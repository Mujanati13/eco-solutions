const XLSX = require('xlsx');
const { google } = require('googleapis');

class EnhancedExcelProcessor {
  constructor() {
    this.supportedFormats = ['xlsx', 'xls', 'csv', 'ods'];
    this.encodings = ['utf8', 'utf16le', 'latin1', 'cp1252', 'windows-1252'];
    
    // Column patterns for different Excel formats
    this.formatPatterns = {
      // New format specifically for your Excel file
      yourExcelFormat: {
        name: 'Your Excel Format',
        patterns: {
          order_id: [/order.*id/i, /id/i, 0],                    // A: Order ID
          full_name: [/full.*name/i, /name/i, 1],                // B: Full name
          phone: [/phone/i, /telephone/i, 2],                    // C: Phone
          phone_2: [/phone.*2/i, /telephone.*2/i, 3],            // D: phone 2
          address: [/address/i, /adresse/i, 4],                  // E: Address 1
          baladia: [/بلدية/i, /baladia/i, /municipality/i, 5],    // F: البلدية
          variant_price: [/variant.*price/i, /price/i, 6],       // G: Variant price
          wilaya: [/ولاية/i, /wilaya/i, /province/i, 7],          // H: الولاية
          product_name: [/product.*name/i, /product/i, 8],       // I: Product name
          variant: [/product.*variant/i, /variant/i, 9],         // J: Product variant
          notes: [/remarque/i, /notes/i, /comment/i, 10]         // K: remarque
        }
      },
      ecotrack: {
        name: 'EcoTrack Format',
        patterns: {
          order_id: [/order.*id/i, /tracking/i, /reference/i, 0],
          full_name: [/full.*name/i, /nom.*prenom/i, /customer.*name/i, 1],
          phone: [/phone/i, /telephone/i, /tel/i, 2],
          phone_2: [/phone.*2/i, /telephone.*2/i, /tel.*2/i, 3],
          address: [/address/i, /adresse/i, 4],
          wilaya_price: [/wilaya/i, /commune/i, /city/i, 5],
          product_name: [/product.*name/i, /produit/i, /item/i, 6],
          variant: [/variant/i, /variante/i, /type/i, 7],
          notes: [/notes/i, /remarque/i, /comment/i, 8],
          weight: [/weight/i, /poids/i, /kg/i, 9],
          pick_up: [/pick.*up/i, /retrait/i, 10],
          exchange: [/exchange/i, /echange/i, 11],
          stop_desk: [/stop.*desk/i, /bureau/i, 12],
          station_code: [/station.*code/i, /code.*station/i, 13]
        }
      },
      french: {
        name: 'French Format',
        patterns: {
          order_id: [/reference.*commande/i, /numero.*commande/i, 0],
          full_name: [/nom.*prenom/i, /nom.*client/i, 1],
          phone: [/telephone/i, /mobile/i, 2],
          address: [/adresse.*livraison/i, /adresse/i, 3],
          city: [/commune.*livraison/i, /ville/i, 4],
          amount: [/montant.*colis/i, /prix/i, 5],
          wilaya_code: [/code.*wilaya/i, /wilaya/i, 6],
          product: [/produit/i, /article/i, 7],
          notes: [/remarque/i, /observation/i, 8],
          weight: [/poids/i, /kg/i, 9],
          metro: [/metro/i, /livraison.*metro/i, 10]
        }
      },
      noest: {
        name: 'NoEst Format',
        patterns: {
          tracking_id: [/tracking.*id/i, /suivi/i, 0],
          date: [/date/i, 1],
          full_name: [/full.*name/i, /nom.*complete/i, 2],
          phone: [/phone/i, /telephone/i, 3],
          wilaya: [/wilaya/i, 4],
          commune: [/commune/i, 5],
          product: [/product/i, /produit/i, 6],
          product_price: [/prix.*produit/i, 7],
          situation: [/situation/i, /status/i, 8],
          delivery_price: [/prix.*livraison/i, 9],
          total: [/total/i, 10]
        }
      }
    };
  }

  /**
   * Enhanced Excel file parsing with multiple format support
   */
  async parseExcelFile(buffer, options = {}) {
    try {
      // Extract Google Sheets source information
      const {
        spreadsheetId = null,
        sheetName = 'Sheet1',
        fileName = 'unknown.xlsx',
        driveFileId = null,
        sourceType = 'file_upload'
      } = options;
      
      console.log(`🔍 Parsing Excel with source tracking:`, {
        fileName,
        spreadsheetId,
        sheetName,
        sourceType
      });
      
      const results = {
        success: false,
        data: [],
        format: null,
        encoding: null,
        metadata: {
          fileName,
          spreadsheetId,
          sheetName,
          driveFileId,
          sourceType
        },
        errors: []
      };

      // Try multiple parsing approaches
      for (const encoding of this.encodings) {
        try {
          let workbook;
          
          // Try different XLSX read options
          const readOptions = {
            type: 'buffer',
            cellDates: true,
            cellNF: false,
            cellText: false,
            raw: false,
            dateNF: 'yyyy-mm-dd',
            sheetStubs: true,
            defval: '',
            codepage: encoding === 'utf8' ? 65001 : 1252
          };

          workbook = XLSX.read(buffer, readOptions);

          // Get the first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to raw array data
          const rawData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            blankrows: false,
            raw: false
          });

          if (rawData.length > 1) {
            const processedData = this.processRawData(rawData, options);
            
            if (processedData.data.length > 0) {
              results.success = true;
              results.data = processedData.data;
              results.format = processedData.format;
              results.encoding = encoding;
              results.metadata = {
                totalRows: rawData.length,
                totalColumns: Math.max(...rawData.map(row => row.length)),
                hasHeaders: processedData.hasHeaders,
                detectedColumns: processedData.columns,
                sheetName: sheetName
              };
              break;
            }
          }
        } catch (encodingError) {
          results.errors.push(`Encoding ${encoding}: ${encodingError.message}`);
          continue;
        }
      }

      return results;
    } catch (error) {
      return {
        success: false,
        data: [],
        format: null,
        encoding: null,
        metadata: {},
        errors: [`Parse error: ${error.message}`]
      };
    }
  }

  /**
   * Process raw Excel data with intelligent column detection
   */
  processRawData(rawData, options = {}) {
    if (!rawData || rawData.length === 0) {
      return { data: [], format: 'unknown', hasHeaders: false, columns: [] };
    }

    console.log(`📊 Processing ${rawData.length} rows of Excel data...`);

    // Extract source information from options
    const sourceInfo = {
      spreadsheetId: options.spreadsheetId || null,
      sheetName: options.sheetName || 'Sheet1',
      fileName: options.fileName || 'unknown.xlsx'
    };

    // Detect if first row contains headers
    const hasHeaders = this.detectHeaders(rawData[0], rawData[1]);
    console.log(`📋 Headers detected: ${hasHeaders}`);
    
    // Get column mappings
    const columnMap = this.detectColumnFormat(rawData, hasHeaders);
    console.log(`🔍 Detected format: ${columnMap.format}`);
    console.log(`📍 Column mapping:`, columnMap.mapping);
    
    // Process data rows
    const dataStartIndex = hasHeaders ? 1 : 0;
    const processedData = [];
    const errors = [];

    for (let i = dataStartIndex; i < rawData.length; i++) {
      const row = rawData[i];
      if (this.isEmptyRow(row)) continue;

      try {
        const processedRow = this.mapRowToStandardFormat(row, columnMap, i + 1, sourceInfo);
        if (processedRow) {
          processedData.push(processedRow);
        }
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
        console.warn(`⚠️ Error processing row ${i + 1}:`, error.message);
      }
    }

    console.log(`✅ Successfully processed ${processedData.length} orders from ${rawData.length - dataStartIndex} rows`);
    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} rows had errors:`, errors.slice(0, 5));
    }

    return {
      data: processedData,
      format: columnMap.format,
      hasHeaders,
      columns: columnMap.columns,
      errors,
      sourceInfo
    };
  }

  /**
   * Intelligent header detection
   */
  detectHeaders(firstRow, secondRow) {
    if (!firstRow || !secondRow) return false;

    // Check if first row contains text and second row contains different data types
    const firstRowTypes = firstRow.map(cell => this.getCellType(cell));
    const secondRowTypes = secondRow.map(cell => this.getCellType(cell));

    const firstRowTextCount = firstRowTypes.filter(type => type === 'text').length;
    const secondRowHasNumbers = secondRowTypes.includes('number');
    
    // Check for common header patterns
    const hasHeaderPatterns = firstRow.some(cell => {
      if (typeof cell !== 'string') return false;
      const cellLower = cell.toLowerCase();
      return /^(order|nom|phone|tel|address|adresse|wilaya|product|produit|price|prix|amount|montant|weight|poids|notes|remarque|date|id|reference|tracking)/.test(cellLower);
    });

    return (firstRowTextCount > firstRow.length * 0.5 && secondRowHasNumbers) || hasHeaderPatterns;
  }

  /**
   * Get cell data type
   */
  getCellType(cell) {
    if (cell === null || cell === undefined || cell === '') return 'empty';
    if (typeof cell === 'number') return 'number';
    if (cell instanceof Date) return 'date';
    if (typeof cell === 'boolean') return 'boolean';
    
    const str = String(cell).trim();
    if (/^\d+$/.test(str)) return 'number';
    if (/^\d+[.,]\d+$/.test(str)) return 'decimal';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) return 'date';
    
    return 'text';
  }

  /**
   * Enhanced column format detection
   */
  detectColumnFormat(rawData, hasHeaders) {
    const headerRow = hasHeaders ? rawData[0] : null;
    const firstDataRow = rawData[hasHeaders ? 1 : 0];
    
    // Special detection for your Excel format based on Arabic headers
    if (headerRow && this.isYourExcelFormat(headerRow)) {
      console.log(`🎯 Detected your Excel format with Arabic headers`);
      return {
        format: 'yourExcelFormat',
        columns: ['order_id', 'full_name', 'phone', 'phone_2', 'address', 'baladia', 'variant_price', 'wilaya', 'product_name', 'variant', 'notes'],
        mapping: {
          order_id: 0,
          full_name: 1,
          phone: 2,
          phone_2: 3,
          address: 4,
          baladia: 5,
          variant_price: 6,
          wilaya: 7,
          product_name: 8,
          variant: 9,
          notes: 10
        },
        config: this.formatPatterns.yourExcelFormat
      };
    }
    
    let bestMatch = { format: 'unknown', score: 0, mapping: {} };

    // Try to match each format pattern
    for (const [formatName, config] of Object.entries(this.formatPatterns)) {
      const score = this.calculateFormatScore(headerRow, firstDataRow, config);
      
      if (score > bestMatch.score) {
        bestMatch = {
          format: formatName,
          score: score,
          mapping: this.createColumnMapping(headerRow, firstDataRow, config),
          config: config
        };
      }
    }

    console.log(`🎯 Best format match: ${bestMatch.format} (score: ${bestMatch.score})`);

    return {
      format: bestMatch.format,
      columns: Object.keys(bestMatch.mapping),
      mapping: bestMatch.mapping,
      config: bestMatch.config
    };
  }

  /**
   * Check if this is your specific Excel format
   */
  isYourExcelFormat(headerRow) {
    if (!headerRow || headerRow.length < 8) return false;
    
    const headers = headerRow.map(h => String(h || '').trim());
    
    // Look for distinctive patterns from your Excel file
    const hasArabicBaladia = headers.some(h => h.includes('البلدية') || h.includes('بلدية'));
    const hasArabicWilaya = headers.some(h => h.includes('الولاية') || h.includes('ولاية'));
    const hasVariantPrice = headers.some(h => h.toLowerCase().includes('variant') && h.toLowerCase().includes('price'));
    const hasFullName = headers.some(h => h.toLowerCase().includes('full') && h.toLowerCase().includes('name'));
    const hasOrderId = headers.some(h => h.toLowerCase().includes('order') && h.toLowerCase().includes('id'));
    
    // Return true if we have the key indicators
    return (hasArabicBaladia || hasArabicWilaya) && (hasVariantPrice || hasFullName || hasOrderId);
  }

  /**
   * Calculate format matching score
   */
  calculateFormatScore(headerRow, dataRow, formatConfig) {
    let score = 0;
    const patterns = formatConfig.patterns;
    
    if (headerRow) {
      // Header-based scoring
      for (const [field, [regex, , , position]] of Object.entries(patterns)) {
        if (position < headerRow.length) {
          const headerCell = String(headerRow[position] || '').toLowerCase();
          if (regex.test(headerCell)) {
            score += 10; // High score for header match
          }
        }
        
        // Also check if regex matches any header cell
        for (let i = 0; i < headerRow.length; i++) {
          const headerCell = String(headerRow[i] || '').toLowerCase();
          if (regex.test(headerCell)) {
            score += 5; // Medium score for any position match
            break;
          }
        }
      }
    }

    // Data pattern scoring
    if (dataRow) {
      for (const [field, [, , , position]] of Object.entries(patterns)) {
        if (position < dataRow.length) {
          const dataCell = dataRow[position];
          if (this.validateFieldData(field, dataCell)) {
            score += 3; // Score for data pattern match
          }
        }
      }
    }

    return score;
  }

  /**
   * Validate field data against expected patterns
   */
  validateFieldData(fieldName, value) {
    if (!value) return false;
    
    const str = String(value).trim();
    
    switch (fieldName) {
      case 'phone':
      case 'phone_2':
        return /\d{8,15}/.test(str.replace(/\D/g, ''));
      
      case 'wilaya_price':
      case 'amount':
      case 'total':
        return /\d+/.test(str) && /\d+/.test(str.replace(/[^\d]/g, ''));
      
      case 'weight':
        return /\d+([.,]\d+)?/.test(str);
        
      case 'order_id':
      case 'tracking_id':
        return str.length > 2 && /\w/.test(str);
        
      case 'full_name':
        return str.length > 2 && /[a-zA-Zàáâãäåçèéêëìíîïñòóôõöùúûüý\u0600-\u06FF\s]/.test(str);
        
      default:
        return str.length > 0;
    }
  }

  /**
   * Create column mapping for detected format
   */
  createColumnMapping(headerRow, dataRow, formatConfig) {
    const mapping = {};
    const patterns = formatConfig.patterns;
    
    for (const [field, [regex, , , defaultPosition]] of Object.entries(patterns)) {
      let columnIndex = -1;
      
      // First try to find by header pattern
      if (headerRow) {
        for (let i = 0; i < headerRow.length; i++) {
          const headerCell = String(headerRow[i] || '').toLowerCase();
          if (regex.test(headerCell)) {
            columnIndex = i;
            break;
          }
        }
      }
      
      // Fallback to default position if header not found
      if (columnIndex === -1 && defaultPosition < (dataRow?.length || 0)) {
        columnIndex = defaultPosition;
      }
      
      if (columnIndex >= 0) {
        mapping[field] = columnIndex;
      }
    }
    
    return mapping;
  }

  /**
   * Map row data to standardized format
   */
  mapRowToStandardFormat(row, columnMap, rowNumber, sourceInfo = {}) {
    try {
      const mapping = columnMap.mapping;
      const orderData = {};

      // Map each field using the detected column structure
      for (const [field, columnIndex] of Object.entries(mapping)) {
        const cellValue = row[columnIndex];
        orderData[field] = this.processCellValue(cellValue, field);
      }

      // Convert to standard order format based on detected format
      const standardOrder = this.convertToStandardOrder(orderData, columnMap.format, sourceInfo);

      // Validate required fields
      if (!standardOrder.customer_name || !standardOrder.customer_phone) {
        throw new Error(`Missing required fields: customer_name or customer_phone`);
      }

      return standardOrder;
    } catch (error) {
      console.error(`❌ Row mapping error (row ${rowNumber}):`, error.message);
      throw error;
    }
  }

  /**
   * Convert format-specific data to standard order format
   */
  convertToStandardOrder(data, format, sourceInfo = {}) {
    const order = {
      order_number: data.order_id || data.tracking_id || `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      customer_name: data.full_name || '',
      customer_phone: data.phone || '',
      customer_phone_2: data.phone_2 || '',
      customer_address: data.address || '',
      customer_city: data.city || data.commune || '',
      product_details: data.product_name || data.product || '',
      product_variant: data.variant || '',
      total_amount: 0,
      notes: data.notes || '',
      weight: data.weight || 1.0,
      status: 'processing',
      payment_status: 'pending',
      created_at: new Date(),
      delivery_type: 'home',
      
      // Add Google Sheets source tracking
      source_spreadsheet_id: sourceInfo.spreadsheetId || null,
      source_sheet_name: sourceInfo.sheetName || 'Sheet1',
      source_file_name: sourceInfo.fileName || 'unknown.xlsx'
    };

    // Format-specific processing
    switch (format) {
      case 'yourExcelFormat':
        // Handle your specific Excel format
        order.customer_name = data.full_name || '';
        order.customer_phone = data.phone || '';
        order.customer_phone_2 = data.phone_2 || '';
        order.customer_address = data.address || '';
        order.baladia_name = data.baladia || '';
        order.product_name = data.product_name || '';
        order.product_variant = data.variant || '';
        order.notes = data.notes || '';
        
        // Parse price from variant_price field
        if (data.variant_price) {
          const priceStr = String(data.variant_price).replace(/[^\d.,]/g, '');
          order.total_amount = parseFloat(priceStr.replace(',', '.')) || 0;
        }
        
        // Parse wilaya information from format like "09 - Blida"
        if (data.wilaya) {
          const wilayaStr = String(data.wilaya).trim();
          const wilayaMatch = wilayaStr.match(/^(\d{1,2})\s*[-\s]+(.+)$/);
          if (wilayaMatch) {
            order.wilaya_code = wilayaMatch[1].padStart(2, '0');
            order.wilaya_name = wilayaMatch[2].trim();
          } else {
            order.wilaya_name = wilayaStr;
          }
        }
        
        // Set default delivery type
        order.delivery_type = 'home';
        order.status = 'pending';
        order.payment_status = 'unpaid';
        break;

      case 'ecotrack':
        // Parse wilaya and price from combined field
        if (data.wilaya_price) {
          const parsed = this.parseWilayaPrice(data.wilaya_price);
          order.total_amount = parsed.price;
          order.customer_city = parsed.wilaya;
        }
        
        // Determine delivery type
        if (data.pick_up && String(data.pick_up).toLowerCase().includes('oui')) {
          order.delivery_type = 'pickup_point';
        } else if (data.exchange && String(data.exchange).toLowerCase().includes('oui')) {
          order.delivery_type = 'les_changes';
        } else if (data.stop_desk && String(data.stop_desk).toLowerCase().includes('oui')) {
          order.delivery_type = 'pickup_point';
        }
        break;

      case 'french':
        order.total_amount = data.amount || 0;
        order.wilaya_code = data.wilaya_code;
        break;

      case 'noest':
        order.total_amount = data.total || data.product_price || 0;
        order.customer_city = data.wilaya;
        order.status = this.mapStatus(data.situation);
        if (data.date) {
          order.created_at = new Date(data.date);
        }
        break;
    }

    return order;
  }

  /**
   * Parse wilaya and price from combined field (e.g., "Bouinan 4200", "Chebli 2600")
   */
  parseWilayaPrice(wilayaPriceField) {
    if (!wilayaPriceField) return { wilaya: '', price: 0 };
    
    const str = String(wilayaPriceField).trim();
    
    // Try different patterns
    const patterns = [
      /^(.+?)\s+(\d+)$/, // "Bouinan 4200"
      /^(\d+)\s*(.+)$/, // "4200 Bouinan" 
      /^(.+?)\s*[:-]\s*(\d+)/, // "Bouinan: 4200"
      /(\d+).*$/ // Just extract number
    ];
    
    for (const pattern of patterns) {
      const match = str.match(pattern);
      if (match) {
        if (pattern === patterns[3]) {
          // Just number pattern
          return { wilaya: '', price: parseFloat(match[1]) || 0 };
        } else if (pattern === patterns[1]) {
          // Number first pattern
          return { wilaya: match[2].trim(), price: parseFloat(match[1]) || 0 };
        } else {
          // Text first patterns
          return { wilaya: match[1].trim(), price: parseFloat(match[2]) || 0 };
        }
      }
    }
    
    return { wilaya: str, price: 0 };
  }

  /**
   * Enhanced cell value processing
   */
  processCellValue(value, fieldType) {
    if (value === undefined || value === null || value === '') {
      return '';
    }

    const strValue = String(value).trim();

    switch (fieldType) {
      case 'phone':
      case 'phone_2':
        // Clean phone number
        const cleaned = strValue.replace(/[^\d]/g, '');
        return cleaned.length >= 8 ? cleaned : '';

      case 'amount':
      case 'total':
      case 'product_price':
      case 'delivery_price':
        // Extract numeric value
        const priceStr = strValue.replace(/[^\d.,]/g, '');
        return parseFloat(priceStr.replace(',', '.')) || 0;

      case 'weight':
        // Extract weight value
        const weightStr = strValue.replace(/[^\d.,]/g, '');
        return parseFloat(weightStr.replace(',', '.')) || 1.0;

      case 'wilaya_code':
        // Extract wilaya code
        const codeMatch = strValue.match(/\d+/);
        return codeMatch ? parseInt(codeMatch[0]) : null;

      case 'full_name':
      case 'address':
      case 'city':
      case 'commune':
      case 'product':
      case 'product_name':
      case 'notes':
        // Normalize text
        return this.normalizeText(strValue);

      case 'wilaya_price':
        // Keep as-is for later parsing
        return strValue;

      default:
        return strValue;
    }
  }

  /**
   * Normalize text with proper encoding handling
   */
  normalizeText(text) {
    if (!text) return '';
    
    return String(text)
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\u00A0/g, ' ') // Non-breaking space
      .trim();
  }

  /**
   * Map various status formats to standard statuses
   */
  mapStatus(status) {
    if (!status) return 'pending';
    
    const statusLower = String(status).toLowerCase().trim();
    const statusMappings = {
      'delivered': 'delivered',
      'livré': 'delivered',
      'livree': 'delivered',
      'sd': 'delivered',
      'confirmed': 'confirmed',
      'confirmé': 'confirmed',
      'confirme': 'confirmed',
      'pending': 'pending',
      'en attente': 'pending',
      'cancelled': 'cancelled',
      'annulé': 'cancelled',
      'annule': 'cancelled',
      'canceled': 'cancelled'
    };

    return statusMappings[statusLower] || 'pending';
  }

  /**
   * Check if row is empty
   */
  isEmptyRow(row) {
    if (!row || row.length === 0) return true;
    
    return row.every(cell => {
      return cell === null || cell === undefined || String(cell).trim() === '';
    });
  }

  /**
   * Process Excel file from Google Drive with source tracking
   */
  async processExcelFromGoogleDrive(userId, spreadsheetId, options = {}) {
    try {
      console.log(`🔄 Processing Excel from Google Drive: ${spreadsheetId}`);
      
      // Get Google APIs client
      const { google } = require('googleapis');
      const googleAuthService = require('./googleAuth');
      
      // Get authorized client
      const authClient = await googleAuthService.getAuthenticatedClient(userId);
      const drive = google.drive({ version: 'v3', auth: authClient });
      
      // Get file metadata
      const fileMetadata = await drive.files.get({
        fileId: spreadsheetId,
        fields: 'id,name,mimeType,size,modifiedTime'
      });
      
      const fileName = fileMetadata.data.name;
      const mimeType = fileMetadata.data.mimeType;
      console.log(`📁 Processing file: ${fileName} (${mimeType})`);
      
      let fileBuffer;
      
      // Handle Google Sheets vs Excel files differently
      if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        console.log('📊 Detected Google Sheets file, exporting as Excel...');
        // Export Google Sheets as Excel format
        const response = await drive.files.export({
          fileId: spreadsheetId,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        fileBuffer = Buffer.from(response.data, 'binary');
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                 mimeType === 'application/vnd.ms-excel') {
        console.log('📊 Detected Excel file, downloading directly...');
        // Download Excel files directly
        const response = await drive.files.get({
          fileId: spreadsheetId,
          alt: 'media'
        });
        fileBuffer = Buffer.from(response.data, 'binary');
      } else {
        throw new Error(`Unsupported file type: ${mimeType}. Only Google Sheets and Excel files are supported.`);
      }
      
      // Parse with source tracking information
      const parseOptions = {
        spreadsheetId,
        fileName,
        driveFileId: spreadsheetId,
        sourceType: 'google_drive',
        ...options
      };
      
      const result = await this.parseExcelFile(fileBuffer, parseOptions);
      
      if (result.success && result.data.length > 0) {
        console.log(`✅ Successfully processed ${result.data.length} orders from ${fileName}`);
        return {
          success: true,
          orders: result.data,
          metadata: result.metadata,
          fileName
        };
      } else {
        console.log(`⚠️ No orders found in ${fileName}`);
        return {
          success: false,
          orders: [],
          error: 'No valid orders found',
          fileName
        };
      }
      
    } catch (error) {
      console.error('❌ Error processing Excel from Google Drive:', error);
      return {
        success: false,
        orders: [],
        error: error.message
      };
    }
  }
}

module.exports = EnhancedExcelProcessor;
