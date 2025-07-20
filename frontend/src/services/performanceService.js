import api from './api'

export const performanceService = {
  // Get performance reports with filters
  getReports: async (params = {}) => {
    const response = await api.get('/performance/reports', { params })
    return response.data
  },

  // Get users list for admin filter
  getUsers: async () => {
    const response = await api.get('/users')
    return response.data
  },

  // Export reports as CSV
  exportReports: async (params = {}) => {
    const response = await api.get('/performance/export', { 
      params,
      responseType: 'blob' // Important for file download
    })
    return response
  },

  // Get individual user performance
  getUserPerformance: async (userId, params = {}) => {
    const response = await api.get(`/performance/user/${userId}`, { params })
    return response.data
  },

  // Get performance statistics for dashboard
  getPerformanceStats: async (params = {}) => {
    const response = await api.get('/performance/stats', { params })
    return response.data
  }
}
