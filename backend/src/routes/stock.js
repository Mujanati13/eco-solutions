const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireAnyPermission } = require('../middleware/permissions');
const StockService = require('../services/stockService');
const { validateRequest, schemas } = require('../middleware/validation');

const router = express.Router();

// Product Routes
router.get('/products', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const result = await StockService.getAllProducts(req.query);
    res.json(result);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/products/:id', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const product = await StockService.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public product endpoint for product display pages
router.get('/products/:id/public', async (req, res) => {
  try {
    const product = await StockService.getProductById(req.params.id);
    if (!product || !product.is_active) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found or not available' 
      });
    }
    
    // Only return public information, hide sensitive data
    const publicProduct = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      selling_price: product.selling_price,
      current_stock: product.current_stock,
      category_name: product.category_name,
      emplacement: product.emplacement || product.location,
      barcode: product.barcode,
      image_url: product.image_url,
      is_active: product.is_active,
      variants: product.variants || [],
      images: product.images || []
    };
    
    res.json({
      success: true,
      product: publicProduct
    });
  } catch (error) {
    console.error('Get public product error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

router.post('/products', authenticateToken, requirePermission('canCreateProducts'), async (req, res) => {
  try {
    const productId = await StockService.createProduct(req.body, req.user.id);
    res.status(201).json({ id: productId, message: 'Product created successfully' });
  } catch (error) {
    console.error('Create product error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'SKU already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

router.put('/products/:id', authenticateToken, requirePermission('canEditProducts'), async (req, res) => {
  try {
    const updated = await StockService.updateProduct(req.params.id, req.body, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Update product error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'SKU already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete product
router.delete('/products/:id', authenticateToken, requirePermission('canDeleteProducts'), async (req, res) => {
  try {
    const deleted = await StockService.deleteProduct(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stock Level Routes
router.get('/stock-levels', authenticateToken, requirePermission('canViewStock'), async (req, res) => {
  try {
    const stockLevels = await StockService.getStockLevels(req.query);
    res.json(stockLevels);
  } catch (error) {
    console.error('Get stock levels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/stock-adjustments', authenticateToken, requirePermission('canManageStock'), async (req, res) => {
  try {
    await StockService.adjustStock(req.body, req.user.id);
    res.json({ message: 'Stock adjustment completed successfully' });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    if (error.message.includes('Insufficient stock')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Stock Movement Routes
router.get('/stock-movements', authenticateToken, requirePermission('canViewStock'), async (req, res) => {
  try {
    const result = await StockService.getStockMovements(req.query);
    res.json(result);
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Location Routes
router.get('/locations', authenticateToken, requirePermission('canViewStock'), async (req, res) => {
  try {
    const locations = await StockService.getAllLocations();
    res.json(locations);
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/locations', authenticateToken, requirePermission('canManageStock'), async (req, res) => {
  try {
    const locationId = await StockService.createLocation(req.body);
    res.status(201).json({ id: locationId, message: 'Location created successfully' });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/locations/:id', authenticateToken, requirePermission('canViewStock'), async (req, res) => {
  try {
    const location = await StockService.getLocationById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/locations/:id', authenticateToken, requirePermission('canManageStock'), async (req, res) => {
  try {
    const updated = await StockService.updateLocation(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/locations/:id', authenticateToken, requirePermission('canManageStock'), async (req, res) => {
  try {
    const deleted = await StockService.deleteLocation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stock Reports Routes
router.get('/reports/summary', authenticateToken, requirePermission('canViewStockReports'), async (req, res) => {
  try {
    const summary = await StockService.getStockSummary();
    res.json(summary);
  } catch (error) {
    console.error('Get stock summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reports/low-stock', authenticateToken, requirePermission('canViewStockReports'), async (req, res) => {
  try {
    const lowStockItems = await StockService.getLowStockAlert();
    res.json(lowStockItems);
  } catch (error) {
    console.error('Get low stock alert error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Categories and Brands (for dropdowns)
router.get('/categories', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const { pool } = require('../../config/database');
    const [categories] = await pool.query(`
      SELECT DISTINCT category 
      FROM products 
      WHERE category IS NOT NULL AND category != '' 
      ORDER BY category
    `);
    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/brands', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const { pool } = require('../../config/database');
    const [brands] = await pool.query(`
      SELECT DISTINCT brand 
      FROM products 
      WHERE brand IS NOT NULL AND brand != '' 
      ORDER BY brand
    `);
    res.json(brands.map(b => b.brand));
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Product Link Generation
router.post('/products/:id/generate-link', authenticateToken, requirePermission('canViewProducts'), async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await StockService.getProductById(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Generate a unique token for the product link
    const timestamp = Date.now();
    const linkToken = `prod_${productId}_${timestamp}`;
    
    // In a production environment, you might want to store this token in the database
    // and set an expiration time
    
    const baseUrl = req.get('origin') || 'http://localhost:3000';
    const productLink = `${baseUrl}/product/${linkToken}?name=${encodeURIComponent(product.name)}&sku=${encodeURIComponent(product.sku)}&price=${product.selling_price || 0}`;
    
    res.json({
      link: productLink,
      token: linkToken,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.selling_price
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    });
  } catch (error) {
    console.error('Generate product link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
