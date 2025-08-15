const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Get all active locations (boutiques)
router.get('/locations', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const [locations] = await pool.query(`
        SELECT 
          id, name, code, type, address, city, wilaya,
          contact_person, phone, email, is_active,
          created_at, updated_at
        FROM stock_locations 
        WHERE is_active = 1 
        ORDER BY name
      `);
      
      res.json({
        success: true,
        locations: locations
      });
    } catch (error) {
      console.error('Error getting locations:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get locations',
        error: error.message 
      });
    }
  }
);

// Get specific location by ID
router.get('/locations/:id', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const locationId = req.params.id;
      
      const [locations] = await pool.query(`
        SELECT 
          id, name, code, type, address, city, wilaya,
          contact_person, phone, email, is_active,
          created_at, updated_at
        FROM stock_locations 
        WHERE id = ? AND is_active = 1
      `, [locationId]);
      
      if (locations.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }
      
      res.json({
        success: true,
        location: locations[0]
      });
    } catch (error) {
      console.error('Error getting location:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get location',
        error: error.message 
      });
    }
  }
);

// Get location with associated EcoTrack account
router.get('/locations/:id/ecotrack-account', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const locationId = req.params.id;
      
      const [results] = await pool.query(`
        SELECT 
          sl.id as location_id,
          sl.name as location_name,
          sl.code as location_code,
          ea.id as account_id,
          ea.account_name,
          ea.api_token,
          ea.user_guid,
          ea.is_enabled as account_enabled,
          ea.is_default as account_default
        FROM stock_locations sl
        LEFT JOIN ecotrack_accounts ea ON sl.id = ea.location_id AND ea.is_enabled = 1
        WHERE sl.id = ? AND sl.is_active = 1
      `, [locationId]);
      
      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }
      
      const result = results[0];
      
      res.json({
        success: true,
        location: {
          id: result.location_id,
          name: result.location_name,
          code: result.location_code
        },
        ecotrack_account: result.account_id ? {
          id: result.account_id,
          account_name: result.account_name,
          api_token: result.api_token,
          user_guid: result.user_guid,
          is_enabled: result.account_enabled,
          is_default: result.account_default
        } : null
      });
    } catch (error) {
      console.error('Error getting location with EcoTrack account:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get location with EcoTrack account',
        error: error.message 
      });
    }
  }
);

module.exports = router;
