const express = require('express');
const { pool } = require('../../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const RolePermissionService = require('../services/rolePermissionService');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const canViewAllOrders = await RolePermissionService.userHasPermission(req.user.id, 'canViewAllOrders');
    const userId = req.user.id;

    // Base statistics for all users
    let stats = {};

    if (canViewAllOrders) {
      // Admin gets overall statistics
      const [totalOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders'
      );

      const [todayOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE()'
      );

      const [pendingOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE status = "pending"'
      );

      const [confirmedOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE status = "confirmed"'
      );

      const [deliveredOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE status = "delivered"'
      );

      const [totalRevenue] = await pool.query(
        'SELECT SUM(total_amount) as revenue FROM orders WHERE status = "delivered"'
      );

      const [activeEmployees] = await pool.query(
        'SELECT COUNT(*) as count FROM users WHERE role = "employee" AND is_active = true'
      );

      stats = {
        total_orders: totalOrders[0].count,
        today_orders: todayOrders[0].count,
        pending_orders: pendingOrders[0].count,
        confirmed_orders: confirmedOrders[0].count,
        delivered_orders: deliveredOrders[0].count,
        total_revenue: totalRevenue[0].revenue || 0,
        active_employees: activeEmployees[0].count
      };
    } else {
      // Employee gets personal statistics
      const [myOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE assigned_to = ?',
        [userId]
      );

      const [myTodayOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND DATE(created_at) = CURDATE()',
        [userId]
      );

      const [myPendingOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = "pending"',
        [userId]
      );

      const [myConfirmedOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = "confirmed"',
        [userId]
      );

      const [myDeliveredOrders] = await pool.query(
        'SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = "delivered"',
        [userId]
      );

      stats = {
        my_orders: myOrders[0].count,
        my_today_orders: myTodayOrders[0].count,
        my_pending_orders: myPendingOrders[0].count,
        my_confirmed_orders: myConfirmedOrders[0].count,
        my_delivered_orders: myDeliveredOrders[0].count
      };
    }

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent orders for dashboard
router.get('/recent-orders', authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const canViewAllOrders = await RolePermissionService.userHasPermission(req.user.id, 'canViewAllOrders');
    const userId = req.user.id;

    let whereClause = '';
    let queryParams = [];

    if (!canViewAllOrders) {
      whereClause = 'WHERE o.assigned_to = ?';
      queryParams.push(userId);
    }

    const [orders] = await pool.query(`
      SELECT 
        o.id, o.order_number, o.customer_name, o.customer_phone,
        o.status, o.total_amount, o.created_at,
        u.first_name as assigned_first_name,
        u.last_name as assigned_last_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_to = u.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ?
    `, [...queryParams, parseInt(limit)]);

    res.json(orders);
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get performance metrics
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const canViewAllUsers = await RolePermissionService.userHasPermission(req.user.id, 'canViewUsers');
    const userId = req.user.id;

    if (canViewAllUsers) {
      // Admin gets all employees' performance
      // First try to get from performance_metrics table
      const [performance] = await pool.query(`
        SELECT 
          u.id, u.first_name, u.last_name, u.username,
          u.performance_score, u.total_orders_handled,
          COUNT(DISTINCT pm.date) as active_days,
          SUM(pm.orders_confirmed) as total_confirmed,
          SUM(pm.orders_delivered) as total_delivered,
          AVG(pm.confirmation_rate) as avg_confirmation_rate,
          AVG(pm.delivery_rate) as avg_delivery_rate
        FROM users u
        LEFT JOIN performance_metrics pm ON u.id = pm.user_id 
          AND pm.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        WHERE u.role IN ('employee', 'admin') AND u.is_active = true
        GROUP BY u.id
        ORDER BY u.performance_score DESC, total_confirmed DESC
      `, [days]);

      // If no performance metrics data, calculate from orders directly
      if (performance.length === 0 || performance.every(p => p.total_confirmed === null)) {
        const [fallbackPerformance] = await pool.query(`
          SELECT 
            u.id, u.first_name, u.last_name, u.username,
            u.performance_score, u.total_orders_handled,
            COUNT(DISTINCT DATE(o.created_at)) as active_days,
            COUNT(CASE WHEN o.status IN ('confirmed', 'out_for_delivery', 'delivered') THEN 1 END) as total_confirmed,
            COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as total_delivered,
            ROUND(
              (COUNT(CASE WHEN o.status IN ('confirmed', 'out_for_delivery', 'delivered') THEN 1 END) * 100.0) / 
              NULLIF(COUNT(o.id), 0), 2
            ) as avg_confirmation_rate,
            ROUND(
              (COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) * 100.0) / 
              NULLIF(COUNT(CASE WHEN o.status IN ('confirmed', 'out_for_delivery', 'delivered') THEN 1 END), 0), 2
            ) as avg_delivery_rate
          FROM users u
          LEFT JOIN orders o ON u.id = o.assigned_to 
            AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          WHERE u.role IN ('employee', 'admin') AND u.is_active = true
          GROUP BY u.id
          HAVING COUNT(o.id) > 0
          ORDER BY total_confirmed DESC, total_delivered DESC
          LIMIT 10
        `, [days]);

        res.json(fallbackPerformance);
      } else {
        res.json(performance);
      }
    } else {
      // Employee gets personal performance calculated from orders
      const [performance] = await pool.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as orders_assigned,
          COUNT(CASE WHEN status IN ('confirmed', 'out_for_delivery', 'delivered') THEN 1 END) as orders_confirmed,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as orders_delivered,
          ROUND(
            (COUNT(CASE WHEN status IN ('confirmed', 'out_for_delivery', 'delivered') THEN 1 END) * 100.0) / 
            NULLIF(COUNT(*), 0), 2
          ) as confirmation_rate,
          ROUND(
            (COUNT(CASE WHEN status = 'delivered' THEN 1 END) * 100.0) / 
            NULLIF(COUNT(CASE WHEN status IN ('confirmed', 'out_for_delivery', 'delivered') THEN 1 END), 0), 2
          ) as delivery_rate,
          0 as avg_confirmation_time
        FROM orders
        WHERE assigned_to = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [userId, days]);

      res.json(performance);
    }
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get order status distribution
router.get('/order-distribution', authenticateToken, async (req, res) => {
  try {
    const canViewAllOrders = await RolePermissionService.userHasPermission(req.user.id, 'canViewAllOrders');
    const userId = req.user.id;

    let whereClause = '';
    let queryParams = [];

    if (!canViewAllOrders) {
      whereClause = 'WHERE assigned_to = ?';
      queryParams.push(userId);
    }

    const [distribution] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
      FROM orders
      ${whereClause}
      GROUP BY status
      ORDER BY count DESC
    `, queryParams);

    res.json(distribution);
  } catch (error) {
    console.error('Order distribution error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily order trends
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const canViewAllOrders = await RolePermissionService.userHasPermission(req.user.id, 'canViewAllOrders');
    const userId = req.user.id;

    let whereClause = '';
    let queryParams = [days];

    if (!canViewAllOrders) {
      whereClause = 'AND assigned_to = ?';
      queryParams.push(userId);
    }

    const [trends] = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        SUM(total_amount) as total_revenue
      FROM orders
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, queryParams);

    res.json(trends);
  } catch (error) {
    console.error('Order trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Product Management Dashboard Routes
// Get product statistics
router.get('/product-stats', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    // Get total products count
    const [totalProducts] = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE is_active = true'
    );

    // Get low stock products (where total stock is below minimum stock level)
    const [lowStockProducts] = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as count 
      FROM products p
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      WHERE p.is_active = true 
      AND p.minimum_stock_level > COALESCE((
        SELECT SUM(quantity_available) 
        FROM stock_levels 
        WHERE product_id = p.id
      ), 0)
    `);

    // Get out of stock products
    const [outOfStockProducts] = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as count 
      FROM products p
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      WHERE p.is_active = true 
      AND COALESCE((
        SELECT SUM(quantity_available) 
        FROM stock_levels 
        WHERE product_id = p.id
      ), 0) = 0
    `);

    // Get total stock value
    const [totalStockValue] = await pool.query(`
      SELECT SUM(p.cost_price * COALESCE(sl.total_available, 0)) as value
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity_available) as total_available
        FROM stock_levels
        GROUP BY product_id
      ) sl ON p.id = sl.product_id
      WHERE p.is_active = true
    `);

    // Get categories count
    const [categoriesCount] = await pool.query(
      'SELECT COUNT(DISTINCT category) as count FROM products WHERE is_active = true AND category IS NOT NULL'
    );

    // Get recent stock movements
    const [recentMovements] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM stock_movements 
      WHERE DATE(created_at) = CURDATE()
    `);

    const stats = {
      total_products: totalProducts[0].count,
      low_stock_products: lowStockProducts[0].count,
      out_of_stock_products: outOfStockProducts[0].count,
      total_stock_value: totalStockValue[0].value || 0,
      categories_count: categoriesCount[0].count,
      today_movements: recentMovements[0].count
    };

    res.json(stats);
  } catch (error) {
    console.error('Product stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product categories distribution
router.get('/product-distribution', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const [distribution] = await pool.query(`
      SELECT 
        category,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
      FROM products
      WHERE is_active = true AND category IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `);

    res.json(distribution);
  } catch (error) {
    console.error('Product distribution error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get stock movement trends
router.get('/stock-trends', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const [trends] = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN movement_type = 'in' THEN quantity ELSE 0 END) as stock_in,
        SUM(CASE WHEN movement_type = 'out' THEN quantity ELSE 0 END) as stock_out,
        COUNT(*) as total_movements
      FROM stock_movements
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [days]);

    res.json(trends);
  } catch (error) {
    console.error('Stock trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get low stock alerts
router.get('/low-stock-alerts', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const [alerts] = await pool.query(`
      SELECT 
        p.id, p.name, p.sku, p.category, p.minimum_stock_level as reorder_level,
        COALESCE(SUM(sl.quantity_available), 0) as current_stock,
        (p.minimum_stock_level - COALESCE(SUM(sl.quantity_available), 0)) as shortage
      FROM products p
      LEFT JOIN stock_levels sl ON p.id = sl.product_id
      WHERE p.is_active = true
      GROUP BY p.id
      HAVING current_stock <= p.minimum_stock_level
      ORDER BY shortage DESC
      LIMIT 20
    `);

    res.json(alerts);
  } catch (error) {
    console.error('Low stock alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent product activities
router.get('/recent-product-activities', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const limit = req.query.limit || 10;

    const [activities] = await pool.query(`
      SELECT 
        sm.id, sm.movement_type, sm.quantity, sm.notes as reason, sm.created_at,
        p.name as product_name, p.sku,
        u.first_name, u.last_name,
        '' as from_location,
        '' as to_location
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.performed_by = u.id
      ORDER BY sm.created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);

    res.json(activities);
  } catch (error) {
    console.error('Recent product activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
