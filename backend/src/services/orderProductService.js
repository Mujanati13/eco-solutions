const { pool } = require('../../config/database');

class OrderProductService {
  
  // Get orders with their products
  static async getOrdersWithProducts(filters = {}) {
    try {
      const { order_id, product_id, status, customer_name } = filters;
      
      let whereClause = '1=1';
      const queryParams = [];
      
      if (order_id) {
        whereClause += ' AND o.id = ?';
        queryParams.push(order_id);
      }
      
      if (product_id) {
        whereClause += ' AND oi.product_id = ?';
        queryParams.push(product_id);
      }
      
      if (status) {
        whereClause += ' AND o.status = ?';
        queryParams.push(status);
      }
      
      if (customer_name) {
        whereClause += ' AND o.customer_name LIKE ?';
        queryParams.push(`%${customer_name}%`);
      }
      
      const [results] = await pool.query(`
        SELECT 
          o.id as order_id,
          o.order_number,
          o.customer_name,
          o.customer_phone,
          o.customer_address,
          o.customer_city,
          o.total_amount,
          o.status,
          o.payment_status,
          o.delivery_date,
          o.created_at as order_date,
          o.updated_at as last_updated,
          
          -- Order items details
          oi.id as order_item_id,
          oi.product_id,
          oi.product_sku,
          oi.product_name,
          oi.quantity,
          oi.unit_price,
          oi.total_price,
          
          -- Current product details
          p.name as current_product_name,
          p.sku as current_sku,
          p.selling_price as current_selling_price,
          p.cost_price as current_cost_price,
          p.is_active as product_is_active,
          
          -- Current stock level
          COALESCE(SUM(sl.quantity_available), 0) as current_stock,
          
          -- Stock alert level
          CASE 
            WHEN COALESCE(SUM(sl.quantity_available), 0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(sl.quantity_available), 0) <= 5 THEN 'low_stock'
            WHEN COALESCE(SUM(sl.quantity_available), 0) <= 10 THEN 'medium_stock'
            ELSE 'in_stock'
          END as stock_alert_level,
          
          -- Category information
          COALESCE(c.name, p.category) as category_name
          
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${whereClause}
        GROUP BY o.id, oi.id
        ORDER BY o.created_at DESC, oi.id
      `, queryParams);
      
      // Group results by order
      const ordersMap = new Map();
      
      results.forEach(row => {
        if (!ordersMap.has(row.order_id)) {
          ordersMap.set(row.order_id, {
            order_id: row.order_id,
            order_number: row.order_number,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            customer_address: row.customer_address,
            customer_city: row.customer_city,
            total_amount: row.total_amount,
            status: row.status,
            payment_status: row.payment_status,
            delivery_date: row.delivery_date,
            order_date: row.order_date,
            last_updated: row.last_updated,
            items: []
          });
        }
        
        if (row.order_item_id) {
          ordersMap.get(row.order_id).items.push({
            order_item_id: row.order_item_id,
            product_id: row.product_id,
            product_sku: row.product_sku,
            product_name: row.product_name,
            quantity: row.quantity,
            unit_price: row.unit_price,
            total_price: row.total_price,
            current_product_name: row.current_product_name,
            current_sku: row.current_sku,
            current_selling_price: row.current_selling_price,
            current_cost_price: row.current_cost_price,
            product_is_active: row.product_is_active,
            current_stock: row.current_stock,
            stock_alert_level: row.stock_alert_level,
            category_name: row.category_name
          });
        }
      });
      
      return Array.from(ordersMap.values());
      
    } catch (error) {
      console.error('Get orders with products error:', error);
      throw error;
    }
  }
  
  // Get products with their orders
  static async getProductsWithOrders(filters = {}) {
    try {
      const { product_id, sku, status, date_from, date_to } = filters;
      
      let whereClause = '1=1';
      const queryParams = [];
      
      if (product_id) {
        whereClause += ' AND p.id = ?';
        queryParams.push(product_id);
      }
      
      if (sku) {
        whereClause += ' AND p.sku LIKE ?';
        queryParams.push(`%${sku}%`);
      }
      
      if (status) {
        whereClause += ' AND o.status = ?';
        queryParams.push(status);
      }
      
      if (date_from) {
        whereClause += ' AND DATE(o.created_at) >= ?';
        queryParams.push(date_from);
      }
      
      if (date_to) {
        whereClause += ' AND DATE(o.created_at) <= ?';
        queryParams.push(date_to);
      }
      
      const [results] = await pool.query(`
        SELECT 
          p.id as product_id,
          p.sku,
          p.name as product_name,
          p.description,
          p.selling_price,
          p.cost_price,
          p.is_active,
          
          -- Stock information
          COALESCE(SUM(DISTINCT sl.quantity_available), 0) as current_stock,
          
          -- Category information
          COALESCE(c.name, p.category) as category_name,
          
          -- Order statistics
          COUNT(DISTINCT oi.order_id) as total_orders,
          COALESCE(SUM(oi.quantity), 0) as total_quantity_sold,
          COALESCE(SUM(oi.total_price), 0) as total_revenue,
          
          -- Recent orders
          GROUP_CONCAT(
            DISTINCT CONCAT(o.order_number, '|', o.status, '|', oi.quantity, '|', o.created_at)
            ORDER BY o.created_at DESC
            SEPARATOR ';'
          ) as recent_orders_data
          
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${whereClause}
        GROUP BY p.id
        ORDER BY total_quantity_sold DESC, p.name
      `, queryParams);
      
      // Process recent orders data
      const processedResults = results.map(row => {
        let recent_orders = [];
        
        if (row.recent_orders_data) {
          recent_orders = row.recent_orders_data.split(';').map(orderData => {
            const [order_number, status, quantity, created_at] = orderData.split('|');
            return {
              order_number,
              status,
              quantity: parseInt(quantity),
              order_date: created_at
            };
          }).slice(0, 5); // Limit to 5 most recent orders
        }
        
        return {
          product_id: row.product_id,
          sku: row.sku,
          product_name: row.product_name,
          description: row.description,
          selling_price: row.selling_price,
          cost_price: row.cost_price,
          is_active: row.is_active,
          current_stock: row.current_stock,
          category_name: row.category_name,
          total_orders: row.total_orders,
          total_quantity_sold: row.total_quantity_sold,
          total_revenue: row.total_revenue,
          recent_orders
        };
      });
      
      return processedResults;
      
    } catch (error) {
      console.error('Get products with orders error:', error);
      throw error;
    }
  }
  
  // Add item to order
  static async addItemToOrder(orderId, itemData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const { product_id, quantity, unit_price } = itemData;
      
      // Get product details
      const [products] = await connection.query(`
        SELECT sku, name FROM products WHERE id = ?
      `, [product_id]);
      
      if (products.length === 0) {
        throw new Error('Product not found');
      }
      
      const product = products[0];
      const total_price = quantity * unit_price;
      
      // Insert order item
      const [result] = await connection.query(`
        INSERT INTO order_items (order_id, product_id, product_sku, product_name, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [orderId, product_id, product.sku, product.name, quantity, unit_price, total_price]);
      
      // Update order total
      await connection.query(`
        UPDATE orders 
        SET total_amount = (
          SELECT SUM(total_price) FROM order_items WHERE order_id = ?
        ),
        updated_at = NOW()
        WHERE id = ?
      `, [orderId, orderId]);
      
      await connection.commit();
      return result.insertId;
      
    } catch (error) {
      await connection.rollback();
      console.error('Add item to order error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // Remove item from order
  static async removeItemFromOrder(orderItemId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Get order ID before deleting item
      const [items] = await connection.query(`
        SELECT order_id FROM order_items WHERE id = ?
      `, [orderItemId]);
      
      if (items.length === 0) {
        throw new Error('Order item not found');
      }
      
      const orderId = items[0].order_id;
      
      // Delete order item
      await connection.query(`
        DELETE FROM order_items WHERE id = ?
      `, [orderItemId]);
      
      // Update order total
      await connection.query(`
        UPDATE orders 
        SET total_amount = COALESCE((
          SELECT SUM(total_price) FROM order_items WHERE order_id = ?
        ), 0),
        updated_at = NOW()
        WHERE id = ?
      `, [orderId, orderId]);
      
      await connection.commit();
      return true;
      
    } catch (error) {
      await connection.rollback();
      console.error('Remove item from order error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
  
  // Get order statistics
  static async getOrderProductStatistics(dateFrom = null, dateTo = null) {
    try {
      let dateClause = '';
      const queryParams = [];
      
      if (dateFrom) {
        dateClause += ' AND DATE(o.created_at) >= ?';
        queryParams.push(dateFrom);
      }
      
      if (dateTo) {
        dateClause += ' AND DATE(o.created_at) <= ?';
        queryParams.push(dateTo);
      }
      
      const [stats] = await pool.query(`
        SELECT 
          COUNT(DISTINCT o.id) as total_orders,
          COUNT(DISTINCT oi.product_id) as unique_products_ordered,
          SUM(oi.quantity) as total_items_sold,
          SUM(oi.total_price) as total_revenue,
          AVG(oi.unit_price) as avg_unit_price,
          
          -- Top selling product
          (SELECT p.name 
           FROM products p 
           JOIN order_items oi2 ON p.id = oi2.product_id
           JOIN orders o2 ON oi2.order_id = o2.id
           WHERE 1=1 ${dateClause}
           GROUP BY p.id 
           ORDER BY SUM(oi2.quantity) DESC 
           LIMIT 1) as top_selling_product,
           
          -- Orders by status
          SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
          SUM(CASE WHEN o.status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
          SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
          
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE 1=1 ${dateClause}
      `, [...queryParams, ...queryParams]);
      
      return stats[0];
      
    } catch (error) {
      console.error('Get order product statistics error:', error);
      throw error;
    }
  }
}

module.exports = OrderProductService;
