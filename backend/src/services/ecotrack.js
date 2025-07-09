const axios = require('axios');

class EcotrackService {
  constructor() {
    this.apiUrl = process.env.ECOTRACK_API_URL;
    this.apiKey = process.env.ECOTRACK_API_KEY;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Test API connection
      const response = await axios.get(`${this.apiUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      if (response.status === 200) {
        this.initialized = true;
        console.log('✅ Ecotrack service initialized');
      }
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
        external_order_id: orderData.order_number,
        customer: {
          name: orderData.customer_name,
          phone: orderData.customer_phone,
          address: orderData.customer_address,
          city: orderData.customer_city
        },
        package: {
          description: JSON.stringify(orderData.product_details),
          value: orderData.total_amount,
          weight: orderData.weight || 1,
          dimensions: orderData.dimensions || { length: 10, width: 10, height: 10 }
        },
        delivery: {
          type: 'standard',
          scheduled_date: orderData.delivery_date,
          payment_method: orderData.payment_method || 'cod',
          cod_amount: orderData.payment_method === 'cod' ? orderData.total_amount : 0
        },
        notes: orderData.notes || ''
      };

      const response = await axios.post(`${this.apiUrl}/deliveries`, deliveryData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('✅ Delivery created in Ecotrack:', response.data.tracking_id);
      return {
        tracking_id: response.data.tracking_id,
        delivery_id: response.data.id,
        estimated_delivery: response.data.estimated_delivery,
        status: response.data.status
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

      const response = await axios.get(`${this.apiUrl}/deliveries/${trackingId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return {
        tracking_id: response.data.tracking_id,
        status: response.data.status,
        current_location: response.data.current_location,
        estimated_delivery: response.data.estimated_delivery,
        delivery_attempts: response.data.delivery_attempts,
        updates: response.data.tracking_updates
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
