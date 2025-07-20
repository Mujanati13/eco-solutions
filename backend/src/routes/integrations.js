const express = require('express');
const { pool } = require('../../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const googleSheetsService = require('../services/googleSheets');
const ecotrackService = require('../services/ecotrack');

const router = express.Router();

// Sync all orders to Google Sheets
router.post('/google-sheets/sync', authenticateToken, requirePermission('canExportToGoogleSheets'), async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user has Google Sheets access
    const canAccess = await googleSheetsService.canUserAccessSheets(userId);
    if (!canAccess) {
      return res.status(401).json({ 
        error: 'Google Sheets access not authorized',
        authRequired: true
      });
    }
    
    // Get all orders from database
    const [orders] = await pool.query(`
      SELECT o.*, u.first_name, u.last_name 
      FROM orders o 
      LEFT JOIN users u ON o.assigned_to = u.id 
      ORDER BY o.created_at DESC
    `);

    // Sync to Google Sheets using user's authentication
    await googleSheetsService.syncAllOrders(orders, userId);

    // Update sync status in database
    await pool.query('UPDATE orders SET google_sheets_synced = true');

    res.json({
      message: 'Orders synced to Google Sheets successfully',
      count: orders.length
    });
  } catch (error) {
    console.error('Google Sheets sync error:', error);
    res.status(500).json({ error: 'Failed to sync orders to Google Sheets' });
  }
});

// Create delivery in Ecotrack for an order
router.post('/ecotrack/create-delivery/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get order details
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    if (order.ecotrack_synced) {
      return res.status(400).json({ error: 'Delivery already created in Ecotrack' });
    }

    // Create delivery in Ecotrack
    const deliveryResult = await ecotrackService.createDelivery(order);

    if (deliveryResult) {
      // Update order with tracking information
      await pool.query(
        'UPDATE orders SET ecotrack_synced = true, tracking_number = ? WHERE id = ?',
        [deliveryResult.tracking_id, orderId]
      );

      // Log the action
      await pool.query(
        'INSERT INTO tracking_logs (order_id, user_id, action, description) VALUES (?, ?, ?, ?)',
        [orderId, req.user.id, 'ecotrack_delivery_created', `Delivery created with tracking ID: ${deliveryResult.tracking_id}`]
      );

      res.json({
        message: 'Delivery created in Ecotrack successfully',
        tracking_id: deliveryResult.tracking_id,
        delivery_data: deliveryResult
      });
    } else {
      res.status(500).json({ error: 'Failed to create delivery in Ecotrack' });
    }
  } catch (error) {
    console.error('Ecotrack delivery creation error:', error);
    res.status(500).json({ error: 'Failed to create delivery in Ecotrack' });
  }
});

// Get delivery status from Ecotrack
router.get('/ecotrack/status/:trackingId', authenticateToken, async (req, res) => {
  try {
    const { trackingId } = req.params;

    const deliveryStatus = await ecotrackService.getDeliveryStatus(trackingId);

    if (deliveryStatus) {
      res.json(deliveryStatus);
    } else {
      res.status(404).json({ error: 'Delivery not found or Ecotrack service unavailable' });
    }
  } catch (error) {
    console.error('Ecotrack status check error:', error);
    res.status(500).json({ error: 'Failed to get delivery status from Ecotrack' });
  }
});

// Update delivery status in Ecotrack
router.patch('/ecotrack/status/:trackingId', authenticateToken, async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const result = await ecotrackService.updateDeliveryStatus(trackingId, status);

    if (result) {
      // Update local order status as well
      await pool.query(
        'UPDATE orders SET status = ? WHERE tracking_number = ?',
        [status, trackingId]
      );

      res.json({
        message: 'Delivery status updated successfully',
        status: status
      });
    } else {
      res.status(500).json({ error: 'Failed to update delivery status in Ecotrack' });
    }
  } catch (error) {
    console.error('Ecotrack status update error:', error);
    res.status(500).json({ error: 'Failed to update delivery status in Ecotrack' });
  }
});

// Get delivery metrics from Ecotrack
router.get('/ecotrack/metrics', authenticateToken, requirePermission('canViewIntegrations'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const metrics = await ecotrackService.getDeliveryMetrics(start_date, end_date);

    if (metrics) {
      res.json(metrics);
    } else {
      res.status(500).json({ error: 'Failed to get delivery metrics from Ecotrack' });
    }
  } catch (error) {
    console.error('Ecotrack metrics error:', error);
    res.status(500).json({ error: 'Failed to get delivery metrics from Ecotrack' });
  }
});

// New Ecotrack Integration Routes

// Create single order in Ecotrack
router.post('/ecotrack/order', authenticateToken, requirePermission('canViewIntegrations'), async (req, res) => {
  try {
    const orderData = req.body;
    
    // Validate required fields
    if (!orderData.customer_name || !orderData.customer_phone || !orderData.customer_address) {
      return res.status(400).json({ error: 'Missing required fields: customer_name, customer_phone, customer_address' });
    }

    // Create order in Ecotrack
    const result = await ecotrackService.createDelivery(orderData);

    if (result && result.tracking_id) {
      // Log the action
      await pool.query(
        'INSERT INTO tracking_logs (user_id, action, description) VALUES (?, ?, ?)',
        [req.user.id, 'ecotrack_order_created', `Order created with tracking ID: ${result.tracking_id}`]
      );

      res.json({
        message: 'Order created successfully in Ecotrack',
        tracking: result.tracking_id,
        success: true,
        result: result
      });
    } else {
      res.status(500).json({ error: 'Failed to create order in Ecotrack' });
    }
  } catch (error) {
    console.error('Ecotrack order creation error:', error);
    res.status(500).json({ error: 'Failed to create order in Ecotrack: ' + error.message });
  }
});

// Create bulk orders in Ecotrack
router.post('/ecotrack/bulk-orders', authenticateToken, requirePermission('canViewIntegrations'), async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'Orders array is required' });
    }

    // Create orders one by one (no bulk method available)
    const results = [];
    const errors = [];

    for (const order of orders) {
      try {
        const result = await ecotrackService.createDelivery(order);
        if (result && result.tracking_id) {
          results.push(result);
        } else {
          errors.push({ order, error: 'Failed to create order' });
        }
      } catch (error) {
        errors.push({ order, error: error.message });
      }
    }

    if (results.length > 0) {
      // Log the action
      await pool.query(
        'INSERT INTO tracking_logs (user_id, action, description) VALUES (?, ?, ?)',
        [req.user.id, 'ecotrack_bulk_orders_created', `${results.length} orders created in Ecotrack`]
      );

      res.json({
        message: `${results.length} orders created successfully in Ecotrack`,
        trackings: results.map(r => r.tracking_id),
        results: results,
        errors: errors
      });
    } else {
      res.status(500).json({ error: 'Failed to create bulk orders in Ecotrack', errors });
    }
  } catch (error) {
    console.error('Ecotrack bulk orders creation error:', error);
    res.status(500).json({ error: 'Failed to create bulk orders in Ecotrack: ' + error.message });
  }
});

// Track parcel in Ecotrack
router.get('/ecotrack/track/:trackingNumber', authenticateToken, requirePermission('canViewIntegrations'), async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    if (!trackingNumber) {
      return res.status(400).json({ error: 'Tracking number is required' });
    }

    const trackingData = await ecotrackService.getDeliveryStatus(trackingNumber);

    if (trackingData) {
      res.json({
        success: true,
        tracking: trackingNumber,
        status: trackingData.status,
        current_location: trackingData.current_location,
        estimated_delivery: trackingData.estimated_delivery,
        delivery_attempts: trackingData.delivery_attempts,
        activity: trackingData.updates
      });
    } else {
      res.status(404).json({ error: 'Tracking data not found' });
    }
  } catch (error) {
    console.error('Ecotrack tracking error:', error);
    res.status(500).json({ error: 'Failed to track parcel in Ecotrack: ' + error.message });
  }
});

// Test Google Sheets connection
router.get('/google-sheets/test', authenticateToken, requirePermission('canManageGoogleSheets'), async (req, res) => {
  try {
    await googleSheetsService.initialize();
    res.json({ message: 'Google Sheets connection successful' });
  } catch (error) {
    console.error('Google Sheets test error:', error);
    res.status(500).json({ error: 'Google Sheets connection failed' });
  }
});

// Test Ecotrack connection
router.get('/ecotrack/test', authenticateToken, requirePermission('canManageGoogleSheets'), async (req, res) => {
  try {
    await ecotrackService.initialize();
    res.json({ 
      message: 'Ecotrack connection successful',
      initialized: ecotrackService.initialized
    });
  } catch (error) {
    console.error('Ecotrack test error:', error);
    res.status(500).json({ error: 'Ecotrack connection failed' });
  }
});

// Import orders from Google Sheets
router.post('/google-sheets/import', authenticateToken, requirePermission('canImportFromGoogleSheets'), async (req, res) => {
  try {
    const { sheetRange } = req.body;
    
    // Import orders from Google Sheets
    const orders = await googleSheetsService.importOrdersFromSheet(sheetRange);
    
    if (orders.length === 0) {
      return res.json({
        message: 'No orders found in the specified range',
        count: 0,
        imported: 0
      });
    }

    let importedCount = 0;
    const errors = [];

    // Insert orders into database
    for (const order of orders) {
      try {
        // Check if order already exists
        const [existing] = await pool.query(
          'SELECT id FROM orders WHERE order_number = ?',
          [order.order_number]
        );

        if (existing.length > 0) {
          errors.push(`Order ${order.order_number} already exists`);
          continue;
        }

        // Insert new order
        await pool.query(`
          INSERT INTO orders (
            order_number, customer_name, customer_phone, customer_address, 
            customer_city, product_details, total_amount, status, 
            payment_status, created_at, delivery_date, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          order.order_number,
          order.customer_name,
          order.customer_phone,
          order.customer_address,
          order.customer_city,
          JSON.stringify(order.product_details),
          order.total_amount,
          order.status,
          order.payment_status,
          order.created_at,
          order.delivery_date,
          order.notes,
          req.user.id
        ]);

        importedCount++;
      } catch (error) {
        console.error(`Error importing order ${order.order_number}:`, error);
        errors.push(`Failed to import order ${order.order_number}: ${error.message}`);
      }
    }

    res.json({
      message: `Imported ${importedCount} orders from Google Sheets`,
      count: orders.length,
      imported: importedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Google Sheets import error:', error);
    res.status(500).json({ error: 'Failed to import orders from Google Sheets' });
  }
});

// Import orders from Google Sheets and create Ecotrack deliveries
router.post('/google-sheets/import-to-ecotrack', authenticateToken, requirePermission('canImportFromGoogleSheets'), async (req, res) => {
  try {
    const { sheetRange, createEcotrackDeliveries = true, validateOnly = false, skipDuplicates = true, saveToDatabase = true } = req.body;
    const userId = req.user.id;
    
    // Check if user has Google Sheets access
    const canAccess = await googleSheetsService.canUserAccessSheets(userId);
    if (!canAccess) {
      return res.status(401).json({ 
        error: 'Google Sheets access not authorized',
        authRequired: true
      });
    }
    
    // Import orders from Google Sheets using user's authentication
    const orders = await googleSheetsService.importOrdersFromSheet(sheetRange, userId);
    
    if (orders.length === 0) {
      return res.json({
        message: 'No orders found in the specified range',
        count: 0,
        imported: 0,
        ecotrackDeliveries: 0
      });
    }

    // If validation only, return the orders without importing
    if (validateOnly) {
      return res.json({
        message: `Found ${orders.length} orders in Google Sheets`,
        count: orders.length,
        orders: orders.slice(0, 10), // Return first 10 for preview
        validationOnly: true
      });
    }

    let importedCount = 0;
    let ecotrackCount = 0;
    let databaseSaved = 0;
    let databaseFailed = 0;
    const errors = [];
    const warnings = [];

    // Process orders one by one
    for (const [index, orderData] of orders.entries()) {
      try {
        // Check if order already exists
        const [existing] = await pool.query(
          'SELECT id, tracking_number FROM orders WHERE order_number = ?',
          [orderData.order_number]
        );

        if (existing.length > 0 && skipDuplicates) {
          warnings.push(`Order ${orderData.order_number} already exists (skipped)`);
          continue;
        }

        let trackingNumber = null;
        let ecotrackResult = null;

        // Create Ecotrack delivery first if requested
        if (createEcotrackDeliveries) {
          try {
            await ecotrackService.initialize();
            ecotrackResult = await ecotrackService.createDelivery(orderData);
            
            if (ecotrackResult && ecotrackResult.tracking_id) {
              trackingNumber = ecotrackResult.tracking_id;
              ecotrackCount++;
            } else {
              warnings.push(`Order ${orderData.order_number}: Failed to create Ecotrack delivery, but order will be imported`);
            }
          } catch (ecotrackError) {
            console.error(`Ecotrack error for order ${orderData.order_number}:`, ecotrackError);
            warnings.push(`Order ${orderData.order_number}: Ecotrack delivery creation failed - ${ecotrackError.message}`);
          }
        }

        // Insert or update order in database if requested
        if (saveToDatabase) {
          try {
            if (existing.length > 0) {
              // Update existing order
              await pool.query(`
                UPDATE orders SET 
                  customer_name = ?, customer_phone = ?, customer_address = ?, 
                  customer_city = ?, product_details = ?, total_amount = ?, 
                  status = ?, payment_status = ?, delivery_date = ?, notes = ?,
                  tracking_number = COALESCE(?, tracking_number),
                  ecotrack_synced = ?,
                  updated_at = NOW(),
                  updated_by = ?
                WHERE order_number = ?
              `, [
                orderData.customer_name,
                orderData.customer_phone,
                orderData.customer_address,
                orderData.customer_city,
                JSON.stringify(orderData.product_details),
                orderData.total_amount,
                orderData.status,
                orderData.payment_status,
                orderData.delivery_date,
                orderData.notes,
                trackingNumber,
                ecotrackResult ? true : false,
                userId,
                orderData.order_number
              ]);
            } else {
              // Insert new order
              await pool.query(`
                INSERT INTO orders (
                  order_number, customer_name, customer_phone, customer_address, 
                  customer_city, product_details, total_amount, status, 
                  payment_status, created_at, delivery_date, notes, 
                  tracking_number, ecotrack_synced, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                orderData.order_number,
                orderData.customer_name,
                orderData.customer_phone,
                orderData.customer_address,
                orderData.customer_city,
                JSON.stringify(orderData.product_details),
                orderData.total_amount,
                orderData.status || 'pending',
                orderData.payment_status || 'pending',
                orderData.created_at || new Date(),
                orderData.delivery_date,
                orderData.notes,
                trackingNumber,
                ecotrackResult ? true : false,
                userId
              ]);
            }
            databaseSaved++;
          } catch (dbError) {
            console.error(`Database save error for order ${orderData.order_number}:`, dbError);
            databaseFailed++;
            warnings.push(`Order ${orderData.order_number}: Saved to Ecotrack but failed to save to local database - ${dbError.message}`);
          }
        }

        importedCount++;
      } catch (error) {
        console.error(`Error processing order ${orderData.order_number}:`, error);
        errors.push(`Failed to process order ${orderData.order_number}: ${error.message}`);
      }
    }

    // Return comprehensive results
    res.json({
      message: `Processed ${importedCount} orders from Google Sheets${createEcotrackDeliveries ? ` with ${ecotrackCount} Ecotrack deliveries created` : ''}`,
      count: orders.length,
      imported: importedCount,
      ecotrackDeliveries: ecotrackCount,
      databaseSaved,
      databaseFailed,
      errors: errors.length > 0 ? errors.slice(0, 10) : [], // Limit errors shown
      warnings: warnings.length > 0 ? warnings.slice(0, 10) : [], // Limit warnings shown
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      success: importedCount > 0
    });
  } catch (error) {
    console.error('Google Sheets to Ecotrack import error:', error);
    res.status(500).json({ 
      error: 'Failed to import orders from Google Sheets to Ecotrack',
      details: error.message 
    });
  }
});

// Get Google Sheets information
router.get('/google-sheets/info', authenticateToken, requirePermission('canViewIntegrations'), async (req, res) => {
  try {
    const sheetInfo = await googleSheetsService.getSheetInfo();
    res.json(sheetInfo);
  } catch (error) {
    console.error('Google Sheets info error:', error);
    res.status(500).json({ error: 'Failed to get Google Sheets information' });
  }
});

module.exports = router;
