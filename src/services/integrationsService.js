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

  // Ecotrack
  async createEcotrackDelivery(orderId) {
    try {
      const response = await api.post(`/api/integrations/ecotrack/create-delivery/${orderId}`);
      return response.data;
    } catch (error) {
      console.error('Create Ecotrack delivery error:', error);
      throw error;
    }
  },

  async getEcotrackStatus(trackingId) {
    try {
      const response = await api.get(`/api/integrations/ecotrack/status/${trackingId}`);
      return response.data;
    } catch (error) {
      console.error('Get Ecotrack status error:', error);
      throw error;
    }
  },

  async updateEcotrackStatus(trackingId, status) {
    try {
      const response = await api.patch(`/api/integrations/ecotrack/status/${trackingId}`, {
        status
      });
      return response.data;
    } catch (error) {
      console.error('Update Ecotrack status error:', error);
      throw error;
    }
  },

  async getEcotrackMetrics(startDate, endDate) {
    try {
      const response = await api.get('/api/integrations/ecotrack/metrics', {
        params: { start_date: startDate, end_date: endDate }
      });
      return response.data;
    } catch (error) {
      console.error('Get Ecotrack metrics error:', error);
      throw error;
    }
  },

  async testEcotrackConnection() {
    try {
      const response = await api.get('/api/integrations/ecotrack/test');
      return response.data;
    } catch (error) {
      console.error('Test Ecotrack connection error:', error);
      throw error;
    }
  }
};

export default integrationsService;
