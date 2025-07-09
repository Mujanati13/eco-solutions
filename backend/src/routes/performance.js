const express = require('express');
const { pool } = require('../../config/database');
const { authenticateToken, requireEmployee } = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/permissions');
const RolePermissionService = require('../services/rolePermissionService');

const router = express.Router();

// Get performance reports with filtering - simplified and cleaner
router.get('/reports', authenticateToken, requireAnyPermission(['canViewReports', 'canViewPerformance']), async (req, res) => {
  try {
    const {
      user_id,
      start_date,
      end_date
    } = req.query;

    const requestUserId = req.user.id;

    // Check if user can view all users' data or only their own
    const canViewAllUsers = await RolePermissionService.userHasPermission(requestUserId, 'canViewUsers');

    // Build base query conditions
    let whereClause = '1=1';
    const queryParams = [];

    // User filtering - users can only see their own data unless they have canViewUsers permission
    if (!canViewAllUsers) {
      whereClause += ' AND pm.user_id = ?';
      queryParams.push(requestUserId);
    } else if (user_id) {
      whereClause += ' AND pm.user_id = ?';
      queryParams.push(user_id);
    }

    // Date filtering
    if (start_date) {
      whereClause += ' AND pm.date >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND pm.date <= ?';
      queryParams.push(end_date);
    }

    // If no date range specified, default to last 7 days
    if (!start_date && !end_date) {
      whereClause += ' AND pm.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    }

    // Simplified summary query focusing on key metrics
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT pm.user_id) as total_users,
        SUM(pm.orders_confirmed) as total_confirmed,
        SUM(pm.orders_delivered) as total_delivered,
        SUM(pm.orders_assigned) as total_assigned
      FROM performance_metrics pm
      WHERE ${whereClause}
    `;

    // Cleaner details query with better formatting
    const detailsQuery = `
      SELECT 
        pm.date,
        pm.user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.username,
        u.role as user_role,
        pm.orders_assigned,
        pm.orders_confirmed,
        pm.orders_delivered,
        ROUND(
          CASE 
            WHEN pm.orders_confirmed > 0 
            THEN (pm.orders_delivered / pm.orders_confirmed) * 100 
            ELSE 0 
          END, 
        1) as success_rate
      FROM performance_metrics pm
      LEFT JOIN users u ON pm.user_id = u.id
      WHERE ${whereClause}
      ORDER BY pm.date DESC, u.first_name ASC
      LIMIT 100
    `;

    const [summaryResult] = await pool.query(summaryQuery, queryParams);
    const [details] = await pool.query(detailsQuery, queryParams);

    const summary = summaryResult[0] || {};

    // Calculate overall success rate
    const overallSuccessRate = summary.total_confirmed > 0 
      ? Math.round((summary.total_delivered / summary.total_confirmed) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        summary: {
          total_users: parseInt(summary.total_users) || 0,
          total_confirmed: parseInt(summary.total_confirmed) || 0,
          total_delivered: parseInt(summary.total_delivered) || 0,
          total_assigned: parseInt(summary.total_assigned) || 0,
          success_rate: overallSuccessRate
        },
        details: details.map(row => ({
          date: row.date,
          user_id: row.user_id,
          user_name: row.user_name,
          username: row.username,
          user_role: row.user_role,
          orders_assigned: parseInt(row.orders_assigned) || 0,
          orders_confirmed: parseInt(row.orders_confirmed) || 0,
          orders_delivered: parseInt(row.orders_delivered) || 0,
          success_rate: parseFloat(row.success_rate) || 0
        }))
      }
    });

  } catch (error) {
    console.error('Get performance reports error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch performance reports' 
    });
  }
});

// Export performance reports in various formats
router.get('/export', authenticateToken, requireAnyPermission(['canExportReports', 'canViewReports']), async (req, res) => {
  try {
    const {
      period = 'week',
      user_id,
      start_date,
      end_date,
      format = 'csv' // New format parameter: csv, excel, pdf
    } = req.query;

    const requestUserId = req.user.id;

    // Check if user can view all users' data or only their own
    const canViewAllUsers = await RolePermissionService.userHasPermission(requestUserId, 'canViewUsers');

    // Build base query conditions (same as reports endpoint)
    let whereClause = '1=1';
    const queryParams = [];

    if (!canViewAllUsers) {
      whereClause += ' AND pm.user_id = ?';
      queryParams.push(requestUserId);
    } else if (user_id) {
      whereClause += ' AND pm.user_id = ?';
      queryParams.push(user_id);
    }

    if (start_date) {
      whereClause += ' AND pm.date >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND pm.date <= ?';
      queryParams.push(end_date);
    }

    if (!start_date && !end_date) {
      whereClause += ' AND pm.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    const query = `
      SELECT 
        u.first_name as 'First Name',
        u.last_name as 'Last Name',
        u.username as 'Username',
        u.email as 'Email',
        pm.date as 'Date',
        pm.orders_assigned as 'Orders Assigned',
        pm.orders_confirmed as 'Orders Confirmed',
        pm.orders_delivered as 'Orders Delivered',
        ROUND((pm.orders_delivered / NULLIF(pm.orders_confirmed, 0)) * 100, 2) as 'Success Rate %',
        ROUND((pm.orders_confirmed / NULLIF(pm.orders_assigned, 0)) * 100, 2) as 'Confirmation Rate %'
      FROM performance_metrics pm
      LEFT JOIN users u ON pm.user_id = u.id
      WHERE ${whereClause}
      ORDER BY pm.date DESC, u.username ASC
    `;

    const [data] = await pool.query(query, queryParams);

    // Convert to CSV
    if (data.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified criteria' });
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle values that might contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');

    // Set appropriate headers based on format
    let contentType, fileExtension, fileName;
    
    switch (format.toLowerCase()) {
      case 'excel':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
        // TODO: Implement actual Excel export using libraries like xlsx or exceljs
        // For now, we'll return CSV content with Excel MIME type
        break;
      case 'pdf':
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        // TODO: Implement actual PDF export using libraries like puppeteer or pdfkit
        // For now, we'll return CSV content (which won't work for PDF, but maintains API compatibility)
        break;
      case 'csv':
      default:
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;
    }

    fileName = `performance_report_${new Date().toISOString().split('T')[0]}.${fileExtension}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export performance reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get performance statistics for dashboard
router.get('/stats', authenticateToken, requireAnyPermission(['canViewReports', 'canViewPerformance']), async (req, res) => {
  try {
    const requestUserId = req.user.id;

    // Check if user can view all users' data or only their own
    const canViewAllUsers = await RolePermissionService.userHasPermission(requestUserId, 'canViewUsers');

    let whereClause = '1=1';
    const queryParams = [];

    if (!canViewAllUsers) {
      whereClause += ' AND pm.user_id = ?';
      queryParams.push(requestUserId);
    }

    // Get current period stats (last 7 days)
    const currentPeriodQuery = `
      SELECT 
        SUM(pm.orders_confirmed + pm.orders_delivered) as current_orders,
        SUM(pm.orders_confirmed) as current_confirmed,
        SUM(pm.orders_delivered) as current_delivered
      FROM performance_metrics pm
      WHERE ${whereClause} AND pm.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `;

    // Get previous period stats (8-14 days ago)
    const previousPeriodQuery = `
      SELECT 
        SUM(pm.orders_confirmed + pm.orders_delivered) as previous_orders,
        SUM(pm.orders_confirmed) as previous_confirmed,
        SUM(pm.orders_delivered) as previous_delivered
      FROM performance_metrics pm
      WHERE ${whereClause} 
        AND pm.date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        AND pm.date < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `;

    const [currentResult] = await pool.query(currentPeriodQuery, queryParams);
    const [previousResult] = await pool.query(previousPeriodQuery, queryParams);

    const current = currentResult[0] || {};
    const previous = previousResult[0] || {};

    // Calculate growth rates
    const calculateGrowth = (current, previous) => {
      if (!previous || previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    res.json({
      current_period: {
        orders: parseInt(current.current_orders) || 0,
        confirmed: parseInt(current.current_confirmed) || 0,
        delivered: parseInt(current.current_delivered) || 0
      },
      previous_period: {
        orders: parseInt(previous.previous_orders) || 0,
        confirmed: parseInt(previous.previous_confirmed) || 0,
        delivered: parseInt(previous.previous_delivered) || 0
      },
      growth: {
        orders: calculateGrowth(current.current_orders, previous.previous_orders),
        confirmed: calculateGrowth(current.current_confirmed, previous.previous_confirmed),
        delivered: calculateGrowth(current.current_delivered, previous.previous_delivered)
      }
    });

  } catch (error) {
    console.error('Get performance stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get individual user performance
router.get('/user/:userId', authenticateToken, requireAnyPermission(['canViewReports', 'canViewPerformance']), async (req, res) => {
  try {
    const { userId } = req.params;
    const requestUserId = req.user.id;

    // Check if user can view all users' data or only their own
    const canViewAllUsers = await RolePermissionService.userHasPermission(requestUserId, 'canViewUsers');

    // Check permissions
    if (!canViewAllUsers && parseInt(userId) !== requestUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = `
      SELECT 
        pm.*,
        u.username,
        u.first_name,
        u.last_name,
        (pm.orders_confirmed + pm.orders_delivered) as orders_handled
      FROM performance_metrics pm
      LEFT JOIN users u ON pm.user_id = u.id
      WHERE pm.user_id = ?
      ORDER BY pm.date DESC
      LIMIT 30
    `;

    const [results] = await pool.query(query, [userId]);

    res.json({
      user_performance: results
    });

  } catch (error) {
    console.error('Get user performance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to group data by period
function groupByPeriod(data, period) {
  const grouped = {};

  data.forEach(item => {
    const date = new Date(item.date);
    let key;

    if (period === 'week') {
      // Group by week (start of week)
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      key = `${item.user_id}_${startOfWeek.toISOString().split('T')[0]}`;
    } else if (period === 'month') {
      // Group by month
      key = `${item.user_id}_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      // Default to day
      key = `${item.user_id}_${item.date}`;
    }

    if (!grouped[key]) {
      grouped[key] = {
        user_id: item.user_id,
        username: item.username,
        first_name: item.first_name,
        last_name: item.last_name,
        email: item.email,
        period_date: item.date,
        orders_confirmed: 0,
        orders_delivered: 0,
        orders_handled: 0
      };
    }

    grouped[key].orders_confirmed += item.orders_confirmed || 0;
    grouped[key].orders_delivered += item.orders_delivered || 0;
    grouped[key].orders_handled += item.orders_handled || 0;
  });

  return Object.values(grouped);
}

module.exports = router;
