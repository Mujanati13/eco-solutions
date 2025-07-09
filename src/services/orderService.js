import api from './api'

export const orderService = {
  getOrders: async (params = {}) => {
    try {
      console.log('OrderService.getOrders called with params:', params);
      const response = await api.get('/orders', { params });
      console.log('OrderService.getOrders response:', response);
      console.log('OrderService.getOrders response.data:', response.data);
      return response.data;
    } catch (error) {
      console.error('OrderService.getOrders error:', error);
      throw error;
    }
  },

  getAllOrders: (params = {}) => {
    return api.get('/orders', { params })
  },

  getOrderById: (id) => {
    return api.get(`/orders/${id}`)
  },

  createOrder: (orderData) => {
    return api.post('/orders', orderData)
  },

  updateOrder: async (id, orderData) => {
    try {
      const response = await api.put(`/orders/${id}`, orderData);
      return response.data;
    } catch (error) {
      console.error('OrderService.updateOrder error:', error);
      throw error;
    }
  },

  deleteOrder: (id) => {
    return api.delete(`/orders/${id}`)
  },

  assignOrder: (id, employeeId) => {
    return api.put(`/orders/${id}/assign`, { assigned_to: employeeId })
  },

  updateOrderStatus: (id, status) => {
    return api.put(`/orders/${id}`, { status })
  },

  distributeOrders: () => {
    return api.post('/orders/distribute')
  },

  getOrderStatistics: () => {
    return api.get('/orders/stats')
  },

  exportOrders: (params = {}) => {
    return api.get('/orders/export', { 
      params,
      responseType: 'blob'
    })
  },

  importOrders: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/orders/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // Tracking methods
  getTrackingInfo: (id) => {
    return api.get(`/orders/${id}/tracking`)
  },

  updateTrackingStatus: (id) => {
    return api.put(`/orders/${id}/tracking/update`)
  },

  bulkSyncTracking: () => {
    return api.post('/orders/tracking/sync-all')
  },

  updateOrderTracking: (id) => {
    return api.put(`/orders/${id}/tracking/update`)
  },

  syncAllTracking: () => {
    return api.post('/orders/tracking/sync-all')
  },

  getOrderTracking: (id) => {
    return api.get(`/orders/${id}/tracking`)
  }
}
