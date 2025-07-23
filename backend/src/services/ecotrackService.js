const axios = require('axios');

class EcotrackService {
  constructor() {
    this.baseURL = 'https://app.noest-dz.com/api';
    this.apiToken = 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG';
    this.userGuid = '2QG0JDFP';
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
        'partner-id': this.userGuid
      },
      timeout: 30000
    });
  }

  /**
   * Validate that all required Ecotrack credentials are configured
   * @returns {boolean} - Whether credentials are valid
   */
  validateCredentials() {
    const missing = [];
    
    if (!this.apiToken) missing.push('ECOTRACK_API_TOKEN');
    if (!this.userGuid) missing.push('ECOTRACK_USER_GUID');
    
    if (missing.length > 0) {
      console.warn(`⚠️  Missing Ecotrack credentials: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }

  /**
   * Create a new order in Ecotrack using the new API endpoint
   * @param {Object} orderData - Order information
   * @returns {Promise<Object>} - Tracking information
   */
  async createShipment(orderData) {
    console.log(`🚚 EcotrackService.createShipment called with:`, orderData);
    
    if (!this.validateCredentials()) {
      console.error(`❌ Missing Ecotrack credentials`);
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
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

      // Prepare order data according to Ecotrack API requirements
      const ecotrackOrderData = {
        api_token: this.apiToken, // Required - from documentation
        user_guid: this.userGuid, // Required
        reference: orderData.order_number || `REF-${Date.now()}`, // Nullable | max:255
        client: orderData.customer_name || 'Customer', // Required | max:255
        phone: (orderData.customer_phone?.replace(/\D/g, '') || '0555123456').substring(0, 10), // Required | digits between 9,10
        adresse: orderData.customer_address || 'Address', // Required | max:255
        wilaya_id: 16, // Required | integer between 1,48 - Use Algiers (16) as default
        commune: 'Alger Centre', // Required | max:255 - Default commune for Algiers
        montant: parseFloat(orderData.total_amount) || 0, // Required | numeric
        remarque: orderData.notes || '', // max:255
        produit: productDetails.name || 'Product', // Required
        type_id: 1, // Required | integer between 1,3 (1: Livraison, 2: Échange, 3: Pick up)
        poids: productDetails.weight || 1, // Required | integer
        stop_desk: 0, // Required | integer between 0,1 (0: à domicile, 1: stop desk)
        stock: 0, // integer between 0,1 (0: Non, 1: Oui) - set to 0 since stock module is disabled
        can_open: 0 // integer between 0,1 (0: Non, 1: Oui) - default to no
      };

      console.log('🚚 Creating Ecotrack order with new API:', ecotrackOrderData);

      // Use the correct API endpoint for creating orders
      console.log('🌐 Making request to: https://app.noest-dz.com/api/public/create/order');
      console.log('🔑 Using headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
        'partner-id': this.userGuid
      });
      
      const createResponse = await axios.post('https://app.noest-dz.com/api/public/create/order', ecotrackOrderData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
          'partner-id': this.userGuid
        },
        timeout: 30000
      });
      
      console.log('🎯 Raw Ecotrack API Response:', createResponse.data);
      console.log('🎯 Response Status:', createResponse.status);
      console.log('🎯 Response Headers:', createResponse.headers);
      
      // Handle different response formats
      let trackingId;
      let success = false;
      
      if (createResponse.data) {
        // Check if API explicitly returned success: false
        if (createResponse.data.success === false) {
          throw new Error(`Ecotrack API Error: ${createResponse.data.message || 'Unknown error'}`);
        }
        
        // Check for success in different formats
        if (createResponse.data.success === true || createResponse.data.success === 1) {
          success = true;
          trackingId = createResponse.data.tracking || createResponse.data.tracking_id || createResponse.data.id;
        } else if (createResponse.status === 200 || createResponse.status === 201) {
          // Sometimes API returns 200/201 without explicit success field
          success = true;
          trackingId = createResponse.data.tracking || createResponse.data.tracking_id || createResponse.data.id || createResponse.data.data?.tracking;
        } else if (createResponse.data.message && !createResponse.data.errors) {
          // Check if it's a success message without explicit success flag
          success = true;
          trackingId = createResponse.data.tracking || createResponse.data.tracking_id || createResponse.data.id;
        }
      }
      
      if (!success || !trackingId) {
        console.error('❌ Unexpected API response format:', createResponse.data);
        throw new Error(`Unexpected API response: ${JSON.stringify(createResponse.data)}`);
      }

      console.log('✅ Ecotrack order created with tracking:', trackingId);

      return {
        success: true,
        tracking_id: trackingId,
        status: 'created', // Initial status
        tracking_url: `https://app.noest-dz.com/tracking/${trackingId}`
      };
    } catch (error) {
      console.error('🚨 Ecotrack API Error Details:');
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Response Data:', error.response?.data);
      console.error('Request URL:', error.config?.url);
      console.error('Request Method:', error.config?.method);
      console.error('Request Data:', error.config?.data);
      console.error('Full Error:', error.message);
      
      throw new Error(`Failed to create Ecotrack shipment: ${error.response?.status} ${error.response?.statusText} - ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Validate an order in Ecotrack (Step 2: Make visible to logistics)
   * @param {string} trackingId - Ecotrack tracking ID
   * @returns {Promise<Object>} - Validation result
   */
  async validateOrder(trackingId) {
    try {
      const response = await this.client.post('/valid/order', {
        api_token: this.apiToken,
        user_guid: this.userGuid,
        tracking: trackingId
      });

      if (!response.data.success) {
        throw new Error('Failed to validate order in Ecotrack');
      }

      console.log('✅ Ecotrack order validated:', trackingId);
      return { success: true, tracking_id: trackingId };
    } catch (error) {
      console.error('Ecotrack validate order error:', error.response?.data || error.message);
      throw new Error(`Failed to validate Ecotrack order: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Update order information in Ecotrack (only for unvalidated orders)
   * @param {string} trackingId - Ecotrack tracking ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} - Update result
   */
  async updateShipmentStatus(trackingId, updates) {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      const updateData = {
        api_token: this.apiToken,
        user_guid: this.userGuid,
        tracking: trackingId,
        ...updates // Include any fields to update
      };

      const response = await this.client.post('/update/order', updateData);

      if (!response.data.success) {
        throw new Error('Failed to update order in Ecotrack');
      }

      return {
        success: true,
        tracking_id: trackingId,
        message: 'Order updated successfully'
      };
    } catch (error) {
      console.error('Ecotrack update order error:', error.response?.data || error.message);
      throw new Error(`Failed to update Ecotrack order: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get tracking information for a single shipment
   * @param {string} trackingId - Ecotrack tracking ID
   * @returns {Promise<Object>} - Tracking information
   */
  async getTrackingInfo(trackingId) {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      // Use bulk tracking endpoint with single tracking ID
      const response = await this.client.post('/get/trackings/info', {
        api_token: this.apiToken,
        user_guid: this.userGuid,
        trackings: [trackingId]
      });

      const trackingData = response.data[trackingId];
      
      if (!trackingData) {
        return {
          success: false,
          error: 'Tracking ID not found'
        };
      }

      // Get the latest activity status
      const latestActivity = trackingData.activity && trackingData.activity.length > 0 
        ? trackingData.activity[0] 
        : null;

      return {
        success: true,
        tracking_id: trackingId,
        status: latestActivity ? latestActivity.event_key || latestActivity.event : 'upload',
        status_description: latestActivity ? latestActivity.event : 'Uploadé sur le système',
        last_update: latestActivity ? latestActivity.date : trackingData.OrderInfo.created_at,
        location: latestActivity ? latestActivity.by : '',
        order_info: trackingData.OrderInfo,
        tracking_history: trackingData.activity || []
      };
    } catch (error) {
      console.error('Ecotrack get tracking error:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'Tracking ID not found'
        };
      }
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get tracking status for multiple shipments (bulk)
   * @param {Array} trackingIds - Array of tracking IDs
   * @returns {Promise<Array>} - Array of tracking information
   */
  async getBulkTrackingInfo(trackingIds) {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      const response = await this.client.post('/get/trackings/info', {
        api_token: this.apiToken,
        user_guid: this.userGuid,
        trackings: trackingIds
      });

      return trackingIds.map(trackingId => {
        const trackingData = response.data[trackingId];
        
        if (!trackingData) {
          return {
            tracking_id: trackingId,
            success: false,
            error: 'Tracking ID not found'
          };
        }

        // Get the latest activity status
        const latestActivity = trackingData.activity && trackingData.activity.length > 0 
          ? trackingData.activity[0] 
          : null;

        return {
          tracking_id: trackingId,
          success: true,
          status: latestActivity ? latestActivity.event_key || latestActivity.event : 'upload',
          status_description: latestActivity ? latestActivity.event : 'Uploadé sur le système',
          last_update: latestActivity ? latestActivity.date : trackingData.OrderInfo.created_at,
          location: latestActivity ? latestActivity.by : ''
        };
      });
    } catch (error) {
      console.error('Ecotrack bulk tracking error:', error.response?.data || error.message);
      // Return individual failures for each tracking ID
      return trackingIds.map(id => ({
        tracking_id: id,
        success: false,
        error: error.response?.data?.message || error.message
      }));
    }
  }

  /**
   * Delete an order in Ecotrack (only before validation)
   * @param {string} trackingId - Ecotrack tracking ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} - Cancellation result
   */
  async cancelShipment(trackingId, reason = 'Order cancelled') {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      const response = await this.client.post('/delete/order', {
        api_token: this.apiToken,
        user_guid: this.userGuid,
        tracking: trackingId
      });

      if (!response.data.success) {
        throw new Error('Failed to delete order in Ecotrack');
      }

      return {
        success: true,
        tracking_id: trackingId,
        status: 'cancelled',
        message: 'Order deleted successfully'
      };
    } catch (error) {
      console.error('Ecotrack cancel shipment error:', error.response?.data || error.message);
      throw new Error(`Failed to cancel Ecotrack shipment: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Add a remark/update to an order
   * @param {string} trackingId - Ecotrack tracking ID
   * @param {string} content - Remark content (max 255 chars)
   * @returns {Promise<Object>} - Result
   */
  async addRemark(trackingId, content) {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      const response = await this.client.get('/add/maj', {
        params: {
          api_token: this.apiToken,
          tracking: trackingId,
          content: content.substring(0, 255) // Ensure max 255 chars
        }
      });

      return {
        success: true,
        tracking_id: trackingId,
        message: 'Remark added successfully'
      };
    } catch (error) {
      console.error('Ecotrack add remark error:', error.response?.data || error.message);
      throw new Error(`Failed to add remark: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Request a new delivery attempt
   * @param {string} trackingId - Ecotrack tracking ID
   * @returns {Promise<Object>} - Result
   */
  async requestNewDeliveryAttempt(trackingId) {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      const response = await this.client.get('/ask/new-tentative', {
        params: {
          api_token: this.apiToken,
          tracking: trackingId
        }
      });

      return {
        success: true,
        tracking_id: trackingId,
        message: 'New delivery attempt requested'
      };
    } catch (error) {
      console.error('Ecotrack new attempt error:', error.response?.data || error.message);
      throw new Error(`Failed to request new delivery attempt: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Request a return for an order
   * @param {string} trackingId - Ecotrack tracking ID
   * @returns {Promise<Object>} - Result
   */
  async requestReturn(trackingId) {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      const response = await this.client.get('/ask/return', {
        params: {
          api_token: this.apiToken,
          tracking: trackingId
        }
      });

      return {
        success: true,
        tracking_id: trackingId,
        message: 'Return requested'
      };
    } catch (error) {
      console.error('Ecotrack request return error:', error.response?.data || error.message);
      throw new Error(`Failed to request return: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get shipping label for an order
   * @param {string} trackingId - Ecotrack tracking ID
   * @returns {Promise<Object>} - Label data or URL
   */
  async getShippingLabel(trackingId) {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      const response = await this.client.get('/get/order/label', {
        params: {
          api_token: this.apiToken,
          tracking: trackingId
        },
        responseType: 'arraybuffer' // Handle binary data
      });

      return {
        success: true,
        tracking_id: trackingId,
        label_data: response.data,
        content_type: response.headers['content-type']
      };
    } catch (error) {
      console.error('Ecotrack get label error:', error.response?.data || error.message);
      throw new Error(`Failed to get shipping label: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get list of pickup/drop-off stations
   * @returns {Promise<Object>} - Stations list
   */
  async getStations() {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      const response = await this.client.post('/desks', {
        api_token: this.apiToken,
        user_guid: this.userGuid
      });

      return {
        success: true,
        stations: response.data
      };
    } catch (error) {
      console.error('Ecotrack get stations error:', error.response?.data || error.message);
      throw new Error(`Failed to get stations: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get delivery fees/pricing
   * @returns {Promise<Object>} - Pricing information
   */
  async getDeliveryFees() {
    if (!this.validateCredentials()) {
      throw new Error('Missing required Ecotrack credentials');
    }

    try {
      const response = await this.client.post('/fees', {
        api_token: this.apiToken,
        user_guid: this.userGuid
      });

      return {
        success: true,
        fees: response.data
      };
    } catch (error) {
      console.error('Ecotrack get fees error:', error.response?.data || error.message);
      throw new Error(`Failed to get delivery fees: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Map city name to Wilaya ID and get default commune
   * @param {string} cityName - City name
   * @returns {Object} - {wilaya_id, commune}
   */
  mapCityToWilayaId(cityName) {
    const cityMappings = {
      'adrar': { wilaya_id: 1, commune: 'Adrar' },
      'chlef': { wilaya_id: 2, commune: 'Chlef' },
      'laghouat': { wilaya_id: 3, commune: 'Laghouat' },
      'oum-el-bouaghi': { wilaya_id: 4, commune: 'Oum El Bouaghi' },
      'batna': { wilaya_id: 5, commune: 'Batna' },
      'bejaia': { wilaya_id: 6, commune: 'Bejaia' },
      'biskra': { wilaya_id: 7, commune: 'Biskra' },
      'bechar': { wilaya_id: 8, commune: 'Bechar' },
      'blida': { wilaya_id: 9, commune: 'Blida' },
      'bouira': { wilaya_id: 10, commune: 'Bouira' },
      'tamanrasset': { wilaya_id: 11, commune: 'Tamanrasset' },
      'tebessa': { wilaya_id: 12, commune: 'Tebessa' },
      'tlemcen': { wilaya_id: 13, commune: 'Tlemcen' },
      'tiaret': { wilaya_id: 14, commune: 'Tiaret' },
      'tizi-ouzou': { wilaya_id: 15, commune: 'Tizi Ouzou' },
      'alger': { wilaya_id: 16, commune: 'Alger Centre' },
      'algiers': { wilaya_id: 16, commune: 'Alger Centre' },
      'djelfa': { wilaya_id: 17, commune: 'Djelfa' },
      'jijel': { wilaya_id: 18, commune: 'Jijel' },
      'setif': { wilaya_id: 19, commune: 'Setif' },
      'saida': { wilaya_id: 20, commune: 'Saida' },
      'skikda': { wilaya_id: 21, commune: 'Skikda' },
      'sidi-bel-abbes': { wilaya_id: 22, commune: 'Sidi Bel Abbes' },
      'annaba': { wilaya_id: 23, commune: 'Annaba' },
      'guelma': { wilaya_id: 24, commune: 'Guelma' },
      'constantine': { wilaya_id: 25, commune: 'Constantine' },
      'medea': { wilaya_id: 26, commune: 'Medea' },
      'mostaganem': { wilaya_id: 27, commune: 'Mostaganem' },
      'msila': { wilaya_id: 28, commune: 'M\'Sila' },
      'mascara': { wilaya_id: 29, commune: 'Mascara' },
      'ouargla': { wilaya_id: 30, commune: 'Ouargla' },
      'oran': { wilaya_id: 31, commune: 'Oran' },
      'el-bayadh': { wilaya_id: 32, commune: 'El Bayadh' },
      'illizi': { wilaya_id: 33, commune: 'Illizi' },
      'bordj-bou-arreridj': { wilaya_id: 34, commune: 'Bordj Bou Arreridj' },
      'boumerdes': { wilaya_id: 35, commune: 'Boumerdes' },
      'el-tarf': { wilaya_id: 36, commune: 'El Tarf' },
      'tindouf': { wilaya_id: 37, commune: 'Tindouf' },
      'tissemsilt': { wilaya_id: 38, commune: 'Tissemsilt' },
      'el-oued': { wilaya_id: 39, commune: 'El Oued' },
      'khenchela': { wilaya_id: 40, commune: 'Khenchela' },
      'souk-ahras': { wilaya_id: 41, commune: 'Souk Ahras' },
      'tipaza': { wilaya_id: 42, commune: 'Tipaza' },
      'mila': { wilaya_id: 43, commune: 'Mila' },
      'ain-defla': { wilaya_id: 44, commune: 'Ain Defla' },
      'naama': { wilaya_id: 45, commune: 'Naama' },
      'ain-temouchent': { wilaya_id: 46, commune: 'Ain Temouchent' },
      'ghardaia': { wilaya_id: 47, commune: 'Ghardaia' },
      'relizane': { wilaya_id: 48, commune: 'Relizane' }
    };

    const normalizedCity = cityName.toLowerCase().trim().replace(/\s+/g, '-');
    return cityMappings[normalizedCity] || { wilaya_id: 16, commune: 'Alger Centre' }; // Default to Algiers
  }

  /**
   * Check if Ecotrack service is available (basic connectivity test)
   * @returns {Promise<boolean>} - Service availability
   */
  async healthCheck() {
    try {
      // Test with a simple call to get stations
      const response = await this.client.post('/desks', {
        api_token: this.apiToken,
        user_guid: this.userGuid
      });
      return response.status === 200;
    } catch (error) {
      console.error('Ecotrack health check failed:', error.message);
      return false;
    }
  }
}

module.exports = new EcotrackService();
