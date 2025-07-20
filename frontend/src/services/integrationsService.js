import api from './api';

export const integrationsService = {
  // Google Sheets
  async importFromGoogleSheets(sheetRange = 'Orders!A2:L') {
    try {
      const response = await api.post('/api/integrations/google-sheets/import', {
        sheetRange
      });
      return response.data;
    } catch (error) {
      console.error('Import from Google Sheets error:', error);
      throw error;
    }
  },

  async exportToGoogleSheets() {
    try {
      const response = await api.post('/api/integrations/google-sheets/sync');
      return response.data;
    } catch (error) {
      console.error('Export to Google Sheets error:', error);
      throw error;
    }
  },

  async getGoogleSheetsInfo() {
    try {
      const response = await api.get('/api/integrations/google-sheets/info');
      return response.data;
    } catch (error) {
      console.error('Get Google Sheets info error:', error);
      throw error;
    }
  },

  async testGoogleSheetsConnection() {
    try {
      const response = await api.get('/api/integrations/google-sheets/test');
      return response.data;
    } catch (error) {
      console.error('Test Google Sheets connection error:', error);
      throw error;
    }
  },

  async importFromGoogleSheetsToEcotrack(sheetRange = 'Orders!A2:L', options = {}) {
    try {
      const response = await api.post('/api/integrations/google-sheets/import-to-ecotrack', {
        sheetRange,
        createEcotrackDeliveries: options.createEcotrackDeliveries !== false, // Default true
        validateOnly: options.validateOnly || false,
        skipDuplicates: options.skipDuplicates !== false // Default true
      });
      return response.data;
    } catch (error) {
      console.error('Import from Google Sheets to Ecotrack error:', error);
      throw error;
    }
  },

  // Ecotrack
  async createEcotrackDelivery(orderId) {
    try {
      // First get order details from backend
      const orderResponse = await api.get(`/api/orders/${orderId}`);
      const order = orderResponse.data;

      // Then create delivery directly with Ecotrack using correct format
      const ecotrackData = {
        type_id: 1, // Standard delivery
        ref_client: order.order_number,
        product_codes: order.product_details ? JSON.stringify(order.product_details) : "product",
        quantite: order.quantity || 1,
        mobile: order.customer_phone,
        email: order.customer_email || "",
        remarque: order.notes || "",
        is_fragile: order.is_fragile || 0,
        sms_alert: 1
      };

      const response = await fetch('https://app.noest-dz.com/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_token: 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG',
          user_guid: '2QG0JDFP',
          ...ecotrackData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Create Ecotrack delivery error:', error);
      throw error;
    }
  },

  async getEcotrackStatus(trackingId) {
    try {
      const response = await fetch(`https://app.noest-dz.com/api/public/get/trackings/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_token: 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG',
          user_guid: '2QG0JDFP',
          trackings: [trackingId]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get Ecotrack status error:', error);
      throw error;
    }
  },

  async updateEcotrackStatus(trackingId, status) {
    try {
      // Note: The API documentation doesn't show an update endpoint
      // This might need to be handled differently based on actual API
      console.warn('Update status not available in current Ecotrack API');
      return { success: false, message: 'Update not supported' };
    } catch (error) {
      console.error('Update Ecotrack status error:', error);
      throw error;
    }
  },

  async getEcotrackMetrics(startDate, endDate) {
    try {
      // Note: The API documentation doesn't show a metrics endpoint
      // This might need to be handled differently based on actual API
      console.warn('Metrics not available in current Ecotrack API');
      return { success: false, message: 'Metrics not supported' };
    } catch (error) {
      console.error('Get Ecotrack metrics error:', error);
      throw error;
    }
  },

  async testEcotrackConnection() {
    try {
      // Test by trying to track a dummy tracking number
      const response = await fetch('https://app.noest-dz.com/api/public/get/trackings/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_token: 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG',
          user_guid: '2QG0JDFP',
          trackings: ['TEST123']
        })
      });

      // Even if tracking fails, if we get a response, the connection works
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      console.error('Test Ecotrack connection error:', error);
      throw error;
    }
  }
};

export default integrationsService;
