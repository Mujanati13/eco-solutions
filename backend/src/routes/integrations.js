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
    const userId = req.user.id;
    
    // Import orders from Google Sheets
    const result = await googleSheetsService.importOrdersFromSheet(googleSheetsService.spreadsheetId, sheetRange, userId);
    
    if (!result.success || result.imported === 0) {
      return res.json({
        message: result.message || 'No orders found in the specified range',
        count: result.total || 0,
        imported: result.imported || 0,
        errors: result.errors || []
      });
    }

    // Return the import result directly
    res.json({
      message: result.message,
      count: result.total,
      imported: result.imported,
      errors: result.errors,
      importedOrders: result.importedOrders
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
    const result = await googleSheetsService.importOrdersFromSheet(googleSheetsService.spreadsheetId, sheetRange, userId);
    
    if (!result.success || result.imported === 0) {
      return res.json({
        message: result.message || 'No orders found in the specified range',
        count: result.total || 0,
        imported: 0,
        ecotrackDeliveries: 0
      });
    }

    // Get the actual orders array from the result
    const orders = result.importedOrders || [];

    // If validation only, return the orders without importing
    if (validateOnly) {
      return res.json({
        message: `Found ${orders.length} orders in Google Sheets`,
        count: orders.length,
        orders: orders.slice(0, 10), // Return first 10 for preview
        validationOnly: true
      });
    }

    // Since orders are already imported to database by importOrdersFromSheet,
    // we just need to return the results without additional processing
    const errors = result.errors || [];
    const warnings = [];

    // Return comprehensive results
    res.json({
      message: `Successfully imported ${result.imported} orders from Google Sheets to database`,
      count: result.total,
      imported: result.imported,
      ecotrackDeliveries: 0, // No Ecotrack deliveries created
      databaseSaved: result.imported,
      databaseFailed: 0,
      errors: errors.length > 0 ? errors.slice(0, 10) : [],
      warnings: warnings.length > 0 ? warnings.slice(0, 10) : [],
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      success: result.imported > 0
    });
  } catch (error) {
    console.error('Google Sheets import error:', error);
    res.status(500).json({ 
      error: 'Failed to import orders from Google Sheets',
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
