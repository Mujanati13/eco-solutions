import api from './api';

class GoogleAuthService {
  // Get Google OAuth authorization URL
  async getAuthUrl() {
    try {
      const response = await api.get('/google/auth/google');
      return response.data;
    } catch (error) {
      console.error('Error getting Google auth URL:', error);
      throw error;
    }
  }

  // Check Google authentication status
  async getAuthStatus() {
    try {
      const response = await api.get('/google/auth/google/status');
      return response.data;
    } catch (error) {
      console.error('Error checking Google auth status:', error);
      throw error;
    }
  }

  // Revoke Google authentication
  async revokeAuth() {
    try {
      const response = await api.delete('/google/auth/google');
      return response.data;
    } catch (error) {
      console.error('Error revoking Google auth:', error);
      throw error;
    }
  }

  // Test Google Sheets connection
  async testConnection() {
    try {
      const response = await api.get('/google/test-connection');
      return response.data;
    } catch (error) {
      console.error('Error testing Google connection:', error);
      throw error;
    }
  }

  // List user's Google Sheets files
  async listGoogleSheets() {
    try {
      const response = await api.get('/google/list-sheets');
      return response.data;
    } catch (error) {
      console.error('Error listing Google Sheets:', error);
      throw error;
    }
  }

  // Get sheets within a specific spreadsheet
  async getSpreadsheetTabs(spreadsheetId) {
    try {
      const response = await api.get(`/google/spreadsheet/${spreadsheetId}/tabs`);
      return response.data;
    } catch (error) {
      console.error('Error getting spreadsheet tabs:', error);
      throw error;
    }
  }

  // Preview data from a specific sheet
  async previewSheetData(spreadsheetId, sheetName = 'Sheet1', range = 'A1:L10') {
    try {
      const response = await api.get(`/google/spreadsheet/${spreadsheetId}/preview`, {
        params: { sheet: sheetName, range }
      });
      return response.data;
    } catch (error) {
      console.error('Error previewing sheet data:', error);
      throw error;
    }
  }

  // Import orders from a Google Sheet
  async importOrdersFromSheet(spreadsheetId, sheetName = 'Sheet1', options = {}) {
    try {
      const response = await api.post('/google/import-orders', {
        spreadsheetId,
        sheetName,
        ...options
      });
      return response.data;
    } catch (error) {
      console.error('Error importing orders from sheet:', error);
      throw error;
    }
  }

  // Debug method to test authentication
  async debugUser() {
    try {
      const response = await api.get('/google/debug-user');
      return response.data;
    } catch (error) {
      console.error('Error in debug call:', error);
      throw error;
    }
  }

  // Debug Google Drive access
  async debugDriveAccess() {
    try {
      const response = await api.get('/google/debug-drive');
      return response.data;
    } catch (error) {
      console.error('Error in drive debug call:', error);
      throw error;
    }
  }

  // Open Google authorization in popup window
  openAuthPopup() {
    return new Promise(async (resolve, reject) => {
      try {
        // Get authorization URL
        const authData = await this.getAuthUrl();
        
        // Open popup window
        const popup = window.open(
          authData.authUrl,
          'google-auth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for messages from the popup
        const messageListener = (event) => {
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
            window.removeEventListener('message', messageListener);
            popup.close();
            
            // Check auth status to get complete user info
            this.getAuthStatus()
              .then(status => resolve(status))
              .catch(reject);
          } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
            window.removeEventListener('message', messageListener);
            popup.close();
            reject(new Error(event.data.error || 'Authentication failed'));
          }
        };

        window.addEventListener('message', messageListener);

        // Fallback: Poll for popup closure (in case postMessage fails)
        const pollTimer = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(pollTimer);
              window.removeEventListener('message', messageListener);
              
              // Check auth status after popup closes
              this.getAuthStatus()
                .then(status => {
                  if (status.isAuthenticated) {
                    resolve(status);
                  } else {
                    reject(new Error('Authentication was cancelled or failed'));
                  }
                })
                .catch(reject);
            }
          } catch (error) {
            // Ignore cross-origin errors when checking popup status
          }
        }, 1000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollTimer);
          window.removeEventListener('message', messageListener);
          if (!popup.closed) {
            popup.close();
          }
          reject(new Error('Authentication timed out'));
        }, 5 * 60 * 1000);

      } catch (error) {
        reject(error);
      }
    });
  }
}

export default new GoogleAuthService();
