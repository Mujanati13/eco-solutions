const mysql = require('mysql2/promise');
require('dotenv').config();

async function createCategoriesAndVariants() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'eco_s_orders',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('🔄 Creating categories and variants tables...');

    // Step 1: Create categories table
    console.log('📂 Creating categories table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_id INT NULL,
        level INT DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        sort_order INT DEFAULT 0,
        image_url VARCHAR(500),
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_name (name),
        INDEX idx_parent_id (parent_id),
        INDEX idx_level (level),
        INDEX idx_is_active (is_active),
        INDEX idx_sort_order (sort_order)
      )
    `);

    // Step 2: Create product_variants table
    console.log('🎨 Creating product_variants table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        variant_name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) UNIQUE NOT NULL,
        barcode VARCHAR(100),
        cost_price DECIMAL(10,2) DEFAULT 0.00,
        selling_price DECIMAL(10,2) DEFAULT 0.00,
        weight DECIMAL(8,3),
        dimensions VARCHAR(100),
        color VARCHAR(50),
        size VARCHAR(50),
        material VARCHAR(100),
        attributes JSON,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_id (product_id),
        INDEX idx_sku (sku),
        INDEX idx_variant_name (variant_name),
        INDEX idx_is_active (is_active),
        INDEX idx_color (color),
        INDEX idx_size (size)
      )
    `);

    // Step 3: Update products table to add category_id
    console.log('🔗 Updating products table to link with categories...');
    
    // Check if columns exist first
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
    `);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    
    if (!existingColumns.includes('category_id')) {
      await pool.query('ALTER TABLE products ADD COLUMN category_id INT');
      console.log('✅ Added category_id column to products table');
    }

    // Add index
    try {
      await pool.query('ALTER TABLE products ADD INDEX idx_category_id (category_id)');
      console.log('✅ Added index on category_id');
    } catch (error) {
      console.log('⚠️  Index on category_id might already exist');
    }

    // Try to add foreign key
    try {
      await pool.query(`
        ALTER TABLE products 
        ADD CONSTRAINT fk_products_category 
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      `);
      console.log('✅ Added foreign key constraint for products.category_id');
    } catch (error) {
      console.log('⚠️  Note: Could not add foreign key constraint for products.category_id (might already exist)');
    }

    // Step 4: Create variant_stock_levels table
    console.log('📊 Creating variant_stock_levels table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS variant_stock_levels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        variant_id INT NOT NULL,
        location_id INT NOT NULL,
        quantity INT DEFAULT 0,
        reserved_quantity INT DEFAULT 0,
        available_quantity INT GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
        minimum_stock_level INT DEFAULT 0,
        maximum_stock_level INT,
        last_movement_date TIMESTAMP NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE CASCADE,
        UNIQUE KEY unique_variant_location (variant_id, location_id),
        INDEX idx_variant_id (variant_id),
        INDEX idx_location_id (location_id),
        INDEX idx_available_quantity (available_quantity)
      )
    `);

    // Step 5: Create variant_stock_movements table
    console.log('📋 Creating variant_stock_movements table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS variant_stock_movements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        variant_id INT NOT NULL,
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
        FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
        FOREIGN KEY (location_id) REFERENCES stock_locations(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_variant_id (variant_id),
        INDEX idx_location_id (location_id),
        INDEX idx_movement_type (movement_type),
        INDEX idx_reason (reason),
        INDEX idx_created_at (created_at),
        INDEX idx_reference (reference_type, reference_id)
      )
    `);

    // Step 6: Create sample categories
    console.log('📂 Creating sample categories...');
    const sampleCategories = [
      { name: 'Electronics', description: 'Electronic devices and accessories', level: 1 },
      { name: 'Clothing', description: 'Clothing and apparel', level: 1 },
      { name: 'Home & Garden', description: 'Home and garden products', level: 1 },
      { name: 'Sports', description: 'Sports and outdoor equipment', level: 1 },
      { name: 'Books', description: 'Books and educational materials', level: 1 }
    ];

    for (const category of sampleCategories) {
      try {
        await pool.query(`
          INSERT IGNORE INTO categories (name, description, level, is_active) 
          VALUES (?, ?, ?, ?)
        `, [category.name, category.description, category.level, true]);
      } catch (error) {
        console.log(`⚠️  Could not create sample category ${category.name}`);
      }
    }

    // Step 7: Create subcategories
    console.log('📂 Creating sample subcategories...');
    const [electronicsCategory] = await pool.query(`
      SELECT id FROM categories WHERE name = 'Electronics' LIMIT 1
    `);

    if (electronicsCategory.length > 0) {
      const parentId = electronicsCategory[0].id;
      const subcategories = [
        { name: 'Smartphones', description: 'Mobile phones and accessories', parent_id: parentId, level: 2 },
        { name: 'Laptops', description: 'Laptops and notebooks', parent_id: parentId, level: 2 },
        { name: 'Accessories', description: 'Electronic accessories', parent_id: parentId, level: 2 }
      ];

      for (const subcategory of subcategories) {
        try {
          await pool.query(`
            INSERT IGNORE INTO categories (name, description, parent_id, level, is_active) 
            VALUES (?, ?, ?, ?, ?)
          `, [subcategory.name, subcategory.description, subcategory.parent_id, subcategory.level, true]);
        } catch (error) {
          console.log(`⚠️  Could not create subcategory ${subcategory.name}`);
        }
      }
    }

    console.log('✅ Categories and variants tables created successfully!');
    console.log('📊 Database structure is ready for category and variant management.');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Failed to create categories and variants tables:', error);
    await pool.end();
    process.exit(1);
  }
}

createCategoriesAndVariants();
