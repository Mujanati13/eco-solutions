const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const DeliveryPricingService = require('../services/deliveryPricingService');
const { logActivity } = require('../middleware/activityLogger');

const router = express.Router();

// Get all wilayas with their delivery pricing
router.get('/wilayas', authenticateToken, async (req, res) => {
  try {
    const wilayas = await DeliveryPricingService.getAllWilayasWithPricing();
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

// Get active wilayas for dropdown
router.get('/wilayas/active', authenticateToken, async (req, res) => {
  try {
    const wilayas = await DeliveryPricingService.getActiveWilayas();
    res.json({
      success: true,
      data: wilayas
    });
  } catch (error) {
    console.error('Error fetching active wilayas:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Calculate delivery price
router.post('/calculate-price', authenticateToken, async (req, res) => {
  try {
    const { 
      wilaya_id, 
      baladia_id, 
      delivery_type = 'home', 
      weight = 1.0, 
      volume = 0, 
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

// Get delivery pricing for specific wilaya
router.get('/pricing/:wilayaId', authenticateToken, async (req, res) => {
  try {
    const { wilayaId } = req.params;
    const pricing = await DeliveryPricingService.getWilayaPricing(wilayaId);
    
    res.json({
      success: true,
      data: pricing
    });
  } catch (error) {
    console.error('Error fetching wilaya pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update delivery pricing (Admin only)
router.put('/pricing/:wilayaId/:deliveryType', 
  authenticateToken, 
  requirePermission('canManageDelivery'),
  logActivity('update', 'delivery_pricing'),
  async (req, res) => {
    try {
      const { wilayaId, deliveryType } = req.params;
      const pricingData = req.body;

      // Validate required fields
      if (!pricingData.base_price || pricingData.base_price < 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid base price is required'
        });
      }

      const result = await DeliveryPricingService.updateDeliveryPricing(
        wilayaId,
        deliveryType,
        pricingData
      );

      res.json({
        success: true,
        message: 'Delivery pricing updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error updating delivery pricing:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Create new delivery pricing (Admin only)
router.post('/pricing', 
  authenticateToken, 
  requirePermission('canManageDelivery'),
  logActivity('create', 'delivery_pricing'),
  async (req, res) => {
    try {
      const pricingData = req.body;

      // Validate required fields
      if (!pricingData.wilaya_id || !pricingData.base_price) {
        return res.status(400).json({
          success: false,
          message: 'Wilaya ID and base price are required'
        });
      }

      const result = await DeliveryPricingService.createDeliveryPricing(pricingData);

      res.status(201).json({
        success: true,
        message: 'Delivery pricing created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error creating delivery pricing:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Delete delivery pricing (Admin only)
router.delete('/pricing/:wilayaId/:deliveryType', 
  authenticateToken, 
  requirePermission('canManageDelivery'),
  logActivity('delete', 'delivery_pricing'),
  async (req, res) => {
    try {
      const { wilayaId, deliveryType } = req.params;

      const result = await DeliveryPricingService.deleteDeliveryPricing(wilayaId, deliveryType);

      if (result.success) {
        res.json({
          success: true,
          message: 'Delivery pricing deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Delivery pricing not found'
        });
      }
    } catch (error) {
      console.error('Error deleting delivery pricing:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Toggle wilaya status (Admin only)
router.patch('/wilayas/:wilayaId/toggle-status', 
  authenticateToken, 
  requirePermission('canManageDelivery'),
  logActivity('update', 'wilaya'),
  async (req, res) => {
    try {
      const { wilayaId } = req.params;
      const { is_active } = req.body;

      const result = await DeliveryPricingService.toggleWilayaStatus(wilayaId, is_active);

      if (result.success) {
        res.json({
          success: true,
          message: `Wilaya ${is_active ? 'activated' : 'deactivated'} successfully`
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Wilaya not found'
        });
      }
    } catch (error) {
      console.error('Error toggling wilaya status:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Get delivery pricing statistics (Admin only)
router.get('/stats', 
  authenticateToken, 
  requirePermission('canViewDeliveryPricing'),
  async (req, res) => {
    try {
      const stats = await DeliveryPricingService.getDeliveryPricingStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching delivery pricing stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Bulk update delivery pricing (Admin only)
router.post('/pricing/bulk-update', 
  authenticateToken, 
  requirePermission('canBulkUpdatePricing'),
  logActivity('bulk_update', 'delivery_pricing'),
  async (req, res) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Updates array is required'
        });
      }

      // Validate each update
      for (const update of updates) {
        if (!update.wilaya_id || !update.delivery_type || !update.base_price) {
          return res.status(400).json({
            success: false,
            message: 'Each update must have wilaya_id, delivery_type, and base_price'
          });
        }
      }

      const result = await DeliveryPricingService.bulkUpdatePricing(updates);

      res.json({
        success: true,
        message: `Successfully updated ${result.updated} pricing rules`,
        data: result
      });
    } catch (error) {
      console.error('Error in bulk update delivery pricing:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

module.exports = router;
