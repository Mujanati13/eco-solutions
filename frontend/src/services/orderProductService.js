import api from './api'

class OrderProductService {
  // Get orders with their products
  async getOrdersWithProducts(params = {}) {
    try {
      const response = await api.get('/order-product/orders-with-products', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Get products with their orders
  async getProductsWithOrders(params = {}) {
    try {
      const response = await api.get('/order-product/products-with-orders', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Get specific order with all product details
  async getOrderDetails(orderId) {
    try {
      const response = await api.get(`/order-product/orders/${orderId}/details`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Get specific product with all order details
  async getProductOrders(productId) {
    try {
      const response = await api.get(`/order-product/products/${productId}/orders`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Add item to order
  async addItemToOrder(orderId, itemData) {
    try {
      const response = await api.post(`/order-product/orders/${orderId}/items`, itemData)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Remove item from order
  async removeItemFromOrder(orderItemId) {
    try {
      const response = await api.delete(`/order-product/order-items/${orderItemId}`)
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }

  // Get order-product statistics
  async getStatistics(params = {}) {
    try {
      const response = await api.get('/order-product/statistics', { params })
      return response.data
    } catch (error) {
      throw error.response?.data || error
    }
  }
}

export default new OrderProductService()
