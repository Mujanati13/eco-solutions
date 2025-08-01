const { pool } = require('../../config/database');

class StockService {
  // Product Management
  static async getAllProducts(filters = {}) {
    try {
      const { page = 1, limit = 20, search, category, brand, is_active, low_stock } = filters;
      
      const validPage = Math.max(1, parseInt(page) || 1);
      const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (validPage - 1) * validLimit;

      let whereClause = '1=1';
      const queryParams = [];

      if (search) {
        whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }

      if (category) {
        whereClause += ' AND p.category = ?';
        queryParams.push(category);
      }

      if (brand) {
        whereClause += ' AND p.brand = ?';
        queryParams.push(brand);
      }

      if (is_active !== undefined) {
        whereClause += ' AND p.is_active = ?';
        queryParams.push(is_active === 'true');
      }

      // Get total count
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM products p WHERE ${whereClause}`,
        queryParams
      );

      // Get products with stock levels
      const productsQuery = `
        SELECT 
          p.*,
          COALESCE(SUM(sl.quantity_available), 0) as total_stock,
          COALESCE(SUM(sl.quantity_available), 0) as current_stock,
          COALESCE(SUM(sl.quantity_reserved), 0) as total_reserved,
          COUNT(DISTINCT sl.location_id) as locations_count,
          u.username as created_by_name,
          COALESCE(c.name, p.category) as category_name,
          CASE 
            WHEN COALESCE(SUM(sl.quantity_available), 0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(sl.quantity_available), 0) <= 5 THEN 'low_stock'
            WHEN COALESCE(SUM(sl.quantity_available), 0) <= 10 THEN 'medium_stock'
            ELSE 'in_stock'
          END as stock_alert_level,
          CASE 
            WHEN COALESCE(SUM(sl.quantity_available), 0) <= 5 THEN true 
            ELSE false 
          END as is_low_stock
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${whereClause}
        GROUP BY p.id
      `;

      if (low_stock === 'true') {
        productsQuery = productsQuery.replace('WHERE ${whereClause}', 
          `WHERE ${whereClause} HAVING is_low_stock = true`);
      }

      const finalQuery = `${productsQuery} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
      const finalParams = [...queryParams, validLimit, offset];

      const [products] = await pool.query(finalQuery, finalParams);

      return {
        products,
        pagination: {
          page: validPage,
          limit: validLimit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / validLimit)
        }
      };
    } catch (error) {
      console.error('Get products error:', error);
      throw error;
    }
  }

  static async getProductById(id) {
    try {
      const [products] = await pool.query(`
        SELECT 
          p.*,
          u.username as created_by_name,
          COALESCE(c.name, p.category) as category_name,
          COALESCE(SUM(sl.quantity_available), 0) as total_stock,
          COALESCE(SUM(sl.quantity_reserved), 0) as total_reserved
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
        GROUP BY p.id
      `, [id]);

      if (products.length === 0) {
        return null;
      }

      // Get stock levels by location
      const [stockLevels] = await pool.query(`
        SELECT 
          sl.*,
          loc.name as location_name,
          loc.type as location_type
        FROM stock_levels sl
        JOIN stock_locations loc ON sl.location_id = loc.id
        WHERE sl.product_id = ?
        ORDER BY loc.name
      `, [id]);

      return {
        ...products[0],
        stock_by_location: stockLevels
      };
    } catch (error) {
      console.error('Get product by ID error:', error);
      throw error;
    }
  }

  static async createProduct(productData, createdBy) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        sku, name, description, external_link, category, brand, unit_of_measure,
        cost_price, selling_price, barcode, is_active = true,
        current_stock = 0, location_id = 1, category_id
      } = productData;

      // Insert product
      const [result] = await connection.query(`
        INSERT INTO products (
          sku, name, description, external_link, category, brand, unit_of_measure,
          cost_price, selling_price, barcode, is_active, created_by, category_id, location_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        sku, name, description, external_link, category, brand, unit_of_measure,
        cost_price, selling_price, barcode, is_active, createdBy, category_id, location_id
      ]);

      const productId = result.insertId;

      // Create initial stock level if provided
      if (current_stock > 0) {
        await connection.query(`
          INSERT INTO stock_levels (product_id, location_id, quantity_available)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE quantity_available = quantity_available + VALUES(quantity_available)
        `, [productId, location_id, current_stock]);

        // Record stock movement
        await connection.query(`
          INSERT INTO stock_movements (
            product_id, location_id, movement_type, quantity, 
            reference_type, notes, performed_by
          ) VALUES (?, ?, 'in', ?, 'adjustment', 'Initial stock', ?)
        `, [productId, location_id, current_stock, createdBy]);
      }

      await connection.commit();
      return productId;
    } catch (error) {
      await connection.rollback();
      console.error('Create product error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateProduct(id, productData, updatedBy) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        sku, name, description, external_link, category, brand, unit_of_measure,
        cost_price, selling_price, barcode, is_active, current_stock, category_id, location_id
      } = productData;

      // Update product basic info
      const [result] = await connection.query(`
        UPDATE products SET
          sku = ?, name = ?, description = ?, external_link = ?, category = ?, brand = ?,
          unit_of_measure = ?, cost_price = ?, selling_price = ?,
          barcode = ?, is_active = ?, category_id = ?, location_id = ?
        WHERE id = ?
      `, [
        sku, name, description, external_link, category, brand, unit_of_measure,
        cost_price, selling_price, barcode, is_active, category_id, location_id, id
      ]);

      // Update stock level if current_stock is provided
      if (current_stock !== undefined && current_stock !== null) {
        // Get current stock level
        const [currentStockResult] = await connection.query(`
          SELECT COALESCE(SUM(quantity_available), 0) as current_total
          FROM stock_levels 
          WHERE product_id = ?
        `, [id]);

        const currentTotal = currentStockResult[0]?.current_total || 0;
        const stockDifference = current_stock - currentTotal;

        if (stockDifference !== 0) {
          // Update stock level (assuming default location_id = 1)
          await connection.query(`
            INSERT INTO stock_levels (product_id, location_id, quantity_available)
            VALUES (?, 1, ?)
            ON DUPLICATE KEY UPDATE quantity_available = ?
          `, [id, current_stock, current_stock]);

          // Record stock movement
          const movementType = stockDifference > 0 ? 'in' : 'out';
          const quantity = Math.abs(stockDifference);
          await connection.query(`
            INSERT INTO stock_movements (
              product_id, location_id, movement_type, quantity, 
              reference_type, notes, performed_by
            ) VALUES (?, 1, ?, ?, 'adjustment', 'Stock level adjustment', ?)
          `, [id, movementType, quantity, updatedBy]);
        }
      }

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      console.error('Update product error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Stock Level Management
  static async getStockLevels(filters = {}) {
    try {
      const { location_id, product_id, low_stock } = filters;

      let whereClause = '1=1';
      const queryParams = [];

      if (location_id) {
        whereClause += ' AND sl.location_id = ?';
        queryParams.push(location_id);
      }

      if (product_id) {
        whereClause += ' AND sl.product_id = ?';
        queryParams.push(product_id);
      }

      let query = `
        SELECT 
          sl.*,
          p.sku, p.name as product_name,
          loc.name as location_name, loc.type as location_type,
          CASE 
            WHEN sl.quantity_available = 0 THEN 'out_of_stock'
            WHEN sl.quantity_available <= 5 THEN 'low_stock'
            WHEN sl.quantity_available <= 10 THEN 'medium_stock'
            ELSE 'in_stock'
          END as stock_alert_level,
          CASE 
            WHEN sl.quantity_available <= 5 THEN true 
            ELSE false 
          END as is_low_stock
        FROM stock_levels sl
        JOIN products p ON sl.product_id = p.id
        JOIN stock_locations loc ON sl.location_id = loc.id
        WHERE ${whereClause}
      `;

      if (low_stock === 'true') {
        query += ' HAVING is_low_stock = true';
      }

      query += ' ORDER BY loc.name, p.name';

      const [stockLevels] = await pool.query(query, queryParams);
      return stockLevels;
    } catch (error) {
      console.error('Get stock levels error:', error);
      throw error;
    }
  }

  static async adjustStock(adjustmentData, performedBy) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const {
        product_id, location_id, adjustment_type, quantity, reason, notes
      } = adjustmentData;

      // Validate adjustment
      if (adjustment_type === 'decrease') {
        const [currentStock] = await connection.query(
          'SELECT quantity_available FROM stock_levels WHERE product_id = ? AND location_id = ?',
          [product_id, location_id]
        );

        if (currentStock.length === 0 || currentStock[0].quantity_available < quantity) {
          throw new Error('Insufficient stock for adjustment');
        }
      }

      // Update stock level
      const stockChange = adjustment_type === 'increase' ? quantity : -quantity;
      
      await connection.query(`
        INSERT INTO stock_levels (product_id, location_id, quantity_available)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE quantity_available = quantity_available + VALUES(quantity_available)
      `, [product_id, location_id, stockChange]);

      // Record movement
      await connection.query(`
        INSERT INTO stock_movements (
          product_id, location_id, movement_type, quantity,
          reference_type, notes, performed_by
        ) VALUES (?, ?, ?, ?, 'adjustment', ?, ?)
      `, [
        product_id, location_id, 
        adjustment_type === 'increase' ? 'in' : 'out',
        quantity, `${reason}: ${notes}`, performedBy
      ]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Adjust stock error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Stock Movements
  static async getStockMovements(filters = {}) {
    try {
      const { page = 1, limit = 50, product_id, location_id, movement_type, start_date, end_date } = filters;
      
      const validPage = Math.max(1, parseInt(page) || 1);
      const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const offset = (validPage - 1) * validLimit;

      let whereClause = '1=1';
      const queryParams = [];

      if (product_id) {
        whereClause += ' AND sm.product_id = ?';
        queryParams.push(product_id);
      }

      if (location_id) {
        whereClause += ' AND sm.location_id = ?';
        queryParams.push(location_id);
      }

      if (movement_type) {
        whereClause += ' AND sm.movement_type = ?';
        queryParams.push(movement_type);
      }

      if (start_date) {
        whereClause += ' AND DATE(sm.created_at) >= ?';
        queryParams.push(start_date);
      }

      if (end_date) {
        whereClause += ' AND DATE(sm.created_at) <= ?';
        queryParams.push(end_date);
      }

      // Get total count
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM stock_movements sm WHERE ${whereClause}`,
        queryParams
      );

      // Get movements
      const [movements] = await pool.query(`
        SELECT 
          sm.*,
          p.sku, p.name as product_name,
          loc.name as location_name,
          u.username as performed_by_name
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        JOIN stock_locations loc ON sm.location_id = loc.id
        LEFT JOIN users u ON sm.performed_by = u.id
        WHERE ${whereClause}
        ORDER BY sm.created_at DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, validLimit, offset]);

      return {
        movements,
        pagination: {
          page: validPage,
          limit: validLimit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / validLimit)
        }
      };
    } catch (error) {
      console.error('Get stock movements error:', error);
      throw error;
    }
  }

  // Locations Management
  static async getAllLocations() {
    try {
      const [locations] = await pool.query(`
        SELECT 
          sl.*,
          COUNT(DISTINCT slev.product_id) as products_count,
          COALESCE(SUM(slev.quantity_available), 0) as total_items
        FROM stock_locations sl
        LEFT JOIN stock_levels slev ON sl.id = slev.location_id
        GROUP BY sl.id
        ORDER BY sl.name
      `);

      return locations;
    } catch (error) {
      console.error('Get locations error:', error);
      throw error;
    }
  }

  static async createLocation(locationData) {
    try {
      const { name, type, address, contact_person, phone, email } = locationData;

      const [result] = await pool.query(`
        INSERT INTO stock_locations (name, type, address, contact_person, phone, email)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [name, type, address, contact_person, phone, email]);

      return result.insertId;
    } catch (error) {
      console.error('Create location error:', error);
      throw error;
    }
  }

  static async getLocationById(id) {
    try {
      const [locations] = await pool.query(`
        SELECT 
          sl.*,
          COUNT(DISTINCT slev.product_id) as products_count,
          COALESCE(SUM(slev.quantity_available), 0) as total_items
        FROM stock_locations sl
        LEFT JOIN stock_levels slev ON sl.id = slev.location_id
        WHERE sl.id = ?
        GROUP BY sl.id
      `, [id]);

      return locations[0] || null;
    } catch (error) {
      console.error('Get location by ID error:', error);
      throw error;
    }
  }

  static async updateLocation(id, locationData) {
    try {
      const { name, type, address, contact_person, phone, email, is_active } = locationData;

      const [result] = await pool.query(`
        UPDATE stock_locations 
        SET name = ?, type = ?, address = ?, contact_person = ?, phone = ?, email = ?, is_active = ?
        WHERE id = ?
      `, [name, type, address, contact_person, phone, email, is_active, id]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Update location error:', error);
      throw error;
    }
  }

  static async deleteLocation(id) {
    try {
      // Check if location has any stock levels associated
      const [stockLevels] = await pool.query(`
        SELECT COUNT(*) as count FROM stock_levels WHERE location_id = ?
      `, [id]);

      if (stockLevels[0].count > 0) {
        throw new Error('Cannot delete location with existing stock levels');
      }

      const [result] = await pool.query(`
        DELETE FROM stock_locations WHERE id = ?
      `, [id]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Delete location error:', error);
      throw error;
    }
  }

  // Stock Reports
  static async getStockSummary() {
    try {
      const [summary] = await pool.query(`
        SELECT 
          COUNT(DISTINCT p.id) as total_products,
          COUNT(DISTINCT sl.location_id) as total_locations,
          COALESCE(SUM(sl.quantity_available), 0) as total_items_in_stock,
          COALESCE(SUM(sl.quantity_reserved), 0) as total_items_reserved,
          COUNT(DISTINCT CASE 
            WHEN sl.quantity_available <= 5
            THEN p.id 
          END) as low_stock_products,
          COUNT(DISTINCT CASE 
            WHEN sl.quantity_available = 0
            THEN p.id 
          END) as out_of_stock_products,
          COALESCE(SUM(p.cost_price * sl.quantity_available), 0) as total_stock_value
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        WHERE p.is_active = true
      `);

      return summary[0];
    } catch (error) {
      console.error('Get stock summary error:', error);
      throw error;
    }
  }

  static async getLowStockAlert() {
    try {
      const [lowStockItems] = await pool.query(`
        SELECT 
          p.id, p.sku, p.name,
          SUM(sl.quantity_available) as current_stock,
          COUNT(sl.location_id) as locations_count,
          CASE 
            WHEN SUM(sl.quantity_available) = 0 THEN 'out_of_stock'
            WHEN SUM(sl.quantity_available) <= 5 THEN 'low_stock'
            WHEN SUM(sl.quantity_available) <= 10 THEN 'medium_stock'
            ELSE 'in_stock'
          END as stock_alert_level
        FROM products p
        JOIN stock_levels sl ON p.id = sl.product_id
        WHERE p.is_active = true 
        GROUP BY p.id
        HAVING SUM(sl.quantity_available) <= 10
        ORDER BY SUM(sl.quantity_available) ASC
      `);

      return lowStockItems;
    } catch (error) {
      console.error('Get low stock alert error:', error);
      throw error;
    }
  }

  // Reduce stock when order is completed
  static async reduceStock(productId, quantity = 1, orderId = null, performedBy = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Check if enough stock is available
      const [stockCheck] = await connection.query(`
        SELECT COALESCE(SUM(quantity_available), 0) as total_stock
        FROM stock_levels 
        WHERE product_id = ?
      `, [productId]);

      const availableStock = stockCheck[0]?.total_stock || 0;
      
      if (availableStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
      }

      // Reduce stock (assuming default location_id = 1)
      await connection.query(`
        UPDATE stock_levels 
        SET quantity_available = quantity_available - ?
        WHERE product_id = ? AND location_id = 1 AND quantity_available >= ?
      `, [quantity, productId, quantity]);

      // Record stock movement
      const notes = orderId ? `Order completion - Order ID: ${orderId}` : 'Stock reduction';
      await connection.query(`
        INSERT INTO stock_movements (
          product_id, location_id, movement_type, quantity, 
          reference_type, reference_id, notes, performed_by
        ) VALUES (?, 1, 'out', ?, 'order', ?, ?, ?)
      `, [productId, quantity, orderId, notes, performedBy]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Reduce stock error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteProduct(id) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Delete stock levels first (foreign key constraint)
      await connection.query('DELETE FROM stock_levels WHERE product_id = ?', [id]);
      
      // Delete stock movements
      await connection.query('DELETE FROM stock_movements WHERE product_id = ?', [id]);
      
      // Delete the product
      const [result] = await connection.query('DELETE FROM products WHERE id = ?', [id]);

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      console.error('Delete product error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = StockService;
