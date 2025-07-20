const axios = require('axios');

class EcotrackService {
  constructor() {
    this.apiUrl = 'https://app.noest-dz.com/api';
    this.apiKey = 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG';
    this.userGuid = 'your_user_guid_here'; // You'll need to get this from Ecotrack
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Skip health check - just verify we have required config
      if (!this.apiUrl || !this.apiKey) {
        throw new Error('Missing required Ecotrack configuration');
      }

      this.initialized = true;
      console.log('✅ Ecotrack service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Ecotrack service:', error.message);
      // Don't throw error to allow system to work without Ecotrack
    }
  }

  async createDelivery(orderData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.initialized) {
        console.warn('⚠️ Ecotrack service not available, skipping delivery creation');
        return null;
      }

      const deliveryData = {
        api_token: this.apiKey,
        user_guid: this.userGuid,
        type_id: 1, // Standard delivery
        ref_client: orderData.order_number,
        product_codes: orderData.product_details ? JSON.stringify(orderData.product_details) : "product",
        quantite: orderData.quantity || 1,
        mobile: orderData.customer_phone,
        email: orderData.customer_email || "",
        remarque: orderData.notes || "",
        is_fragile: orderData.is_fragile || 0,
        sms_alert: 1
      };

      const response = await axios.post(`${this.apiUrl}/orders`, deliveryData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('✅ Delivery created in Ecotrack:', response.data.tracking);
      return {
        tracking_id: response.data.tracking,
        success: response.data.success,
        status: 'created'
      };
    } catch (error) {
      console.error('❌ Failed to create delivery in Ecotrack:', error.message);
      return null; // Return null instead of throwing to allow order creation to continue
    }
  }

  async updateDeliveryStatus(trackingId, status) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.initialized) {
        console.warn('⚠️ Ecotrack service not available, skipping status update');
        return null;
      }

      const response = await axios.patch(`${this.apiUrl}/deliveries/${trackingId}`, {
        status: status
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('✅ Delivery status updated in Ecotrack:', trackingId, status);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to update delivery status in Ecotrack:', error.message);
      return null;
    }
  }

  async getDeliveryStatus(trackingId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.initialized) {
        console.warn('⚠️ Ecotrack service not available, cannot get delivery status');
        return null;
      }

      const response = await axios.post(`${this.apiUrl}/public/get/trackings/info`, {
        api_token: this.apiKey,
        user_guid: this.userGuid,
        trackings: [trackingId]
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        tracking_id: trackingId,
        status: response.data.status,
        updates: response.data.data || []
      };
    } catch (error) {
      console.error('❌ Failed to get delivery status from Ecotrack:', error.message);
      return null;
    }
  }

  async cancelDelivery(trackingId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.initialized) {
        console.warn('⚠️ Ecotrack service not available, skipping delivery cancellation');
        return null;
      }

      const response = await axios.patch(`${this.apiUrl}/deliveries/${trackingId}`, {
        status: 'cancelled'
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('✅ Delivery cancelled in Ecotrack:', trackingId);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to cancel delivery in Ecotrack:', error.message);
      return null;
    }
  }

  async getDeliveryMetrics(startDate, endDate) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.initialized) {
        console.warn('⚠️ Ecotrack service not available, cannot get metrics');
        return null;
      }

      const response = await axios.get(`${this.apiUrl}/analytics/deliveries`, {
        params: {
          start_date: startDate,
          end_date: endDate
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        total_deliveries: response.data.total_deliveries,
        successful_deliveries: response.data.successful_deliveries,
        failed_deliveries: response.data.failed_deliveries,
        average_delivery_time: response.data.average_delivery_time,
        delivery_rate: response.data.delivery_rate
      };
    } catch (error) {
      console.error('❌ Failed to get delivery metrics from Ecotrack:', error.message);
      return null;
    }
  }
}

module.exports = new EcotrackService();
