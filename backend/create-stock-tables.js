const mysql = require('mysql2/promise');
require('dotenv').config();

async function createStockTables() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'eco_s_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('🔄 Creating stock management tables...');

    // Step 1: Create products table
    console.log('📦 Creating products table...');
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
    console.log('🏢 Creating stock_locations table...');
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

    // Step 3: Create stock_levels table (current stock at each location)
    console.log('📊 Creating stock_levels table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_levels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        location_id INT NOT NULL,
        quantity INT DEFAULT 0,
        reserved_quantity INT DEFAULT 0,
        available_quantity INT GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
        last_movement_date TIMESTAMP NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE CASCADE,
        UNIQUE KEY unique_product_location (product_id, location_id),
        INDEX idx_product_id (product_id),
        INDEX idx_location_id (location_id),
        INDEX idx_available_quantity (available_quantity)
      )
    `);

    // Step 4: Create stock_movements table (audit trail for all stock changes)
    console.log('📋 Creating stock_movements table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        location_id INT NOT NULL,
        movement_type ENUM('in', 'out', 'adjustment', 'transfer_in', 'transfer_out') NOT NULL,
        reason ENUM('purchase', 'sale', 'adjustment', 'transfer', 'damage', 'theft', 'correction', 'initial') NOT NULL,
        quantity INT NOT NULL,
        quantity_before INT NOT NULL,
        quantity_after INT NOT NULL,
        unit_cost DECIMAL(10,2) DEFAULT 0.00,
        reference_type ENUM('order', 'purchase_order', 'manual', 'system') DEFAULT 'manual',
        reference_id INT NULL,
        reference_number VARCHAR(100),
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_product_id (product_id),
        INDEX idx_location_id (location_id),
        INDEX idx_movement_type (movement_type),
        INDEX idx_reason (reason),
        INDEX idx_created_at (created_at),
        INDEX idx_reference (reference_type, reference_id)
      )
    `);

    // Step 5: Create purchase_orders table
    console.log('🛒 Creating purchase_orders table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        po_number VARCHAR(100) UNIQUE NOT NULL,
        supplier_name VARCHAR(255) NOT NULL,
        supplier_contact TEXT,
        status ENUM('draft', 'pending', 'approved', 'ordered', 'received', 'cancelled') DEFAULT 'draft',
        order_date DATE NOT NULL,
        expected_delivery_date DATE,
        actual_delivery_date DATE,
        total_amount DECIMAL(12,2) DEFAULT 0.00,
        notes TEXT,
        created_by INT,
        approved_by INT,
        received_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_po_number (po_number),
        INDEX idx_status (status),
        INDEX idx_order_date (order_date),
        INDEX idx_supplier_name (supplier_name)
      )
    `);

    // Step 6: Create purchase_order_items table
    console.log('📝 Creating purchase_order_items table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        purchase_order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity_ordered INT NOT NULL,
        quantity_received INT DEFAULT 0,
        unit_cost DECIMAL(10,2) NOT NULL,
        total_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
        location_id INT NOT NULL,
        notes TEXT,
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE CASCADE,
        INDEX idx_purchase_order_id (purchase_order_id),
        INDEX idx_product_id (product_id),
        INDEX idx_location_id (location_id)
      )
    `);

    // Step 7: Update orders table to link with products
    console.log('🔗 Updating orders table to link with products...');
    
    // Check if columns exist first
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
    `);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    
    if (!existingColumns.includes('product_id')) {
      await pool.query('ALTER TABLE orders ADD COLUMN product_id INT');
      console.log('✅ Added product_id column to orders table');
    }
    
    if (!existingColumns.includes('quantity_ordered')) {
      await pool.query('ALTER TABLE orders ADD COLUMN quantity_ordered INT DEFAULT 1');
      console.log('✅ Added quantity_ordered column to orders table');
    }

    // Add index
    try {
      await pool.query('ALTER TABLE orders ADD INDEX idx_product_id (product_id)');
      console.log('✅ Added index on product_id');
    } catch (error) {
      console.log('⚠️  Index on product_id might already exist');
    }

    // Try to add foreign key (this might fail if data integrity issues exist)
    try {
      await pool.query(`
        ALTER TABLE orders 
        ADD CONSTRAINT fk_orders_product 
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      `);
      console.log('✅ Added foreign key constraint for orders.product_id');
    } catch (error) {
      console.log('⚠️  Note: Could not add foreign key constraint for orders.product_id (existing data may have integrity issues)');
    }

    // Step 8: Create default stock location
    console.log('🏪 Creating default stock location...');
    await pool.query(`
      INSERT IGNORE INTO stock_locations (name, type, address, is_active) 
      VALUES ('Main Warehouse', 'warehouse', 'Default warehouse location', true)
    `);

    // Step 9: Create some sample products
    console.log('📦 Creating sample products...');
    const sampleProducts = [
      { sku: 'PROD-001', name: 'Sample Product 1', category: 'Electronics', selling_price: 29.99, cost_price: 15.00 },
      { sku: 'PROD-002', name: 'Sample Product 2', category: 'Clothing', selling_price: 49.99, cost_price: 25.00 },
      { sku: 'PROD-003', name: 'Sample Product 3', category: 'Home & Garden', selling_price: 19.99, cost_price: 10.00 }
    ];

    for (const product of sampleProducts) {
      try {
        await pool.query(`
          INSERT IGNORE INTO products (sku, name, category, selling_price, cost_price, minimum_stock_level) 
          VALUES (?, ?, ?, ?, ?, ?)
        `, [product.sku, product.name, product.category, product.selling_price, product.cost_price, 10]);
      } catch (error) {
        console.log(`⚠️  Could not create sample product ${product.sku}`);
      }
    }

    console.log('✅ Stock management tables created successfully!');
    console.log('📊 Database structure is ready for stock management operations.');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Failed to create stock tables:', error);
    await pool.end();
    process.exit(1);
  }
}

createStockTables();
