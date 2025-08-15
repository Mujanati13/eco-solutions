import api from './api';
import { configService } from './configService';

class EcotrackHybridService {
  constructor() {
    this.accountsCache = new Map();
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 300000; // 5 minutes cache
  }

  /**
   * Intelligently get the appropriate EcoTrack account for an order
   * @param {Object} orderData - Order with location information
   * @returns {Promise<Object>} - Account credentials and metadata
   */
  async getAccountForOrder(orderData) {
    try {
      console.log('🤖 EcoTrack Hybrid Service: Determining best account for order');
      console.log('📦 Order data:', {
        id: orderData.id,
        location_id: orderData.location_id,
        stock_location_id: orderData.stock_location_id,
        boutique_id: orderData.boutique_id
      });

      // Step 1: Try to determine location from order
      const locationId = this.extractLocationFromOrder(orderData);
      console.log(`📍 Extracted location ID: ${locationId}`);

      if (locationId) {
        // Step 2: Try multi-account system first
        try {
          console.log('🔄 Attempting multi-account lookup...');
          const multiAccountResult = await this.getMultiAccount(locationId);
          
          if (multiAccountResult.success) {
            console.log('✅ Multi-account found:', multiAccountResult.account.account_name);
            return {
              success: true,
              account: multiAccountResult.account,
              source: 'multi_account',
              is_fallback: multiAccountResult.is_fallback || false,
              location_id: locationId
            };
          }
        } catch (multiError) {
          console.log('⚠️ Multi-account lookup failed:', multiError.message);
        }
      }

      // Step 3: Fallback to single account system
      console.log('🔄 Falling back to single account system...');
      try {
        const singleAccountResult = await this.getSingleAccount();
        
        if (singleAccountResult.success) {
          console.log('✅ Single account found and configured');
          return {
            success: true,
            account: singleAccountResult.account,
            source: 'single_account',
            is_fallback: true,
            location_id: null
          };
        }
      } catch (singleError) {
        console.log('❌ Single account lookup failed:', singleError.message);
      }

      // Step 4: No accounts available
      throw new Error('No EcoTrack accounts available (neither multi-account nor single account configured)');

    } catch (error) {
      console.error('❌ EcoTrack Hybrid Service error:', error);
      throw error;
    }
  }

  /**
   * Extract location ID from order data
   * @param {Object} orderData - Order information
   * @returns {number|null} - Location ID or null
   */
  extractLocationFromOrder(orderData) {
    // Try various fields that might contain location information
    return orderData.location_id || 
           orderData.stock_location_id || 
           orderData.boutique_id || 
           orderData.warehouse_id ||
           null;
  }

  /**
   * Get account from multi-account system
   * @param {number} locationId - Location/boutique ID
   * @returns {Promise<Object>} - Multi-account result
   */
  async getMultiAccount(locationId) {
    try {
      // Check cache first
      const cacheKey = `multi_${locationId}`;
      const now = Date.now();
      
      if (this.accountsCache.has(cacheKey) && 
          this.cacheTimestamp && 
          (now - this.cacheTimestamp < this.CACHE_DURATION)) {
        console.log(`🚀 Using cached multi-account for location ${locationId}`);
        return { success: true, account: this.accountsCache.get(cacheKey) };
      }

      const response = await api.get(`/api/ecotrack-multi-account/accounts/by-location/${locationId}`);
      
      if (response.data && response.data.success) {
        // Transform to standard format
        const account = {
          id: response.data.account.id,
          account_name: response.data.account.account_name,
          api_token: response.data.account.api_token,
          user_guid: response.data.account.user_guid,
          location_id: response.data.account.location_id,
          location_name: response.data.account.location_name,
          is_enabled: response.data.account.is_enabled,
          is_default: response.data.account.is_default
        };

        // Cache the result
        this.accountsCache.set(cacheKey, account);
        this.cacheTimestamp = now;

        return {
          success: true,
          account: account,
          is_fallback: response.data.is_fallback || false
        };
      }

      throw new Error('Multi-account API returned unsuccessful response');
    } catch (error) {
      console.error('Multi-account lookup error:', error);
      throw new Error(`Multi-account lookup failed: ${error.message}`);
    }
  }

  /**
   * Get account from single account system
   * @returns {Promise<Object>} - Single account result
   */
  async getSingleAccount() {
    try {
      // Check cache first
      const cacheKey = 'single_account';
      const now = Date.now();
      
      if (this.accountsCache.has(cacheKey) && 
          this.cacheTimestamp && 
          (now - this.cacheTimestamp < this.CACHE_DURATION)) {
        console.log('🚀 Using cached single account');
        return { success: true, account: this.accountsCache.get(cacheKey) };
      }

      // Use existing configService to get credentials
      const credentials = await configService.getEcotrackCredentials();
      
      if (credentials && credentials.apiToken && credentials.userGuid) {
        const account = {
          id: 'single',
          account_name: 'Single Account (Legacy)',
          api_token: credentials.apiToken,
          user_guid: credentials.userGuid,
          location_id: null,
          location_name: 'Global',
          is_enabled: true,
          is_default: true
        };

        // Cache the result
        this.accountsCache.set(cacheKey, account);
        this.cacheTimestamp = now;

        return {
          success: true,
          account: account,
          is_fallback: false
        };
      }

      throw new Error('Single account credentials not available');
    } catch (error) {
      console.error('Single account lookup error:', error);
      throw new Error(`Single account lookup failed: ${error.message}`);
    }
  }

  /**
   * Create order using the best available account
   * @param {Object} orderData - Order information
   * @returns {Promise<Object>} - Creation result
   */
  async createOrder(orderData) {
    try {
      console.log('🚚 EcoTrack Hybrid: Creating order');
      
      // Get the appropriate account
      const accountResult = await this.getAccountForOrder(orderData);
      const account = accountResult.account;
      
      console.log(`🔑 Using account: ${account.account_name} (${accountResult.source})`);
      console.log(`📍 Account location: ${account.location_name || 'Global'}`);
      console.log(`🔄 Is fallback: ${accountResult.is_fallback}`);

      // Determine which API to use based on account source
      let createResponse;
      
      if (accountResult.source === 'multi_account') {
        // Use multi-account API
        console.log('🔀 Using multi-account API');
        createResponse = await api.post('/api/ecotrack-multi-account/create-order', {
          orderData: orderData,
          orderId: orderData.id,
          locationId: accountResult.location_id
        });
      } else {
        // Use single account API
        console.log('🔀 Using single account API');
        createResponse = await api.post('/api/ecotrack/create-order', {
          orderData: orderData,
          orderId: orderData.id
        });
      }

      if (createResponse.data && createResponse.data.success) {
        console.log('✅ Order created successfully via hybrid service');
        return {
          success: true,
          tracking_id: createResponse.data.data.tracking_id,
          account_used: {
            name: account.account_name,
            location_name: account.location_name,
            source: accountResult.source,
            is_fallback: accountResult.is_fallback
          },
          ...createResponse.data.data
        };
      }

      throw new Error(`Order creation failed: ${createResponse.data?.message || 'Unknown error'}`);
    } catch (error) {
      console.error('❌ EcoTrack Hybrid create order error:', error);
      throw error;
    }
  }

  /**
   * Delete order using appropriate account
   * @param {string} trackingId - EcoTrack tracking ID
   * @param {Object} orderData - Order information (optional, for account selection)
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteOrder(trackingId, orderData = null) {
    try {
      console.log('🗑️ EcoTrack Hybrid: Deleting order');
      
      let deleteResponse;
      
      if (orderData) {
        // Try to get account for this order
        try {
          const accountResult = await this.getAccountForOrder(orderData);
          console.log(`🔑 Using specific account for deletion: ${accountResult.account.account_name}`);
          
          if (accountResult.source === 'multi_account') {
            deleteResponse = await api.post('/api/ecotrack-multi-account/delete-order', {
              trackingId: trackingId,
              orderId: orderData.id,
              locationId: accountResult.location_id
            });
          } else {
            deleteResponse = await api.post('/api/ecotrack/delete-order', {
              trackingId: trackingId,
              orderId: orderData.id
            });
          }
        } catch (accountError) {
          console.log('⚠️ Could not determine account, trying single account API');
          deleteResponse = await api.post('/api/ecotrack/delete-order', {
            trackingId: trackingId,
            orderId: orderData.id
          });
        }
      } else {
        // No order data, try single account API
        console.log('🔀 No order data provided, using single account API');
        deleteResponse = await api.post('/api/ecotrack/delete-order', {
          trackingId: trackingId
        });
      }

      if (deleteResponse.data && deleteResponse.data.success) {
        console.log('✅ Order deleted successfully via hybrid service');
        return deleteResponse.data;
      }

      throw new Error(`Order deletion failed: ${deleteResponse.data?.message || 'Unknown error'}`);
    } catch (error) {
      console.error('❌ EcoTrack Hybrid delete order error:', error);
      throw error;
    }
  }

  /**
   * Get tracking information using appropriate account
   * @param {Array<string>} trackingIds - Array of tracking IDs
   * @param {Object} orderData - Order information (optional, for account selection)
   * @returns {Promise<Object>} - Tracking information
   */
  async getTrackingInfo(trackingIds, orderData = null) {
    try {
      console.log('🔍 EcoTrack Hybrid: Getting tracking info');
      
      let trackingResponse;
      
      if (orderData) {
        try {
          const accountResult = await this.getAccountForOrder(orderData);
          console.log(`🔑 Using specific account for tracking: ${accountResult.account.account_name}`);
          
          if (accountResult.source === 'multi_account') {
            trackingResponse = await api.post('/api/ecotrack-multi-account/tracking-info', {
              trackingIds: trackingIds,
              locationId: accountResult.location_id
            });
          } else {
            trackingResponse = await api.post('/api/ecotrack/tracking-info', {
              trackingIds: trackingIds
            });
          }
        } catch (accountError) {
          console.log('⚠️ Could not determine account, trying single account API');
          trackingResponse = await api.post('/api/ecotrack/tracking-info', {
            trackingIds: trackingIds
          });
        }
      } else {
        // No order data, try single account API
        console.log('🔀 No order data provided, using single account API');
        trackingResponse = await api.post('/api/ecotrack/tracking-info', {
          trackingIds: trackingIds
        });
      }

      if (trackingResponse.data && trackingResponse.data.success) {
        console.log('✅ Tracking info retrieved successfully via hybrid service');
        return trackingResponse.data;
      }

      throw new Error(`Tracking info retrieval failed: ${trackingResponse.data?.message || 'Unknown error'}`);
    } catch (error) {
      console.error('❌ EcoTrack Hybrid tracking info error:', error);
      throw error;
    }
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.accountsCache.clear();
    this.cacheTimestamp = null;
    console.log('🗑️ EcoTrack Hybrid cache cleared');
  }

  /**
   * Get service status and available accounts
   * @returns {Promise<Object>} - Service status
   */
  async getStatus() {
    try {
      const status = {
        hybrid_service: true,
        multi_account_available: false,
        single_account_available: false,
        total_accounts: 0,
        recommended_setup: 'single_account'
      };

      // Check multi-account system
      try {
        const multiResponse = await api.get('/api/ecotrack-multi-account/accounts');
        if (multiResponse.data && multiResponse.data.success) {
          status.multi_account_available = true;
          status.total_accounts = multiResponse.data.accounts.length;
          if (status.total_accounts > 0) {
            status.recommended_setup = 'multi_account';
          }
        }
      } catch (multiError) {
        console.log('Multi-account system not available:', multiError.message);
      }

      // Check single account system
      try {
        const singleResult = await this.getSingleAccount();
        if (singleResult.success) {
          status.single_account_available = true;
        }
      } catch (singleError) {
        console.log('Single account system not available:', singleError.message);
      }

      return status;
    } catch (error) {
      console.error('Error getting hybrid service status:', error);
      throw error;
    }
  }
}

export const ecotrackHybridService = new EcotrackHybridService();
export default ecotrackHybridService;
