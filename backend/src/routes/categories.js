const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateCategory } = require('../middleware/validation');

// Get all categories with hierarchical structure
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active_only = true, with_products = false } = req.query;
    
    let query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.parent_id,
        c.level,
        c.is_active,
        c.sort_order,
        c.image_url,
        c.created_at,
        c.updated_at,
        pc.name as parent_name,
        u.username as created_by_name
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN users u ON c.created_by = u.id
    `;
    
    const params = [];
    
    if (with_products === 'true') {
      query = query.replace(
        'u.username as created_by_name',
        `u.username as created_by_name,
        (
          SELECT COUNT(*) 
          FROM products p 
          WHERE p.category_id = c.id AND p.is_active = true
        ) as products_count`
      );
    }
    
    if (active_only === 'true') {
      query += ' WHERE c.is_active = true';
    }
    
    query += ' ORDER BY c.level, c.sort_order, c.name';
    
    const [categories] = await pool.query(query, params);
    
    // Build hierarchical structure
    const categoryMap = new Map();
    const rootCategories = [];
    
    // First pass: create all category objects
    categories.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        children: []
      });
    });
    
    // Second pass: build hierarchy
    categories.forEach(cat => {
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children.push(categoryMap.get(cat.id));
        }
      } else {
        rootCategories.push(categoryMap.get(cat.id));
      }
    });
    
    res.json({
      success: true,
      data: {
        categories: rootCategories,
        total: categories.length
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Get category by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [categories] = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.parent_id,
        c.level,
        c.is_active,
        c.sort_order,
        c.image_url,
        c.created_at,
        c.updated_at,
        pc.name as parent_name,
        u.username as created_by_name,
        (
          SELECT COUNT(*) 
          FROM products p 
          WHERE p.category_id = c.id AND p.is_active = true
        ) as products_count
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `, [id]);
    
    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Get children categories
    const [children] = await pool.query(`
      SELECT id, name, description, is_active, sort_order
      FROM categories 
      WHERE parent_id = ? AND is_active = true
      ORDER BY sort_order, name
    `, [id]);
    
    res.json({
      success: true,
      data: {
        category: {
          ...categories[0],
          children
        }
      }
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category',
      error: error.message
    });
  }
});

// Create new category
router.post('/', authenticateToken, validateCategory, async (req, res) => {
  try {
    const { name, description, parent_id, is_active = true, sort_order = 0, image_url } = req.body;
    const created_by = req.user.id;
    
    // Determine level based on parent
    let level = 1;
    if (parent_id) {
      const [parentCategory] = await pool.query('SELECT level FROM categories WHERE id = ?', [parent_id]);
      if (parentCategory.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }
      level = parentCategory[0].level + 1;
    }
    
    // Check for duplicate name at same level
    const [existingCategory] = await pool.query(
      'SELECT id FROM categories WHERE name = ? AND parent_id = ?',
      [name, parent_id]
    );
    
    if (existingCategory.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists at this level'
      });
    }
    
    const [result] = await pool.query(`
      INSERT INTO categories (name, description, parent_id, level, is_active, sort_order, image_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, description, parent_id, level, is_active, sort_order, image_url, created_by]);
    
    // Fetch the created category
    const [newCategory] = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.parent_id,
        c.level,
        c.is_active,
        c.sort_order,
        c.image_url,
        c.created_at,
        c.updated_at,
        pc.name as parent_name,
        u.username as created_by_name
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `, [result.insertId]);
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        category: newCategory[0]
      }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error.message
    });
  }
});

// Update category
router.put('/:id', authenticateToken, validateCategory, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parent_id, is_active, sort_order, image_url } = req.body;
    
    // Check if category exists
    const [existingCategory] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (existingCategory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Prevent circular references
    if (parent_id && parent_id === parseInt(id)) {
      return res.status(400).json({
        success: false,
        message: 'Category cannot be its own parent'
      });
    }
    
    // Check for cycles in hierarchy
    if (parent_id) {
      const [parentCheck] = await pool.query(`
        WITH RECURSIVE parent_hierarchy AS (
          SELECT id, parent_id, name, 1 as level
          FROM categories
          WHERE id = ?
          
          UNION ALL
          
          SELECT c.id, c.parent_id, c.name, ph.level + 1
          FROM categories c
          JOIN parent_hierarchy ph ON c.parent_id = ph.id
          WHERE ph.level < 10
        )
        SELECT id FROM parent_hierarchy WHERE id = ?
      `, [parent_id, id]);
      
      if (parentCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'This would create a circular reference in the category hierarchy'
        });
      }
    }
    
    // Determine new level
    let level = 1;
    if (parent_id) {
      const [parentCategory] = await pool.query('SELECT level FROM categories WHERE id = ?', [parent_id]);
      if (parentCategory.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found'
        });
      }
      level = parentCategory[0].level + 1;
    }
    
    // Check for duplicate name at same level (excluding current category)
    const [duplicateCheck] = await pool.query(
      'SELECT id FROM categories WHERE name = ? AND parent_id = ? AND id != ?',
      [name, parent_id, id]
    );
    
    if (duplicateCheck.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists at this level'
      });
    }
    
    await pool.query(`
      UPDATE categories 
      SET name = ?, description = ?, parent_id = ?, level = ?, is_active = ?, sort_order = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, parent_id, level, is_active, sort_order, image_url, id]);
    
    // Update child categories' levels if parent changed
    if (parent_id !== existingCategory[0].parent_id) {
      await updateChildLevels(id, level);
    }
    
    // Fetch updated category
    const [updatedCategory] = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.parent_id,
        c.level,
        c.is_active,
        c.sort_order,
        c.image_url,
        c.created_at,
        c.updated_at,
        pc.name as parent_name,
        u.username as created_by_name
      FROM categories c
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `, [id]);
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: {
        category: updatedCategory[0]
      }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
});

// Delete category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category exists
    const [existingCategory] = await pool.query('SELECT * FROM categories WHERE id = ?', [id]);
    if (existingCategory.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Check if category has products
    const [productsCount] = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [id]
    );
    
    if (productsCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category that has products assigned to it'
      });
    }
    
    // Check if category has children
    const [childrenCount] = await pool.query(
      'SELECT COUNT(*) as count FROM categories WHERE parent_id = ?',
      [id]
    );
    
    if (childrenCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category that has subcategories'
      });
    }
    
    await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error.message
    });
  }
});

// Helper function to update child levels recursively
async function updateChildLevels(parentId, parentLevel) {
  const newLevel = parentLevel + 1;
  
  // Get all direct children
  const [children] = await pool.query(
    'SELECT id FROM categories WHERE parent_id = ?',
    [parentId]
  );
  
  for (const child of children) {
    // Update child level
    await pool.query(
      'UPDATE categories SET level = ? WHERE id = ?',
      [newLevel, child.id]
    );
    
    // Recursively update grandchildren
    await updateChildLevels(child.id, newLevel);
  }
}

module.exports = router;
