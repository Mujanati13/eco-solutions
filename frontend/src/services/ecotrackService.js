const API_BASE_URL = 'https://app.noest-dz.com';
import api from './api'; // Import your local API service

class EcotrackService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.apiToken = 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG';
    this.userGuid = '2QG0JDFP'; // Add user GUID
  }

  // Helper method to make API calls with authentication
  async makeRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ecotrack API Error:', error);
      throw error;
    }
  }

  // 1. Create a single order
  async createOrder(orderData) {
    try {
      // Step 1: Create order in Ecotrack
      const ecotrackResult = await this.makeRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          api_token: this.apiToken,
          user_guid: this.userGuid,
          type_id: 1, // Standard delivery
          ref_client: orderData.order_number || `ECO-${Date.now()}`,
          product_codes: orderData.product_details ? JSON.stringify(orderData.product_details) : orderData.product_name || 'Product',
          quantite: orderData.quantity || 1,
          mobile: orderData.customer_phone,
          email: orderData.customer_email || '',
          remarque: orderData.notes || '',
          is_fragile: orderData.is_fragile || 0,
          sms_alert: 1,
          nom: orderData.customer_name,
          adresse: orderData.customer_address,
          commune: orderData.customer_city,
          montant: orderData.total_amount
        }),
      });

      // Step 2: If Ecotrack creation successful, save to local database
      if (ecotrackResult && ecotrackResult.tracking) {
        const localOrderData = {
          order_number: orderData.order_number || `ECO-${Date.now()}`,
          customer_name: orderData.customer_name,
          customer_phone: orderData.customer_phone,
          customer_email: orderData.customer_email || '',
          customer_address: orderData.customer_address,
          customer_city: orderData.customer_city,
          product_details: orderData.product_details || { name: orderData.product_name },
          total_amount: orderData.total_amount,
          delivery_amount: orderData.delivery_amount || 0,
          final_total: orderData.total_amount + (orderData.delivery_amount || 0),
          status: 'pending',
          payment_status: 'pending',
          notes: orderData.notes || '',
          tracking_number: ecotrackResult.tracking,
          ecotrack_synced: true,
          delivery_type: orderData.delivery_type || 'home'
        };

        try {
          // Save to local database via your backend API
          const localResult = await api.post('/api/orders', localOrderData);
          
          // Return combined result
          return {
            ...ecotrackResult,
            localOrderId: localResult.data.id,
            savedToDatabase: true
          };
        } catch (localError) {
          console.error('Failed to save order to local database:', localError);
          // Still return Ecotrack result even if local save fails
          return {
            ...ecotrackResult,
            savedToDatabase: false,
            localError: localError.message
          };
        }
      }

      return ecotrackResult;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  // 2. Create multiple orders (bulk)
  async createBulkOrders(ordersArray) {
    const results = [];
    const errors = [];

    for (const orderData of ordersArray) {
      try {
        // Create each order individually to handle local database saving
        const result = await this.createOrder(orderData);
        results.push({
          ...result,
          originalData: orderData,
          success: true
        });
      } catch (error) {
        console.error('Error creating bulk order:', error);
        errors.push({
          orderData,
          error: error.message,
          success: false
        });
      }
    }

    return {
      results,
      errors,
      successCount: results.length,
      errorCount: errors.length,
      trackings: results.filter(r => r.tracking).map(r => r.tracking)
    };
  }

  // 3. Track a parcel
  async trackParcel(trackingNumber) {
    return this.makeRequest(`/api/public/get/trackings/info`, {
      method: 'POST',
      body: JSON.stringify({
        api_token: this.apiToken,
        user_guid: this.userGuid,
        trackings: [trackingNumber]
      })
    });
  }

  // Helper method to parse CSV
  parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        return obj;
      });
  }

  // Helper method to validate order data
  validateOrderData(orderData) {
    const required = ['customer_name', 'customer_phone', 'customer_address', 'customer_city', 'total_amount'];
    
    for (const field of required) {
      if (!orderData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate phone format
    if (orderData.customer_phone && !/^[0-9]{10}$/.test(orderData.customer_phone)) {
      throw new Error('Invalid phone format (must be 10 digits)');
    }
    
    return true;
  }

  // Convert CSV data to Ecotrack format
  convertCSVToEcotrackFormat(csvData) {
    return csvData.map(row => ({
      order_number: row.order_number || `ORDER-${Date.now()}`,
      customer_name: row.customer_name || row.FULL_NAME,
      customer_phone: row.customer_phone || row.PHONE,
      customer_address: row.customer_address || row.adresse,
      customer_city: row.customer_city || row.COMMUNE,
      total_amount: parseFloat(row.total_amount || row['PRIX total']) || 0,
      product_details: { name: row.product_name || row.PRODUCT },
      notes: row.notes || row.note,
      delivery_type: 'home'
    }));
  }

  // Helper method to validate order data
  validateOrderData(orderData) {
    const required = ['type_id', 'ref_client', 'mobile'];
    const missing = required.filter(field => !orderData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate mobile number format
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(orderData.mobile)) {
      throw new Error('Mobile number must be 10 digits');
    }

    return true;
  }

  // Helper method to parse CSV data
  parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  }

  // Helper method to convert CSV data to Ecotrack format
  convertCSVToEcotrackFormat(csvData) {
    return csvData.map(row => ({
      type_id: parseInt(row.type_id) || 1,
      ref_client: row.ref_client || '',
      product_codes: row.product_codes || '',
      quantite: parseInt(row.quantite) || 1,
      mobile: row.mobile || '',
      email: row.email || '',
      remarque: row.remarque || '',
      is_fragile: parseInt(row.is_fragile) || 0,
      sms_alert: parseInt(row.sms_alert) || 1,
    }));
  }

  // Method to get order types (you might need to implement this based on Ecotrack API)
  getOrderTypes() {
    return [
      { id: 1, name: 'Standard Delivery' },
      { id: 2, name: 'Express Delivery' },
      { id: 3, name: 'Same Day Delivery' },
    ];
  }
}

export const ecotrackService = new EcotrackService();
export default ecotrackService;
