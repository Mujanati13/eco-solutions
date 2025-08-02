import api from './api';

export const deliveryPricingService = {
  // Get all wilayas with their delivery pricing
  getAllWilayasWithPricing: async (statusFilter = null) => {
    const params = statusFilter ? { status: statusFilter } : {};
    const response = await api.get('/delivery-pricing/wilayas', { params });
    return response.data;
  },

  // Get active wilayas for dropdown
  getActiveWilayas: async () => {
    const response = await api.get('/delivery-pricing/wilayas/active');
    return response.data;
  },

  // Calculate delivery price
  calculateDeliveryPrice: async (data) => {
    const response = await api.post('/delivery-pricing/calculate-price', data);
    return response.data;
  },

  // Get delivery pricing for specific wilaya
  getWilayaPricing: async (wilayaId) => {
    const response = await api.get(`/delivery-pricing/pricing/${wilayaId}`);
    return response.data;
  },

  // Update delivery pricing
  updateDeliveryPricing: async (wilayaId, deliveryType, pricingData) => {
    const response = await api.put(`/delivery-pricing/pricing/${wilayaId}/${deliveryType}`, pricingData);
    return response.data;
  },

  // Create new delivery pricing
  createDeliveryPricing: async (pricingData) => {
    const response = await api.post('/delivery-pricing/pricing', pricingData);
    return response.data;
  },

  // Delete delivery pricing
  deleteDeliveryPricing: async (wilayaId, deliveryType) => {
    const response = await api.delete(`/delivery-pricing/pricing/${wilayaId}/${deliveryType}`);
    return response.data;
  },

  // Toggle wilaya status
  toggleWilayaStatus: async (wilayaId, isActive) => {
    const response = await api.patch(`/delivery-pricing/wilayas/${wilayaId}/toggle-status`, { is_active: isActive });
    return response.data;
  },

  // Get delivery pricing statistics
  getDeliveryPricingStats: async () => {
    const response = await api.get('/delivery-pricing/stats');
    return response.data;
  },

  // Bulk update delivery pricing
  bulkUpdatePricing: async (updates) => {
    const response = await api.post('/delivery-pricing/pricing/bulk-update', { updates });
    return response.data;
  },

  // Recalculate delivery pricing for order
  recalculateOrderDelivery: async (orderId, data) => {
    const response = await api.post(`/orders/${orderId}/recalculate-delivery`, data);
    return response.data;
  }
};
