const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateVariant } = require('../middleware/validation');

// Get all variants for a product
router.get('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { active_only = true, with_stock = false } = req.query;
    
    let query = `
      SELECT 
        v.id,
        v.product_id,
        v.variant_name,
        v.sku,
        v.barcode,
        v.cost_price,
        v.selling_price,
        v.weight,
        v.dimensions,
        v.color,
        v.size,
        v.material,
        v.attributes,
        v.is_active,
        v.created_at,
        v.updated_at,
        p.name as product_name
      FROM product_variants v
      LEFT JOIN products p ON v.product_id = p.id
      WHERE v.product_id = ?
    `;
    
    const params = [productId];
    
    if (with_stock === 'true') {
      query = query.replace(
        'p.name as product_name',
        `p.name as product_name,
        (
          SELECT COALESCE(SUM(vsl.available_quantity), 0)
          FROM variant_stock_levels vsl
          WHERE vsl.variant_id = v.id
        ) as total_stock`
      );
    }
    
    if (active_only === 'true') {
      query += ' AND v.is_active = true';
    }
    
    query += ' ORDER BY v.variant_name';
    
    const [variants] = await pool.query(query, params);
    
    res.json({
      success: true,
      data: {
        variants,
        total: variants.length
      }
    });
  } catch (error) {
    console.error('Error fetching variants:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch variants',
      error: error.message
    });
  }
});

// Get variant by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [variants] = await pool.query(`
      SELECT 
        v.id,
        v.product_id,
        v.variant_name,
        v.sku,
        v.barcode,
        v.cost_price,
        v.selling_price,
        v.weight,
        v.dimensions,
        v.color,
        v.size,
        v.material,
        v.attributes,
        v.is_active,
        v.created_at,
        v.updated_at,
        p.name as product_name,
        p.sku as product_sku
      FROM product_variants v
      LEFT JOIN products p ON v.product_id = p.id
      WHERE v.id = ?
    `, [id]);
    
    if (variants.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }
    
    // Get stock levels for this variant
    const [stockLevels] = await pool.query(`
      SELECT 
        vsl.id,
        vsl.variant_id,
        vsl.location_id,
        vsl.quantity,
        vsl.reserved_quantity,
        vsl.available_quantity,
        vsl.minimum_stock_level,
        vsl.maximum_stock_level,
        vsl.last_movement_date,
        sl.name as location_name
      FROM variant_stock_levels vsl
      LEFT JOIN stock_locations sl ON vsl.location_id = sl.id
      WHERE vsl.variant_id = ?
      ORDER BY sl.name
    `, [id]);
    
    res.json({
      success: true,
      data: {
        variant: {
          ...variants[0],
          stock_levels: stockLevels
        }
      }
    });
  } catch (error) {
    console.error('Error fetching variant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch variant',
      error: error.message
    });
  }
});

// Create new variant
router.post('/', authenticateToken, validateVariant, async (req, res) => {
  try {
    const {
      product_id,
      variant_name,
      sku,
      barcode,
      cost_price = 0,
      selling_price = 0,
      weight,
      dimensions,
      color,
      size,
      material,
      attributes,
      is_active = true
    } = req.body;
    
    // Check if product exists
    const [product] = await pool.query('SELECT id FROM products WHERE id = ?', [product_id]);
    if (product.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Check for duplicate SKU
    const [existingSku] = await pool.query(
      'SELECT id FROM product_variants WHERE sku = ?',
      [sku]
    );
    
    if (existingSku.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists'
      });
    }
    
    const [result] = await pool.query(`
      INSERT INTO product_variants (
        product_id, variant_name, sku, barcode, cost_price, selling_price,
        weight, dimensions, color, size, material, attributes, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product_id, variant_name, sku, barcode, cost_price, selling_price,
      weight, dimensions, color, size, material, 
      attributes ? JSON.stringify(attributes) : null, is_active
    ]);
    
    // Create initial stock levels for all locations
    const [locations] = await pool.query('SELECT id FROM stock_locations WHERE is_active = true');
    
    for (const location of locations) {
      await pool.query(`
        INSERT INTO variant_stock_levels (variant_id, location_id, quantity, reserved_quantity)
        VALUES (?, ?, 0, 0)
      `, [result.insertId, location.id]);
    }
    
    // Fetch the created variant
    const [newVariant] = await pool.query(`
      SELECT 
        v.id,
        v.product_id,
        v.variant_name,
        v.sku,
        v.barcode,
        v.cost_price,
        v.selling_price,
        v.weight,
        v.dimensions,
        v.color,
        v.size,
        v.material,
        v.attributes,
        v.is_active,
        v.created_at,
        v.updated_at,
        p.name as product_name
      FROM product_variants v
      LEFT JOIN products p ON v.product_id = p.id
      WHERE v.id = ?
    `, [result.insertId]);
    
    res.status(201).json({
      success: true,
      message: 'Variant created successfully',
      data: {
        variant: newVariant[0]
      }
    });
  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create variant',
      error: error.message
    });
  }
});

// Update variant
router.put('/:id', authenticateToken, validateVariant, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      variant_name,
      sku,
      barcode,
      cost_price,
      selling_price,
      weight,
      dimensions,
      color,
      size,
      material,
      attributes,
      is_active
    } = req.body;
    
    // Check if variant exists
    const [existingVariant] = await pool.query('SELECT * FROM product_variants WHERE id = ?', [id]);
    if (existingVariant.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }
    
    // Check for duplicate SKU (excluding current variant)
    const [duplicateSku] = await pool.query(
      'SELECT id FROM product_variants WHERE sku = ? AND id != ?',
      [sku, id]
    );
    
    if (duplicateSku.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists'
      });
    }
    
    await pool.query(`
      UPDATE product_variants 
      SET 
        variant_name = ?, 
        sku = ?, 
        barcode = ?, 
        cost_price = ?, 
        selling_price = ?,
        weight = ?, 
        dimensions = ?, 
        color = ?, 
        size = ?, 
        material = ?, 
        attributes = ?, 
        is_active = ?, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      variant_name, sku, barcode, cost_price, selling_price,
      weight, dimensions, color, size, material,
      attributes ? JSON.stringify(attributes) : null, is_active, id
    ]);
    
    // Fetch updated variant
    const [updatedVariant] = await pool.query(`
      SELECT 
        v.id,
        v.product_id,
        v.variant_name,
        v.sku,
        v.barcode,
        v.cost_price,
        v.selling_price,
        v.weight,
        v.dimensions,
        v.color,
        v.size,
        v.material,
        v.attributes,
        v.is_active,
        v.created_at,
        v.updated_at,
        p.name as product_name
      FROM product_variants v
      LEFT JOIN products p ON v.product_id = p.id
      WHERE v.id = ?
    `, [id]);
    
    res.json({
      success: true,
      message: 'Variant updated successfully',
      data: {
        variant: updatedVariant[0]
      }
    });
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update variant',
      error: error.message
    });
  }
});

// Delete variant
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if variant exists
    const [existingVariant] = await pool.query('SELECT * FROM product_variants WHERE id = ?', [id]);
    if (existingVariant.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }
    
    // Check if variant has stock movements
    const [movementsCount] = await pool.query(
      'SELECT COUNT(*) as count FROM variant_stock_movements WHERE variant_id = ?',
      [id]
    );
    
    if (movementsCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete variant that has stock movements'
      });
    }
    
    // Delete stock levels first (cascade should handle this, but being explicit)
    await pool.query('DELETE FROM variant_stock_levels WHERE variant_id = ?', [id]);
    
    // Delete the variant
    await pool.query('DELETE FROM product_variants WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Variant deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting variant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete variant',
      error: error.message
    });
  }
});

// Get variant stock levels
router.get('/:id/stock', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [stockLevels] = await pool.query(`
      SELECT 
        vsl.id,
        vsl.variant_id,
        vsl.location_id,
        vsl.quantity,
        vsl.reserved_quantity,
        vsl.available_quantity,
        vsl.minimum_stock_level,
        vsl.maximum_stock_level,
        vsl.last_movement_date,
        vsl.updated_at,
        sl.name as location_name,
        sl.type as location_type
      FROM variant_stock_levels vsl
      LEFT JOIN stock_locations sl ON vsl.location_id = sl.id
      WHERE vsl.variant_id = ?
      ORDER BY sl.name
    `, [id]);
    
    res.json({
      success: true,
      data: {
        stock_levels: stockLevels
      }
    });
  } catch (error) {
    console.error('Error fetching variant stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch variant stock',
      error: error.message
    });
  }
});

// Update variant stock level
router.put('/:id/stock/:locationId', authenticateToken, async (req, res) => {
  try {
    const { id, locationId } = req.params;
    const { quantity, minimum_stock_level, maximum_stock_level } = req.body;
    
    // Check if variant exists
    const [variant] = await pool.query('SELECT id FROM product_variants WHERE id = ?', [id]);
    if (variant.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }
    
    // Check if location exists
    const [location] = await pool.query('SELECT id FROM stock_locations WHERE id = ?', [locationId]);
    if (location.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    // Get current stock level
    const [currentStock] = await pool.query(
      'SELECT quantity FROM variant_stock_levels WHERE variant_id = ? AND location_id = ?',
      [id, locationId]
    );
    
    if (currentStock.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stock level not found'
      });
    }
    
    const oldQuantity = currentStock[0].quantity;
    
    // Update stock level
    await pool.query(`
      UPDATE variant_stock_levels 
      SET quantity = ?, minimum_stock_level = ?, maximum_stock_level = ?, last_movement_date = CURRENT_TIMESTAMP
      WHERE variant_id = ? AND location_id = ?
    `, [quantity, minimum_stock_level, maximum_stock_level, id, locationId]);
    
    // Create stock movement record
    if (quantity !== oldQuantity) {
      const movementType = quantity > oldQuantity ? 'in' : 'out';
      const movementQuantity = Math.abs(quantity - oldQuantity);
      
      await pool.query(`
        INSERT INTO variant_stock_movements (
          variant_id, location_id, movement_type, reason, quantity, 
          quantity_before, quantity_after, reference_type, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, locationId, movementType, 'adjustment', movementQuantity,
        oldQuantity, quantity, 'manual', req.user.id
      ]);
    }
    
    // Fetch updated stock level
    const [updatedStock] = await pool.query(`
      SELECT 
        vsl.id,
        vsl.variant_id,
        vsl.location_id,
        vsl.quantity,
        vsl.reserved_quantity,
        vsl.available_quantity,
        vsl.minimum_stock_level,
        vsl.maximum_stock_level,
        vsl.last_movement_date,
        vsl.updated_at,
        sl.name as location_name
      FROM variant_stock_levels vsl
      LEFT JOIN stock_locations sl ON vsl.location_id = sl.id
      WHERE vsl.variant_id = ? AND vsl.location_id = ?
    `, [id, locationId]);
    
    res.json({
      success: true,
      message: 'Stock level updated successfully',
      data: {
        stock_level: updatedStock[0]
      }
    });
  } catch (error) {
    console.error('Error updating variant stock:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update variant stock',
      error: error.message
    });
  }
});

module.exports = router;
