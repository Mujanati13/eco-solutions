const express = require('express');
const { pool } = require('../../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get basic dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    if (isAdmin) {
      // Admin dashboard stats
      const [outForDeliveryOrders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE status = "out_for_delivery"');
      const [pendingOrders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE status = "pending"');
      const [completedOrders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE status = "delivered"');
      const [cancelledOrders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE status = "cancelled"');
      const [totalRevenue] = await pool.query('SELECT SUM(total_amount) as total FROM orders WHERE status = "delivered"');
      const [activeUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');

      res.json({
        outForDeliveryOrders: outForDeliveryOrders[0].count,
        pendingOrders: pendingOrders[0].count,
        completedOrders: completedOrders[0].count,
        cancelledOrders: cancelledOrders[0].count,
        totalRevenue: totalRevenue[0].total || 0,
        activeUsers: activeUsers[0].count
      });
    } else {
      // Employee dashboard stats
      const [myOrders] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE assigned_to = ?', [userId]);
      const [myPending] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = "pending"', [userId]);
      const [myCompleted] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = "delivered"', [userId]);
      const [myCancelled] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND status = "cancelled"', [userId]);
      const [myToday] = await pool.query('SELECT COUNT(*) as count FROM orders WHERE assigned_to = ? AND DATE(created_at) = CURDATE()', [userId]);

      res.json({
        myOrders: myOrders[0].count,
        myPending: myPending[0].count,
        myCompleted: myCompleted[0].count,
        myCancelled: myCancelled[0].count,
        myToday: myToday[0].count
      });
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get order status distribution for pie chart
router.get('/order-status', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    let query = `
      SELECT status, COUNT(*) as count 
      FROM orders 
      ${!isAdmin ? 'WHERE assigned_to = ?' : ''}
      GROUP BY status
    `;
    
    const params = !isAdmin ? [userId] : [];
    const [results] = await pool.query(query, params);

    res.json(results);
  } catch (error) {
    console.error('Order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily order trends for line chart
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    let query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM orders 
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ${!isAdmin ? 'AND assigned_to = ?' : ''}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    
    const params = !isAdmin ? [days, userId] : [days];
    const [results] = await pool.query(query, params);

    res.json(results);
  } catch (error) {
    console.error('Order trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent orders
router.get('/recent-orders', authenticateToken, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    let query = `
      SELECT 
        id, order_number, customer_name, status, total_amount, created_at
      FROM orders 
      ${!isAdmin ? 'WHERE assigned_to = ?' : ''}
      ORDER BY created_at DESC
      LIMIT ?
    `;
    
    const params = !isAdmin ? [userId, parseInt(limit)] : [parseInt(limit)];
    const [results] = await pool.query(query, params);

    res.json(results);
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get performance metrics (for admin only)
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [results] = await pool.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        COUNT(o.id) as total_orders,
        SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        ROUND(
          (SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) * 100.0 / COUNT(o.id)), 2
        ) as success_rate
      FROM users u
      LEFT JOIN orders o ON u.id = o.assigned_to
      WHERE u.role = 'employee' AND u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name
      HAVING COUNT(o.id) > 0
      ORDER BY success_rate DESC, delivered_orders DESC
      LIMIT 10
    `);

    res.json(results);
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
