const { google } = require('googleapis');
const googleAuthService = require('./googleAuth');
const DeliveryPricingService = require('./deliveryPricingService');
const EnhancedExcelProcessor = require('./enhancedExcelProcessor');

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
    return await googleAuthService.getDriveClient(userId);
  }

  // Create a new spreadsheet
  async createSpreadsheet(userId, title) {
    try {
      const sheets = await this.getSheetsClient(userId);
      
      const resource = {
        properties: {
          title: title
        },
        sheets: [{
          properties: {
            title: 'Orders',
            gridProperties: {
              rowCount: 1000,
              columnCount: 20
            }
          }
        }]
      };

      const response = await sheets.spreadsheets.create({
        resource: resource
      });

      return {
        success: true,
        spreadsheetId: response.data.spreadsheetId,
        spreadsheetUrl: response.data.spreadsheetUrl
      };
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      throw new Error('Failed to create spreadsheet');
    }
  }

  // Get spreadsheet metadata
  async getSpreadsheetMetadata(userId, spreadsheetId) {
    try {
      const sheets = await this.getSheetsClient(userId);
      
      const response = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        fields: 'properties,sheets.properties'
      });

      return {
        title: response.data.properties.title,
        spreadsheetId: response.data.spreadsheetId,
        sheets: response.data.sheets.map(sheet => ({
          sheetId: sheet.properties.sheetId,
          title: sheet.properties.title,
          index: sheet.properties.index,
          rowCount: sheet.properties.gridProperties?.rowCount || 0,
          columnCount: sheet.properties.gridProperties?.columnCount || 0
        }))
      };
    } catch (error) {
      console.error('Error getting spreadsheet metadata:', error);
      throw new Error('Failed to get spreadsheet metadata');
    }
  }

  // Get list of sheets in a spreadsheet
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

  // Read data from a specific range
  async readSheetData(userId, spreadsheetId, range) {
    try {
      const sheets = await this.getSheetsClient(userId);
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range
      });

      return {
        values: response.data.values || [],
        range: response.data.range
      };
    } catch (error) {
      console.error('Error reading sheet data:', error);
      throw new Error('Failed to read sheet data');
    }
  }

  // Write data to a specific range
  async writeSheetData(userId, spreadsheetId, range, values) {
    try {
      const sheets = await this.getSheetsClient(userId);
      
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: range,
        valueInputOption: 'RAW',
        resource: {
          values: values
        }
      });

      return {
        success: true,
        updatedCells: response.data.updatedCells,
        updatedRows: response.data.updatedRows
      };
    } catch (error) {
      console.error('Error writing sheet data:', error);
      throw new Error('Failed to write sheet data');
    }
  }

  // Save orders to database with source tracking (for enhanced Excel processor)
  async saveOrdersToDatabase(orders, userId) {
    try {
      const { pool } = require('../../config/database');
      const DeliveryPricingService = require('./deliveryPricingService');
      
      const imported = [];
      const errors = [];

      for (let i = 0; i < orders.length; i++) {
        const orderData = orders[i];
        
        try {
          // Resolve wilaya and baladia information
          let wilayaId = null;
          let baladiaId = null;
          let wilayaName = orderData.wilaya_name || '';
          let resolvedWilayaCode = orderData.wilaya_code || null;

          // Look up wilaya by code or name
          if (orderData.wilaya_code) {
            const [wilayaByCode] = await pool.query('SELECT id, name FROM wilayas WHERE code = ?', [orderData.wilaya_code]);
            if (wilayaByCode.length > 0) {
              wilayaId = wilayaByCode[0].id;
              wilayaName = wilayaByCode[0].name;
            }
          } else if (orderData.wilaya_name) {
            const [wilayaByName] = await pool.query('SELECT id, code FROM wilayas WHERE name LIKE ?', [`%${orderData.wilaya_name}%`]);
            if (wilayaByName.length > 0) {
              wilayaId = wilayaByName[0].id;
              resolvedWilayaCode = wilayaByName[0].code;
            }
          }

          // Look up baladia if provided
          if (orderData.baladia_name && wilayaId) {
            const [baladiaByName] = await pool.query(`
              SELECT id FROM baladias 
              WHERE wilaya_id = ? AND (
                name_ar LIKE ? OR 
                name_fr LIKE ? OR 
                name_en LIKE ?
              )
            `, [wilayaId, `%${orderData.baladia_name}%`, `%${orderData.baladia_name}%`, `%${orderData.baladia_name}%`]);
            
            if (baladiaByName.length > 0) {
              baladiaId = baladiaByName[0].id;
            }
          }

          // Set default delivery type
          const deliveryType = orderData.delivery_type || 'home';
          
          // Build product info
          const productInfo = {
            name: orderData.product_details || orderData.product_name || 'Unknown Product',
            variant: orderData.product_variant || '',
            price: orderData.total_amount || 0
          };

          // Check for duplicate orders
          let isDuplicate = false;
          let existingOrderId = null;
          let duplicateReason = '';
          
          // First check by order number if it exists
          if (orderData.order_number && orderData.order_number.trim() !== '') {
            const [orderCheck] = await pool.query(
              'SELECT id FROM orders WHERE order_number = ? LIMIT 1', 
              [orderData.order_number]
            );
            if (orderCheck.length > 0) {
              isDuplicate = true;
              existingOrderId = orderCheck[0].id;
              duplicateReason = `order number: ${orderData.order_number}`;
            }
          } else {
            // If no order number, check by customer details to prevent duplicates
            if (orderData.customer_phone && orderData.customer_name) {
              const [customerCheck] = await pool.query(`
                SELECT id FROM orders 
                WHERE customer_phone = ? 
                AND customer_name = ? 
                AND ABS(total_amount - ?) < 0.01
                AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                LIMIT 1
              `, [orderData.customer_phone, orderData.customer_name, orderData.total_amount || 0]);
              
              if (customerCheck.length > 0) {
                isDuplicate = true;
                existingOrderId = customerCheck[0].id;
                duplicateReason = `customer details: ${orderData.customer_name} (${orderData.customer_phone})`;
              }
            }
          }
          
          if (isDuplicate) {
            console.log(`🔄 Skipping duplicate order by ${duplicateReason} (Order ID: ${existingOrderId})`);
          }
          
          // Skip if duplicate found
          if (isDuplicate) {
            console.log(`⏭️ Order already exists, skipping: ${duplicateReason}`);
            continue;
          }

          // Generate order number if not provided (for orders without order numbers)
          const finalOrderNumber = orderData.order_number && orderData.order_number.trim() !== '' 
            ? orderData.order_number 
            : `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

          // Determine pricing level
          const pricingLevel = baladiaId ? 'baladia' : 'wilaya';

          // Insert into database with source tracking
          const [result] = await pool.query(`
            INSERT INTO orders (
              order_number, customer_name, customer_phone, customer_phone_2,
              customer_address, customer_city, product_details, total_amount, status,
              payment_status, notes, created_at, assigned_to,
              wilaya_code, wilaya_id, baladia_id, baladia_name, weight, delivery_type, delivery_price, pricing_level,
              source_spreadsheet_id, source_sheet_name, source_file_name, ecotrack_tracking_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            finalOrderNumber,
            orderData.customer_name,
            orderData.customer_phone,
            orderData.customer_phone_2 || '',
            orderData.customer_address,
            wilayaName || 'Unknown',
            JSON.stringify(productInfo),
            orderData.total_amount,
            orderData.status || 'pending',
            orderData.payment_status || 'unpaid',
            orderData.notes || '',
            null, // assigned_to
            resolvedWilayaCode,
            wilayaId,
            baladiaId,
            orderData.baladia_name || '',
            orderData.weight || 1.0,
            deliveryType,
            orderData.total_amount,
            pricingLevel,
            orderData.source_spreadsheet_id || null,
            orderData.source_sheet_name || null,
            orderData.source_file_name || null
          ]);

          const actualOrderNumber = finalOrderNumber;
          console.log(`✅ Successfully saved order ${actualOrderNumber} with source tracking`);

          imported.push({
            id: result.insertId,
            order_number: actualOrderNumber,
            customer_name: orderData.customer_name,
            total_amount: orderData.total_amount
          });

        } catch (error) {
          console.error(`❌ Error saving order ${orderData.order_number}:`, error);
          errors.push(`Order ${orderData.order_number}: ${error.message}`);
        }
      }

      return {
        success: true,
        message: `Successfully saved ${imported.length} orders with source tracking`,
        imported: imported.length,
        total: orders.length,
        errors: errors,
        orders: imported
      };

    } catch (error) {
      console.error('❌ Error saving orders to database:', error);
      throw new Error('Failed to save orders to database');
    }
  }

  // Import orders from Google Sheet with enhanced Excel processing and multilingual baladia support
  async importOrdersFromSheet(spreadsheetId, sheetRange, userId) {
    try {
      // First try to process as Excel file using enhanced processor
      try {
        const enhancedProcessor = new EnhancedExcelProcessor();
        const driveResult = await enhancedProcessor.processExcelFromGoogleDrive(userId, spreadsheetId);
        
        if (driveResult.success && driveResult.orders && driveResult.orders.length > 0) {
          console.log(`Enhanced processor found ${driveResult.orders.length} orders from Google Drive`);
          return driveResult;
        }
      } catch (enhancedError) {
        console.log('Enhanced processor failed, falling back to Sheets API:', enhancedError.message);
      }

      // Fallback to existing Google Sheets API processing
      const sheets = await this.getSheetsClient(userId);
      const { pool } = require('../../config/database');
      
      // Get spreadsheet metadata to retrieve file name
      let fileName = 'Unknown';
      try {
        const metadata = await sheets.spreadsheets.get({
          spreadsheetId: spreadsheetId,
          fields: 'properties.title'
        });
        fileName = metadata.data.properties.title || 'Unknown';
      } catch (metaError) {
        console.warn('Could not retrieve spreadsheet title:', metaError.message);
      }
      
      // Get all data from the sheet (A-N columns based on the provided Excel format)
      const range = sheetRange || 'Sheet1!A2:N'; // A-N columns as per Excel screenshot
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        return {
          success: false,
          message: 'No data found to import',
          imported: 0,
          errors: []
        };
      }

      const imported = [];
      const errors = [];

      // Process each row with proper try-catch structure
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // Excel row number (1-indexed + header)

        try {
          // Map Excel columns to order data (A–Q format from provided sample)
          const orderData = {
            order_number: row[0] && String(row[0]).trim() !== '' ? String(row[0]).trim() : `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // A: Order ID (generate if empty)
            customer_name: row[1] ? String(row[1]).trim() : '', // B: Full name
            customer_phone: row[2] ? String(row[2]).trim() : '', // C: Phone
            customer_phone_2: row[3] ? String(row[3]).trim() : '', // D: phone 2
            customer_address: row[4] ? String(row[4]).trim() : '', // E: Address 1
            baladia_name: row[5] ? String(row[5]).trim() : '', // F: البلدية (Baladia)
            variant_price: row[6] !== undefined && row[6] !== null ? String(row[6]).trim() : '', // G: Variant price (number)
            wilaya_text: row[7] ? String(row[7]).trim() : '', // H: الولاية (e.g., "09 - Blida")
            product_name: row[8] ? String(row[8]).trim() : '', // I: Product name
            product_variant: row[9] ? String(row[9]).trim() : '', // J: Product variant
            notes: row[10] ? String(row[10]).trim() : '', // K: remarque
            weight: row[11] ? parseFloat(String(row[11]).replace(/[^\d.,]/g, '').replace(',', '.')) || 1.0 : 1.0, // L: poids
            pick_up: row[12] ? String(row[12]).trim() : '', // M: PICK UP
            echange: row[13] ? String(row[13]).trim() : '', // N: ECHANGE
            stop_desk: row[14] ? String(row[14]).trim() : '', // O: STOP DESK
            open_package: row[15] ? String(row[15]).trim() : '', // P: Ouvrir le colis
            station_code: row[16] ? String(row[16]).trim() : '', // Q: Code de station
            status: 'pending',
            payment_status: 'unpaid',
            // Add source tracking information
            source_spreadsheet_id: spreadsheetId,
            source_sheet_name: sheetRange.split('!')[0] || 'Sheet1',
            source_file_name: fileName
          };

          // Normalize textual fields to handle entities like &#39; and accents
          orderData.customer_name = this.normalizeText(orderData.customer_name);
          orderData.customer_address = this.normalizeText(orderData.customer_address);
          orderData.baladia_name = this.normalizeText(orderData.baladia_name);
          orderData.wilaya_text = this.normalizeText(orderData.wilaya_text);
          orderData.product_name = this.normalizeText(orderData.product_name);
          orderData.product_variant = this.normalizeText(orderData.product_variant);
          orderData.notes = this.normalizeText(orderData.notes);

          // Fix weight parsing to allow 0 and only default when NaN
          {
            const raw = row[11];
            const w = parseFloat(String(raw ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
            orderData.weight = Number.isFinite(w) ? w : 1.0;
          }

          // Parse price from Variant price (G) and wilaya code/name from Wilaya (H)
          let wilayaName = '';
          let wilayaCode = '';
          let parsedPrice = 0;
          let detectedBaladiaName = orderData.baladia_name || '';
          let wilayaId = null; // declare early to avoid TDZ when used below

          // Price: prefer numeric from G (Variant price)
          if (orderData.variant_price) {
            const numeric = orderData.variant_price.toString().match(/\d+(?:[.,]\d{2})?/);
            if (numeric) {
              parsedPrice = parseFloat(numeric[0].replace(',', '.')) || 0;
            }
          }

          // Wilaya: parse from H like "09 - Blida" or just name
          if (orderData.wilaya_text) {
            const text = orderData.wilaya_text.toString().trim();
            // If it starts with NN - Name
            const codeMatch = text.match(/^(\d{1,2})\s*[-\s]+(.+)$/);
            if (codeMatch) {
              wilayaCode = codeMatch[1].padStart(2, '0');
              wilayaName = codeMatch[2].trim();
            } else {
              // Otherwise, treat as name only
              wilayaName = text;
            }
          }

          // If no price found yet, try to extract from product variant text
          if (parsedPrice === 0 && orderData.product_variant) {
            const variantPriceMatch = orderData.product_variant.toString().match(/(\d+(?:[.,]\d{2})?)/);
            if (variantPriceMatch) {
              parsedPrice = parseFloat(variantPriceMatch[1].replace(',', '.'));
            }
          }

          // Determine delivery type based on the delivery options
          let deliveryType = 'home'; // default
          if (orderData.stop_desk && orderData.stop_desk.toLowerCase().includes('oui')) {
            deliveryType = 'pickup_point';
          } else if (orderData.pick_up && orderData.pick_up.toLowerCase().includes('oui')) {
            deliveryType = 'pickup_point';
          } else if (orderData.echange && orderData.echange.toLowerCase().includes('oui')) {
            deliveryType = 'les_changes';
          }

          // Use parsed price as total amount
          orderData.total_amount = parsedPrice;

          // Validate required fields
          if (!orderData.customer_name) {
            errors.push(`Row ${rowNumber}: Missing customer name (Full name)`);
            continue;
          }
          if (!orderData.customer_phone) {
            errors.push(`Row ${rowNumber}: Missing phone number`);
            continue;
          }
          if (!orderData.total_amount || orderData.total_amount <= 0) {
            errors.push(`Row ${rowNumber}: Missing or invalid variant price`);
            continue;
          }
          if (!wilayaName && !wilayaCode) {
            errors.push(`Row ${rowNumber}: Missing wilaya information`);
            continue;
          }
          // Enforce station code when STOP DESK = OUI
          if (orderData.stop_desk && orderData.stop_desk.toLowerCase().includes('oui') && !orderData.station_code) {
            errors.push(`Row ${rowNumber}: Station code is required when STOP DESK = OUI`);
            continue;
          }

          // Create comprehensive product details JSON
          const productInfo = {
            name: orderData.product_name,
            variant: orderData.product_variant,
            weight: orderData.weight,
            delivery_options: {
              pick_up: orderData.pick_up,
              echange: orderData.echange,
              stop_desk: orderData.stop_desk,
              open_package: orderData.open_package,
              station_code: orderData.station_code
            }
          };

          // Enhanced wilaya lookup with auto-creation
          let resolvedWilayaCode = wilayaCode;
          
          if (wilayaCode) {
            try {
              // Try to find by exact code match first
              const [wilayaResult] = await pool.query(
                'SELECT id, code FROM wilayas WHERE code = ?',
                [wilayaCode]
              );
              
              if (wilayaResult.length > 0) {
                wilayaId = wilayaResult[0].id;
                resolvedWilayaCode = wilayaResult[0].code;
              }
            } catch (wilayaError) {
              console.warn(`Could not resolve wilaya_id for code: ${wilayaCode}`, wilayaError);
            }
          }
          
          // If no code match, try to find by wilaya name
          if (!wilayaId && wilayaName) {
            try {
              const [wilayaNameResult] = await pool.query(
                'SELECT id, code FROM wilayas WHERE LOWER(name_fr) LIKE ? OR LOWER(name_en) LIKE ? OR LOWER(name_ar) LIKE ?',
                [`%${wilayaName.toLowerCase()}%`, `%${wilayaName.toLowerCase()}%`, `%${wilayaName.toLowerCase()}%`]
              );
              
              if (wilayaNameResult.length > 0) {
                wilayaId = wilayaNameResult[0].id;
                resolvedWilayaCode = wilayaNameResult[0].code;
              }
            } catch (wilayaError) {
              console.warn(`Could not resolve wilaya_id for name: ${wilayaName}`, wilayaError);
            }
          }

          // If wilaya not found, create it automatically
          if (!wilayaId && (wilayaName || wilayaCode)) {
            try {
              console.log(`🏗️ Creating new wilaya: ${wilayaName} (code: ${wilayaCode || 'auto'})`);
              
              // Generate code if not provided
              const newWilayaCode = wilayaCode || String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
              
              // Check if generated code already exists
              const [existingCode] = await pool.query(
                'SELECT id FROM wilayas WHERE code = ?',
                [newWilayaCode]
              );
              
              if (existingCode.length === 0) {
                const [insertResult] = await pool.query(`
                  INSERT INTO wilayas (code, name_ar, name_fr, name_en, is_active)
                  VALUES (?, ?, ?, ?, 1)
                `, [
                  newWilayaCode,
                  wilayaName, // Use the name for all languages initially
                  wilayaName,
                  wilayaName
                ]);
                
                wilayaId = insertResult.insertId;
                resolvedWilayaCode = newWilayaCode;
                console.log(`✅ Created new wilaya with ID: ${wilayaId}, Code: ${newWilayaCode}`);
              } else {
                console.warn(`⚠️ Generated wilaya code ${newWilayaCode} already exists`);
              }
            } catch (createWilayaError) {
              console.error(`❌ Failed to create new wilaya: ${wilayaName}`, createWilayaError);
            }
          }

          // Enhanced multilingual baladia lookup (Arabic/French/English support)
          let baladiaId = null;
          
          // Priority 1: Use detected baladia name from wilaya column if available
          if (detectedBaladiaName && wilayaId) {
            try {
              console.log(`🔍 Looking up detected baladia: "${detectedBaladiaName}" in wilaya ${wilayaId}`);
              
              const [detectedBaladiaResult] = await pool.query(`
                SELECT id, name_ar, name_fr, name_en FROM baladias 
                WHERE wilaya_id = ? AND (
                  LOWER(name_ar) LIKE ? OR 
                  LOWER(name_fr) LIKE ? OR 
                  LOWER(name_en) LIKE ?
                )
                LIMIT 1
              `, [wilayaId, `%${detectedBaladiaName.toLowerCase()}%`, `%${detectedBaladiaName.toLowerCase()}%`, `%${detectedBaladiaName.toLowerCase()}%`]);
              
              if (detectedBaladiaResult.length > 0) {
                baladiaId = detectedBaladiaResult[0].id;
                console.log(`✅ Found baladia from wilaya column: ${detectedBaladiaResult[0].name_fr || detectedBaladiaResult[0].name_en || detectedBaladiaResult[0].name_ar}`);
              } else {
                console.log(`⚠️ Detected baladia "${detectedBaladiaName}" not found in database for wilaya ${wilayaId}`);
              }
            } catch (detectedBaladiaError) {
              console.error(`❌ Error looking up detected baladia: ${detectedBaladiaName}`, detectedBaladiaError);
            }
          }
          
          // Priority 2: Use customer address if no baladia found yet
          if (!baladiaId && orderData.customer_address && orderData.customer_address.trim() && wilayaId) {
            try {
              const addressText = orderData.customer_address.trim();
              console.log(`🔍 Looking up baladia from address: "${addressText}"`);
              
              // Split address into words for better matching
              const addressWords = addressText.toLowerCase().split(/\s+/);
              
              // Try multiple approaches for baladia lookup
              let baladiaFound = false;
              
              // 1. First try exact match with full address
              if (!baladiaFound) {
                const [exactResult] = await pool.query(`
                  SELECT id, name_ar, name_fr, name_en FROM baladias 
                  WHERE wilaya_id = ? AND (
                    LOWER(name_ar) = ? OR 
                    LOWER(name_fr) = ? OR 
                    LOWER(name_en) = ?
                  )
                  LIMIT 1
                `, [wilayaId, addressText.toLowerCase(), addressText.toLowerCase(), addressText.toLowerCase()]);
                
                if (exactResult.length > 0) {
                  baladiaId = exactResult[0].id;
                  baladiaFound = true;
                  console.log(`✅ Found baladia by exact match: ${exactResult[0].name_fr || exactResult[0].name_en || exactResult[0].name_ar}`);
                }
              }
              
              // 2. Try partial match with full address
              if (!baladiaFound) {
                const [partialResult] = await pool.query(`
                  SELECT id, name_ar, name_fr, name_en FROM baladias 
                  WHERE wilaya_id = ? AND (
                    LOWER(name_ar) LIKE ? OR 
                    LOWER(name_fr) LIKE ? OR 
                    LOWER(name_en) LIKE ? OR
                    ? LIKE CONCAT('%', LOWER(name_ar), '%') OR
                    ? LIKE CONCAT('%', LOWER(name_fr), '%') OR
                    ? LIKE CONCAT('%', LOWER(name_en), '%')
                  )
                  ORDER BY (
                    CASE 
                      WHEN LOWER(name_fr) = ? THEN 1
                      WHEN LOWER(name_en) = ? THEN 1
                      WHEN LOWER(name_ar) = ? THEN 1
                      WHEN LOWER(name_fr) LIKE ? THEN 2
                      WHEN LOWER(name_en) LIKE ? THEN 2
                      WHEN LOWER(name_ar) LIKE ? THEN 2
                      ELSE 3
                    END
                  )
                  LIMIT 1
                `, [
                  wilayaId, 
                  `%${addressText.toLowerCase()}%`, `%${addressText.toLowerCase()}%`, `%${addressText.toLowerCase()}%`,
                  addressText.toLowerCase(), addressText.toLowerCase(), addressText.toLowerCase(),
                  addressText.toLowerCase(), addressText.toLowerCase(), addressText.toLowerCase(),
                  `%${addressText.toLowerCase()}%`, `%${addressText.toLowerCase()}%`, `%${addressText.toLowerCase()}%`
                ]);
                
                if (partialResult.length > 0) {
                  baladiaId = partialResult[0].id;
                  baladiaFound = true;
                  console.log(`✅ Found baladia by partial match: ${partialResult[0].name_fr || partialResult[0].name_en || partialResult[0].name_ar}`);
                }
              }
              
              // 3. Try word-by-word matching for complex addresses
              if (!baladiaFound && addressWords.length > 1) {
                for (const word of addressWords) {
                  if (word.length >= 3) { // Only check words with 3+ characters
                    const [wordResult] = await pool.query(`
                      SELECT id, name_ar, name_fr, name_en FROM baladias 
                      WHERE wilaya_id = ? AND (
                        LOWER(name_ar) LIKE ? OR 
                        LOWER(name_fr) LIKE ? OR 
                        LOWER(name_en) LIKE ?
                      )
                      LIMIT 1
                    `, [wilayaId, `%${word}%`, `%${word}%`, `%${word}%`]);
                    
                    if (wordResult.length > 0) {
                      baladiaId = wordResult[0].id;
                      baladiaFound = true;
                      console.log(`✅ Found baladia by word match '${word}': ${wordResult[0].name_fr || wordResult[0].name_en || wordResult[0].name_ar}`);
                      break;
                    }
                  }
                }
              }
              
              if (!baladiaFound) {
                console.warn(`⚠️ Could not find baladia for address: "${addressText}" in wilaya ${wilayaId}`);
              }
              
            } catch (baladiaError) {
              console.error(`❌ Error resolving baladia_id for address: ${orderData.customer_address}`, baladiaError);
            }
          }

          // If baladia not found and we have a wilaya, try to create it
          if (!baladiaId && wilayaId) {
            try {
              let potentialBaladiaName = '';
              
              // Priority 1: Use detected baladia name from wilaya column
              if (detectedBaladiaName) {
                potentialBaladiaName = detectedBaladiaName.trim();
                console.log(`🏗️ Using detected baladia name for creation: "${potentialBaladiaName}"`);
              } 
              // Priority 2: Extract from customer address
              else if (orderData.customer_address && orderData.customer_address.trim()) {
                const addressText = orderData.customer_address.trim();
                
                // Extract potential baladia name from address (first word/phrase before comma)
                potentialBaladiaName = addressText.split(',')[0].trim();
                
                // Clean the baladia name (remove numbers, common address words)
                potentialBaladiaName = potentialBaladiaName
                  .replace(/\d+/g, '') // Remove numbers
                  .replace(/\b(rue|avenue|boulevard|street|cité|quartier|bloc|block|apt|apartment)\b/gi, '') // Remove common address words
                  .trim();
                
                console.log(`🏗️ Extracted baladia name from address: "${potentialBaladiaName}"`);
              }
              
              if (potentialBaladiaName && potentialBaladiaName.length >= 3) {
                console.log(`🏗️ Creating new baladia: ${potentialBaladiaName} for wilaya ${wilayaId}`);
                
                // Generate a simple code for the baladia
                const baladiaCode = `${resolvedWilayaCode}${String(Math.floor(Math.random() * 99) + 1).padStart(2, '0')}`;
                
                // Check if code already exists
                const [existingBaladiaCode] = await pool.query(
                  'SELECT id FROM baladias WHERE code = ?',
                  [baladiaCode]
                );
                
                if (existingBaladiaCode.length === 0) {
                  const [insertBaladiaResult] = await pool.query(`
                    INSERT INTO baladias (code, name_ar, name_fr, name_en, wilaya_id, is_active, delivery_zone)
                    VALUES (?, ?, ?, ?, ?, 1, 'urban')
                  `, [
                    baladiaCode,
                    potentialBaladiaName, // Use the extracted name for all languages initially
                    potentialBaladiaName,
                    potentialBaladiaName,
                    wilayaId
                  ]);
                  
                  baladiaId = insertBaladiaResult.insertId;
                  console.log(`✅ Created new baladia with ID: ${baladiaId}, Code: ${baladiaCode}, Name: ${potentialBaladiaName}`);
                } else {
                  console.warn(`⚠️ Generated baladia code ${baladiaCode} already exists`);
                }
              }
            } catch (createBaladiaError) {
              console.error(`❌ Failed to create new baladia from address: ${orderData.customer_address}`, createBaladiaError);
            }
          }

          // Calculate delivery price based on wilaya and delivery type
          let deliveryPrice = orderData.total_amount; // Use the price from Excel as base
          if (wilayaId) {
            try {
              const pricingResult = await DeliveryPricingService.calculateDeliveryPrice(
                wilayaId,
                deliveryType,
                orderData.weight || 1.0,
                0 // volume - default to 0
              );
              
              // Log both prices for comparison
              console.log(`💰 Delivery pricing - Calculated: ${pricingResult.price} DA, Excel: ${orderData.total_amount} DA`);
              // Using Excel price for now: deliveryPrice = pricingResult.price;
            } catch (pricingError) {
              console.warn(`Could not calculate delivery price for wilaya ${wilayaId}:`, pricingError);
              // Keep the price from Excel file
            }
          }

          // Before insert: log resolved geography
          console.log(`📍 Resolved wilaya: name='${wilayaName}', code='${resolvedWilayaCode}', id=${wilayaId}; baladiaId=${baladiaId}`);

          // Check for duplicate orders (same logic as saveOrdersToDatabase)
          let isDuplicate = false;
          let existingOrderId = null;
          let duplicateReason = '';
          
          // First check by order number if it exists
          if (orderData.order_number && orderData.order_number.trim() !== '') {
            const [orderCheck] = await pool.query(
              'SELECT id FROM orders WHERE order_number = ? LIMIT 1', 
              [orderData.order_number]
            );
            if (orderCheck.length > 0) {
              isDuplicate = true;
              existingOrderId = orderCheck[0].id;
              duplicateReason = `order number: ${orderData.order_number}`;
            }
          } else {
            // If no order number, check by customer details to prevent duplicates
            if (orderData.customer_phone && orderData.customer_name) {
              const [customerCheck] = await pool.query(`
                SELECT id FROM orders 
                WHERE customer_phone = ? 
                AND customer_name = ? 
                AND ABS(total_amount - ?) < 0.01
                AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                LIMIT 1
              `, [orderData.customer_phone, orderData.customer_name, orderData.total_amount || 0]);
              
              if (customerCheck.length > 0) {
                isDuplicate = true;
                existingOrderId = customerCheck[0].id;
                duplicateReason = `customer details: ${orderData.customer_name} (${orderData.customer_phone})`;
              }
            }
          }
          
          // Skip if duplicate found
          if (isDuplicate) {
            console.log(`⏭️ Skipping duplicate order by ${duplicateReason} (Order ID: ${existingOrderId}) - Row ${rowNumber}`);
            continue;
          }

          // Generate final order number for new orders
          const finalOrderNumber = orderData.order_number && orderData.order_number.trim() !== '' 
            ? orderData.order_number 
            : `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

          // Decide pricing level
          const pricingLevel = baladiaId ? 'baladia' : 'wilaya';

          // Insert into database with NEW Excel format mapping and source tracking
          const [result] = await pool.query(`
            INSERT INTO orders (
              order_number, customer_name, customer_phone, customer_phone_2,
              customer_address, customer_city, product_details, total_amount, status,
              payment_status, notes, created_at, assigned_to,
              wilaya_code, wilaya_id, baladia_id, baladia_name, weight, delivery_type, delivery_price, pricing_level,
              source_spreadsheet_id, source_sheet_name, source_file_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            finalOrderNumber,
            orderData.customer_name,
            orderData.customer_phone,
            orderData.customer_phone_2,
            orderData.customer_address,
            wilayaName || 'Unknown',
            JSON.stringify(productInfo),
            orderData.total_amount,
            orderData.status,
            orderData.payment_status,
            orderData.notes,
            null,
            resolvedWilayaCode,
            wilayaId,
            baladiaId,
            orderData.baladia_name || '',
            orderData.weight,
            deliveryType,
            orderData.total_amount,
            pricingLevel,
            orderData.source_spreadsheet_id || null,
            orderData.source_sheet_name || null,
            orderData.source_file_name || null
          ]);

          console.log(`✅ Successfully imported order ${finalOrderNumber} for ${orderData.customer_name}`);

          imported.push({
            id: result.insertId,
            order_number: finalOrderNumber,
            customer_name: orderData.customer_name,
            total_amount: orderData.total_amount
          });

        } catch (error) {
          console.error(`❌ Error importing row ${rowNumber}:`, error);
          errors.push(`Row ${rowNumber}: ${error.message}`);
        }
      }

      return {
        success: true,
        message: `Successfully imported ${imported.length} orders`,
        imported: imported.length,
        total: rows.length,
        errors: errors,
        importedOrders: imported.slice(0, 10) // Return first 10 for preview
      };

    } catch (error) {
      console.error('Error importing orders from sheet:', error);
      throw new Error('Failed to import orders from Google Sheet');
    }
  }

  // Normalize and decode common HTML entities and normalize Unicode
  normalizeText(str) {
    if (str == null) return '';
    let s = String(str).trim();
    s = s
      .replace(/&#(\d+);/g, (_, n) => {
        try { return String.fromCharCode(parseInt(n, 10)); } catch { return _; }
      })
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&(apos|#39);/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    try { s = s.normalize('NFC'); } catch {}
    return s;
  }

  // Check if user can access Google Sheets
  async canUserAccessSheets(userId) {
    return await googleAuthService.isUserAuthenticated(userId);
  }

  // List user's Google Sheets files
  async listUserGoogleSheets(userId, maxResults = 50) {
    try {
      const drive = await this.getDriveClient(userId);
      
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, modifiedTime, size, webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: maxResults
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing user Google Sheets:', error);
      throw new Error('Failed to list user Google Sheets');
    }
  }

  // Get basic sheet info (for existing spreadsheet functionality)
  async getSheetInfo(userId) {
    try {
      const sheets = await this.getSheetsClient(userId);
      
      if (!this.spreadsheetId) {
        return {
          success: false,
          message: 'No spreadsheet ID configured'
        };
      }

      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });

      return {
        success: true,
        title: response.data.properties.title,
        spreadsheetId: this.spreadsheetId,
        sheets: response.data.sheets.map(sheet => ({
          sheetId: sheet.properties.sheetId,
          title: sheet.properties.title
        }))
      };
    } catch (error) {
      console.error('Error getting sheet info:', error);
      return {
        success: false,
        message: 'Failed to get sheet information'
      };
    }
  }

  // Export orders to Google Sheets
  async exportOrders(userId, orders) {
    try {
      const sheets = await this.getSheetsClient(userId);
      
      if (!this.spreadsheetId) {
        throw new Error('No spreadsheet ID configured');
      }

      // Prepare data for export
      const headers = [
        'Order Number', 'Customer Name', 'Phone', 'Address', 'City',
        'Product', 'Quantity', 'Total Amount', 'Status', 'Payment Status',
        'Created At', 'Assigned To', 'Notes'
      ];

      const rows = orders.map(order => [
        order.order_number,
        order.customer_name,
        order.customer_phone,
        order.customer_address,
        order.customer_city,
        order.product_details,
        order.quantity || 1,
        order.total_amount,
        order.status,
        order.payment_status,
        order.created_at,
        order.assigned_to || '',
        order.notes || ''
      ]);

      const values = [headers, ...rows];

      // Clear existing data and write new data
      await sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: 'Orders!A:M'
      });

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'Orders!A1',
        valueInputOption: 'RAW',
        resource: {
          values: values
        }
      });

      return {
        success: true,
        exportedRows: orders.length,
        updatedCells: response.data.updatedCells
      };
    } catch (error) {
      console.error('❌ Failed to export orders:', error.message);
      throw error;
    }
  }

  // Update order status in Google Sheets
  async updateOrderStatusInSheet(userId, spreadsheetId, orderNumber, newStatus, sheetName = 'Sheet1') {
    try {
      console.log(`🔄 Updating order ${orderNumber} status to ${newStatus} in Google Sheets...`);
      
      const sheets = await this.getSheetsClient(userId);
      
      // First, find the order row by searching for the order number
      const searchResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A:A`  // Search in column A (assuming order number is in first column)
      });

      const rows = searchResponse.data.values || [];
      let orderRowIndex = -1;
      
      // Find the row with the order number
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i][0] && rows[i][0].toString() === orderNumber.toString()) {
          orderRowIndex = i + 1; // Google Sheets is 1-indexed
          break;
        }
      }

      if (orderRowIndex === -1) {
        console.log(`⚠️ Order ${orderNumber} not found in Google Sheets`);
        return {
          success: false,
          message: `Order ${orderNumber} not found in Google Sheets`
        };
      }

      // Get the current row data to determine status column
      const rowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!${orderRowIndex}:${orderRowIndex}`
      });

      const currentRow = rowResponse.data.values[0] || [];
      
      // Determine status column - commonly in different positions depending on sheet format
      // Let's check headers first to find the status column
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!1:1`
      });

      const headers = headerResponse.data.values[0] || [];
      let statusColumnIndex = -1;

      // Look for status-related headers (case insensitive)
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i].toString().toLowerCase();
        if (header.includes('status') || header.includes('statut') || header.includes('حالة') || 
            header.includes('état') || header.includes('state') || header.includes('etat')) {
          statusColumnIndex = i;
          break;
        }
      }

      // If no status column found, try common positions or add it
      if (statusColumnIndex === -1) {
        // Try last column or add a new status column
        statusColumnIndex = Math.max(headers.length, currentRow.length);
        
        // Update header if adding new column
        if (statusColumnIndex >= headers.length) {
          const statusHeaderRange = `${sheetName}!${String.fromCharCode(65 + statusColumnIndex)}1`;
          await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: statusHeaderRange,
            valueInputOption: 'RAW',
            resource: {
              values: [['Status']]
            }
          });
        }
      }

      // Update the status in the found row
      const statusCellRange = `${sheetName}!${String.fromCharCode(65 + statusColumnIndex)}${orderRowIndex}`;
      
      const updateResponse = await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: statusCellRange,
        valueInputOption: 'RAW',
        resource: {
          values: [[newStatus]]
        }
      });

      console.log(`✅ Successfully updated order ${orderNumber} status to ${newStatus} in Google Sheets`);
      
      return {
        success: true,
        message: `Order ${orderNumber} status updated to ${newStatus}`,
        updatedCells: updateResponse.data.updatedCells,
        statusColumn: String.fromCharCode(65 + statusColumnIndex),
        rowIndex: orderRowIndex
      };

    } catch (error) {
      console.error('❌ Failed to update order status in Google Sheets:', error.message);
      return {
        success: false,
        message: `Failed to update order status: ${error.message}`,
        error: error.message
      };
    }
  }

  // Batch update multiple order statuses in Google Sheets
  async batchUpdateOrderStatusInSheet(userId, spreadsheetId, orderUpdates, sheetName = 'Sheet1') {
    try {
      console.log(`🔄 Batch updating ${orderUpdates.length} order statuses in Google Sheets...`);
      
      const results = [];
      for (const update of orderUpdates) {
        const result = await this.updateOrderStatusInSheet(
          userId, 
          spreadsheetId, 
          update.orderNumber, 
          update.newStatus, 
          sheetName
        );
        results.push({
          orderNumber: update.orderNumber,
          ...result
        });
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`✅ Batch update completed: ${successCount} succeeded, ${failureCount} failed`);

      return {
        success: successCount > 0,
        results: results,
        summary: {
          total: orderUpdates.length,
          succeeded: successCount,
          failed: failureCount
        }
      };

    } catch (error) {
      console.error('❌ Failed to batch update order statuses in Google Sheets:', error.message);
      return {
        success: false,
        message: `Failed to batch update order statuses: ${error.message}`,
        error: error.message
      };
    }
  }
}

module.exports = new GoogleSheetsService();
