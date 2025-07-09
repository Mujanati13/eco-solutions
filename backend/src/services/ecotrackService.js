const axios = require('axios');

class EcotrackService {
  constructor() {
    this.baseURL = process.env.ECOTRACK_API_URL || 'https://app.noest-dz.com/api/public';
    this.apiToken = process.env.ECOTRACK_API_TOKEN;
    this.userGuid = process.env.ECOTRACK_USER_GUID;
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json'
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
   * Create a new order in Ecotrack (Step 1: Create)
   * @param {Object} orderData - Order information
   * @returns {Promise<Object>} - Tracking information
   */
  async createShipment(orderData) {
    if (!this.validateCredentials()) {
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

      // Prepare order data according to Ecotrack API spec
      const ecotrackOrderData = {
        api_token: this.apiToken,
        user_guid: this.userGuid,
        reference: orderData.order_number,
        client: orderData.customer_name,
        phone: orderData.customer_phone.replace(/\D/g, ''), // Remove non-digits
        adresse: orderData.customer_address,
        wilaya_id: this.mapCityToWilayaId(orderData.customer_city), // Map city to wilaya ID
        commune: orderData.customer_city,
        montant: parseFloat(orderData.total_amount) || 0,
        remarque: orderData.notes || '',
        produit: productDetails.name || 'Product',
        type_id: 1, // 1 = Livraison (delivery)
        poids: Math.max(1, parseInt(productDetails.weight) || 1), // Default weight 1kg
        stop_desk: orderData.delivery_type === 'stop_desk' ? 1 : 0,
        stock: 0, // Not using NOEST stock
        can_open: 1 // Allow recipient to open package
      };

      console.log('🚚 Creating Ecotrack order:', ecotrackOrderData);

      // Step 1: Create the order
      const createResponse = await this.client.post('/create/order', ecotrackOrderData);
      
      if (!createResponse.data.success) {
        throw new Error('Failed to create order in Ecotrack');
      }

      const trackingId = createResponse.data.tracking;
      console.log('✅ Ecotrack order created with tracking:', trackingId);

      // Step 2: Validate the order (make it visible to logistics)
      await this.validateOrder(trackingId);

      return {
        success: true,
        tracking_id: trackingId,
        status: 'upload', // Initial status according to event list
        tracking_url: `https://app.noest-dz.com/tracking/${trackingId}`
      };
    } catch (error) {
      console.error('Ecotrack create shipment error:', error.response?.data || error.message);
      throw new Error(`Failed to create Ecotrack shipment: ${error.response?.data?.message || error.message}`);
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
   * Map city name to Wilaya ID (basic mapping - should be expanded)
   * @param {string} cityName - City name
   * @returns {number} - Wilaya ID (1-48)
   */
  mapCityToWilayaId(cityName) {
    const cityMappings = {
      'adrar': 1, 'chlef': 2, 'laghouat': 3, 'oum-el-bouaghi': 4, 'batna': 5,
      'bejaia': 6, 'biskra': 7, 'bechar': 8, 'blida': 9, 'bouira': 10,
      'tamanrasset': 11, 'tebessa': 12, 'tlemcen': 13, 'tiaret': 14, 'tizi-ouzou': 15,
      'alger': 16, 'algiers': 16, 'djelfa': 17, 'jijel': 18, 'setif': 19, 'saida': 20,
      'skikda': 21, 'sidi-bel-abbes': 22, 'annaba': 23, 'guelma': 24, 'constantine': 25,
      'medea': 26, 'mostaganem': 27, 'msila': 28, 'mascara': 29, 'ouargla': 30,
      'oran': 31, 'el-bayadh': 32, 'illizi': 33, 'bordj-bou-arreridj': 34, 'boumerdes': 35,
      'el-tarf': 36, 'tindouf': 37, 'tissemsilt': 38, 'el-oued': 39, 'khenchela': 40,
      'souk-ahras': 41, 'tipaza': 42, 'mila': 43, 'ain-defla': 44, 'naama': 45,
      'ain-temouchent': 46, 'ghardaia': 47, 'relizane': 48
    };

    const normalizedCity = cityName.toLowerCase().trim().replace(/\s+/g, '-');
    return cityMappings[normalizedCity] || 16; // Default to Algiers (16) if not found
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
