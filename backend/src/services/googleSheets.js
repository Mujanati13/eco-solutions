const { google } = require('googleapis');
const googleAuthService = require('./googleAuth');
const DeliveryPricingService = require('./deliveryPricingService');

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  }

  // Get authenticated sheets client for a user
  async getSheetsClient(userId) {
    return await googleAuthService.getSheetsClient(userId);
  }

  // Get authenticated drive client for a user
  async getDriveClient(userId) {
    const auth = await googleAuthService.getAuthenticatedClient(userId);
    return google.drive({ version: 'v3', auth });
  }

  // List all Google Sheets files accessible to the user
  async listUserGoogleSheets(userId) {
    try {
      const drive = await this.getDriveClient(userId);
      
      console.log('🔍 Searching for Google Sheets files...');
      
      // Try multiple queries to find sheets
      const queries = [
        // All spreadsheet files (most comprehensive)
        "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        // Files you own
        "mimeType='application/vnd.google-apps.spreadsheet' and 'me' in owners and trashed=false",
        // Files shared with you
        "mimeType='application/vnd.google-apps.spreadsheet' and sharedWithMe=true and trashed=false",
        // Recent files (last 7 days)
        `mimeType='application/vnd.google-apps.spreadsheet' and modifiedTime > '${new Date(Date.now() - 7*24*60*60*1000).toISOString()}' and trashed=false`,
        // Just try without any filters except MIME type
        "mimeType='application/vnd.google-apps.spreadsheet'"
      ];
      
      let allFiles = [];
      
      for (const [index, query] of queries.entries()) {
        try {
          console.log(`📋 Query ${index + 1}: ${query}`);
          
          const response = await drive.files.list({
            q: query,
            fields: 'files(id, name, createdTime, modifiedTime, webViewLink, owners, shared, parents, mimeType)',
            orderBy: 'modifiedTime desc',
            pageSize: 100,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true
          });
          
          console.log(`📄 Query ${index + 1} found ${response.data.files.length} files`);
          
          if (response.data.files.length > 0) {
            // Log first few files for debugging
            response.data.files.slice(0, 3).forEach(file => {
              console.log(`  📋 Found: "${file.name}" (ID: ${file.id})`);
            });
            allFiles = allFiles.concat(response.data.files);
          }
        } catch (queryError) {
          console.error(`❌ Error with query ${index + 1}:`, queryError.message);
        }
      }

      // Also try a very basic search without any filters
      try {
        console.log('🔍 Trying basic search without filters...');
        const basicResponse = await drive.files.list({
          pageSize: 50,
          fields: 'files(id, name, mimeType, createdTime, modifiedTime)',
          orderBy: 'modifiedTime desc'
        });
        
        console.log(`📁 Basic search found ${basicResponse.data.files.length} total files`);
        
        // Filter for spreadsheets
        const spreadsheets = basicResponse.data.files.filter(file => 
          file.mimeType === 'application/vnd.google-apps.spreadsheet'
        );
        
        console.log(`📊 Spreadsheets from basic search: ${spreadsheets.length}`);
        
        if (spreadsheets.length > 0) {
          allFiles = allFiles.concat(spreadsheets);
        }
      } catch (basicError) {
        console.error('❌ Basic search failed:', basicError.message);
      }

      // Remove duplicates based on file ID
      const uniqueFiles = allFiles.filter((file, index, self) => 
        index === self.findIndex(f => f.id === file.id)
      );

      console.log(`✅ Total unique Google Sheets found: ${uniqueFiles.length}`);

      if (uniqueFiles.length > 0) {
        console.log('📋 Files found:');
        uniqueFiles.forEach((file, i) => {
          console.log(`  ${i + 1}. "${file.name}" (${file.id}) - Modified: ${file.modifiedTime}`);
        });
      }

      return uniqueFiles.map(file => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        isOwner: file.owners && file.owners.some(owner => owner.me),
        isShared: file.shared || false
      }));
    } catch (error) {
      console.error('Error listing Google Sheets:', error);
      throw new Error(`Failed to list Google Sheets files: ${error.message}`);
    }
  }

  // Get sheets within a specific Google Sheets file
  // Get sheets within a specific Google Sheets file
  async getSpreadsheetSheets(userId, spreadsheetId) {
    try {
      const sheets = await this.getSheetsClient(userId);
      
      const response = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        fields: 'sheets.properties'
      });

      return response.data.sheets.map(sheet => ({
        sheetId: sheet.properties.sheetId,
        title: sheet.properties.title,
        index: sheet.properties.index,
        rowCount: sheet.properties.gridProperties?.rowCount || 0,
        columnCount: sheet.properties.gridProperties?.columnCount || 0
      }));
    } catch (error) {
      console.error('Error getting spreadsheet sheets:', error);
      throw new Error('Failed to get spreadsheet sheets');
    }
  }

  // Alias for getSpreadsheetSheets (for API consistency)
  async getSpreadsheetTabs(userId, spreadsheetId) {
    return await this.getSpreadsheetSheets(userId, spreadsheetId);
  }

  // Preview data from a specific sheet
  async previewSheetData(userId, spreadsheetId, sheetName = 'Sheet1', range = 'A1:L10') {
    try {
      const sheets = await this.getSheetsClient(userId);
      
      const fullRange = sheetName ? `${sheetName}!${range}` : range;
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: fullRange
      });

      return {
        range: response.data.range,
        values: response.data.values || [],
        majorDimension: response.data.majorDimension
      };
    } catch (error) {
      console.error('Error previewing sheet data:', error);
      throw new Error('Failed to preview sheet data');
    }
  }

  // Alias for previewSheetData (for API consistency)
  async getSheetData(userId, spreadsheetId, range) {
    return await this.previewSheetData(userId, spreadsheetId, null, range);
  }

  // Map French delivery type text to database enum values
  mapDeliveryType(deliveryTypeText) {
    if (!deliveryTypeText || typeof deliveryTypeText !== 'string') {
      return 'home'; // default value
    }

    const type = deliveryTypeText.toLowerCase().trim();
    
    // Map French delivery types to enum values
    if (type.includes('stop desk') || type.includes('stopdesk') || type.includes('stop-desk')) {
      return 'pickup_point';
    } else if (type.includes('domicile') || type.includes('home') || type.includes('maison')) {
      return 'home';
    } else if (type.includes('bureau') || type.includes('office') || type.includes('travail')) {
      return 'office';
    } else if (type.includes('express') || type.includes('rapide')) {
      return 'express';
    } else if (type.includes('standard') || type.includes('normal')) {
      return 'standard';
    } else if (type.includes('overnight') || type.includes('nuit')) {
      return 'overnight';
    } else if (type.includes('weekend') || type.includes('week-end')) {
      return 'weekend';
    } else if (type.includes('economy') || type.includes('economique')) {
      return 'economy';
    } else if (type.includes('les changes') || type.includes('les_changes')) {
      return 'les_changes';
    } else {
      // Default to home delivery if type not recognized
      return 'home';
    }
  }

  // Import orders from a Google Sheet
  async importOrdersFromSheet(spreadsheetId, sheetRange, userId) {
    try {
      const sheets = await this.getSheetsClient(userId);
      const { pool } = require('../../config/database');
      
      // Get all data from the sheet
      const range = sheetRange || 'Orders!A2:M'; // Extended to column M for delivery_type
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range
      });

      const rows = response.data.values || [];
      
      if (rows.length < 2) {
        return {
          success: false,
          message: 'No data found to import',
          imported: 0,
          errors: []
        };
      }

      // Assume first row is headers
      const headers = rows[0];
      const dataRows = rows.slice(1);
      
      const imported = [];
      const errors = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNumber = i + 2; // +2 because we skip header and array is 0-indexed
        
        try {
          // Map row data to order fields - French Excel format
          const orderData = {
            order_number: row[0] || `IMPORT-${Date.now()}-${i}`, // reference commande
            customer_name: row[1] || '', // nom et prenom du client
            customer_phone: row[2] || '', // telephone (obligatoire)
            customer_phone_2: row[3] || '', // telephone 2
            customer_address: row[4] || '', // adresse de livraison
            customer_city: row[5] || '', // commune de livraison
            total_amount: parseFloat(String(row[6]).replace(/[^\d.-]/g, '')) || 0, // montant du colis
            wilaya_code: row[7] || '', // code wilaya
            product_details: row[8] || '', // produit
            notes: row[9] || '', // remarque
            weight: parseFloat(row[10]) || 0, // poids (en kg)
            metro_delivery: row[11] && String(row[11]).toLowerCase().includes('oui') ? 1 : 0, // metro delivery (0 or 1)
            delivery_type: this.mapDeliveryType(row[12] || ''), // Type de Livraison
            status: 'pending',
            payment_status: 'cod_pending'
          };

          // Validate required fields based on French format
          if (!orderData.customer_name) {
            errors.push(`Row ${rowNumber}: Missing customer name (nom et prenom du client)`);
            continue;
          }
          
          if (!orderData.customer_phone) {
            errors.push(`Row ${rowNumber}: Missing phone number (telephone)`);
            continue;
          }
          
          if (!orderData.total_amount || orderData.total_amount <= 0) {
            errors.push(`Row ${rowNumber}: Missing or invalid package amount (montant du colis)`);
            continue;
          }
          
          if (!orderData.wilaya_code) {
            errors.push(`Row ${rowNumber}: Missing wilaya code (code wilaya)`);
            continue;
          }

          // Create product details JSON
          const productInfo = {
            name: orderData.product_details,
            weight: orderData.weight,
            metro_delivery: orderData.metro_delivery
          };

          // Look up wilaya_id from wilaya_code for proper database relationships
          let wilayaId = null;
          if (orderData.wilaya_code) {
            try {
              // First try to find by exact code match
              const [wilayaResult] = await pool.query(
                'SELECT id FROM wilayas WHERE code = ?',
                [orderData.wilaya_code]
              );
              
              if (wilayaResult.length > 0) {
                wilayaId = wilayaResult[0].id;
              } else {
                // If no exact match, try to find by partial name match
                const [wilayaNameResult] = await pool.query(
                  'SELECT id FROM wilayas WHERE LOWER(name_fr) LIKE ? OR LOWER(name_en) LIKE ? OR code = ?',
                  [`%${orderData.wilaya_code.toLowerCase()}%`, `%${orderData.wilaya_code.toLowerCase()}%`, orderData.wilaya_code.padStart(2, '0')]
                );
                
                if (wilayaNameResult.length > 0) {
                  wilayaId = wilayaNameResult[0].id;
                }
              }
            } catch (wilayaError) {
              console.warn(`Could not resolve wilaya_id for code: ${orderData.wilaya_code}`, wilayaError);
            }
          }

          // Look up baladia_id from customer_city for proper database relationships
          let baladiaId = null;
          if (orderData.customer_city && orderData.customer_city.trim()) {
            try {
              // First try to find by exact code match (if customer_city contains a code)
              const [baladiaCodeResult] = await pool.query(
                'SELECT id FROM baladias WHERE code = ?',
                [orderData.customer_city.trim()]
              );
              
              if (baladiaCodeResult.length > 0) {
                baladiaId = baladiaCodeResult[0].id;
              } else {
                // If no exact code match, try to find by name match
                const cityName = orderData.customer_city.trim().toLowerCase();
                let baladiaNameQuery = `
                  SELECT id FROM baladias 
                  WHERE LOWER(name_ar) LIKE ? OR LOWER(name_fr) LIKE ? OR LOWER(name_en) LIKE ?
                `;
                let queryParams = [`%${cityName}%`, `%${cityName}%`, `%${cityName}%`];
                
                // If we have a wilaya_id, restrict baladia search to that wilaya
                if (wilayaId) {
                  baladiaNameQuery += ' AND wilaya_id = ?';
                  queryParams.push(wilayaId);
                }
                
                baladiaNameQuery += ' LIMIT 1';
                
                const [baladiaNameResult] = await pool.query(baladiaNameQuery, queryParams);
                
                if (baladiaNameResult.length > 0) {
                  baladiaId = baladiaNameResult[0].id;
                }
              }
            } catch (baladiaError) {
              console.warn(`Could not resolve baladia_id for city: ${orderData.customer_city}`, baladiaError);
            }
          }

          // Calculate delivery price based on wilaya and delivery type
          let deliveryPrice = 0;
          if (wilayaId) {
            try {
              const pricingResult = await DeliveryPricingService.calculateDeliveryPrice(
                wilayaId,
                orderData.delivery_type || 'home',
                orderData.weight || 1.0,
                0 // volume - default to 0
              );
              deliveryPrice = pricingResult.price;
              console.log(`✅ Calculated delivery price for wilaya ${wilayaId}: ${deliveryPrice} DA`);
            } catch (pricingError) {
              console.warn(`Could not calculate delivery price for wilaya ${wilayaId}:`, pricingError);
              // Use default pricing if calculation fails
              deliveryPrice = 500; // Default delivery price
            }
          } else {
            // Default pricing when no wilaya found
            deliveryPrice = 500;
          }

          // Insert into database with French format mapping
          const [result] = await pool.query(`
            INSERT INTO orders (
              order_number, customer_name, customer_phone, customer_address,
              customer_city, product_details, total_amount, status,
              payment_status, notes, created_at, assigned_to,
              wilaya_code, wilaya_id, baladia_id, weight, metro_delivery, delivery_type, delivery_price
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            orderData.order_number,
            orderData.customer_name,
            orderData.customer_phone,
            orderData.customer_address,
            orderData.customer_city,
            JSON.stringify(productInfo),
            orderData.total_amount,
            orderData.status,
            orderData.payment_status,
            orderData.notes,
            null, // assigned_to - NOT assigned to anyone
            orderData.wilaya_code,
            wilayaId, // resolved wilaya_id for proper relationships
            baladiaId, // resolved baladia_id for proper relationships
            orderData.weight,
            orderData.metro_delivery,
            orderData.delivery_type,
            deliveryPrice // calculated delivery price
          ]);

          imported.push({
            id: result.insertId,
            order_number: orderData.order_number,
            customer_name: orderData.customer_name,
            total_amount: orderData.total_amount
          });

        } catch (error) {
          console.error(`Error importing row ${rowNumber}:`, error);
          errors.push(`Row ${rowNumber}: ${error.message}`);
        }
      }

      return {
        success: true,
        message: `Successfully imported ${imported.length} orders`,
        imported: imported.length,
        total: dataRows.length,
        errors: errors,
        importedOrders: imported.slice(0, 10) // Return first 10 for preview
      };

    } catch (error) {
      console.error('Error importing orders from sheet:', error);
      throw new Error('Failed to import orders from Google Sheet');
    }
  }

  // Check if user can access Google Sheets
  async canUserAccessSheets(userId) {
    return await googleAuthService.isUserAuthenticated(userId);
  }

  // Get basic sheet info (for existing spreadsheet functionality)
  async getSheetInfo(userId) {
    try {
      const sheets = await this.getSheetsClient(userId);

      if (!this.spreadsheetId) {
        throw new Error('No spreadsheet ID configured');
      }

      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      return {
        title: response.data.properties.title,
        sheets: response.data.sheets.map(sheet => ({
          title: sheet.properties.title,
          sheetId: sheet.properties.sheetId,
          gridProperties: sheet.properties.gridProperties
        }))
      };
    } catch (error) {
      console.error('❌ Failed to get sheet info:', error.message);
      throw error;
    }
  }

  // Export orders to Google Sheets (existing functionality)
  async exportOrders(userId, orders) {
    try {
      const sheets = await this.getSheetsClient(userId);

      if (!this.spreadsheetId) {
        throw new Error('No spreadsheet ID configured');
      }

      const values = orders.map(order => [
        order.order_number,
        order.customer_name,
        order.customer_phone,
        order.customer_address,
        order.customer_city,
        JSON.stringify(order.product_details),
        order.total_amount,
        order.status,
        order.payment_status,
        new Date(order.created_at).toISOString(),
        order.delivery_date || '',
        order.notes || '',
        order.delivery_type || 'home' // Type de Livraison
      ]);

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Orders!A:M', // Extended to column M for delivery_type
        valueInputOption: 'RAW',
        resource: {
          values
        }
      });

      console.log('✅ Orders exported to Google Sheets');
      return response.data;
    } catch (error) {
      console.error('❌ Failed to export orders:', error.message);
      throw error;
    }
  }
}

module.exports = new GoogleSheetsService();
