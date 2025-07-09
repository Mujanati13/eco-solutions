const { google } = require('googleapis');
const googleAuthService = require('./googleAuth');

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
      
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: 'files(id, name, createdTime, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
      });

      return response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink
      }));
    } catch (error) {
      console.error('Error listing Google Sheets:', error);
      throw new Error('Failed to list Google Sheets files');
    }
  }

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

  // Import orders from a Google Sheet
  async importOrdersFromSheet(userId, spreadsheetId, sheetName = 'Sheet1', options = {}) {
    try {
      const sheets = await this.getSheetsClient(userId);
      const { pool } = require('../config/database');
      
      // Get all data from the sheet
      const range = options.range || `${sheetName}!A:L`;
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
          // Map row data to order fields (adjust mapping as needed)
          const orderData = {
            order_number: row[0] || `IMPORT-${Date.now()}-${i}`,
            customer_name: row[1] || '',
            customer_phone: row[2] || '',
            customer_email: row[3] || '',
            customer_address: row[4] || '',
            customer_city: row[5] || '',
            product_name: row[6] || '',
            quantity: parseInt(row[7]) || 1,
            unit_price: parseFloat(row[8]) || 0,
            total_amount: parseFloat(row[9]) || 0,
            payment_method: row[10] || 'cash_on_delivery',
            status: row[11] || 'pending',
            notes: row[12] || ''
          };

          // Validate required fields
          if (!orderData.customer_name || !orderData.customer_phone) {
            errors.push(`Row ${rowNumber}: Missing customer name or phone`);
            continue;
          }

          // Insert into database
          const [result] = await pool.query(`
            INSERT INTO orders (
              order_number, customer_name, customer_phone, customer_email,
              customer_address, customer_city, product_name, quantity,
              unit_price, total_amount, payment_method, status, notes,
              created_at, assigned_to
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
          `, [
            orderData.order_number,
            orderData.customer_name,
            orderData.customer_phone,
            orderData.customer_email,
            orderData.customer_address,
            orderData.customer_city,
            orderData.product_name,
            orderData.quantity,
            orderData.unit_price,
            orderData.total_amount,
            orderData.payment_method,
            orderData.status,
            orderData.notes,
            userId // assigned_to
          ]);

          imported.push({
            id: result.insertId,
            order_number: orderData.order_number,
            customer_name: orderData.customer_name
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
        order.notes || ''
      ]);

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Orders!A:L',
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
