const axios = require('axios');
const { pool } = require('../../config/database');

class EcotrackMultiAccountService {
  constructor() {
    this.baseURL = 'https://app.noest-dz.com/api';
    this.accountsCache = new Map();
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 300000; // 5 minutes cache
  }

  /**
   * Get EcoTrack account for a specific location
   * @param {number} locationId - Location/boutique ID
   * @returns {Promise<Object>} - EcoTrack account credentials
   */
  async getAccountByLocation(locationId) {
    try {
      console.log(`🔍 Getting EcoTrack account for location: ${locationId}`);
      
      // Check cache first
      const cacheKey = `location_${locationId}`;
      const now = Date.now();
      
      if (this.accountsCache.has(cacheKey) && 
          this.cacheTimestamp && 
          (now - this.cacheTimestamp < this.CACHE_DURATION)) {
        console.log(`✅ Using cached account for location ${locationId}`);
        return this.accountsCache.get(cacheKey);
      }
      
      // Query database for location-specific account
      const [accounts] = await pool.query(`
        SELECT 
          ea.id, ea.location_id, ea.account_name, ea.api_token, 
          ea.user_guid, ea.is_enabled, ea.is_default,
          sl.name as location_name, sl.code as location_code
        FROM ecotrack_accounts ea
        LEFT JOIN stock_locations sl ON ea.location_id = sl.id
        WHERE ea.location_id = ? AND ea.is_enabled = 1 AND sl.is_active = 1
      `, [locationId]);
      
      let account = null;
      
      if (accounts.length > 0) {
        account = accounts[0];
        console.log(`✅ Found specific account for location ${locationId}: ${account.account_name}`);
      } else {
        // Fallback to default account
        console.log(`⚠️ No specific account found for location ${locationId}, using default account`);
        const [defaultAccounts] = await pool.query(`
          SELECT 
            ea.id, ea.location_id, ea.account_name, ea.api_token, 
            ea.user_guid, ea.is_enabled, ea.is_default,
            sl.name as location_name, sl.code as location_code
          FROM ecotrack_accounts ea
          LEFT JOIN stock_locations sl ON ea.location_id = sl.id
          WHERE ea.is_default = 1 AND ea.is_enabled = 1 AND sl.is_active = 1
        `);
        
        if (defaultAccounts.length > 0) {
          account = { ...defaultAccounts[0], is_fallback: true };
          console.log(`✅ Using default account: ${account.account_name}`);
        } else {
          throw new Error('No EcoTrack account found for location and no default account available');
        }
      }
      
      // Cache the result
      this.accountsCache.set(cacheKey, account);
      this.cacheTimestamp = now;
      
      return account;
    } catch (error) {
      console.error(`❌ Error getting EcoTrack account for location ${locationId}:`, error);
      throw error;
    }
  }

  /**
   * Get default EcoTrack account
   * @returns {Promise<Object>} - Default EcoTrack account credentials
   */
  async getDefaultAccount() {
    try {
      console.log('🔍 Getting default EcoTrack account');
      
      const [accounts] = await pool.query(`
        SELECT 
          ea.id, ea.location_id, ea.account_name, ea.api_token, 
          ea.user_guid, ea.is_enabled, ea.is_default,
          sl.name as location_name, sl.code as location_code
        FROM ecotrack_accounts ea
        LEFT JOIN stock_locations sl ON ea.location_id = sl.id
        WHERE ea.is_default = 1 AND ea.is_enabled = 1 AND sl.is_active = 1
      `);
      
      if (accounts.length === 0) {
        throw new Error('No default EcoTrack account found');
      }
      
      console.log(`✅ Found default account: ${accounts[0].account_name}`);
      return accounts[0];
    } catch (error) {
      console.error('❌ Error getting default EcoTrack account:', error);
      throw error;
    }
  }

  /**
   * Create axios client for specific account
   * @param {Object} account - EcoTrack account with credentials
   * @returns {Object} - Configured axios client
   */
  createClient(account) {
    return axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${account.api_token}`,
        'partner-id': account.user_guid
      },
      timeout: 30000
    });
  }

  /**
   * Create a new order in EcoTrack using specific account
   * @param {number} locationId - Location/boutique ID
   * @param {Object} orderData - Order information
   * @returns {Promise<Object>} - Tracking information
   */
  async createShipment(locationId, orderData) {
    try {
      console.log(`🚚 Creating EcoTrack shipment for location ${locationId}`);
      
      // Get account for this location
      const account = await this.getAccountByLocation(locationId);
      console.log(`🔑 Using account: ${account.account_name} (${account.is_fallback ? 'fallback' : 'specific'})`);
      
      // Create axios client with account credentials
      const client = this.createClient(account);
      
      // Validate required fields
      if (!orderData.customer_name || !orderData.customer_phone) {
        throw new Error('Customer name and phone are required');
      }

      // Parse product details if it's a string
      let productDetails;
      if (typeof orderData.product_details === 'string') {
        try {
          productDetails = JSON.parse(orderData.product_details);
        } catch {
          productDetails = { name: orderData.product_details };
        }
      } else {
        productDetails = orderData.product_details || {};
      }

      // Prepare order data according to EcoTrack API requirements
      const ecotrackOrderData = {
        api_token: account.api_token,
        user_guid: account.user_guid,
        reference: orderData.order_number || `REF-${Date.now()}`,
        client: orderData.customer_name || 'Customer',
        phone: (orderData.customer_phone?.replace(/\D/g, '') || '0555123456').substring(0, 10),
        phone_2: orderData.customer_phone_2 ? orderData.customer_phone_2.replace(/\D/g, '').substring(0, 10) : undefined,
        adresse: orderData.customer_address || orderData.customer_city || 'Address',
        wilaya_id: orderData.wilaya_id || 16, // Default to Algiers
        commune: orderData.commune || orderData.customer_city || 'Commune',
        montant: parseFloat(orderData.total_amount) || 0,
        remarque: orderData.notes || '',
        produit: productDetails.name || 'Product',
        type_id: 1, // Standard delivery
        poids: Math.max(1, Math.floor(orderData.weight || productDetails.weight || 1)),
        stop_desk: 0, // Home delivery
        stock: 0,
        can_open: 0
      };

      console.log(`🌐 Making EcoTrack API request using account: ${account.account_name}`);
      console.log(`   API Token: ***${account.api_token.slice(-4)}`);
      console.log(`   User GUID: ${account.user_guid}`);
      
      // Create order via EcoTrack API
      const response = await axios.post('https://app.noest-dz.com/api/public/create/order', ecotrackOrderData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${account.api_token}`,
          'partner-id': account.user_guid
        },
        timeout: 30000
      });

      console.log('🎯 EcoTrack API Response:', response.data);
      
      // Handle different response formats
      let trackingId;
      let success = false;
      
      if (response.data) {
        if (response.data.success === false) {
          throw new Error(`EcoTrack API Error: ${response.data.message || 'Unknown error'}`);
        }
        
        if (response.data.success === true || response.data.success === 1 || 
            response.status === 200 || response.status === 201) {
          success = true;
          trackingId = response.data.tracking || response.data.tracking_id || response.data.id;
        }
      }
      
      if (!success || !trackingId) {
        console.error('❌ Unexpected API response format:', response.data);
        throw new Error(`Unexpected API response: ${JSON.stringify(response.data)}`);
      }

      console.log(`✅ EcoTrack order created with tracking: ${trackingId} using account: ${account.account_name}`);

      return {
        success: true,
        tracking_id: trackingId,
        status: 'created',
        tracking_url: `https://app.noest-dz.com/tracking/${trackingId}`,
        account_used: {
          id: account.id,
          name: account.account_name,
          location_name: account.location_name,
          is_fallback: account.is_fallback || false
        }
      };
    } catch (error) {
      console.error(`🚨 EcoTrack multi-account shipment creation error:`, error);
      throw new Error(`Failed to create EcoTrack shipment: ${error.message}`);
    }
  }

  /**
   * Cancel/delete a shipment in EcoTrack
   * @param {string} trackingId - EcoTrack tracking ID
   * @param {number} locationId - Location ID (optional, for account selection)
   * @returns {Promise<Object>} - Cancellation result
   */
  async cancelShipment(trackingId, locationId = null) {
    try {
      console.log(`🗑️ Cancelling EcoTrack shipment: ${trackingId}`);
      
      let account;
      if (locationId) {
        // Try to use location-specific account
        try {
          account = await this.getAccountByLocation(locationId);
          console.log(`🔑 Using location-specific account: ${account.account_name}`);
        } catch (error) {
          console.log(`⚠️ Could not get location-specific account, using default`);
          account = await this.getDefaultAccount();
        }
      } else {
        // Use default account
        account = await this.getDefaultAccount();
        console.log(`🔑 Using default account: ${account.account_name}`);
      }
      
      const requestData = {
        api_token: account.api_token,
        user_guid: account.user_guid,
        tracking: trackingId.trim()
      };

      console.log(`🌐 Making EcoTrack cancel request using account: ${account.account_name}`);
      
      const response = await axios.post('https://app.noest-dz.com/api/public/delete/order', requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      console.log('🎯 EcoTrack cancel response:', response.data);

      if (!response.data.success) {
        throw new Error(`Failed to delete order in EcoTrack: ${response.data.message || 'Unknown error'}`);
      }

      console.log(`✅ EcoTrack order cancelled successfully: ${trackingId} using account: ${account.account_name}`);

      return {
        success: true,
        tracking_id: trackingId,
        status: 'cancelled',
        message: 'Order deleted successfully',
        account_used: {
          id: account.id,
          name: account.account_name,
          location_name: account.location_name
        }
      };
    } catch (error) {
      console.error(`🚨 EcoTrack cancellation error:`, error);
      throw new Error(`Failed to cancel EcoTrack shipment: ${error.message}`);
    }
  }

  /**
   * Get tracking information for orders
   * @param {Array<string>} trackingIds - Array of tracking IDs
   * @param {number} locationId - Location ID (optional, for account selection)
   * @returns {Promise<Object>} - Tracking information
   */
  async getTrackingInfo(trackingIds, locationId = null) {
    try {
      console.log(`🔍 Getting tracking info for: ${trackingIds.join(', ')}`);
      
      let account;
      if (locationId) {
        try {
          account = await this.getAccountByLocation(locationId);
        } catch (error) {
          account = await this.getDefaultAccount();
        }
      } else {
        account = await this.getDefaultAccount();
      }
      
      console.log(`🔑 Using account: ${account.account_name}`);
      
      const response = await axios.post('https://app.noest-dz.com/api/public/get/trackings/info', {
        api_token: account.api_token,
        user_guid: account.user_guid,
        trackings: trackingIds
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      console.log('🎯 EcoTrack tracking info response:', response.data);
      
      return {
        ...response.data,
        account_used: {
          id: account.id,
          name: account.account_name,
          location_name: account.location_name
        }
      };
    } catch (error) {
      console.error('❌ Error getting tracking info:', error);
      throw new Error(`Failed to get tracking information: ${error.message}`);
    }
  }

  /**
   * Add remark to EcoTrack shipment
   * @param {string} trackingId - EcoTrack tracking ID
   * @param {string} content - Remark content
   * @param {number} locationId - Location ID (optional, for account selection)
   * @returns {Promise<Object>} - Add remark result
   */
  async addRemark(trackingId, content, locationId = null) {
    try {
      console.log(`💬 Adding remark to EcoTrack tracking: ${trackingId}`);
      
      let account;
      if (locationId) {
        try {
          account = await this.getAccountByLocation(locationId);
        } catch (error) {
          account = await this.getDefaultAccount();
        }
      } else {
        account = await this.getDefaultAccount();
      }
      
      console.log(`🔑 Using account: ${account.account_name}`);
      
      const response = await axios.post('https://app.noest-dz.com/api/public/add/maj', {
        api_token: account.api_token,
        tracking: trackingId,
        content: content
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000
      });

      console.log('🎯 EcoTrack add remark response:', response.data);
      
      return {
        ...response.data,
        account_used: {
          id: account.id,
          name: account.account_name,
          location_name: account.location_name
        }
      };
    } catch (error) {
      console.error('❌ Error adding remark:', error);
      throw new Error(`Failed to add remark: ${error.message}`);
    }
  }

  /**
   * Test connection for specific account
   * @param {Object} account - Account with credentials
   * @returns {Promise<boolean>} - Connection success
   */
  async testConnection(account) {
    try {
      console.log(`🔍 Testing connection for account: ${account.account_name || 'Unknown'}`);
      
      const response = await axios.post('https://app.noest-dz.com/api/public/get/desks', {
        api_token: account.api_token,
        user_guid: account.user_guid
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000
      });
      
      console.log(`✅ Connection test successful for account: ${account.account_name}`);
      return true;
    } catch (error) {
      console.error(`❌ Connection test failed for account: ${account.account_name}`, error.message);
      return false;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.accountsCache.clear();
    this.cacheTimestamp = null;
    console.log('🗑️ EcoTrack multi-account cache cleared');
  }

  /**
   * Get all enabled accounts
   * @returns {Promise<Array>} - All enabled accounts
   */
  async getAllAccounts() {
    try {
      const [accounts] = await pool.query(`
        SELECT 
          ea.id, ea.location_id, ea.account_name, ea.api_token, 
          ea.user_guid, ea.is_enabled, ea.is_default,
          sl.name as location_name, sl.code as location_code
        FROM ecotrack_accounts ea
        LEFT JOIN stock_locations sl ON ea.location_id = sl.id
        WHERE ea.is_enabled = 1 AND sl.is_active = 1
        ORDER BY ea.is_default DESC, ea.account_name
      `);
      
      return accounts;
    } catch (error) {
      console.error('❌ Error getting all accounts:', error);
      throw error;
    }
  }
}

module.exports = new EcotrackMultiAccountService();
