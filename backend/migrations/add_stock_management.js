const { pool } = require('../config/database');

class StockManagementMigration {
  static async up() {
    try {
      console.log('🔄 Starting stock management migration...');

      // Step 1: Create products table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id INT PRIMARY KEY AUTO_INCREMENT,
          sku VARCHAR(100) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(100),
          brand VARCHAR(100),
          unit_of_measure ENUM('piece', 'kg', 'liter', 'meter', 'box', 'pack') DEFAULT 'piece',
          cost_price DECIMAL(10,2) DEFAULT 0.00,
          selling_price DECIMAL(10,2) DEFAULT 0.00,
          minimum_stock_level INT DEFAULT 0,
          maximum_stock_level INT DEFAULT NULL,
          is_active BOOLEAN DEFAULT true,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_sku (sku),
          INDEX idx_name (name),
          INDEX idx_category (category),
          INDEX idx_brand (brand),
          INDEX idx_is_active (is_active)
        )
      `);

      // Step 2: Create stock_locations table (warehouses, stores, etc.)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS stock_locations (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          type ENUM('warehouse', 'store', 'supplier', 'customer', 'damaged', 'other') DEFAULT 'warehouse',
          address TEXT,
          contact_person VARCHAR(255),
          phone VARCHAR(20),
          email VARCHAR(100),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_name (name),
          INDEX idx_type (type),
          INDEX idx_is_active (is_active)
        )
      `);

      // Step 3: Create stock_levels table (current stock in each location)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS stock_levels (
          id INT PRIMARY KEY AUTO_INCREMENT,
          product_id INT NOT NULL,
          location_id INT NOT NULL,
          quantity_available INT DEFAULT 0,
          quantity_reserved INT DEFAULT 0,
          quantity_ordered INT DEFAULT 0,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE CASCADE,
          UNIQUE KEY unique_product_location (product_id, location_id),
          INDEX idx_product_id (product_id),
          INDEX idx_location_id (location_id),
          INDEX idx_quantity_available (quantity_available)
        )
      `);

      // Step 4: Create stock_movements table (all stock transactions)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id INT PRIMARY KEY AUTO_INCREMENT,
          product_id INT NOT NULL,
          location_id INT NOT NULL,
          movement_type ENUM('in', 'out', 'transfer', 'adjustment') NOT NULL,
          quantity INT NOT NULL,
          unit_cost DECIMAL(10,2) DEFAULT 0.00,
          reference_type ENUM('purchase', 'sale', 'transfer', 'adjustment', 'return', 'damaged', 'order') DEFAULT NULL,
          reference_id INT DEFAULT NULL COMMENT 'ID of related order, purchase, etc.',
          notes TEXT,
          batch_number VARCHAR(100),
          expiry_date DATE,
          performed_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE CASCADE,
          FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_product_id (product_id),
          INDEX idx_location_id (location_id),
          INDEX idx_movement_type (movement_type),
          INDEX idx_reference_type (reference_type),
          INDEX idx_reference_id (reference_id),
          INDEX idx_created_at (created_at),
          INDEX idx_batch_number (batch_number)
        )
      `);

      // Step 5: Create purchase_orders table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id INT PRIMARY KEY AUTO_INCREMENT,
          po_number VARCHAR(100) UNIQUE NOT NULL,
          supplier_name VARCHAR(255) NOT NULL,
          supplier_contact TEXT,
          status ENUM('draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled') DEFAULT 'draft',
          total_amount DECIMAL(12,2) DEFAULT 0.00,
          notes TEXT,
          expected_delivery_date DATE,
          created_by INT,
          approved_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_po_number (po_number),
          INDEX idx_status (status),
          INDEX idx_supplier_name (supplier_name),
          INDEX idx_created_at (created_at)
        )
      `);

      // Step 6: Create purchase_order_items table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id INT PRIMARY KEY AUTO_INCREMENT,
          purchase_order_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity_ordered INT NOT NULL,
          quantity_received INT DEFAULT 0,
          unit_cost DECIMAL(10,2) NOT NULL,
          total_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
          notes TEXT,
          FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          INDEX idx_purchase_order_id (purchase_order_id),
          INDEX idx_product_id (product_id)
        )
      `);

      // Step 7: Update orders table to link with products
      await pool.query(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS stock_allocated_at TIMESTAMP NULL,
        ADD COLUMN IF NOT EXISTS stock_allocated_by INT,
        ADD INDEX IF NOT EXISTS idx_stock_reserved (stock_reserved)
      `);

      // Step 8: Create order_items table to track individual products in orders
      await pool.query(`
        CREATE TABLE IF NOT EXISTS order_items (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
          stock_reserved INT DEFAULT 0,
          notes TEXT,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          INDEX idx_order_id (order_id),
          INDEX idx_product_id (product_id)
        )
      `);

      console.log('✅ Stock management tables created successfully');

      // Step 9: Insert default stock location
      await this.insertDefaultData();

      // Step 10: Add stock management permissions
      await this.addStockPermissions();

      console.log('✅ Stock management migration completed successfully');

    } catch (error) {
      console.error('❌ Stock management migration failed:', error);
      throw error;
    }
  }

  static async insertDefaultData() {
    console.log('🔄 Inserting default stock data...');

    // Insert default warehouse location
    await pool.query(`
      INSERT IGNORE INTO stock_locations (name, type, address, is_active)
      VALUES (?, ?, ?, ?)
    `, ['Main Warehouse', 'warehouse', 'Main warehouse location', true]);

    console.log('✅ Default stock data inserted');
  }

  static async addStockPermissions() {
    console.log('🔄 Adding stock management permissions...');

    const permissions = [
      // Product Management Permissions
      { name: 'canViewProducts', category: 'stock', description: 'View products and inventory' },
      { name: 'canCreateProducts', category: 'stock', description: 'Create new products' },
      { name: 'canEditProducts', category: 'stock', description: 'Edit product details' },
      { name: 'canDeleteProducts', category: 'stock', description: 'Delete products' },
      
      // Stock Management Permissions
      { name: 'canViewStock', category: 'stock', description: 'View stock levels and movements' },
      { name: 'canManageStock', category: 'stock', description: 'Adjust stock levels' },
      { name: 'canTransferStock', category: 'stock', description: 'Transfer stock between locations' },
      { name: 'canViewStockReports', category: 'stock', description: 'View stock reports and analytics' },
      
      // Purchase Order Permissions
      { name: 'canViewPurchaseOrders', category: 'stock', description: 'View purchase orders' },
      { name: 'canCreatePurchaseOrders', category: 'stock', description: 'Create purchase orders' },
      { name: 'canApprovePurchaseOrders', category: 'stock', description: 'Approve purchase orders' },
      { name: 'canReceiveStock', category: 'stock', description: 'Receive stock from suppliers' },
    ];

    for (const permission of permissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO permissions (name, category, description) VALUES (?, ?, ?)',
          [permission.name, permission.category, permission.description]
        );
      } catch (error) {
        console.error(`Failed to insert permission ${permission.name}:`, error);
      }
    }

    // Add stock permissions to admin role
    const adminPermissions = [
      'canViewProducts', 'canCreateProducts', 'canEditProducts', 'canDeleteProducts',
      'canViewStock', 'canManageStock', 'canTransferStock', 'canViewStockReports',
      'canViewPurchaseOrders', 'canCreatePurchaseOrders', 'canApprovePurchaseOrders', 'canReceiveStock'
    ];

    for (const permission of adminPermissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
          ['admin', permission]
        );
      } catch (error) {
        console.error(`Failed to assign permission ${permission} to admin:`, error);
      }
    }

    // Add basic stock permissions to supervisor role
    const supervisorPermissions = [
      'canViewProducts', 'canCreateProducts', 'canEditProducts',
      'canViewStock', 'canManageStock', 'canTransferStock', 'canViewStockReports',
      'canViewPurchaseOrders', 'canCreatePurchaseOrders', 'canReceiveStock'
    ];

    for (const permission of supervisorPermissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
          ['supervisor', permission]
        );
      } catch (error) {
        console.error(`Failed to assign permission ${permission} to supervisor:`, error);
      }
    }

    // Add basic viewing permissions to employee role
    const employeePermissions = [
      'canViewProducts', 'canViewStock'
    ];

    for (const permission of employeePermissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
          ['employee', permission]
        );
      } catch (error) {
        console.error(`Failed to assign permission ${permission} to employee:`, error);
      }
    }

    console.log('✅ Stock management permissions added');
  }

  static async down() {
    try {
      console.log('🔄 Rolling back stock management migration...');

      // Drop tables in reverse order (due to foreign key constraints)
      await pool.query('DROP TABLE IF EXISTS order_items');
      await pool.query('DROP TABLE IF EXISTS purchase_order_items');
      await pool.query('DROP TABLE IF EXISTS purchase_orders');
      await pool.query('DROP TABLE IF EXISTS stock_movements');
      await pool.query('DROP TABLE IF EXISTS stock_levels');
      await pool.query('DROP TABLE IF EXISTS stock_locations');
      await pool.query('DROP TABLE IF EXISTS products');

      // Remove added columns from orders table
      await pool.query('ALTER TABLE orders DROP COLUMN IF EXISTS stock_reserved');
      await pool.query('ALTER TABLE orders DROP COLUMN IF EXISTS stock_allocated_at');
      await pool.query('ALTER TABLE orders DROP COLUMN IF EXISTS stock_allocated_by');

      // Remove stock permissions
      const stockPermissions = [
        'canViewProducts', 'canCreateProducts', 'canEditProducts', 'canDeleteProducts',
        'canViewStock', 'canManageStock', 'canTransferStock', 'canViewStockReports',
        'canViewPurchaseOrders', 'canCreatePurchaseOrders', 'canApprovePurchaseOrders', 'canReceiveStock'
      ];

      for (const permission of stockPermissions) {
        await pool.query('DELETE FROM role_permissions WHERE permission_name = ?', [permission]);
        await pool.query('DELETE FROM user_permissions WHERE permission_name = ?', [permission]);
        await pool.query('DELETE FROM permissions WHERE name = ?', [permission]);
      }

      console.log('✅ Stock management migration rolled back successfully');
    } catch (error) {
      console.error('❌ Stock management rollback failed:', error);
      throw error;
    }
  }
}

module.exports = StockManagementMigration;
