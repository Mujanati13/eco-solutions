import api from './api'

export const authService = {
  login: (credentials) => {
    return api.post('/auth/login', credentials)
  },

  register: (userData) => {
    return api.post('/auth/register', userData)
  },

  logout: () => {
    return api.post('/auth/logout')
  },

  heartbeat: () => {
    return api.post('/auth/heartbeat')
  },

  getCurrentUser: () => {
    return api.get('/auth/profile').then(response => response.data.user)
  },

  refreshToken: () => {
    return api.post('/auth/refresh')
  },

  forgotPassword: (email) => {
    return api.post('/auth/forgot-password', { email })
  },

  resetPassword: (token, password) => {
    return api.post('/auth/reset-password', { token, password })
  },

  updateProfile: (userData) => {
    return api.put('/auth/profile', userData)
  },

  changePassword: (passwordData) => {
    return api.put('/auth/change-password', passwordData)
  },

  // Session management
  getSessions: (params = {}) => {
    return api.get('/auth/sessions', { params }).then(response => response.data)
  },

  getSessionStats: (params = {}) => {
    return api.get('/auth/session-stats', { params }).then(response => response.data)
  },

  exportSessions: (params = {}) => {
    return api.get('/auth/sessions/export', { 
      params,
      responseType: 'blob'
    })
  },

  // Activity management
  getActivities: (params = {}) => {
    // Use admin endpoint for better access to all activities
    return api.get('/admin/activities', { params }).then(response => response.data)
  },

  getActivityStats: (params = {}) => {
    return api.get('/admin/activity-stats', { params }).then(response => response.data)
  },

  getUsers: () => {
    // Use /users endpoint which returns paginated structure
    return api.get('/users').then(response => {
      // Handle both direct array response and paginated response
      if (Array.isArray(response.data)) {
        return response.data;
      } else if (response.data.users && Array.isArray(response.data.users)) {
        return response.data.users;
      } else {
        return [];
      }
    })
  }
}
