const express = require('express');
const { pool } = require('../../config/database');
const { authenticateToken, requireEmployee, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validateRequest, schemas } = require('../middleware/validation');
const ecotrackService = require('../services/ecotrackService');
const { logOrderActivity, logExport } = require('../middleware/activityLogger');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  }
});

// Helper function to map Excel columns to database fields
const mapExcelRowToOrder = (row) => {
  // Handle different date formats
  let orderDate = new Date();
  if (row['DATE']) {
    const dateStr = row['DATE'].toString();
    // Try to parse the date string - handle YYYY-MM-DD HH:MM:SS format
    const parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime())) {
      orderDate = parsedDate;
    }
  }

  // Parse prices and remove any currency symbols or spaces
  const parsePrice = (priceStr) => {
    if (!priceStr) return 0;
    const cleanPrice = priceStr.toString().replace(/[^\d.]/g, '');
    return parseFloat(cleanPrice) || 0;
  };

  // Map status from French/Arabic to English
  const mapStatus = (situation) => {
    if (!situation) return 'pending';
    const status = situation.toString().toLowerCase();
    if (status.includes('sd') || status.includes('livré')) return 'delivered';
    if (status.includes('domicile') || status.includes('a domicile')) return 'out_for_delivery';
    if (status.includes('confirmé') || status.includes('confirmed')) return 'confirmed';
    if (status.includes('annulé') || status.includes('cancelled')) return 'cancelled';
    if (status.includes('retour') || status.includes('returned')) return 'returned';
    return 'pending';
  };

  return {
    ecotrack_id: row['Q'] || '', // Ecotrack ID from Q column
    customer_name: row['FULL_NAME'] || row['Full name'] || row['full_name'] || '',
    customer_phone: row['PHONE'] || row['Phone'] || row['phone'] || '',
    customer_address: `${row['COMMUNE'] || ''}, ${row['WILAYA'] || ''}`.trim().replace(/^,\s*/, ''),
    customer_city: row['COMMUNE'] || row['city'] || '',
    customer_state: row['WILAYA'] || row['state'] || '',
    product_name: row['PRODUCT'] || row['Product name'] || row['product_name'] || '',
    product_price: parsePrice(row['prix de produit']),
    delivery_price: parsePrice(row['prix de livraison']),
    total_amount: parsePrice(row['PRIX total']),
    status: mapStatus(row['situation']),
    notes: row['note'] || '',
    order_date: orderDate
  };
};

// Get all orders with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      assigned_to, 
      customer_name, 
      order_number,
      start_date,
      end_date,
      created_before,
      exclude_status,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    // Ensure page and limit are valid integers
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (validPage - 1) * validLimit;
    
    // Ensure they are integers for MySQL
    const intLimit = parseInt(validLimit);
    const intOffset = parseInt(offset);
    let whereClause = '1=1';
    const queryParams = [];

    // Build WHERE clause based on filters
    if (status) {
      whereClause += ' AND o.status = ?';
      queryParams.push(status);
    }

    if (customer_name) {
      whereClause += ' AND o.customer_name LIKE ?';
      queryParams.push(`%${customer_name}%`);
    }

    if (order_number) {
      whereClause += ' AND o.order_number LIKE ?';
      queryParams.push(`%${order_number}%`);
    }

    if (start_date) {
      whereClause += ' AND DATE(o.created_at) >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(o.created_at) <= ?';
      queryParams.push(end_date);
    }

    // Filter for delayed orders (created before a certain date)
    if (created_before) {
      whereClause += ' AND DATE(o.created_at) < ?';
      queryParams.push(created_before);
    }

    // Exclude certain statuses (for delayed orders - exclude delivered, cancelled, returned)
    if (exclude_status) {
      const excludeStatuses = exclude_status.split(',').map(s => s.trim());
      const placeholders = excludeStatuses.map(() => '?').join(',');
      whereClause += ` AND o.status NOT IN (${placeholders})`;
      queryParams.push(...excludeStatuses);
    }

    // Handle special assigned_to values
    if (assigned_to === 'null') {
      whereClause += ' AND o.assigned_to IS NULL';
    } else if (assigned_to === 'not_null') {
      whereClause += ' AND o.assigned_to IS NOT NULL';
    } else if (assigned_to && assigned_to !== 'null' && assigned_to !== 'not_null') {
      whereClause += ' AND o.assigned_to = ?';
      queryParams.push(assigned_to);
    }

    // If user is employee, only show orders assigned to them or unassigned orders
    if (req.user.role === 'employee') {
      // Only restrict if not already filtered by assigned_to
      if (!assigned_to) {
        whereClause += ' AND (o.assigned_to = ? OR o.assigned_to IS NULL)';
        queryParams.push(req.user.id);
      } else if (assigned_to && assigned_to !== 'null' && assigned_to !== 'not_null' && assigned_to != req.user.id) {
        // Employee trying to see other's orders - restrict access
        whereClause += ' AND o.assigned_to = ?';
        queryParams.push(req.user.id);
      }
    }

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders o WHERE ${whereClause}`,
      queryParams
    );

    const total = countResult[0].total;

    // Get orders with user information
    const orderQuery = `
      SELECT 
        o.*,
        u_assigned.username as assigned_username,
        u_assigned.first_name as assigned_first_name,
        u_assigned.last_name as assigned_last_name,
        u_confirmed.username as confirmed_username,
        u_confirmed.first_name as confirmed_first_name,
        u_confirmed.last_name as confirmed_last_name
      FROM orders o
      LEFT JOIN users u_assigned ON o.assigned_to = u_assigned.id
      LEFT JOIN users u_confirmed ON o.confirmed_by = u_confirmed.id
      WHERE ${whereClause}
      ORDER BY o.${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `;

    const orderQueryParams = [...queryParams, intLimit, intOffset];
    const [orders] = await pool.query(orderQuery, orderQueryParams);

    res.json({
      orders,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        pages: Math.ceil(total / validLimit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single order by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;

    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u_assigned.username as assigned_username,
        u_assigned.first_name as assigned_first_name,
        u_assigned.last_name as assigned_last_name,
        u_confirmed.username as confirmed_username,
        u_confirmed.first_name as confirmed_first_name,
        u_confirmed.last_name as confirmed_last_name
      FROM orders o
      LEFT JOIN users u_assigned ON o.assigned_to = u_assigned.id
      LEFT JOIN users u_confirmed ON o.confirmed_by = u_confirmed.id
      WHERE o.id = ?
    `, [orderId]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // Check if employee can access this order
    if (req.user.role === 'employee' && order.assigned_to !== req.user.id && order.assigned_to !== null) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get tracking logs for this order
    const [logs] = await pool.query(`
      SELECT 
        tl.*,
        u.username,
        u.first_name,
        u.last_name
      FROM tracking_logs tl
      LEFT JOIN users u ON tl.user_id = u.id
      WHERE tl.order_id = ?
      ORDER BY tl.created_at DESC
    `, [orderId]);

    res.json({
      order,
      tracking_logs: logs
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new order
router.post('/', authenticateToken, validateRequest(schemas.createOrder), logOrderActivity('create'), async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_address,
      customer_city,
      product_details,
      total_amount,
      delivery_date,
      notes
    } = req.body;

    // Generate order number
    const orderNumber = `ECO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Handle product_details - ensure it's properly formatted for JSON storage
    let productDetailsJson;
    if (typeof product_details === 'string') {
      try {
        productDetailsJson = JSON.parse(product_details);
      } catch (e) {
        productDetailsJson = { description: product_details };
      }
    } else if (Array.isArray(product_details)) {
      productDetailsJson = { items: product_details };
    } else if (typeof product_details === 'object' && product_details !== null) {
      productDetailsJson = product_details;
    } else {
      productDetailsJson = { description: String(product_details) };
    }

    const [result] = await pool.query(`
      INSERT INTO orders (
        order_number, customer_name, customer_phone, customer_address,
        customer_city, product_details, total_amount, delivery_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderNumber, customer_name, customer_phone, customer_address,
      customer_city, JSON.stringify(productDetailsJson), total_amount,
      delivery_date, notes
    ]);

    // Log the creation
    await pool.query(`
      INSERT INTO tracking_logs (order_id, user_id, action, new_status, details)
      VALUES (?, ?, ?, ?, ?)
    `, [result.insertId, req.user.id, 'created', 'pending', 'Order created']);

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: result.insertId,
        order_number: orderNumber,
        ...req.body
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order
router.put('/:id', authenticateToken, validateRequest(schemas.updateOrder), logOrderActivity('update'), async (req, res) => {
  try {
    const orderId = req.params.id;
    const updates = req.body;

    // Get current order
    const [currentOrder] = await pool.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );

    if (currentOrder.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = currentOrder[0];

    // Check permissions
    if (req.user.role === 'employee' && order.assigned_to !== req.user.id && order.assigned_to !== null) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Restrict editing for certain statuses
    const restrictedStatuses = ['delivered', 'cancelled', 'returned'];
    if (restrictedStatuses.includes(order.status) && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: `Cannot edit order with status: ${order.status}. Only admins can modify ${restrictedStatuses.join(', ')} orders.` 
      });
    }

    // Restrict certain status transitions
    const statusTransitions = {
      'pending': ['confirmed', 'cancelled', 'on_hold'],
      'confirmed': ['processing', 'cancelled', 'on_hold'],
      'processing': ['out_for_delivery', 'cancelled', 'on_hold'],
      'out_for_delivery': ['delivered', 'returned', 'cancelled'],
      'on_hold': ['pending', 'confirmed', 'cancelled'],
      'delivered': [], // Final status - only admin can modify
      'cancelled': [], // Final status - only admin can modify
      'returned': ['pending', 'cancelled'] // Admin only transitions
    };

    if (updates.status && updates.status !== order.status) {
      const allowedTransitions = statusTransitions[order.status] || [];
      if (!allowedTransitions.includes(updates.status) && req.user.role !== 'admin') {
        return res.status(400).json({ 
          error: `Invalid status transition from ${order.status} to ${updates.status}` 
        });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add status-specific user tracking for certain status changes
    if (updates.status && updates.status !== order.status) {
      switch (updates.status) {
        case 'confirmed':
          updateFields.push('confirmed_by = ?');
          updateValues.push(req.user.id);
          break;
      }
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = NOW()');
    updateValues.push(orderId);

    await pool.query(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Integrate with Ecotrack when order is confirmed
    if (updates.status === 'confirmed' && order.status !== 'confirmed') {
      try {
        console.log(`🚚 Creating Ecotrack shipment for order ${order.order_number}`);
        
        const trackingResult = await ecotrackService.createShipment({
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address,
          customer_city: order.customer_city,
          product_details: order.product_details,
          total_amount: order.total_amount,
          notes: order.notes
        });

        if (trackingResult.success) {
          // Update order with Ecotrack tracking information
          await pool.query(
            `UPDATE orders SET 
              ecotrack_tracking_id = ?, 
              ecotrack_status = ?, 
              ecotrack_last_update = NOW(),
              tracking_url = ?
            WHERE id = ?`,
            [
              trackingResult.tracking_id,
              trackingResult.status,
              trackingResult.tracking_url,
              orderId
            ]
          );

          console.log(`✅ Ecotrack shipment created: ${trackingResult.tracking_id}`);
          
          // Log Ecotrack integration
          await pool.query(`
            INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
            VALUES (?, ?, ?, ?, NOW())
          `, [
            orderId,
            req.user.id,
            'ecotrack_created',
            `Ecotrack shipment created with tracking ID: ${trackingResult.tracking_id}`
          ]);
        }
      } catch (ecotrackError) {
        console.error('Ecotrack integration error:', ecotrackError.message);
        // Log the error but don't fail the order update
        await pool.query(`
          INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
          VALUES (?, ?, ?, ?, NOW())
        `, [
          orderId,
          req.user.id,
          'ecotrack_error',
          `Failed to create Ecotrack shipment: ${ecotrackError.message}`
        ]);
      }
    }

    // Log the update with detailed tracking
    const logDetails = Object.keys(updates).map(key => `${key}: ${order[key]} → ${updates[key]}`).join(', ');
    
    await pool.query(`
      INSERT INTO tracking_logs (order_id, user_id, action, previous_status, new_status, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [
      orderId,
      req.user.id,
      updates.status ? 'status_updated' : 'updated',
      order.status,
      updates.status || order.status,
      logDetails
    ]);

    // Update user performance metrics if order status changed
    if (updates.status && updates.status !== order.status) {
      await updatePerformanceMetrics(req.user.id, updates.status);
    }

    res.json({ message: 'Order updated successfully' });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign order to user
router.put('/:id/assign', authenticateToken, requirePermission('canAssignOrders'), logOrderActivity('assign'), async (req, res) => {
  try {
    const orderId = req.params.id;
    const { assigned_to } = req.body;

    if (!assigned_to) {
      return res.status(400).json({ error: 'assigned_to is required' });
    }

    // Check if assigned user exists
    const [users] = await pool.query(
      'SELECT id FROM users WHERE id = ? AND is_active = true',
      [assigned_to]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const [result] = await pool.query(
      'UPDATE orders SET assigned_to = ? WHERE id = ?',
      [assigned_to, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Log the assignment
    await pool.query(`
      INSERT INTO tracking_logs (order_id, user_id, action, details)
      VALUES (?, ?, ?, ?)
    `, [orderId, req.user.id, 'assigned', `Order assigned to user ID ${assigned_to}`]);

    res.json({ message: 'Order assigned successfully' });
  } catch (error) {
    console.error('Assign order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete order (admin only)
router.delete('/:id', authenticateToken, requirePermission('canDeleteOrders'), logOrderActivity('delete'), async (req, res) => {
  try {
    const orderId = req.params.id;

    const [result] = await pool.query(
      'DELETE FROM orders WHERE id = ?',
      [orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto-distribute orders (admin only)
router.post('/distribute', authenticateToken, requirePermission('canDistributeOrders'), async (req, res) => {
  try {
    // Get all unassigned orders
    const [unassignedOrders] = await pool.query(
      'SELECT id FROM orders WHERE assigned_to IS NULL AND status = "pending"'
    );

    if (unassignedOrders.length === 0) {
      return res.json({ message: 'No unassigned orders found', distributed: 0 });
    }

    // Get all active employees
    const [activeEmployees] = await pool.query(
      'SELECT id FROM users WHERE role = "employee" AND is_active = true'
    );

    if (activeEmployees.length === 0) {
      return res.status(400).json({ error: 'No active employees found' });
    }

    let distributed = 0;
    let employeeIndex = 0;

    // Distribute orders equally among employees
    for (const order of unassignedOrders) {
      const employeeId = activeEmployees[employeeIndex].id;
      
      await pool.query(
        'UPDATE orders SET assigned_to = ? WHERE id = ?',
        [employeeId, order.id]
      );

      // Log the assignment
      await pool.query(
        'INSERT INTO tracking_logs (order_id, user_id, action, details) VALUES (?, ?, ?, ?)',
        [order.id, req.user.id, 'assigned', `Auto-distributed to employee ID ${employeeId}`]
      );

      distributed++;
      employeeIndex = (employeeIndex + 1) % activeEmployees.length;
    }

    res.json({ 
      message: `${distributed} orders distributed successfully`,
      distributed 
    });
  } catch (error) {
    console.error('Distribute orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import orders from CSV/Excel (admin only)
router.post('/import', authenticateToken, requirePermission('canImportOrders'), upload.single('file'), logOrderActivity('import'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let workbook;
    let data = [];

    // Parse file based on type
    if (req.file.mimetype.includes('excel') || req.file.mimetype.includes('spreadsheet')) {
      // Parse Excel file
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    } else if (req.file.mimetype.includes('csv')) {
      // Parse CSV file
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    }

    if (data.length === 0) {
      return res.status(400).json({ error: 'No data found in file' });
    }

    let imported = 0;
    let errors = [];
    let warnings = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        const mappedOrder = mapExcelRowToOrder(row);

        // Skip empty rows
        if (!mappedOrder.customer_name && !mappedOrder.customer_phone) {
          continue;
        }

        // Check for missing required fields and add warnings
        const missingFields = [];
        if (!mappedOrder.customer_name) {
          missingFields.push('name');
          mappedOrder.customer_name = ''; // Use empty string as default
        }
        if (!mappedOrder.customer_phone) {
          missingFields.push('phone');
          mappedOrder.customer_phone = ''; // Use empty string as default
        }
        if (!mappedOrder.customer_city) {
          missingFields.push('city');
          mappedOrder.customer_city = ''; // Use empty string as default
        }

        // Add warning if any required fields are missing
        if (missingFields.length > 0) {
          warnings.push(`Row ${i + 2}: Missing required fields (${missingFields.join(', ')})`);
        }

        // Generate order number if not exists
        const orderNumber = `ECO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Create product details object
        const productDetails = {
          name: mappedOrder.product_name,
          price: mappedOrder.product_price,
          delivery_price: mappedOrder.delivery_price,
          delivery_type: 'home_delivery' // Default to home delivery
        };

        // Use the total amount from Excel or calculate if not available
        const totalAmount = mappedOrder.total_amount || (mappedOrder.product_price + mappedOrder.delivery_price);

        // Insert order into database with ecotrack ID and proper status
        const [result] = await pool.query(`
          INSERT INTO orders (
            order_number, customer_name, customer_phone, customer_address,
            customer_city, product_details, total_amount, status, 
            ecotrack_tracking_id, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderNumber,
          mappedOrder.customer_name,
          mappedOrder.customer_phone,
          mappedOrder.customer_address,
          mappedOrder.customer_city,
          JSON.stringify(productDetails),
          totalAmount,
          mappedOrder.status,
          mappedOrder.ecotrack_id || null,
          mappedOrder.notes,
          mappedOrder.order_date
        ]);

        // If there's an ecotrack ID, try to sync with ecotrack service
        if (mappedOrder.ecotrack_id) {
          try {
            // Optional: Sync with ecotrack service to get latest status
            const trackingInfo = await ecotrackService.getTrackingInfo(mappedOrder.ecotrack_id);
            if (trackingInfo && trackingInfo.status) {
              // Update order status based on ecotrack info
              await pool.query(
                'UPDATE orders SET status = ? WHERE id = ?',
                [trackingInfo.status, result.insertId]
              );
            }
          } catch (ecotrackError) {
            console.log(`Could not sync ecotrack for ID ${mappedOrder.ecotrack_id}:`, ecotrackError.message);
            warnings.push(`Row ${i + 2}: Could not sync with ecotrack ID ${mappedOrder.ecotrack_id}`);
          }
        }

        // Log the creation
        await pool.query(`
          INSERT INTO tracking_logs (order_id, user_id, action, new_status, details, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())
        `, [result.insertId, req.user.id, 'created', mappedOrder.status, `Order imported from Excel file${mappedOrder.ecotrack_id ? ` with ecotrack ID: ${mappedOrder.ecotrack_id}` : ''}`]);

        imported++;

      } catch (rowError) {
        console.error(`Error processing row ${i + 2}:`, rowError);
        errors.push(`Row ${i + 2}: ${rowError.message}`);
      }
    }

    res.json({
      message: `Import completed: ${imported} orders imported successfully`,
      imported,
      total_rows: data.length,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Import orders error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Helper function to update performance metrics
async function updatePerformanceMetrics(userId, newStatus) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get or create today's metrics
    const [existingMetrics] = await pool.query(
      'SELECT * FROM performance_metrics WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    if (existingMetrics.length === 0) {
      // Create new metrics record
      await pool.query(
        'INSERT INTO performance_metrics (user_id, date) VALUES (?, ?)',
        [userId, today]
      );
    }

    // Update counters based on status
    let updateField = '';
    switch (newStatus) {
      case 'confirmed':
        updateField = 'orders_confirmed = orders_confirmed + 1';
        break;
      case 'delivered':
        updateField = 'orders_delivered = orders_delivered + 1';
        break;
    }

    if (updateField) {
      await pool.query(
        `UPDATE performance_metrics SET ${updateField} WHERE user_id = ? AND date = ?`,
        [userId, today]
      );

      // Update user's total orders handled
      await pool.query(
        'UPDATE users SET total_orders_handled = total_orders_handled + 1 WHERE id = ?',
        [userId]
      );
    }
  } catch (error) {
    console.error('Update performance metrics error:', error);
  }
}

// Update tracking status for a specific order
router.put('/:id/tracking/update', authenticateToken, requirePermission('canEditOrders'), async (req, res) => {
  try {
    const orderId = req.params.id;

    // Get order with tracking ID
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ? AND ecotrack_tracking_id IS NOT NULL',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found or no tracking ID' });
    }

    const order = orders[0];
    
    // Fetch latest tracking info from Ecotrack
    const trackingInfo = await ecotrackService.getTrackingInfo(order.ecotrack_tracking_id);

    if (trackingInfo.success) {
      // Update order with latest tracking info
      await pool.query(
        `UPDATE orders SET 
          ecotrack_status = ?, 
          ecotrack_last_update = NOW(),
          ecotrack_location = ?
        WHERE id = ?`,
        [trackingInfo.status, trackingInfo.location, orderId]
      );

      // Log the tracking update
      await pool.query(`
        INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [
        orderId,
        req.user.id,
        'tracking_updated',
        `Tracking status updated: ${trackingInfo.status_description || trackingInfo.status} at ${trackingInfo.location || 'Unknown location'}`
      ]);

      res.json({
        message: 'Tracking status updated successfully',
        tracking_info: {
          status: trackingInfo.status,
          status_description: trackingInfo.status_description,
          location: trackingInfo.location,
          last_update: trackingInfo.last_update
        }
      });
    } else {
      res.status(400).json({ error: trackingInfo.error });
    }
  } catch (error) {
    console.error('Update tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk update tracking statuses for all orders with tracking IDs
router.post('/tracking/sync-all', authenticateToken, requirePermission('canDistributeOrders'), async (req, res) => {
  try {
    // Get all orders with Ecotrack tracking IDs
    const [orders] = await pool.query(
      'SELECT id, ecotrack_tracking_id FROM orders WHERE ecotrack_tracking_id IS NOT NULL'
    );

    if (orders.length === 0) {
      return res.json({ message: 'No orders with tracking IDs found', updated: 0 });
    }

    const trackingIds = orders.map(order => order.ecotrack_tracking_id);
    
    // Get bulk tracking info from Ecotrack
    const trackingResults = await ecotrackService.getBulkTrackingInfo(trackingIds);
    
    let updatedCount = 0;
    let errors = [];

    // Update each order with new tracking info
    for (const result of trackingResults) {
      try {
        if (result.success) {
          const order = orders.find(o => o.ecotrack_tracking_id === result.tracking_id);
          
          await pool.query(
            `UPDATE orders SET 
              ecotrack_status = ?, 
              ecotrack_last_update = NOW(),
              ecotrack_location = ?
            WHERE id = ?`,
            [result.status, result.location, order.id]
          );

          // Log the tracking update
          await pool.query(`
            INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
            VALUES (?, ?, ?, ?, NOW())
          `, [
            order.id,
            req.user.id,
            'tracking_synced',
            `Bulk sync - Status: ${result.status_description || result.status} at ${result.location || 'Unknown location'}`
          ]);

          updatedCount++;
        } else {
          errors.push(`${result.tracking_id}: ${result.error}`);
        }
      } catch (updateError) {
        console.error('Error updating order tracking:', updateError);
        errors.push(`${result.tracking_id}: Database update failed`);
      }
    }

    res.json({
      message: `Tracking sync completed: ${updatedCount} orders updated`,
      updated: updatedCount,
      total: orders.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk tracking sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tracking information for an order
router.get('/:id/tracking', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;

    // Get order with tracking information
    const [orders] = await pool.query(
      `SELECT 
        id, order_number, ecotrack_tracking_id, ecotrack_status, 
        ecotrack_last_update, ecotrack_location, tracking_url, status
      FROM orders WHERE id = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    // If no tracking ID, return order status only
    if (!order.ecotrack_tracking_id) {
      return res.json({
        order_id: order.id,
        order_number: order.order_number,
        status: order.status,
        has_tracking: false
      });
    }

    // Get tracking history from logs
    const [trackingHistory] = await pool.query(
      `SELECT action, details, created_at 
      FROM tracking_logs 
      WHERE order_id = ? AND action IN ('ecotrack_created', 'tracking_updated', 'tracking_synced')
      ORDER BY created_at DESC`,
      [orderId]
    );

    res.json({
      order_id: order.id,
      order_number: order.order_number,
      status: order.status,
      has_tracking: true,
      tracking: {
        tracking_id: order.ecotrack_tracking_id,
        status: order.ecotrack_status,
        location: order.ecotrack_location,
        last_update: order.ecotrack_last_update,
        tracking_url: order.tracking_url,
        history: trackingHistory
      }
    });
  } catch (error) {
    console.error('Get tracking info error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export orders to CSV/Excel (admin and employee)
router.get('/export', authenticateToken, requirePermission('canExportOrders'), logExport('orders'), async (req, res) => {
  try {
    const { format = 'csv', status, assigned_to, start_date, end_date } = req.query;
    const isAdmin = req.user.role === 'admin';
    
    let whereClause = '1=1';
    const queryParams = [];

    // Apply filters
    if (status) {
      whereClause += ' AND o.status = ?';
      queryParams.push(status);
    }

    if (assigned_to) {
      whereClause += ' AND o.assigned_to = ?';
      queryParams.push(assigned_to);
    }

    if (start_date) {
      whereClause += ' AND DATE(o.created_at) >= ?';
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(o.created_at) <= ?';
      queryParams.push(end_date);
    }

    // If user is employee, only export their assigned orders
    if (!isAdmin) {
      whereClause += ' AND (o.assigned_to = ? OR o.assigned_to IS NULL)';
      queryParams.push(req.user.id);
    }

    const [orders] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_address,
        o.customer_city,
        o.status,
        o.total_amount,
        o.created_at,
        o.updated_at,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_to = u.id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
    `, queryParams);

    if (format === 'csv') {
      // Generate CSV
      const csv = [
        'Order Number,Customer Name,Customer Phone,Customer Address,Customer City,Status,Total Amount,Assigned To,Created At,Updated At',
        ...orders.map(order => [
          order.order_number,
          order.customer_name,
          order.customer_phone,
          order.customer_address,
          order.customer_city,
          order.status,
          order.total_amount,
          order.assigned_to_name || 'Unassigned',
          order.created_at,
          order.updated_at
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="orders_export_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } else {
      // Return JSON for other formats
      res.json({
        orders,
        exported_count: orders.length,
        export_date: new Date().toISOString(),
        filters: req.query
      });
    }
  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
