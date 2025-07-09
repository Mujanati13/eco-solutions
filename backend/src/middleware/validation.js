const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation Error',
        details: errorDetails
      });
    }
    
    next();
  };
};

// Validation schemas
const schemas = {
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().min(2).max(50).required(),
    last_name: Joi.string().min(2).max(50).required(),
    phone: Joi.alternatives().try(
      Joi.string().allow(''),
      Joi.string().pattern(/^[+]?[0-9\s\-()]{10,20}$/),
      Joi.allow(null)
    ).optional(),
    role: Joi.string().valid('admin', 'supervisor', 'employee', 'custom').optional(),
    roles: Joi.array().items(Joi.string().valid('admin', 'supervisor', 'employee', 'custom')).optional(),
    permissions: Joi.array().items(Joi.string()).optional(),
    is_active: Joi.boolean().optional() // Allow is_active field for registration
  }),

  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
  }),

  createOrder: Joi.object({
    customer_name: Joi.string().min(2).max(100).required(),
    customer_phone: Joi.string().pattern(/^[+]?[0-9\s\-()]{10,20}$/).required(),
    customer_address: Joi.string().min(10).max(500).required(),
    customer_city: Joi.string().min(2).max(50).required(),
    product_details: Joi.alternatives().try(
      Joi.object(),
      Joi.string(),
      Joi.array()
    ).required(),
    total_amount: Joi.number().positive().precision(2).required(),
    delivery_date: Joi.date().optional(),
    notes: Joi.string().max(1000).optional()
  }),

  updateOrder: Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'on_hold').optional(),
    payment_status: Joi.string().valid('unpaid', 'cod_pending', 'paid').optional(),
    assigned_to: Joi.number().integer().optional(),
    delivery_date: Joi.date().optional(),
    notes: Joi.string().max(1000).optional(),
    ecotrack_tracking_id: Joi.string().max(100).optional()
  }),

  updateUser: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).optional(),
    first_name: Joi.string().min(2).max(50).optional(),
    last_name: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.alternatives().try(
      Joi.string().allow(''),
      Joi.string().pattern(/^[+]?[0-9\s\-()]{10,20}$/),
      Joi.allow(null)
    ).optional(),
    role: Joi.string().valid('admin', 'supervisor', 'employee', 'custom').optional(), // Legacy support
    roles: Joi.array().items(Joi.string().valid('admin', 'supervisor', 'employee', 'custom')).optional(), // New multi-role support
    permissions: Joi.array().items(Joi.string()).optional(), // New permissions support
    is_active: Joi.boolean().optional()
  }),

  createUser: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    first_name: Joi.string().min(2).max(50).required(),
    last_name: Joi.string().min(2).max(50).required(),
    phone: Joi.alternatives().try(
      Joi.string().allow(''),
      Joi.string().pattern(/^[+]?[0-9\s\-()]{10,20}$/),
      Joi.allow(null)
    ).optional(),
    role: Joi.string().valid('admin', 'supervisor', 'employee', 'custom').optional(), // Legacy support
    roles: Joi.array().items(Joi.string().valid('admin', 'supervisor', 'employee', 'custom')).optional(), // New multi-role support
    permissions: Joi.array().items(Joi.string()).optional(), // New permissions support
    is_active: Joi.boolean().optional() // Allow is_active field for user creation
  }),

  importOrder: Joi.object({
    order_id: Joi.string().optional(),
    order_date: Joi.date().optional(),
    full_name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^[+]?[0-9\s\-()]{10,20}$/).required(),
    state: Joi.string().min(2).max(50).optional(),
    city: Joi.string().min(2).max(50).required(),
    address: Joi.string().min(5).max(500).required(),
    product_name: Joi.string().min(2).max(200).required(),
    product_variant: Joi.string().max(100).optional(),
    variant_price: Joi.number().positive().required(),
    delivery_type: Joi.string().valid('stop_desk', 'domicile', 'home_delivery', 'pickup').optional()
  }),

  // New schemas for multi-role and permission system
  updateUserRoles: Joi.object({
    roles: Joi.array().items(Joi.string().valid('admin', 'supervisor', 'employee', 'custom')).min(1).required()
  }),

  updateUserPermissions: Joi.object({
    permissions: Joi.array().items(Joi.string()).required()
  }),

  assignPermissions: Joi.object({
    permissions: Joi.array().items(Joi.string()).min(1).required(),
    userId: Joi.number().integer().required()
  }),

  // Category validation
  category: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    description: Joi.string().max(1000).optional(),
    parent_id: Joi.number().integer().optional(),
    is_active: Joi.boolean().optional(),
    sort_order: Joi.number().integer().optional(),
    image_url: Joi.string().uri().max(500).optional()
  }),

  // Variant validation
  variant: Joi.object({
    product_id: Joi.number().integer().required(),
    variant_name: Joi.string().min(2).max(255).required(),
    sku: Joi.string().min(2).max(100).required(),
    barcode: Joi.string().max(100).optional(),
    cost_price: Joi.number().min(0).precision(2).optional(),
    selling_price: Joi.number().min(0).precision(2).optional(),
    weight: Joi.number().min(0).precision(3).optional(),
    dimensions: Joi.string().max(100).optional(),
    color: Joi.string().max(50).optional(),
    size: Joi.string().max(50).optional(),
    material: Joi.string().max(100).optional(),
    attributes: Joi.object().optional(),
    is_active: Joi.boolean().optional()
  }),

  // Product validation (updated with category_id)
  product: Joi.object({
    sku: Joi.string().min(2).max(100).required(),
    name: Joi.string().min(2).max(255).required(),
    description: Joi.string().max(1000).optional(),
    category_id: Joi.number().integer().optional(),
    brand: Joi.string().max(100).optional(),
    unit_of_measure: Joi.string().valid('piece', 'kg', 'liter', 'meter', 'box', 'pack').optional(),
    cost_price: Joi.number().min(0).precision(2).optional(),
    selling_price: Joi.number().min(0).precision(2).optional(),
    minimum_stock_level: Joi.number().integer().min(0).optional(),
    maximum_stock_level: Joi.number().integer().min(0).optional(),
    is_active: Joi.boolean().optional()
  })
};

module.exports = {
  validateRequest,
  schemas,
  validateCategory: validateRequest(schemas.category),
  validateVariant: validateRequest(schemas.variant),
  validateProduct: validateRequest(schemas.product)
};
