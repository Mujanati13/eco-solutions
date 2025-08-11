const { pool } = require('../../config/database');
const googleSheetsService = require('./googleSheets');
const googleAuthService = require('./googleAuth');
const EnhancedExcelProcessor = require('./enhancedExcelProcessor');
const crypto = require('crypto');
const cron = require('node-cron');

class AutoGoogleSheetsImporter {
  constructor() {
    this.googleSheetsService = googleSheetsService;
    this.isRunning = false;
    this.adminUserId = null; // Will be set to admin user ID
    this.processedFiles = new Set(); // Track processed files
  }

  async initialize() {
    try {
      // Get admin user ID for Google authentication
      const [adminUsers] = await pool.query(
        'SELECT id FROM users WHERE role = "admin" AND id = 1 LIMIT 1'
      );
      
      if (adminUsers.length === 0) {
        throw new Error('Admin user not found. Please ensure admin user exists.');
      }
      
      this.adminUserId = adminUsers[0].id;
      console.log(`✅ Auto importer initialized with admin user ID: ${this.adminUserId}`);
      
      // Load previously processed files from database
      await this.loadProcessedFiles();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize auto importer:', error);
      return false;
    }
  }

  async loadProcessedFiles() {
    try {
      // Create enhanced table to track processed files with duplicate prevention
      await pool.query(`
        CREATE TABLE IF NOT EXISTS google_sheets_processed (
          id INT PRIMARY KEY AUTO_INCREMENT,
          spreadsheet_id VARCHAR(255) UNIQUE NOT NULL,
          file_name VARCHAR(500) NOT NULL,
          file_hash VARCHAR(64),
          drive_file_id VARCHAR(255),
          last_modified DATETIME NOT NULL,
          file_size BIGINT DEFAULT 0,
          orders_imported INT DEFAULT 0,
          processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_processed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_spreadsheet_id (spreadsheet_id),
          INDEX idx_file_hash (file_hash),
          INDEX idx_drive_file_id (drive_file_id),
          INDEX idx_last_modified (last_modified),
          INDEX idx_processing_status (processing_status)
        )
      `);

      // Create table to track individual orders and their source files
      await pool.query(`
        CREATE TABLE IF NOT EXISTS order_file_tracking (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_id INT,
          order_number VARCHAR(255),
          source_file_id INT,
          source_spreadsheet_id VARCHAR(255),
          source_file_name VARCHAR(500),
          source_row_number INT,
          imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (source_file_id) REFERENCES google_sheets_processed(id) ON DELETE CASCADE,
          INDEX idx_order_id (order_id),
          INDEX idx_order_number (order_number),
          INDEX idx_source_file_id (source_file_id),
          INDEX idx_source_spreadsheet_id (source_spreadsheet_id),
          UNIQUE KEY unique_order_source (order_number, source_spreadsheet_id)
        )
      `);

      // Load processed file IDs
      const [processed] = await pool.query('SELECT spreadsheet_id FROM google_sheets_processed');
      this.processedFiles = new Set(processed.map(row => row.spreadsheet_id));
      
      console.log(`📂 Loaded ${this.processedFiles.size} previously processed files`);
    } catch (error) {
      console.error('❌ Failed to load processed files:', error);
    }
  }

  /**
   * Generate file hash for duplicate detection
   */
  async generateFileHash(fileContent) {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(fileContent);
      return hash.digest('hex');
    } catch (error) {
      console.error('❌ Error generating file hash:', error);
      return null;
    }
  }

  /**
   * Check if file is duplicate based on content hash
   */
  async isDuplicateFile(fileHash, fileName) {
    if (!fileHash) return false;
    
    try {
      const [existing] = await pool.query(
        'SELECT id, file_name, last_processed FROM google_sheets_processed WHERE file_hash = ?',
        [fileHash]
      );
      
      if (existing.length > 0) {
        console.log(`⚠️ Duplicate file detected: "${fileName}" matches "${existing[0].file_name}" (processed: ${existing[0].last_processed})`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking duplicate file:', error);
      return false;
    }
  }

  /**
   * Track order source in database
   */
  async trackOrderSource(orderData, sourceFileId, sourceSpreadsheetId, sourceFileName, rowNumber) {
    try {
      await pool.query(`
        INSERT INTO order_file_tracking 
        (order_id, order_number, source_file_id, source_spreadsheet_id, source_file_name, source_row_number)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        order_id = VALUES(order_id),
        imported_at = CURRENT_TIMESTAMP
      `, [
        orderData.id || null,
        orderData.order_number,
        sourceFileId,
        sourceSpreadsheetId,
        sourceFileName,
        rowNumber
      ]);
    } catch (error) {
      console.error(`❌ Error tracking order source:`, error);
    }
  }

  async scanAndImportAllFiles() {
    if (this.isRunning) {
      console.log('⏳ Import already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('🔍 Starting automatic Google Sheets scan and import...');

      // Check if admin has Google authentication
      const canAccess = await this.googleSheetsService.canUserAccessSheets(this.adminUserId);
      if (!canAccess) {
        console.log('❌ Admin user not authenticated with Google Sheets');
        return { error: 'Google Sheets access not authorized for admin user' };
      }

      // Get all Google Sheets files
      const sheets = await this.listAllGoogleSheets();
      console.log(`📊 Found ${sheets.length} Google Sheets files`);

      const results = {
        totalFiles: sheets.length,
        processedFiles: 0,
        newFiles: 0,
        totalOrdersImported: 0,
        errors: [],
        processedFileNames: []
      };

      // Process each file
      for (const sheet of sheets) {
        try {
          await this.processSheetFile(sheet, results);
        } catch (error) {
          console.error(`❌ Error processing file ${sheet.name}:`, error);
          results.errors.push(`${sheet.name}: ${error.message}`);
        }
      }

      console.log('✅ Automatic import completed');
      console.log(`📈 Summary: ${results.newFiles} new files, ${results.totalOrdersImported} orders imported`);
      
      return results;

    } catch (error) {
      console.error('❌ Auto import failed:', error);
      return { error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  async listAllGoogleSheets() {
    try {
      const drive = await this.googleSheetsService.getDriveClient(this.adminUserId);

      // Include Google Sheets and Excel; include Shared Drives
      const response = await drive.files.list({
        q: "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed=false",
        fields: 'files(id, name, modifiedTime, size, mimeType)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'allDrives'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('❌ Failed to list Google Sheets:', error);
      throw error;
    }
  }

  async convertXlsxToGoogleSheet(fileId, name) {
    const drive = await this.googleSheetsService.getDriveClient(this.adminUserId);
    const res = await drive.files.copy({
      fileId,
      requestBody: {
        name: `${name} (Converted)`,
        mimeType: 'application/vnd.google-apps.spreadsheet'
      },
      supportsAllDrives: true
    });
    return res.data.id;
  }

  async processSheetFile(sheet, results) {
    let { id: spreadsheetId, name: fileName, modifiedTime, mimeType, size } = sheet;
    console.log(`🔄 Processing: ${fileName} (${(size / 1024).toFixed(1)}KB)`);

    // Check if file should be processed
    if (!this.shouldProcessFile(fileName)) {
      console.log(`⏭️  Skipping: ${fileName} (doesn't match order file pattern)`);
      return;
    }

    // Mark file as processing to prevent duplicate processing
    await pool.query(
      'UPDATE google_sheets_processed SET processing_status = ? WHERE spreadsheet_id = ?',
      ['processing', spreadsheetId]
    );

    try {
      let fileContent = null;
      let fileHash = null;

      // Download file content for hash generation if it's an Excel file
      if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        try {
          const driveClient = await googleAuthService.getDriveClient(this.adminUserId);
          const fileResponse = await driveClient.files.get({
            fileId: spreadsheetId,
            alt: 'media'
          });
          fileContent = fileResponse.data;
          fileHash = await this.generateFileHash(fileContent);
        } catch (error) {
          console.warn(`⚠️ Could not download file for hash generation: ${error.message}`);
        }
      }

      // Check if this is a duplicate file by content hash
      if (fileHash && await this.isDuplicateFile(fileHash, fileName)) {
        console.log(`⏭️ Skipping duplicate file: ${fileName}`);
        await this.markFileAsProcessed(spreadsheetId, fileName, modifiedTime, 0, fileHash, size, 'completed', 'Duplicate file skipped');
        return;
      }

      // Check if file was already processed and hasn't been modified
      const isNewOrModified = await this.isFileNewOrModified(spreadsheetId, modifiedTime, fileContent);
      if (!isNewOrModified) {
        console.log(`⏭️  Skipping: ${fileName} (already processed and not modified)`);
        await pool.query(
          'UPDATE google_sheets_processed SET processing_status = ? WHERE spreadsheet_id = ?',
          ['completed', spreadsheetId]
        );
        return;
      }

      let importResult = { success: false, imported: 0, orders: [] };
      let totalOrdersFromFile = 0;
      let sourceFileId = null;

      // First try enhanced Excel processor for Excel files
      if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        try {
          const enhancedProcessor = new EnhancedExcelProcessor();
          importResult = await enhancedProcessor.processExcelFromGoogleDrive(this.adminUserId, spreadsheetId);
          
          if (importResult.success && importResult.orders && importResult.orders.length > 0) {
            console.log(`✅ Enhanced processor found ${importResult.orders.length} orders from Excel file: ${fileName}`);
            
            // Save orders to database with source tracking
            const saveResult = await this.googleSheetsService.saveOrdersToDatabase(importResult.orders, this.adminUserId);
            
            if (saveResult.success) {
              totalOrdersFromFile = saveResult.imported;
              console.log(`✅ Successfully saved ${totalOrdersFromFile} orders with source tracking from Excel file: ${fileName}`);
              
              // Mark file as processed and get the file record ID
              sourceFileId = await this.markFileAsProcessed(spreadsheetId, fileName, modifiedTime, totalOrdersFromFile, fileHash, size, 'completed');
              
              // Track each order's source using the saved orders (which have database IDs)
              for (let i = 0; i < saveResult.orders.length; i++) {
                await this.trackOrderSource(saveResult.orders[i], sourceFileId, spreadsheetId, fileName, i + 2); // +2 for header row
              }
            } else {
              console.log(`⚠️ Failed to save orders from Excel file: ${fileName}`, saveResult.errors);
              totalOrdersFromFile = 0;
            }
            
          } else {
            console.log(`⚠️ Enhanced processor found no orders in Excel file: ${fileName}, trying conversion...`);
          }
        } catch (enhancedError) {
          console.log(`⚠️ Enhanced processor failed for ${fileName}:`, enhancedError.message);
        }
      }

      // If enhanced processor didn't work or it's a Google Sheet, use fallback approach
      if (!importResult.success || totalOrdersFromFile === 0) {
        // Convert Excel to Google Sheet if needed
        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          try {
            const newId = await this.convertXlsxToGoogleSheet(spreadsheetId, fileName);
            console.log(`✅ Converted Excel to Google Sheet: ${fileName} -> ${newId}`);
            spreadsheetId = newId;
          } catch (e) {
            console.warn(`⚠️ Failed to convert ${fileName}, skipping`, e.message);
            await this.markFileAsProcessed(spreadsheetId, fileName, modifiedTime, 0, fileHash, size, 'failed', e.message);
            return;
          }
        }

        // Get sheet tabs
        const sheetsData = await this.googleSheetsService.getSpreadsheetSheets(this.adminUserId, spreadsheetId);
        
        totalOrdersFromFile = 0;
        
        // Mark file as processed and get the file record ID for tracking
        sourceFileId = await this.markFileAsProcessed(spreadsheetId, fileName, modifiedTime, 0, fileHash, size, 'processing');
        
        // Process each sheet tab
        for (const sheetTab of sheetsData || []) {
          try {
            const sheetRange = `${sheetTab.title}!A:M`; // Extended to M for delivery type
            
            // Import orders from this sheet tab using fallback method
            const tabImportResult = await this.googleSheetsService.importOrdersFromSheet(
              spreadsheetId, 
              sheetRange, 
              this.adminUserId
            );

            if (tabImportResult.success && tabImportResult.imported > 0) {
              totalOrdersFromFile += tabImportResult.imported;
              console.log(`✅ Imported ${tabImportResult.imported} orders from "${fileName}" > "${sheetTab.title}"`);
              
              // Track each order's source if we have order details
              if (tabImportResult.orders) {
                for (let i = 0; i < tabImportResult.orders.length; i++) {
                  await this.trackOrderSource(tabImportResult.orders[i], sourceFileId, spreadsheetId, fileName, i + 2);
                }
              }
            }

            // Log any errors
            if (tabImportResult.errors && tabImportResult.errors.length > 0) {
              results.errors.push(`${fileName} > ${sheetTab.title}: ${tabImportResult.errors.join(', ')}`);
            }

          } catch (error) {
            console.error(`❌ Error processing sheet tab "${sheetTab.title}":`, error);
            results.errors.push(`${fileName} > ${sheetTab.title}: ${error.message}`);
          }
        }

        // Update final status
        await this.markFileAsProcessed(spreadsheetId, fileName, modifiedTime, totalOrdersFromFile, fileHash, size, 'completed');
      }

      // Update results
      results.processedFiles++;
      if (!this.processedFiles.has(spreadsheetId)) {
        results.newFiles++;
      }
      results.totalOrdersImported += totalOrdersFromFile;
      results.processedFileNames.push(`${fileName} (${totalOrdersFromFile} orders)`);

      this.processedFiles.add(spreadsheetId);

      console.log(`✅ Successfully processed "${fileName}": ${totalOrdersFromFile} orders imported`);

    } catch (error) {
      console.error(`❌ Failed to process ${fileName}:`, error);
      
      // Mark file as failed
      await this.markFileAsProcessed(spreadsheetId, fileName, modifiedTime, 0, null, size, 'failed', error.message);
      
      results.errors.push(`${fileName}: ${error.message}`);
      throw error;
    }
  }

  shouldProcessFile(fileName) {
    // Define patterns that indicate this is an order file
    const orderFilePatterns = [
      /order/i,
      /commande/i,
      /cmd/i,
      /livraison/i,
      /delivery/i,
      /client/i,
      /vente/i,
      /sale/i,
      /boutique/i,
      /shop/i,
      // Add your shop's specific naming patterns here
      /^\d{4}-\d{2}-\d{2}/, // Date format like 2025-08-08
      /^CMD\d+/i, // Command reference format
    ];

    return orderFilePatterns.some(pattern => pattern.test(fileName));
  }

  async isFileNewOrModified(spreadsheetId, modifiedTime, fileContent = null) {
    try {
      // Check if file exists in database
      const [existing] = await pool.query(
        'SELECT file_hash, last_modified, processing_status FROM google_sheets_processed WHERE spreadsheet_id = ?',
        [spreadsheetId]
      );

      if (existing.length === 0) {
        console.log(`✅ New file detected: ${spreadsheetId}`);
        return true;
      }

      const existingRecord = existing[0];
      const existingModified = new Date(existingRecord.last_modified);
      const newModified = new Date(modifiedTime);

      // Check if file is currently being processed
      if (existingRecord.processing_status === 'processing') {
        console.log(`⏸️ File already being processed: ${spreadsheetId}`);
        return false;
      }

      // Check modification time
      if (newModified <= existingModified) {
        console.log(`⏭️ File not modified: ${spreadsheetId}`);
        return false;
      }

      // If we have file content, check for duplicate content
      if (fileContent) {
        const newFileHash = await this.generateFileHash(fileContent);
        if (newFileHash && existingRecord.file_hash === newFileHash) {
          console.log(`⏭️ File content unchanged (same hash): ${spreadsheetId}`);
          return false;
        }
      }

      console.log(`🔄 File modified and needs processing: ${spreadsheetId}`);
      return true;

    } catch (error) {
      console.error('❌ Error checking file status:', error);
      return true; // Process on error to be safe
    }
  }

  async markFileAsProcessed(spreadsheetId, fileName, modifiedTime, ordersImported, fileHash = null, fileSize = 0, status = 'completed', errorMessage = null) {
    try {
      // Convert ISO datetime to MySQL format
      const mysqlDateTime = new Date(modifiedTime).toISOString().slice(0, 19).replace('T', ' ');
      
      await pool.query(`
        INSERT INTO google_sheets_processed 
        (spreadsheet_id, file_name, file_hash, drive_file_id, last_modified, file_size, orders_imported, processing_status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          file_name = VALUES(file_name),
          file_hash = VALUES(file_hash),
          last_modified = VALUES(last_modified),
          file_size = VALUES(file_size),
          orders_imported = orders_imported + VALUES(orders_imported),
          processing_status = VALUES(processing_status),
          error_message = VALUES(error_message),
          last_processed = CURRENT_TIMESTAMP
      `, [spreadsheetId, fileName, fileHash, spreadsheetId, mysqlDateTime, fileSize, ordersImported, status, errorMessage]);

      // Get the file record ID for order tracking
      const [fileRecord] = await pool.query(
        'SELECT id FROM google_sheets_processed WHERE spreadsheet_id = ?',
        [spreadsheetId]
      );

      return fileRecord.length > 0 ? fileRecord[0].id : null;
    } catch (error) {
      console.error('❌ Error marking file as processed:', error);
    }
  }

  // Start automatic scanning with cron job
  startAutomaticScanning(cronPattern = '*/5 * * * *') { // Every 5 minutes
    console.log(`🕐 Starting automatic scanning with pattern: ${cronPattern}`);
    
    this.cronJob = cron.schedule(cronPattern, async () => {
      console.log('⏰ Running scheduled Google Sheets import...');
      await this.scanAndImportAllFiles();
    }, {
      scheduled: false // Don't start immediately
    });

    this.cronJob.start();
    console.log('✅ Automatic scanning started');
  }

  stopAutomaticScanning() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('⏹️  Automatic scanning stopped');
    }
  }

  // Manual trigger endpoint
  async triggerManualScan() {
    console.log('🔄 Manual scan triggered');
    return await this.scanAndImportAllFiles();
  }

  // Get processing statistics with enhanced tracking
  async getProcessingStats() {
    try {
      const [stats] = await pool.query(`
        SELECT 
          COUNT(*) as total_files,
          SUM(orders_imported) as total_orders,
          COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed_files,
          COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_files,
          COUNT(CASE WHEN processing_status = 'processing' THEN 1 END) as processing_files,
          MAX(last_processed) as last_import_time,
          AVG(orders_imported) as avg_orders_per_file
        FROM google_sheets_processed
      `);

      const [recentFiles] = await pool.query(`
        SELECT file_name, orders_imported, processing_status, last_processed, error_message, file_size
        FROM google_sheets_processed 
        ORDER BY last_processed DESC 
        LIMIT 10
      `);

      const [duplicates] = await pool.query(`
        SELECT file_hash, COUNT(*) as duplicate_count, GROUP_CONCAT(file_name SEPARATOR ', ') as file_names
        FROM google_sheets_processed 
        WHERE file_hash IS NOT NULL
        GROUP BY file_hash 
        HAVING COUNT(*) > 1
      `);

      return {
        success: true,
        overview: stats[0],
        recentFiles: recentFiles,
        duplicateFiles: duplicates,
        scannerStatus: {
          isRunning: this.isRunning,
          adminUserId: this.adminUserId,
          processedFilesCount: this.processedFiles.size
        }
      };
    } catch (error) {
      console.error('❌ Error getting processing stats:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get order source tracking information
   */
  async getOrderSourceInfo(orderNumber) {
    try {
      const [orderSources] = await pool.query(`
        SELECT 
          oft.order_number,
          oft.source_file_name,
          oft.source_spreadsheet_id,
          oft.source_row_number,
          oft.imported_at,
          gsp.file_hash,
          gsp.last_modified,
          gsp.processing_status
        FROM order_file_tracking oft
        JOIN google_sheets_processed gsp ON oft.source_file_id = gsp.id
        WHERE oft.order_number = ?
        ORDER BY oft.imported_at DESC
      `, [orderNumber]);

      return {
        success: true,
        sources: orderSources
      };
    } catch (error) {
      console.error('❌ Error getting order source info:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get all orders from a specific file
   */
  async getOrdersFromFile(spreadsheetId) {
    try {
      const [orders] = await pool.query(`
        SELECT 
          oft.order_number,
          oft.source_row_number,
          oft.imported_at,
          gsp.file_name,
          gsp.orders_imported as total_orders_in_file
        FROM order_file_tracking oft
        JOIN google_sheets_processed gsp ON oft.source_file_id = gsp.id
        WHERE oft.source_spreadsheet_id = ?
        ORDER BY oft.source_row_number ASC
      `, [spreadsheetId]);

      return {
        success: true,
        orders: orders
      };
    } catch (error) {
      console.error('❌ Error getting orders from file:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = AutoGoogleSheetsImporter;
