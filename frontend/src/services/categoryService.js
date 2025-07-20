import api from './api';

const categoryService = {
  // Get all categories
  async getCategories(params = {}) {
    try {
      const response = await api.get('/categories', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get category by ID
  async getCategory(id) {
    try {
      const response = await api.get(`/categories/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Create new category
  async createCategory(categoryData) {
    try {
      const response = await api.post('/categories', categoryData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Update category
  async updateCategory(id, categoryData) {
    try {
      const response = await api.put(`/categories/${id}`, categoryData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Delete category
  async deleteCategory(id) {
    try {
      const response = await api.delete(`/categories/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get categories tree for dropdown/select
  async getCategoriesTree() {
    try {
      const response = await this.getCategories({ active_only: true });
      return response.data.categories;
    } catch (error) {
      throw error;
    }
  },

  // Get flat categories list for easier processing
  async getFlatCategories() {
    try {
      const response = await this.getCategories({ active_only: true });
      const categories = response.data.categories;
      
      // Flatten the hierarchy
      const flattenCategories = (categories, level = 0) => {
        let result = [];
        
        categories.forEach(category => {
          result.push({
            ...category,
            level,
            indent: '  '.repeat(level)
          });
          
          if (category.children && category.children.length > 0) {
            result = result.concat(flattenCategories(category.children, level + 1));
          }
        });
        
        return result;
      };
      
      return flattenCategories(categories);
    } catch (error) {
      throw error;
    }
  }
};

export default categoryService;
