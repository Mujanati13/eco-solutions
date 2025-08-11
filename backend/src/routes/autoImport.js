const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const AutoGoogleSheetsImporter = require('../services/autoGoogleSheetsImporter');

const router = express.Router();
const autoImporter = new AutoGoogleSheetsImporter();

// Initialize the auto importer
let isInitialized = false;

const ensureInitialized = async (req, res, next) => {
  if (!isInitialized) {
    const success = await autoImporter.initialize();
    if (!success) {
      return res.status(500).json({ error: 'Failed to initialize auto importer' });
    }
    isInitialized = true;
  }
  next();
};

// Manual trigger for scanning and importing all files
router.post('/scan-all', authenticateToken, requireAdmin, ensureInitialized, async (req, res) => {
  try {
    const results = await autoImporter.triggerManualScan();
    
    res.json({
      success: !results.error,
      message: results.error || `Processed ${results.newFiles} new files, imported ${results.totalOrdersImported} orders`,
      results
    });
  } catch (error) {
    console.error('Manual scan error:', error);
    res.status(500).json({ error: 'Failed to scan and import files' });
  }
});

// Start automatic scanning
router.post('/start-auto-scan', authenticateToken, requireAdmin, ensureInitialized, async (req, res) => {
  try {
    const { cronPattern = '*/5 * * * *' } = req.body; // Default: every 5 minutes
    
    autoImporter.startAutomaticScanning(cronPattern);
    
    res.json({
      success: true,
      message: `Automatic scanning started with pattern: ${cronPattern}`,
      cronPattern
    });
  } catch (error) {
    console.error('Start auto scan error:', error);
    res.status(500).json({ error: 'Failed to start automatic scanning' });
  }
});

// Stop automatic scanning
router.post('/stop-auto-scan', authenticateToken, requireAdmin, ensureInitialized, async (req, res) => {
  try {
    autoImporter.stopAutomaticScanning();
    
    res.json({
      success: true,
      message: 'Automatic scanning stopped'
    });
  } catch (error) {
    console.error('Stop auto scan error:', error);
    res.status(500).json({ error: 'Failed to stop automatic scanning' });
  }
});

// Get processing statistics
router.get('/stats', authenticateToken, requireAdmin, ensureInitialized, async (req, res) => {
  try {
    const stats = await autoImporter.getProcessingStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get processing statistics' });
  }
});

// Get list of processed files with enhanced tracking
router.get('/processed-files', authenticateToken, requireAdmin, ensureInitialized, async (req, res) => {
  try {
    const { pool } = require('../../config/database');
    
    const [files] = await pool.query(`
      SELECT 
        spreadsheet_id,
        file_name,
        file_hash,
        file_size,
        last_modified,
        orders_imported,
        processing_status,
        error_message,
        last_processed,
        (SELECT COUNT(*) FROM order_file_tracking oft WHERE oft.source_spreadsheet_id = gsp.spreadsheet_id) as tracked_orders
      FROM google_sheets_processed gsp
      ORDER BY last_processed DESC
      LIMIT 50
    `);

    // Check for duplicates
    const [duplicates] = await pool.query(`
      SELECT file_hash, COUNT(*) as count, GROUP_CONCAT(file_name SEPARATOR ', ') as duplicate_files
      FROM google_sheets_processed 
      WHERE file_hash IS NOT NULL
      GROUP BY file_hash 
      HAVING COUNT(*) > 1
    `);
    
    res.json({
      success: true,
      files: files.map(file => ({
        ...file,
        file_size_mb: file.file_size ? (file.file_size / 1024 / 1024).toFixed(2) : null,
        is_duplicate: duplicates.some(dup => dup.file_hash === file.file_hash)
      })),
      duplicateGroups: duplicates
    });
  } catch (error) {
    console.error('Get processed files error:', error);
    res.status(500).json({ error: 'Failed to get processed files list' });
  }
});

// Get order source tracking information  
router.get('/order-source/:orderNumber', authenticateToken, ensureInitialized, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const sourceInfo = await autoImporter.getOrderSourceInfo(orderNumber);
    res.json(sourceInfo);
  } catch (error) {
    console.error('Order source lookup error:', error);
    res.status(500).json({ error: 'Failed to get order source information' });
  }
});

// Get all orders from a specific file
router.get('/file-orders/:spreadsheetId', authenticateToken, ensureInitialized, async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const ordersInfo = await autoImporter.getOrdersFromFile(spreadsheetId);
    res.json(ordersInfo);
  } catch (error) {
    console.error('File orders lookup error:', error);
    res.status(500).json({ error: 'Failed to get orders from file' });
  }
});

// Get enhanced processing statistics with duplicates and detailed tracking
router.get('/enhanced-stats', authenticateToken, ensureInitialized, async (req, res) => {
  try {
    const stats = await autoImporter.getProcessingStats();
    res.json(stats);
  } catch (error) {
    console.error('Enhanced stats error:', error);
    res.status(500).json({ error: 'Failed to get enhanced processing statistics' });
  }
});

module.exports = router;
