const { pool } = require('../config/database');

/**
 * Migration to fix google_sheets_processed table schema
 * Ensures the table has the correct columns and no missing fields
 */
async function fixGoogleSheetsProcessedTable() {
  console.log('🔧 Running migration: Fix google_sheets_processed table schema');
  
  try {
    // Check if table exists
    const [tables] = await pool.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'google_sheets_processed'"
    );
    
    if (tables.length === 0) {
      console.log('📊 Creating google_sheets_processed table...');
      // Create the table with correct schema
      await pool.query(`
        CREATE TABLE google_sheets_processed (
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
      console.log('✅ google_sheets_processed table created');
    } else {
      console.log('📊 google_sheets_processed table exists, checking schema...');
      
      // Check existing columns
      const [columns] = await pool.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'google_sheets_processed'"
      );
      
      const existingColumns = columns.map(col => col.COLUMN_NAME);
      console.log('📋 Existing columns:', existingColumns);
      
      // Required columns that should exist
      const requiredColumns = [
        'id', 'spreadsheet_id', 'file_name', 'file_hash', 'drive_file_id',
        'last_modified', 'file_size', 'orders_imported', 'processing_status',
        'error_message', 'created_at', 'last_processed'
      ];
      
      // Check for missing columns and add them
      for (const column of requiredColumns) {
        if (!existingColumns.includes(column)) {
          console.log(`➕ Adding missing column: ${column}`);
          
          switch (column) {
            case 'file_hash':
              await pool.query('ALTER TABLE google_sheets_processed ADD COLUMN file_hash VARCHAR(64)');
              break;
            case 'drive_file_id':
              await pool.query('ALTER TABLE google_sheets_processed ADD COLUMN drive_file_id VARCHAR(255)');
              break;
            case 'file_size':
              await pool.query('ALTER TABLE google_sheets_processed ADD COLUMN file_size BIGINT DEFAULT 0');
              break;
            case 'orders_imported':
              await pool.query('ALTER TABLE google_sheets_processed ADD COLUMN orders_imported INT DEFAULT 0');
              break;
            case 'processing_status':
              await pool.query("ALTER TABLE google_sheets_processed ADD COLUMN processing_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending'");
              break;
            case 'error_message':
              await pool.query('ALTER TABLE google_sheets_processed ADD COLUMN error_message TEXT');
              break;
            case 'last_processed':
              await pool.query('ALTER TABLE google_sheets_processed ADD COLUMN last_processed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
              break;
            default:
              console.log(`⚠️ Unknown column ${column}, skipping...`);
          }
        }
      }
      
      // Remove any invalid 'updated_at' column if it exists (this was the bug)
      if (existingColumns.includes('updated_at')) {
        console.log('🗑️ Removing incorrect updated_at column...');
        await pool.query('ALTER TABLE google_sheets_processed DROP COLUMN updated_at');
      }
      
      // Add missing indexes
      try {
        await pool.query('CREATE INDEX IF NOT EXISTS idx_spreadsheet_id ON google_sheets_processed (spreadsheet_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_file_hash ON google_sheets_processed (file_hash)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_drive_file_id ON google_sheets_processed (drive_file_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_last_modified ON google_sheets_processed (last_modified)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_processing_status ON google_sheets_processed (processing_status)');
        console.log('📊 Indexes verified/created');
      } catch (indexError) {
        console.log('⚠️ Some indexes might already exist, continuing...');
      }
    }
    
    // Ensure order_file_tracking table exists with correct foreign key
    console.log('📊 Checking order_file_tracking table...');
    const [trackingTables] = await pool.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_file_tracking'"
    );
    
    if (trackingTables.length === 0) {
      console.log('📊 Creating order_file_tracking table...');
      await pool.query(`
        CREATE TABLE order_file_tracking (
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
      console.log('✅ order_file_tracking table created');
    }
    
    console.log('✅ Migration completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Export for use in migration runner
module.exports = { fixGoogleSheetsProcessedTable };

// Run immediately if called directly
if (require.main === module) {
  fixGoogleSheetsProcessedTable()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}