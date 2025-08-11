import api from './api';

class ConfigService {
  constructor() {
    this.ecotrackConfig = null;
    this.credentialsCache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 30000; // 30 seconds cache
  }

  /**
   * Get Ecotrack configuration from backend
   * @returns {Promise<Object>} - Configuration object with apiToken and userGuid
   */
  async getEcotrackConfig() {
    try {
      const response = await api.get('/api/ecotrack/config');
      if (response.data) {
        // Store config in memory (don't expose full token)
        this.ecotrackConfig = {
          hasApiToken: !!response.data.apiToken,
          userGuid: response.data.userGuid,
          isEnabled: response.data.isEnabled
        };
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error getting Ecotrack config:', error);
      return null;
    }
  }

  /**
   * Get current stored configuration
   * @returns {Object|null} - Current configuration or null
   */
  getCurrentEcotrackConfig() {
    return this.ecotrackConfig;
  }

  /**
   * Get API credentials for making direct Ecotrack API calls
   * This fetches the current configuration from the backend Ecotrack service
   * @returns {Promise<Object>} - { apiToken, userGuid }
   */
  async getEcotrackCredentials() {
    try {
      // Check cache first
      const now = Date.now();
      if (this.credentialsCache && this.cacheTimestamp && (now - this.cacheTimestamp < this.CACHE_DURATION)) {
        console.log('🚀 Using cached Ecotrack credentials (age: ' + Math.round((now - this.cacheTimestamp) / 1000) + 's)');
        console.log('   Cached API Token:', this.credentialsCache.apiToken ? '***' + this.credentialsCache.apiToken.slice(-4) : 'Not set');
        console.log('   Cached User GUID:', this.credentialsCache.userGuid || 'Not set');
        return this.credentialsCache;
      }

      // Fetch current credentials from backend
      console.log('🔄 Fetching fresh Ecotrack credentials from backend');
      const response = await api.get('/api/ecotrack/credentials');
      
      console.log('📡 Backend response:', {
        status: response.status,
        hasData: !!response.data,
        isConfigured: response.data?.isConfigured,
        source: response.data?.source,
        apiToken: response.data?.apiToken ? '***' + response.data.apiToken.slice(-4) : 'Not set',
        userGuid: response.data?.userGuid || 'Not set'
      });
      
      if (response.data && response.data.isConfigured) {
        const credentials = {
          apiToken: response.data.apiToken,
          userGuid: response.data.userGuid
        };
        
        // Cache the credentials
        this.credentialsCache = credentials;
        this.cacheTimestamp = now;
        
        console.log('✅ Ecotrack credentials loaded from backend:', {
          apiToken: credentials.apiToken ? '***' + credentials.apiToken.slice(-4) : 'Not set',
          userGuid: credentials.userGuid || 'Not set',
          source: response.data.source
        });
        
        return credentials;
      }
      
      // If not configured, throw error instead of using fallbacks
      throw new Error('Ecotrack credentials not configured');
    } catch (error) {
      console.error('Error getting Ecotrack credentials:', error);
      // Still provide fallback for backward compatibility, but log warning
      console.warn('⚠️ Using fallback Ecotrack credentials - please configure in Ecotrack settings');
      return {
        apiToken: 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG',
        userGuid: '2QG0JDFP'
      };
    }
  }

  /**
   * Clear cached configuration
   */
  clearConfig() {
    this.ecotrackConfig = null;
    this.credentialsCache = null;
    this.cacheTimestamp = null;
    console.log('🗑️ Cleared Ecotrack configuration cache');
  }

  /**
   * Force refresh credentials on next call
   */
  refreshCredentials() {
    this.credentialsCache = null;
    this.cacheTimestamp = null;
    console.log('🔄 Marked Ecotrack credentials for refresh');
    console.log('🎯 Next getEcotrackCredentials() call will fetch fresh data from database');
  }

  /**
   * Force immediate credential refresh (bypass cache completely)
   */
  async forceRefreshCredentials() {
    console.log('🔄 Force refreshing Ecotrack credentials immediately...');
    this.credentialsCache = null;
    this.cacheTimestamp = null;
    
    try {
      const response = await api.get('/api/ecotrack/credentials');
      if (response.data && response.data.isConfigured) {
        const credentials = {
          apiToken: response.data.apiToken,
          userGuid: response.data.userGuid
        };
        
        // Update cache with fresh data
        this.credentialsCache = credentials;
        this.cacheTimestamp = Date.now();
        
        console.log('✅ Force refresh completed:', {
          apiToken: credentials.apiToken ? '***' + credentials.apiToken.slice(-4) : 'Not set',
          userGuid: credentials.userGuid || 'Not set',
          source: response.data.source || 'unknown'
        });
        
        return credentials;
      }
      throw new Error('Credentials not configured');
    } catch (error) {
      console.error('❌ Force refresh failed:', error);
      throw error;
    }
  }
}

export const configService = new ConfigService();
export default configService;
