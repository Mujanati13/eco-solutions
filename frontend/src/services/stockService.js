import api from './api'

class StockService {
  // Products
  async getProducts(params = {}) {
    try {
      const response = await api.get('/stock/products', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async getProduct(id) {
    try {
      const response = await api.get(`/stock/products/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async createProduct(productData) {
    try {
      const response = await api.post('/stock/products', productData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async updateProduct(id, productData) {
    try {
      const response = await api.put(`/stock/products/${id}`, productData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async deleteProduct(id) {
    try {
      const response = await api.delete(`/stock/products/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Stock Levels
  async getStockLevels(params = {}) {
    try {
      const response = await api.get('/stock/stock-levels', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async getStockLevel(productId, locationId) {
    try {
      const response = await api.get(`/stock/stock-levels/${productId}/${locationId}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async updateStockLevel(productId, locationId, quantity) {
    try {
      const response = await api.put(`/stock/stock-levels/${productId}/${locationId}`, { quantity })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Stock Movements
  async getStockMovements(params = {}) {
    try {
      const response = await api.get('/stock/stock-movements', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async createStockMovement(movementData) {
    try {
      const response = await api.post('/stock/stock-movements', movementData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async getMovementHistory(productId, params = {}) {
    try {
      const response = await api.get(`/stock/stock-movements/product/${productId}`, { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Stock Locations
  async getLocations(params = {}) {
    try {
      const response = await api.get('/stock/locations', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async getLocation(id) {
    try {
      const response = await api.get(`/stock/locations/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async createLocation(locationData) {
    try {
      const response = await api.post('/stock/locations', locationData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async updateLocation(id, locationData) {
    try {
      const response = await api.put(`/stock/locations/${id}`, locationData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async deleteLocation(id) {
    try {
      const response = await api.delete(`/stock/locations/${id}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Reports
  async getStockReport(params = {}) {
    try {
      const response = await api.get('/stock/reports/summary', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  async getLowStockReport(params = {}) {
    try {
      const response = await api.get('/stock/reports/low-stock', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }
}

export default new StockService()
