const express = require('express');
const router = express.Router();
const ecotrackService = require('../services/ecotrackService');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/permissions');

// Get current Ecotrack configuration
router.get('/config', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      // Return the current configuration including full credentials for frontend use
      const config = {
        apiToken: ecotrackService.apiToken ? '***' + ecotrackService.apiToken.slice(-4) : '',
        userGuid: ecotrackService.userGuid || '',
        isEnabled: ecotrackService.validateCredentials(),
        fullApiToken: ecotrackService.apiToken, // Include full token for frontend API calls
        fullUserGuid: ecotrackService.userGuid   // Include full guid for frontend API calls
      };
      
      res.json(config);
    } catch (error) {
      console.error('Error getting Ecotrack config:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get configuration',
        error: error.message 
      });
    }
  }
);

// Get current Ecotrack credentials for API usage
router.get('/credentials', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      // Get configuration from database via service
      const dbConfig = await ecotrackService.getConfig();
      
      if (dbConfig) {
        // Return the database configuration
        const credentials = {
          apiToken: dbConfig.apiToken || '',
          userGuid: dbConfig.userGuid || '',
          isEnabled: dbConfig.isEnabled || false,
          isConfigured: dbConfig.apiToken && dbConfig.userGuid,
          lastUpdated: dbConfig.updatedAt,
          updatedBy: dbConfig.updatedBy,
          source: 'database'
        };
        
        res.json(credentials);
      } else {
        // Fallback to in-memory values if no database config
        const credentials = {
          apiToken: ecotrackService.apiToken || '',
          userGuid: ecotrackService.userGuid || '',
          isConfigured: ecotrackService.validateCredentials(),
          isEnabled: true,
          source: 'fallback'
        };
        
        res.json(credentials);
      }
    } catch (error) {
      console.error('Error getting Ecotrack credentials:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get credentials',
        error: error.message 
      });
    }
  }
);

// Update Ecotrack configuration
router.post('/config', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const { apiToken, userGuid, isEnabled } = req.body;
      
      // Validate input
      if (!apiToken || !userGuid) {
        return res.status(400).json({
          success: false,
          message: 'API Token and User GUID are required'
        });
      }
      
      if (apiToken.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'API Token must be at least 10 characters long'
        });
      }
      
      // Update the service configuration and save to database
      await ecotrackService.updateConfig(apiToken, userGuid, isEnabled, req.user.id);
      
      // Get the updated configuration from database to confirm
      const updatedConfig = await ecotrackService.getConfig();
      
      res.json({
        success: true,
        message: 'Configuration updated and saved to database successfully',
        config: {
          apiToken: '***' + apiToken.slice(-4),
          userGuid: userGuid,
          isEnabled: isEnabled,
          isConfigured: ecotrackService.validateCredentials(),
          lastUpdated: updatedConfig?.updatedAt,
          updatedBy: updatedConfig?.updatedBy
        }
      });
    } catch (error) {
      console.error('Error updating Ecotrack config:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update configuration',
        error: error.message 
      });
    }
  }
);

// Test Ecotrack connection
router.post('/test-connection', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const { apiToken, userGuid } = req.body;
      
      if (!apiToken || !userGuid) {
        return res.status(400).json({
          success: false,
          message: 'API Token and User GUID are required for testing'
        });
      }
      
      // Temporarily create a test service instance
      const testService = Object.create(ecotrackService);
      testService.apiToken = apiToken;
      testService.userGuid = userGuid;
      
      // Test connection with health check
      const isHealthy = await testService.healthCheck();
      
      if (isHealthy) {
        res.json({
          success: true,
          message: 'Connection to Ecotrack API successful!'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to connect to Ecotrack API. Please check your credentials.'
        });
      }
    } catch (error) {
      console.error('Error testing Ecotrack connection:', error);
      res.status(400).json({ 
        success: false, 
        message: 'Connection test failed: ' + error.message
      });
    }
  }
);

// Delete/Cancel order in EcoTrack
router.post('/delete-order',
  authenticateToken,
  requirePermission('canEditOrders'),
  async (req, res) => {
    try {
      const { trackingId, orderId, reason } = req.body;
      
      if (!trackingId) {
        return res.status(400).json({
          success: false,
          message: 'Tracking ID is required'
        });
      }

      console.log(`🗑️ EcoTrack delete request for tracking ID: ${trackingId}`);
      
      // Step 1: Delete from EcoTrack first
      const result = await ecotrackService.cancelShipment(trackingId, reason || 'Order cancelled');
      
      // Step 2: If EcoTrack deletion successful and we have order ID, update local order status
      if (result.success && orderId) {
        try {
          const { pool } = require('../../config/database');
          
          // Update order status to cancelled and clear tracking ID
          await pool.query(
            'UPDATE orders SET status = ?, ecotrack_tracking_id = NULL WHERE id = ?',
            ['cancelled', orderId]
          );
          
          console.log(`✅ Order ${orderId} status updated to "cancelled" after EcoTrack deletion`);
          
          // Log the status change
          await pool.query(`
            INSERT INTO tracking_logs (order_id, user_id, action, new_status, details, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
          `, [orderId, req.user.id, 'ecotrack_deleted', 'cancelled', `Order cancelled in EcoTrack (tracking ID: ${trackingId})`]);
          
        } catch (statusUpdateError) {
          console.error('❌ Failed to update order status after EcoTrack deletion:', statusUpdateError);
          // Don't fail the entire request if status update fails
          result.warning = 'Order deleted from EcoTrack but failed to update local status';
        }
      }
      
      res.json({
        success: true,
        message: 'Order deleted successfully from EcoTrack and status updated',
        data: result
      });
      
    } catch (error) {
      console.error('EcoTrack delete error:', error);
      
      // Handle specific EcoTrack API errors
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        let userFriendlyMessage = 'EcoTrack validation error';
        
        if (errorData && errorData.errors && errorData.errors.tracking) {
          const trackingErrors = errorData.errors.tracking;
          if (trackingErrors.some(err => err.includes('invalide'))) {
            userFriendlyMessage = `The tracking ID "${trackingId}" is not valid or cannot be cancelled. This could mean:
            • The order doesn't exist in EcoTrack
            • The order is already delivered or completed
            • The order was created with different credentials
            • The tracking ID format is incorrect`;
          }
        }
        
        return res.status(422).json({
          success: false,
          message: userFriendlyMessage,
          error: errorData?.message || error.message,
          code: 'ECOTRACK_VALIDATION_ERROR',
          details: errorData?.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete order from EcoTrack',
        error: error.message
      });
    }
  }
);

// Create order in EcoTrack
router.post('/create-order',
  authenticateToken,
  requirePermission('canEditOrders'),
  async (req, res) => {
    try {
      const { orderData, orderId } = req.body;
      
      if (!orderData) {
        return res.status(400).json({
          success: false,
          message: 'Order data is required'
        });
      }

      console.log(`🚚 EcoTrack create request for order:`, orderData);
      
      // Use the service to create the order
      const result = await ecotrackService.createShipment(orderData);
      
      // If order creation was successful and we have an order ID, update the order status
      if (result.success && orderId) {
        try {
          const { pool } = require('../../config/database');
          
          // Update order status to "out_for_delivery" (en cours de livraison)
          await pool.query(
            'UPDATE orders SET status = ?, ecotrack_tracking_id = ? WHERE id = ?',
            ['out_for_delivery', result.tracking_id, orderId]
          );
          
          console.log(`✅ Order ${orderId} status updated to "out_for_delivery" with tracking ID: ${result.tracking_id}`);
          
          // Log the status change
          await pool.query(`
            INSERT INTO tracking_logs (order_id, user_id, action, new_status, details, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
          `, [orderId, req.user.id, 'ecotrack_created', 'out_for_delivery', `Order sent to EcoTrack with tracking ID: ${result.tracking_id}`]);
          
        } catch (statusUpdateError) {
          console.error('❌ Failed to update order status:', statusUpdateError);
          // Don't fail the entire request if status update fails
          result.warning = 'Order created in EcoTrack but failed to update local status';
        }
      }
      
      res.json({
        success: true,
        message: 'Order created successfully in EcoTrack and status updated to "en cours de livraison"',
        data: result
      });
      
    } catch (error) {
      console.error('EcoTrack create error:', error);
      
      // Handle specific EcoTrack API errors
      if (error.response?.status === 422) {
        return res.status(422).json({
          success: false,
          message: 'EcoTrack API validation error',
          error: error.response.data?.message || error.message,
          code: 'ECOTRACK_VALIDATION_ERROR'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to create order in EcoTrack',
        error: error.message
      });
    }
  }
);

// Get tracking information for orders
router.post('/tracking-info',
  authenticateToken,
  requireAnyPermission(['canViewOrders', 'canViewIntegrations']),
  async (req, res) => {
    try {
      const { trackingIds } = req.body;
      
      if (!trackingIds || !Array.isArray(trackingIds) || trackingIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Tracking IDs array is required'
        });
      }

      console.log(`🔍 EcoTrack tracking info request for IDs:`, trackingIds);
      
      // Use the service to get tracking information
      const result = await ecotrackService.getTrackingInfo(trackingIds);
      
      res.json({
        success: true,
        message: 'Tracking information retrieved successfully',
        data: result
      });
      
    } catch (error) {
      console.error('EcoTrack tracking info error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get tracking information',
        error: error.message
      });
    }
  }
);

// Add remark to EcoTrack tracking
router.post('/add-remark',
  authenticateToken,
  requirePermission('canEditOrders'),
  async (req, res) => {
    try {
      const { trackingId, content } = req.body;
      
      if (!trackingId) {
        return res.status(400).json({
          success: false,
          message: 'Tracking ID is required'
        });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Remark content is required'
        });
      }

      console.log(`💬 EcoTrack add remark request for tracking ID: ${trackingId}`);
      
      // Use the service to add remark
      const result = await ecotrackService.addRemark(trackingId, content.trim());
      
      res.json({
        success: true,
        message: 'Remark added successfully to EcoTrack',
        data: result
      });
      
    } catch (error) {
      console.error('EcoTrack add remark error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to add remark to EcoTrack',
        error: error.message
      });
    }
  }
);

// Get Ecotrack integration status
router.get('/status', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const isConfigured = ecotrackService.validateCredentials();
      const isHealthy = isConfigured ? await ecotrackService.healthCheck() : false;
      
      res.json({
        success: true,
        status: {
          configured: isConfigured,
          healthy: isHealthy,
          apiTokenSet: !!ecotrackService.apiToken,
          userGuidSet: !!ecotrackService.userGuid,
          lastChecked: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting Ecotrack status:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get status',
        error: error.message 
      });
    }
  }
);

module.exports = router;
