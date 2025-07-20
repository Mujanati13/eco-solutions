import api from './api'

export const userService = {
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getAllUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUserById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  getUserStatistics: async (id) => {
    const response = await api.get(`/users/${id}/stats`);
    return response.data;
  },

  getEmployeePerformance: async () => {
    const response = await api.get('/users/performance');
    return response.data;
  },

  // Roles and Permissions APIs
  getRoles: async () => {
    const response = await api.get('/users/roles');
    return response.data;
  },

  getPermissions: async () => {
    const response = await api.get('/users/permissions');
    return response.data;
  },

  updateUserRoles: async (userId, roles) => {
    const response = await api.put(`/users/${userId}/roles`, { roles });
    return response.data;
  },

  updateUserPermissions: async (userId, permissions) => {
    const response = await api.put(`/users/${userId}/permissions`, { permissions });
    return response.data;
  },

  getUserEffectivePermissions: async (userId) => {
    const response = await api.get(`/users/${userId}/effective-permissions`);
    return response.data;
  },
}
