const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const OrderProductService = require('../services/orderProductService');

const router = express.Router();

// Get orders with their products
router.get('/orders-with-products', authenticateToken, requirePermission('canViewOrders'), async (req, res) => {
  try {
    const filters = {
      order_id: req.query.order_id,
      product_id: req.query.product_id,
      status: req.query.status,
      customer_name: req.query.customer_name
    };
    
    const orders = await OrderProductService.getOrdersWithProducts(filters);
    
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Get orders with products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders with products',
      error: error.message
    });
  }
});

// Get products with their orders
router.get('/products-with-orders', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const filters = {
      product_id: req.query.product_id,
      sku: req.query.sku,
      status: req.query.status,
      date_from: req.query.date_from,
      date_to: req.query.date_to
    };
    
    const products = await OrderProductService.getProductsWithOrders(filters);
    
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get products with orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products with orders',
      error: error.message
    });
  }
});

// Add item to order
router.post('/orders/:orderId/items', authenticateToken, requirePermission('canManageOrders'), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { product_id, quantity, unit_price } = req.body;
    
    if (!product_id || !quantity || !unit_price) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, quantity, and unit price are required'
      });
    }
    
    const orderItemId = await OrderProductService.addItemToOrder(orderId, {
      product_id,
      quantity,
      unit_price
    });
    
    res.json({
      success: true,
      message: 'Item added to order successfully',
      data: { order_item_id: orderItemId }
    });
  } catch (error) {
    console.error('Add item to order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to order',
      error: error.message
    });
  }
});

// Remove item from order
router.delete('/order-items/:orderItemId', authenticateToken, requirePermission('canManageOrders'), async (req, res) => {
  try {
    const { orderItemId } = req.params;
    
    await OrderProductService.removeItemFromOrder(orderItemId);
    
    res.json({
      success: true,
      message: 'Item removed from order successfully'
    });
  } catch (error) {
    console.error('Remove item from order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from order',
      error: error.message
    });
  }
});

// Get order-product statistics
router.get('/statistics', authenticateToken, requirePermission('canViewReports'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    
    const statistics = await OrderProductService.getOrderProductStatistics(date_from, date_to);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Get order product statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order product statistics',
      error: error.message
    });
  }
});

// Get specific order with all product details
router.get('/orders/:orderId/details', authenticateToken, requirePermission('canViewOrders'), async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const orders = await OrderProductService.getOrdersWithProducts({ order_id: orderId });
    
    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: orders[0]
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
});

// Get specific product with all order details
router.get('/products/:productId/orders', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const { productId } = req.params;
    
    const products = await OrderProductService.getProductsWithOrders({ product_id: productId });
    
    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or has no orders'
      });
    }
    
    res.json({
      success: true,
      data: products[0]
    });
  } catch (error) {
    console.error('Get product orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product orders',
      error: error.message
    });
  }
});

module.exports = router;
