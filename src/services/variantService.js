import api from './api';

const variantService = {
  // Get all variants for a product
  async getVariantsByProduct(productId, params = {}) {
    try {
      const response = await api.get(`/variants/product/${productId}`, { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get variant by ID
  async getVariant(id) {
    try {
      const response = await api.get(`/variants/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Create new variant
  async createVariant(variantData) {
    try {
      const response = await api.post('/variants', variantData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update variant
  async updateVariant(id, variantData) {
    try {
      const response = await api.put(`/variants/${id}`, variantData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Delete variant
  async deleteVariant(id) {
    try {
      const response = await api.delete(`/variants/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get variant stock levels
  async getVariantStock(id) {
    try {
      const response = await api.get(`/variants/${id}/stock`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update variant stock level
  async updateVariantStock(id, locationId, stockData) {
    try {
      const response = await api.put(`/variants/${id}/stock/${locationId}`, stockData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Generate SKU for variant
  generateSku(productSku, variantName) {
    // Simple SKU generation logic - can be enhanced
    const variantCode = variantName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 3);
    
    return `${productSku}-${variantCode}`;
  },

  // Validate variant data
  validateVariant(variantData) {
    const errors = [];
    
    if (!variantData.product_id) {
      errors.push('Product is required');
    }
    
    if (!variantData.variant_name || variantData.variant_name.trim().length < 2) {
      errors.push('Variant name must be at least 2 characters');
    }
    
    if (!variantData.sku || variantData.sku.trim().length < 2) {
      errors.push('SKU must be at least 2 characters');
    }
    
    if (variantData.cost_price && variantData.cost_price < 0) {
      errors.push('Cost price cannot be negative');
    }
    
    if (variantData.selling_price && variantData.selling_price < 0) {
      errors.push('Selling price cannot be negative');
    }
    
    if (variantData.weight && variantData.weight < 0) {
      errors.push('Weight cannot be negative');
    }
    
    return errors;
  }
};

export default variantService;
