const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Get all EcoTrack accounts
router.get('/accounts', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const [accounts] = await pool.query(`
        SELECT 
          ea.*,
          sl.name as location_name,
          sl.code as location_code,
          u1.username as created_by_name,
          u2.username as updated_by_name
        FROM ecotrack_accounts ea
        LEFT JOIN stock_locations sl ON ea.location_id = sl.id
        LEFT JOIN users u1 ON ea.created_by = u1.id
        LEFT JOIN users u2 ON ea.updated_by = u2.id
        WHERE sl.is_active = 1
        ORDER BY ea.is_default DESC, ea.account_name
      `);
      
      res.json({
        success: true,
        accounts: accounts
      });
    } catch (error) {
      console.error('Error getting EcoTrack accounts:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get accounts',
        error: error.message 
      });
    }
  }
);

// Get specific account by ID
router.get('/accounts/:id', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const accountId = req.params.id;
      
      const [accounts] = await pool.query(`
        SELECT 
          ea.*,
          sl.name as location_name,
          sl.code as location_code
        FROM ecotrack_accounts ea
        LEFT JOIN stock_locations sl ON ea.location_id = sl.id
        WHERE ea.id = ? AND sl.is_active = 1
      `, [accountId]);
      
      if (accounts.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Account not found'
        });
      }
      
      res.json({
        success: true,
        account: accounts[0]
      });
    } catch (error) {
      console.error('Error getting EcoTrack account:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get account',
        error: error.message 
      });
    }
  }
);

// Create new EcoTrack account
router.post('/accounts', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const { location_id, account_name, api_token, user_guid, is_enabled, is_default } = req.body;
      
      // Validate input
      if (!location_id || !account_name || !api_token || !user_guid) {
        return res.status(400).json({
          success: false,
          message: 'Location, account name, API token, and user GUID are required'
        });
      }
      
      // Check if location exists and is active
      const [locations] = await pool.query(`
        SELECT id FROM stock_locations WHERE id = ? AND is_active = 1
      `, [location_id]);
      
      if (locations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive location'
        });
      }
      
      // Check if account already exists for this location
      const [existingAccounts] = await pool.query(`
        SELECT id FROM ecotrack_accounts WHERE location_id = ?
      `, [location_id]);
      
      if (existingAccounts.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'An EcoTrack account already exists for this location'
        });
      }
      
      // If setting as default, unset other defaults
      if (is_default) {
        await pool.query(`
          UPDATE ecotrack_accounts SET is_default = 0
        `);
      }
      
      // Insert new account
      const [result] = await pool.query(`
        INSERT INTO ecotrack_accounts (
          location_id, account_name, api_token, user_guid, 
          is_enabled, is_default, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        location_id, account_name, api_token, user_guid,
        is_enabled || true, is_default || false, req.user.id, req.user.id
      ]);
      
      res.json({
        success: true,
        message: 'EcoTrack account created successfully',
        account_id: result.insertId
      });
    } catch (error) {
      console.error('Error creating EcoTrack account:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create account',
        error: error.message 
      });
    }
  }
);

// Update EcoTrack account
router.put('/accounts/:id', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const accountId = req.params.id;
      const { location_id, account_name, api_token, user_guid, is_enabled, is_default } = req.body;
      
      // Validate input
      if (!location_id || !account_name || !api_token || !user_guid) {
        return res.status(400).json({
          success: false,
          message: 'Location, account name, API token, and user GUID are required'
        });
      }
      
      // Check if account exists
      const [existingAccounts] = await pool.query(`
        SELECT id FROM ecotrack_accounts WHERE id = ?
      `, [accountId]);
      
      if (existingAccounts.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Account not found'
        });
      }
      
      // Check if location exists and is active
      const [locations] = await pool.query(`
        SELECT id FROM stock_locations WHERE id = ? AND is_active = 1
      `, [location_id]);
      
      if (locations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive location'
        });
      }
      
      // Check if another account already exists for this location (excluding current account)
      const [conflictingAccounts] = await pool.query(`
        SELECT id FROM ecotrack_accounts WHERE location_id = ? AND id != ?
      `, [location_id, accountId]);
      
      if (conflictingAccounts.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Another EcoTrack account already exists for this location'
        });
      }
      
      // If setting as default, unset other defaults
      if (is_default) {
        await pool.query(`
          UPDATE ecotrack_accounts SET is_default = 0 WHERE id != ?
        `, [accountId]);
      }
      
      // Update account
      await pool.query(`
        UPDATE ecotrack_accounts SET
          location_id = ?, account_name = ?, api_token = ?, user_guid = ?,
          is_enabled = ?, is_default = ?, updated_by = ?
        WHERE id = ?
      `, [
        location_id, account_name, api_token, user_guid,
        is_enabled || true, is_default || false, req.user.id, accountId
      ]);
      
      res.json({
        success: true,
        message: 'EcoTrack account updated successfully'
      });
    } catch (error) {
      console.error('Error updating EcoTrack account:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update account',
        error: error.message 
      });
    }
  }
);

// Delete EcoTrack account
router.delete('/accounts/:id', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const accountId = req.params.id;
      
      // Check if account exists
      const [existingAccounts] = await pool.query(`
        SELECT id, is_default FROM ecotrack_accounts WHERE id = ?
      `, [accountId]);
      
      if (existingAccounts.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Account not found'
        });
      }
      
      const account = existingAccounts[0];
      
      // Check if this is the only account
      const [totalAccounts] = await pool.query(`
        SELECT COUNT(*) as count FROM ecotrack_accounts
      `);
      
      if (totalAccounts[0].count === 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last EcoTrack account'
        });
      }
      
      // If deleting the default account, set another one as default
      if (account.is_default) {
        await pool.query(`
          UPDATE ecotrack_accounts 
          SET is_default = 1 
          WHERE id != ? 
          ORDER BY created_at ASC 
          LIMIT 1
        `, [accountId]);
      }
      
      // Delete account
      await pool.query(`
        DELETE FROM ecotrack_accounts WHERE id = ?
      `, [accountId]);
      
      res.json({
        success: true,
        message: 'EcoTrack account deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting EcoTrack account:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete account',
        error: error.message 
      });
    }
  }
);

// Set account as default
router.post('/accounts/:id/set-default', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const accountId = req.params.id;
      
      // Check if account exists
      const [existingAccounts] = await pool.query(`
        SELECT id FROM ecotrack_accounts WHERE id = ?
      `, [accountId]);
      
      if (existingAccounts.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Account not found'
        });
      }
      
      // Unset all other defaults and set this one as default
      await pool.query(`UPDATE ecotrack_accounts SET is_default = 0`);
      await pool.query(`
        UPDATE ecotrack_accounts SET is_default = 1, updated_by = ? WHERE id = ?
      `, [req.user.id, accountId]);
      
      res.json({
        success: true,
        message: 'Default account updated successfully'
      });
    } catch (error) {
      console.error('Error setting default account:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to set default account',
        error: error.message 
      });
    }
  }
);

// Test connection for specific account
router.post('/test-connection', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const { account_id, api_token, user_guid } = req.body;
      
      if (!api_token || !user_guid) {
        return res.status(400).json({
          success: false,
          message: 'API Token and User GUID are required for testing'
        });
      }
      
      // Test connection with EcoTrack API
      const axios = require('axios');
      
      try {
        console.log(`🔍 Testing EcoTrack connection for account ${account_id}`);
        console.log(`   API Token: ***${api_token.slice(-4)}`);
        console.log(`   User GUID: ${user_guid}`);
        
        // Use a simple API call to test connectivity
        const response = await axios.post('https://app.noest-dz.com/api/public/get/desks', {
          api_token: api_token,
          user_guid: user_guid
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000
        });
        
        console.log(`✅ EcoTrack API test successful for account ${account_id}`);
        console.log(`   Response status: ${response.status}`);
        
        // Update last tested timestamp if account_id provided
        if (account_id) {
          await pool.query(`
            UPDATE ecotrack_accounts 
            SET updated_at = NOW() 
            WHERE id = ?
          `, [account_id]);
        }
        
        res.json({
          success: true,
          message: 'Connection to EcoTrack API successful!'
        });
        
      } catch (apiError) {
        console.error(`❌ EcoTrack API test failed for account ${account_id}:`, apiError.message);
        
        let errorMessage = 'Failed to connect to EcoTrack API';
        if (apiError.response?.status === 401) {
          errorMessage = 'Invalid API credentials';
        } else if (apiError.response?.status === 422) {
          errorMessage = 'Invalid API parameters';
        } else if (apiError.code === 'ECONNREFUSED') {
          errorMessage = 'Cannot reach EcoTrack server';
        } else if (apiError.code === 'ETIMEDOUT') {
          errorMessage = 'Connection timeout';
        }
        
        res.status(400).json({
          success: false,
          message: errorMessage,
          error: apiError.message
        });
      }
    } catch (error) {
      console.error('Error testing EcoTrack connection:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Connection test failed: ' + error.message
      });
    }
  }
);

// Get EcoTrack account by location ID
router.get('/accounts/by-location/:locationId', 
  authenticateToken, 
  requirePermission('canViewIntegrations'), 
  async (req, res) => {
    try {
      const locationId = req.params.locationId;
      
      const [accounts] = await pool.query(`
        SELECT 
          ea.*,
          sl.name as location_name,
          sl.code as location_code
        FROM ecotrack_accounts ea
        LEFT JOIN stock_locations sl ON ea.location_id = sl.id
        WHERE ea.location_id = ? AND ea.is_enabled = 1 AND sl.is_active = 1
      `, [locationId]);
      
      if (accounts.length === 0) {
        // Try to get default account as fallback
        const [defaultAccounts] = await pool.query(`
          SELECT 
            ea.*,
            sl.name as location_name,
            sl.code as location_code
          FROM ecotrack_accounts ea
          LEFT JOIN stock_locations sl ON ea.location_id = sl.id
          WHERE ea.is_default = 1 AND ea.is_enabled = 1 AND sl.is_active = 1
        `);
        
        if (defaultAccounts.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No EcoTrack account found for this location and no default account available'
          });
        }
        
        res.json({
          success: true,
          account: defaultAccounts[0],
          is_fallback: true,
          message: 'Using default account as fallback'
        });
      } else {
        res.json({
          success: true,
          account: accounts[0],
          is_fallback: false
        });
      }
    } catch (error) {
      console.error('Error getting EcoTrack account by location:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get account by location',
        error: error.message 
      });
    }
  }
);

module.exports = router;
