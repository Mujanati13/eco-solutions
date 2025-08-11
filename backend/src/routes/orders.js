const express = require('express');
const { pool } = require('../../config/database');
const { authenticateToken, requireEmployee, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validateRequest, schemas } = require('../middleware/validation');
const ecotrackService = require('../services/ecotrackService');
const StockService = require('../services/stockService');
const DeliveryPricingService = require('../services/deliveryPricingService');
const { logOrderActivity, logExport } = require('../middleware/activityLogger');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');

const router = express.Router();

// Get all wilayas for delivery pricing
router.get('/wilayas', authenticateToken, async (req, res) => {
  try {
    const [wilayas] = await pool.query(`
      SELECT id, name_ar, name_fr, name_en, code
      FROM wilayas 
      ORDER BY code ASC
    `);

    res.json({
      success: true,
      data: wilayas
    });
  } catch (error) {
    console.error('Error fetching wilayas:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get baladias by wilaya for delivery pricing
router.get('/wilayas/:wilayaId/baladias', authenticateToken, async (req, res) => {
  try {
    const { wilayaId } = req.params;
    
    const [baladias] = await pool.query(`
      SELECT id, name_ar, name_fr, name_en, wilaya_id
      FROM baladias 
      WHERE wilaya_id = ?
      ORDER BY name_fr ASC
    `, [wilayaId]);

    res.json({
      success: true,
      data: baladias
    });
  } catch (error) {
    console.error('Error fetching baladias:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Calculate delivery price for order
router.post('/calculate-delivery-price', authenticateToken, async (req, res) => {
  try {
    const { 
      wilaya_id, 
      baladia_id, 
      delivery_type = 'home', 
      weight = 1, 
      volume = 1,
      pricing_level = 'wilaya'
    } = req.body;

    if (!wilaya_id) {
      return res.status(400).json({
        success: false,
        message: 'Wilaya ID is required'
      });
    }

    const pricingData = {
      wilaya_id,
      baladia_id,
      delivery_type,
      weight: parseFloat(weight),
      volume: parseFloat(volume),
      pricing_level
    };

    const pricing = pricing_level === 'baladia' && baladia_id
      ? await DeliveryPricingService.calculateDeliveryPriceWithLocation(pricingData)
      : await DeliveryPricingService.calculateDeliveryPrice(
          wilaya_id,
          delivery_type,
          parseFloat(weight),
          parseFloat(volume)
        );

    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('Error calculating delivery price:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

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

// Helper function to map Excel columns to database fields - Legacy format
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
    ecotrack_tracking_id: row['Q'] || '', // Ecotrack ID from Q column
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

// Helper function to map new Excel format (NOEST EXPRESS format)
const mapNoestExcelRowToOrder = (row) => {
  // Parse prices and remove any currency symbols or spaces
  const parsePrice = (priceStr) => {
    if (!priceStr || priceStr === '' || priceStr === null || priceStr === undefined) return 0;
    
    // Convert to string and clean
    const cleanPrice = priceStr.toString().replace(/[^\d.]/g, '');
    
    // Parse and validate
    const parsedPrice = parseFloat(cleanPrice);
    
    // Return 0 if not a valid number
    return isNaN(parsedPrice) ? 0 : parsedPrice;
  };

  // Clean phone number
  const cleanPhone = (phone) => {
    if (!phone) return '';
    return phone.toString().replace(/[^\d]/g, '');
  };

  // Helper function to find value with multiple possible key names
  const findValue = (row, possibleKeys) => {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    return '';
  };

  // Get primary phone (Tel 1) and secondary phone (Tel 2)
  const primaryPhone = cleanPhone(findValue(row, ['Tel 1', 'tel1', 'phone1', 'Tel1', 'TEL 1', 'TEL1']));
  const secondaryPhone = cleanPhone(findValue(row, ['Tel 2', 'tel2', 'phone2', 'Tel2', 'TEL 2', 'TEL2']));
  
  // Use primary phone, fallback to secondary if primary is 0 or empty
  const customerPhone = (primaryPhone && primaryPhone !== '0') ? primaryPhone : secondaryPhone;

  // Get the tracking ID from ID column first, then Réf column as fallback
  const trackingId = findValue(row, ['ID', 'Réf', 'id', 'ref']);
  
  return {
    ecotrack_tracking_id: trackingId,
    reference: trackingId, // Use the same ID as reference
    customer_name: findValue(row, ['Client', 'client', 'customer_name', 'customerName', 'name', 'Name']),
    customer_phone: customerPhone,
    customer_phone_2: secondaryPhone,
    customer_address: findValue(row, ['Adresse', 'adresse', 'address', 'Address']),
    customer_city: findValue(row, ['Commune', 'commune', 'city', 'City']),
    customer_state: findValue(row, ['Wilaya', 'wilaya', 'state', 'State']),
    total_amount: parsePrice(findValue(row, ['Total', 'total', 'amount', 'Amount', 'TOTAL'])),
    notes: findValue(row, ['Remarque', 'remarque', 'notes', 'Notes', 'note', 'Note']),
    product_name: findValue(row, ['Produits', 'produits', 'products', 'Products', 'product', 'Product']),
    status: 'confirmed', // Default status for imported orders
    order_date: new Date()
  };
};

// Helper function to detect Excel format
const detectExcelFormat = (data) => {
  if (!data || data.length === 0) return 'unknown';
  
  const firstRow = data[0];
  const keys = Object.keys(firstRow).map(key => key.toLowerCase());
  
  // Check if we have __EMPTY columns (position-based data)
  const hasEmptyColumns = keys.some(key => key.includes('__empty'));
  
  if (hasEmptyColumns) {
    console.log('Detected position-based Excel format, defaulting to NOEST');
    return 'noest';
  }
  
  // Check for NOEST EXPRESS format - look for key indicators
  const hasNoestIndicators = keys.some(key => 
    key.includes('id') || key.includes('tracking')
  ) && keys.some(key => 
    key.includes('client') || key.includes('customer')
  ) && keys.some(key => 
    key.includes('tel') || key.includes('phone')
  );
  
  // Check for legacy format - look for legacy indicators
  const hasLegacyIndicators = keys.some(key => 
    key.includes('full_name') || key.includes('fullname')
  ) || keys.some(key => 
    key.includes('phone') && !key.includes('tel')
  ) || keys.some(key => 
    key === 'q' // Specific legacy column
  );
  
  // If we have NOEST indicators and not legacy indicators, it's NOEST format
  if (hasNoestIndicators && !hasLegacyIndicators) {
    return 'noest';
  }
  
  // If we have legacy indicators, it's legacy format
  if (hasLegacyIndicators) {
    return 'legacy';
  }
  
  // Default to NOEST format for new files
  return 'noest';
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
    const validLimit = Math.min(10000, Math.max(1, parseInt(limit) || 20)); // Increased from 100 to 10000
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

    // Get orders with user information and source tracking fields
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
      notes,
      wilaya_id,
      delivery_type = 'home',
      product_weight = 1.0
    } = req.body;

    // Calculate delivery price if wilaya_id is provided
    let delivery_price = 0;
    if (wilaya_id) {
      try {
        const pricingResult = await DeliveryPricingService.calculateDeliveryPrice(
          wilaya_id,
          delivery_type,
          parseFloat(product_weight) || 1.0
        );
        delivery_price = pricingResult.price;
      } catch (pricingError) {
        console.warn('Error calculating delivery price:', pricingError);
        // Continue with order creation even if pricing calculation fails
      }
    }

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
        customer_city, product_details, total_amount, delivery_date, notes,
        wilaya_id, delivery_type, delivery_price, product_weight
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderNumber, customer_name, customer_phone, customer_address,
      customer_city, JSON.stringify(productDetailsJson), total_amount,
      delivery_date, notes, wilaya_id || null, delivery_type, delivery_price, product_weight
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
        delivery_price,
        ...req.body
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order
router.put('/:id', authenticateToken, logOrderActivity('update'), async (req, res) => {
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
      'pending': ['confirmed', 'cancelled', 'on_hold', '0_tent', '1_tent', '2_tent', '3_tent', '4_tent', '5_tent', '6_tent'],
      'confirmed': ['import_to_delivery_company', 'processing', 'cancelled', 'on_hold', '0_tent', '1_tent', '2_tent', '3_tent', '4_tent', '5_tent', '6_tent'],
      'import_to_delivery_company': ['processing', 'cancelled', 'on_hold'],
      'processing': ['out_for_delivery', 'cancelled', 'on_hold', '0_tent', '1_tent', '2_tent', '3_tent', '4_tent', '5_tent', '6_tent'],
      'out_for_delivery': ['delivered', 'returned', 'cancelled', '0_tent', '1_tent', '2_tent', '3_tent', '4_tent', '5_tent', '6_tent'],
      'on_hold': ['pending', 'confirmed', 'cancelled', '0_tent', '1_tent', '2_tent', '3_tent', '4_tent', '5_tent', '6_tent'],
      'delivered': [], // Final status - only admin can modify
      'cancelled': [], // Final status - only admin can modify
      'returned': ['pending', 'cancelled'], // Admin only transitions
      '0_tent': ['1_tent', '2_tent', '3_tent', '4_tent', '5_tent', '6_tent', 'pending', 'confirmed', 'processing', 'cancelled'],
      '1_tent': ['0_tent', '2_tent', '3_tent', '4_tent', '5_tent', '6_tent', 'pending', 'confirmed', 'processing', 'cancelled'],
      '2_tent': ['0_tent', '1_tent', '3_tent', '4_tent', '5_tent', '6_tent', 'pending', 'confirmed', 'processing', 'cancelled'],
      '3_tent': ['0_tent', '1_tent', '2_tent', '4_tent', '5_tent', '6_tent', 'pending', 'confirmed', 'processing', 'cancelled'],
      '4_tent': ['0_tent', '1_tent', '2_tent', '3_tent', '5_tent', '6_tent', 'pending', 'confirmed', 'processing', 'cancelled'],
      '5_tent': ['0_tent', '1_tent', '2_tent', '3_tent', '4_tent', '6_tent', 'pending', 'confirmed', 'processing', 'cancelled'],
      '6_tent': ['0_tent', '1_tent', '2_tent', '3_tent', '4_tent', '5_tent', 'pending', 'confirmed', 'processing', 'cancelled']
    };

    if (updates.status && updates.status !== order.status) {
      const allowedTransitions = statusTransitions[order.status] || [];
      if (!allowedTransitions.includes(updates.status) && req.user.role !== 'admin') {
        return res.status(400).json({ 
          error: `Invalid status transition from ${order.status} to ${updates.status}` 
        });
      }
    }

    // Calculate delivery pricing if location or delivery type changed
    if (updates.wilaya_id || updates.baladia_id || updates.delivery_type) {
      try {
        const wilayaId = updates.wilaya_id || order.wilaya_id;
        const baladiaId = updates.baladia_id || order.baladia_id;
        const deliveryType = updates.delivery_type || order.delivery_type || 'home';
        
        if (wilayaId) {
          const pricingData = {
            wilaya_id: wilayaId,
            baladia_id: baladiaId,
            delivery_type: deliveryType,
            weight: updates.weight || order.weight || 1,
            volume: updates.volume || order.volume || 1,
            pricing_level: baladiaId ? 'baladia' : 'wilaya'
          };

          const pricing = baladiaId
            ? await DeliveryPricingService.calculateDeliveryPriceWithLocation(pricingData)
            : await DeliveryPricingService.calculateDeliveryPrice(
                wilayaId,
                deliveryType,
                pricingData.weight,
                pricingData.volume
              );

          if (pricing && pricing.delivery_price !== undefined) {
            updates.delivery_price = pricing.delivery_price;
          }
        }
      } catch (error) {
        console.error('Error calculating delivery price:', error);
        // Continue with update even if delivery pricing fails
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    // Filter out fields that don't exist in the database
    const allowedFields = [
      'customer_name', 'customer_phone', 'customer_address', 'customer_city',
      'product_details', 'total_amount', 'status', 'payment_status', 'assigned_to',
      'confirmed_by', 'delivery_date', 'notes', 'ecotrack_tracking_id',
      'ecotrack_status', 'ecotrack_last_update', 'wilaya_id', 'baladia_id', 'delivery_type',
      'delivery_price', 'product_weight', 'pricing_level'
    ];

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
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

    console.log(`🔍 MAIN ORDER UPDATE: About to update order ${orderId}`);
    console.log(`🔍 Update fields:`, updateFields);
    console.log(`🔍 Update values:`, updateValues);

    await pool.query(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    console.log(`✅ MAIN ORDER UPDATE COMPLETED for order ${orderId}`);
    console.log(`🔍 Order status before Ecotrack check - order.status: ${order.status}`);
    console.log(`🔍 Updates being applied - updates.status: ${updates.status}`);

    // Note: Automatic Ecotrack integration on 'confirmed' status has been disabled
    // Orders now use batch processing via the /batch-ecotrack endpoint
    // This allows staff to collect confirmed orders and send them in batches
    
    if (updates.status === 'confirmed' && order.status !== 'confirmed') {
      console.log(`� Order ${order.order_number} confirmed and ready for batch processing`);
      
      // Log confirmation without automatic Ecotrack sending
      await pool.query(`
        INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [
        orderId,
        req.user.id,
        'order_confirmed',
        `Order confirmed and ready for batch delivery processing`
      ]);
    }

    // Integrate with Ecotrack when order status is "import_to_delivery_company"
    console.log(`🔍 DEBUG: Checking Ecotrack integration conditions:`);
    console.log(`  - updates.status: ${updates.status}`);
    console.log(`  - order.status: ${order.status}`);
    console.log(`  - Status condition met: ${updates.status === 'import_to_delivery_company' && order.status !== 'import_to_delivery_company'}`);
    
    if (updates.status === 'import_to_delivery_company' && order.status !== 'import_to_delivery_company') {
      console.log(`🚚 ✅ ECOTRACK TRIGGER: Status changed to 'import_to_delivery_company' for order ${order.order_number || order.id}`);
      
      try {
        console.log(`🚚 Creating Ecotrack shipment for order ${order.order_number}`);
        console.log(`📋 Order details for Ecotrack:`, {
          id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          wilaya_id: order.wilaya_id,
          baladia_id: order.baladia_id
        });
        
        // Parse product details to extract more information
        let productInfo = {};
        if (order.product_details) {
          try {
            productInfo = typeof order.product_details === 'string' 
              ? JSON.parse(order.product_details) 
              : order.product_details;
            console.log(`📦 Parsed product info:`, productInfo);
          } catch (e) {
            console.log(`⚠️ Failed to parse product_details, using fallback:`, e.message);
            productInfo = { name: order.product_details };
          }
        } else {
          console.log(`⚠️ No product_details found for order ${order.order_number}`);
        }
        
        const shipmentData = {
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_phone_2: order.customer_phone_2,
          customer_address: order.customer_address,
          customer_city: order.customer_city,
          product_details: productInfo,
          total_amount: order.total_amount,
          notes: order.notes || '',
          delivery_type: order.delivery_type || 'home',
          wilaya_id: order.wilaya_id,
          baladia_name: order.baladia_name,
          weight: order.weight || 1
        };
        
        console.log(`📦 BEFORE ECOTRACK CALL: Shipment data:`, shipmentData);
        console.log(`🌐 About to call ecotrackService.createShipment...`);
        
        const trackingResult = await ecotrackService.createShipment(shipmentData);
        
        console.log(`📦 AFTER ECOTRACK CALL: Response received:`, trackingResult);
        console.log(`📦 Response type:`, typeof trackingResult);
        console.log(`📦 Response success:`, trackingResult?.success);
        console.log(`📦 Response tracking_id:`, trackingResult?.tracking_id);

        if (trackingResult.success) {
          try {
            // Update order with Ecotrack tracking information and change status to processing
            console.log(`💾 Saving tracking ID ${trackingResult.tracking_id} to database for order ${orderId}`);
            
            const updateResult = await pool.query(
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
            
            console.log(`✅ Database update result:`, updateResult[0]);
            console.log(`✅ Ecotrack shipment created and saved: ${trackingResult.tracking_id}`);
            
          } catch (dbError) {
            console.error(`❌ Failed to save tracking ID to database:`, dbError);
            throw dbError; // Re-throw to be caught by outer catch
          }
          
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
        console.error(`🚨 ECOTRACK ERROR CAUGHT:`, ecotrackError);
        console.error(`🚨 Error type:`, typeof ecotrackError);
        console.error(`🚨 Error message:`, ecotrackError.message);
        console.error(`🚨 Error stack:`, ecotrackError.stack);
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

    // Cancel Ecotrack shipment when order is cancelled
    if (updates.status === 'cancelled' && order.status !== 'cancelled') {
      try {
        // Check if order has Ecotrack tracking ID
        if (order.ecotrack_tracking_id) {
          console.log(`🚚 ❌ ECOTRACK CANCELLATION: Cancelling shipment for order ${order.order_number}`);
          console.log(`🚚 Tracking ID to cancel: ${order.ecotrack_tracking_id}`);
          
          const cancellationResult = await ecotrackService.cancelShipment(
            order.ecotrack_tracking_id, 
            `Order ${order.order_number} cancelled by user`
          );
          
          if (cancellationResult.success) {
            // Update order to remove Ecotrack information
            await pool.query(
              `UPDATE orders SET 
                ecotrack_tracking_id = NULL, 
                ecotrack_status = 'cancelled', 
                ecotrack_last_update = NOW(),
                tracking_url = NULL
              WHERE id = ?`,
              [orderId]
            );

            console.log(`✅ Ecotrack shipment cancelled: ${order.ecotrack_tracking_id}`);
            
            // Log Ecotrack cancellation
            await pool.query(`
              INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
              VALUES (?, ?, ?, ?, NOW())
            `, [
              orderId,
              req.user.id,
              'ecotrack_cancelled',
              `Ecotrack shipment cancelled - Tracking ID: ${order.ecotrack_tracking_id}`
            ]);
          } else {
            console.error(`❌ Failed to cancel Ecotrack shipment for ${order.order_number}`);
          }
        } else {
          console.log(`ℹ️ Order ${order.order_number} cancelled but has no Ecotrack tracking ID`);
        }
      } catch (ecotrackError) {
        console.error(`🚨 Ecotrack cancellation error for ${order.order_number}:`, ecotrackError.message);
        
        // Log Ecotrack cancellation error
        await pool.query(`
          INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
          VALUES (?, ?, ?, ?, NOW())
        `, [
          orderId,
          req.user.id,
          'ecotrack_cancellation_error',
          `Failed to cancel Ecotrack shipment: ${ecotrackError.message}`
        ]);
      }
    }

    // Reduce stock when order is delivered
    if (updates.status === 'delivered' && order.status !== 'delivered') {
      try {
        console.log(`📦 Reducing stock for delivered order ${order.order_number}`);
        
        // Check if order has product information
        if (order.product_details) {
          // For now, assume quantity is 1 per order
          // In the future, you might want to parse product_details to get the actual quantity
          const quantity = 1;
          
          // You would need to determine the product_id from the order
          // For this example, I'll log it but you'll need to implement proper product tracking
          console.log(`📦 Stock would be reduced by ${quantity} for order ${order.order_number}`);
          
          // TODO: Implement proper product tracking in orders
          // await StockService.reduceStock(productId, quantity, orderId, req.user.id);
        }
        
        // Log stock reduction attempt
        await pool.query(`
          INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
          VALUES (?, ?, ?, ?, NOW())
        `, [
          orderId,
          req.user.id,
          'stock_reduction_attempt',
          `Attempted stock reduction for delivered order`
        ]);
        
      } catch (stockError) {
        console.error('Stock reduction error:', stockError.message);
        // Log the error but don't fail the order update
        await pool.query(`
          INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
          VALUES (?, ?, ?, ?, NOW())
        `, [
          orderId,
          req.user.id,
          'stock_reduction_error',
          `Failed to reduce stock: ${stockError.message}`
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
      
      // First try to read with headers
      let rawData = XLSX.utils.sheet_to_json(worksheet);
      
      // If we get __EMPTY columns, try reading without headers and use position-based mapping
      if (rawData.length > 0 && Object.keys(rawData[0]).some(key => key.includes('__EMPTY'))) {
        console.log('Detected empty headers, using position-based parsing');
        
        // Read raw data without headers
        const rawArrayData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Convert array data to objects with proper column names
        data = rawArrayData.slice(1).map(row => { // Skip first row (headers)
          // The data appears to be shifted one column to the right
          // So we need to adjust the column positions
          const trackingId = row[1] || row[0] || ''; // Réf column (position 1) or ID column (position 0)
          return {
            'ID': trackingId, // Use the tracking ID from Réf column
            'Réf': trackingId, // Same as ID
            'Client': row[3] || '', // Client is in position 3 (Tel 1 position)
            'Tel 1': row[4] || '', // Tel 1 is in position 4 (Tel 2 position)
            'Tel 2': row[5] || '', // Tel 2 is in position 5 (Adresse position)
            'Adresse': row[6] || '', // Adresse is in position 6 (Commune position)
            'Commune': row[7] || '', // Commune is in position 7 (Wilaya position)
            'Wilaya': row[8] || '', // Wilaya is in position 8 (Total position)
            'Total': row[9] || '', // Total is in position 9 (Remarque position)
            'Remarque': row[10] || '', // Remarque is in position 10 (Produits position)
            'Produits': row[11] || '' // Produits is in position 11 (if exists)
          };
        });
      } else {
        // Check if data seems to have shifted columns (common Excel parsing issue)
        const needsColumnShift = rawData.length > 0 && 
          (typeof rawData[0]['Remarque'] === 'number' && 
          rawData[0]['Total'] && 
          isNaN(parseFloat(rawData[0]['Total']))) ||
          // Also check if ID is empty but Réf has tracking ID pattern
          ((!rawData[0]['ID'] || rawData[0]['ID'] === '') && 
          rawData[0]['Réf'] && 
          rawData[0]['Réf'].match(/^[A-Z0-9\-]+$/));
        
        if (needsColumnShift) {
          console.log('Detected shifted columns, correcting...');
          data = rawData.map(row => {
            // Use Réf as the tracking ID since ID column is empty
            const trackingId = row['Réf'] || row['ID'] || '';
            return {
              'ID': trackingId, // Use Réf as tracking ID
              'Réf': trackingId, // Same as ID
              'Client': row['Tel 1'], // Shifted
              'Tel 1': row['Tel 2'], // Shifted
              'Tel 2': row['Adresse'], // Shifted
              'Adresse': row['Commune'], // Shifted
              'Commune': row['Wilaya'], // Shifted
              'Wilaya': row['Total'], // Shifted
              'Total': row['Remarque'], // Shifted
              'Remarque': row['Produits'], // Shifted
              'Produits': '' // Missing due to shift
            };
          });
        } else {
          data = rawData;
        }
      }
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

    // Detect Excel format
    const excelFormat = detectExcelFormat(data);
    
    console.log('Detected Excel format:', excelFormat);
    console.log('First row keys:', Object.keys(data[0]));

    let imported = 0;
    let errors = [];
    let warnings = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        
        // Debug: Log the first few rows
        if (i < 3) {
          console.log(`Row ${i + 1} data:`, row);
        }
        
        // Use appropriate mapping function based on format
        const mappedOrder = excelFormat === 'noest' 
          ? mapNoestExcelRowToOrder(row) 
          : mapExcelRowToOrder(row);

        // Debug: Log the mapped order for first few rows
        if (i < 3) {
          console.log(`Row ${i + 1} mapped:`, mappedOrder);
        }

        // Skip empty rows
        if (!mappedOrder.customer_name && !mappedOrder.customer_phone) {
          console.log(`Skipping empty row ${i + 1}`);
          continue;
        }

        // Check for missing required fields and add warnings
        const missingFields = [];
        if (!mappedOrder.customer_name) {
          missingFields.push('name');
          mappedOrder.customer_name = 'Unknown Customer'; // Use placeholder
        }
        if (!mappedOrder.customer_phone) {
          missingFields.push('phone');
          warnings.push(`Row ${i + 2}: Missing phone number`);
        }
        if (!mappedOrder.customer_city) {
          missingFields.push('city');
          mappedOrder.customer_city = mappedOrder.customer_state || 'Unknown'; // Use state as fallback
        }

        // Add warning if any required fields are missing
        if (missingFields.length > 0) {
          warnings.push(`Row ${i + 2}: Missing required fields (${missingFields.join(', ')})`);
        }

        // Generate order number - use tracking ID (ID column) as order number
        const orderNumber = mappedOrder.ecotrack_tracking_id || `ECO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Check if order with this tracking ID already exists
        let finalOrderNumber = orderNumber;
        if (mappedOrder.ecotrack_tracking_id) {
          const [existingOrder] = await pool.query(
            'SELECT id FROM orders WHERE order_number = ? OR ecotrack_tracking_id = ?',
            [mappedOrder.ecotrack_tracking_id, mappedOrder.ecotrack_tracking_id]
          );
          
          if (existingOrder.length > 0) {
            // Order already exists, skip
            console.log(`Order with tracking ID ${mappedOrder.ecotrack_tracking_id} already exists, skipping...`);
            warnings.push(`Row ${i + 2}: Order with tracking ID ${mappedOrder.ecotrack_tracking_id} already exists in database`);
            continue;
          }
        }

        // Create product details object
        const productDetails = {
          name: mappedOrder.product_name || 'Product',
          price: mappedOrder.product_price || 0,
          delivery_price: mappedOrder.delivery_price || 0,
          delivery_type: 'home_delivery' // Default to home delivery
        };

        // Use the total amount from Excel or calculate if not available
        let totalAmount = mappedOrder.total_amount || 0;
        
        // Ensure totalAmount is a valid number
        if (isNaN(totalAmount) || totalAmount === null || totalAmount === undefined) {
          totalAmount = (mappedOrder.product_price || 0) + (mappedOrder.delivery_price || 0);
        }
        
        // If still NaN, default to 0
        if (isNaN(totalAmount)) {
          totalAmount = 0;
        }
        
        console.log(`Row ${i + 1}: totalAmount = ${totalAmount}, mappedOrder.total_amount = ${mappedOrder.total_amount}`);

        // Build customer address
        const customerAddress = excelFormat === 'noest' 
          ? `${mappedOrder.customer_address}, ${mappedOrder.customer_city}, ${mappedOrder.customer_state}`.trim()
          : mappedOrder.customer_address;

        // Insert order into database with ecotrack ID and proper status
        const [result] = await pool.query(`
          INSERT INTO orders (
            order_number, customer_name, customer_phone, customer_address,
            customer_city, product_details, total_amount, status, 
            ecotrack_tracking_id, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          finalOrderNumber,
          mappedOrder.customer_name,
          mappedOrder.customer_phone,
          customerAddress,
          mappedOrder.customer_city,
          JSON.stringify(productDetails),
          totalAmount,
          mappedOrder.status,
          mappedOrder.ecotrack_tracking_id || null,
          mappedOrder.notes,
          mappedOrder.order_date
        ]);

        // If there's an ecotrack ID, try to sync with ecotrack service
        if (mappedOrder.ecotrack_tracking_id) {
          try {
            // Optional: Sync with ecotrack service to get latest status
            const trackingInfo = await ecotrackService.getTrackingInfo(mappedOrder.ecotrack_tracking_id);
            if (trackingInfo && trackingInfo.status) {
              // Update order status based on ecotrack info
              await pool.query(
                'UPDATE orders SET status = ? WHERE id = ?',
                [trackingInfo.status, result.insertId]
              );
            }
          } catch (ecotrackError) {
            console.log(`Could not sync ecotrack for ID ${mappedOrder.ecotrack_tracking_id}:`, ecotrackError.message);
            warnings.push(`Row ${i + 2}: Could not sync with ecotrack ID ${mappedOrder.ecotrack_tracking_id}`);
          }
        }

        // Log the creation
        await pool.query(`
          INSERT INTO tracking_logs (order_id, user_id, action, new_status, details, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())
        `, [result.insertId, req.user.id, 'created', mappedOrder.status, `Order imported from Excel file${mappedOrder.ecotrack_tracking_id ? ` with tracking ID: ${mappedOrder.ecotrack_tracking_id}` : ''}`]);

        imported++;

      } catch (rowError) {
        console.error(`Error processing row ${i + 2}:`, rowError);
        errors.push(`Row ${i + 2}: ${rowError.message}`);
      }
    }

    res.json({
      message: `Import completed: ${imported} orders imported successfully using ${excelFormat} format`,
      imported,
      total_rows: data.length,
      format_detected: excelFormat,
      debug_info: {
        first_row_keys: Object.keys(data[0] || {}),
        processed_rows: data.length,
        empty_rows_skipped: data.length - imported - errors.length
      },
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

// Recalculate delivery pricing for order
router.post('/:id/recalculate-delivery', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { wilaya_id, delivery_type, product_weight } = req.body;

    if (!wilaya_id) {
      return res.status(400).json({
        success: false,
        message: 'Wilaya ID is required'
      });
    }

    // Calculate new delivery price
    const pricingResult = await DeliveryPricingService.calculateDeliveryPrice(
      wilaya_id,
      delivery_type || 'home',
      parseFloat(product_weight) || 1.0
    );

    // Update order with new pricing
    await pool.query(`
      UPDATE orders 
      SET wilaya_id = ?, delivery_type = ?, delivery_price = ?, product_weight = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [wilaya_id, delivery_type || 'home', pricingResult.price, product_weight || 1.0, orderId]);

    // Log the pricing update
    await pool.query(`
      INSERT INTO tracking_logs (order_id, user_id, action, details)
      VALUES (?, ?, ?, ?)
    `, [
      orderId, 
      req.user.id, 
      'pricing_updated', 
      `Delivery pricing recalculated: ${pricingResult.price} DA`
    ]);

    res.json({
      success: true,
      message: 'Delivery pricing updated successfully',
      data: {
        delivery_price: pricingResult.price,
        pricing_breakdown: pricingResult.breakdown,
        delivery_time: {
          min: pricingResult.delivery_time_min,
          max: pricingResult.delivery_time_max
        }
      }
    });
  } catch (error) {
    console.error('Error recalculating delivery price:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Test Ecotrack integration
router.post('/test-ecotrack', authenticateToken, requirePermission('canEditOrders'), async (req, res) => {
  try {
    const testOrderData = {
      order_number: `TEST-${Date.now()}`,
      customer_name: 'Test Customer',
      customer_phone: '0555123456',
      customer_address: 'Test Address',
      customer_city: 'Algiers',
      product_details: {
        name: 'Test Product',
        sku: 'TEST-SKU-001',
        quantity: 1,
        is_fragile: 0
      },
      total_amount: 2500,
      notes: 'Test order for Ecotrack integration',
      delivery_type: 'home'
    };

    console.log('🧪 Testing Ecotrack integration...');
    const result = await ecotrackService.createShipment(testOrderData);

    res.json({
      success: true,
      message: 'Ecotrack test successful',
      data: result
    });
  } catch (error) {
    console.error('Ecotrack test error:', error);
    res.status(500).json({
      success: false,
      message: 'Ecotrack test failed',
      error: error.message
    });
  }
});

// Batch send confirmed orders to Ecotrack delivery company
router.post('/batch-ecotrack', authenticateToken, requirePermission('canEditOrders'), async (req, res) => {
  try {
    const { orderIds } = req.body;

    // Validation
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order IDs array is required and must not be empty'
      });
    }

    console.log(`📦 Starting batch Ecotrack processing for ${orderIds.length} orders`);

    // Get confirmed orders that haven't been sent to Ecotrack yet
    const placeholders = orderIds.map(() => '?').join(',');
    const [orders] = await pool.query(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_phone_2,
        o.customer_address, o.customer_city, o.product_details, o.weight,
        o.total_amount, o.notes, o.delivery_type, o.status,
        o.wilaya_id, o.baladia_id, o.ecotrack_tracking_id,
        w.name_fr as wilaya_name, b.name_fr as baladia_name
      FROM orders o
      LEFT JOIN wilayas w ON o.wilaya_id = w.id
      LEFT JOIN baladias b ON o.baladia_id = b.id
      WHERE o.id IN (${placeholders}) 
      AND o.status = 'confirmed'
      AND (o.ecotrack_tracking_id IS NULL OR o.ecotrack_tracking_id = '')`,
      orderIds
    );

    if (orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible confirmed orders found. Orders must be confirmed and not already sent to delivery company.'
      });
    }

    const results = [];
    const successfulOrders = [];
    const failedOrders = [];

    // Process each order - change status to import_to_delivery_company AND integrate with Ecotrack
    for (const order of orders) {
      try {
        console.log(`📦 Processing order ${order.order_number} for batch import to delivery company...`);

        // Update order status to import_to_delivery_company
        await pool.query(
          `UPDATE orders SET 
            status = 'import_to_delivery_company',
            updated_at = NOW()
          WHERE id = ?`,
          [order.id]
        );

        // ECOTRACK INTEGRATION - Add the same logic as individual order update
        console.log(`🚚 ✅ BATCH ECOTRACK: Creating shipment for order ${order.order_number}`);
        
        try {
          // Parse product details
          let productInfo = {};
          if (order.product_details) {
            try {
              productInfo = typeof order.product_details === 'string' 
                ? JSON.parse(order.product_details) 
                : order.product_details;
            } catch (e) {
              productInfo = { name: order.product_details };
            }
          }

          const shipmentData = {
            order_number: order.order_number,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            customer_phone_2: order.customer_phone_2,
            customer_address: order.customer_address,
            customer_city: order.customer_city,
            product_details: productInfo,
            total_amount: order.total_amount,
            notes: order.notes || '',
            delivery_type: order.delivery_type || 'home',
            wilaya_id: order.wilaya_id,
            baladia_name: order.baladia_name,
            weight: order.weight || 1
          };

          console.log(`📦 BATCH: Calling Ecotrack API for order ${order.order_number}`);
          const trackingResult = await ecotrackService.createShipment(shipmentData);
          
          if (trackingResult.success) {
            // Save tracking information to database
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
                order.id
              ]
            );

            console.log(`✅ BATCH: Ecotrack shipment created: ${trackingResult.tracking_id}`);
            
            // Log Ecotrack integration
            await pool.query(`
              INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
              VALUES (?, ?, ?, ?, NOW())
            `, [
              order.id,
              req.user.id,
              'ecotrack_created',
              `Ecotrack shipment created with tracking ID: ${trackingResult.tracking_id}`
            ]);
          } else {
            console.error(`❌ BATCH: Failed to create Ecotrack shipment for ${order.order_number}`);
            
            // Log Ecotrack failure
            await pool.query(`
              INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
              VALUES (?, ?, ?, ?, NOW())
            `, [
              order.id,
              req.user.id,
              'ecotrack_error',
              `Failed to create Ecotrack shipment: ${trackingResult.error || 'Unknown error'}`
            ]);
          }
        } catch (ecotrackError) {
          console.error(`🚨 BATCH: Ecotrack integration error for ${order.order_number}:`, ecotrackError.message);
          
          // Log Ecotrack error
          await pool.query(`
            INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
            VALUES (?, ?, ?, ?, NOW())
          `, [
            order.id,
            req.user.id,
            'ecotrack_error',
            `Ecotrack integration failed: ${ecotrackError.message}`
          ]);
        }

        // Log batch status change
        await pool.query(`
          INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
          VALUES (?, ?, ?, ?, NOW())
        `, [
          order.id,
          req.user.id,
          'batch_import_to_delivery',
          `Order status changed to 'import_to_delivery_company' via batch processing`
        ]);

        successfulOrders.push({
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'import_to_delivery_company'
        });

        console.log(`✅ Success: ${order.order_number} -> import_to_delivery_company`);

      } catch (error) {
        console.error(`❌ Failed to process order ${order.order_number}:`, error);
        failedOrders.push({
          orderId: order.id,
          orderNumber: order.order_number,
          error: error.message
        });
      }
    }

    // Don't log batch operation with NULL order_id since tracking_logs requires a valid order_id
    // Individual order status changes are already logged above

    res.json({
      success: true,
      message: `Batch processing completed: ${successfulOrders.length}/${orders.length} orders successfully imported to delivery company`,
      data: {
        totalProcessed: orders.length,
        successful: successfulOrders.length,
        failed: failedOrders.length,
        successfulOrders,
        failedOrders
      }
    });

  } catch (error) {
    console.error('Batch Ecotrack error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during batch processing',
      error: error.message
    });
  }
});

module.exports = router;
