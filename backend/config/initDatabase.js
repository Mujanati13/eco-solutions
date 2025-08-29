const { pool } = require('../config/database');

class Database {
  // Initialize database schema
  static async initializeSchema() {
    try {
      console.log('🔄 Initializing database schema...');

      // Users table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY AUTO_INCREMENT,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          first_name VARCHAR(50) NOT NULL,
          last_name VARCHAR(50) NOT NULL,
          role ENUM('admin', 'employee') DEFAULT 'employee',
          phone VARCHAR(20),
          is_active BOOLEAN DEFAULT true,
          performance_score DECIMAL(3,2) DEFAULT 0.00,
          total_orders_handled INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_username (username),
          INDEX idx_email (email),
          INDEX idx_role (role)
        )
      `);

      // Orders table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_number VARCHAR(50) UNIQUE NOT NULL,
          customer_name VARCHAR(100) NOT NULL,
          customer_phone VARCHAR(20) NOT NULL,
          customer_address TEXT NOT NULL,
          customer_city VARCHAR(50) NOT NULL,
          product_details JSON NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          status ENUM('pending', 'confirmed', 'import_to_delivery_company', 'processing', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'on_hold', '0_tent', '1_tent', '2_tent', '3_tent', '4_tent', '5_tent', '6_tent') DEFAULT 'pending',
          payment_status ENUM('unpaid', 'cod_pending', 'paid') DEFAULT 'unpaid',
          assigned_to INT,
          confirmed_by INT,
          delivery_date DATE,
          notes TEXT,
          google_sheets_row INT,
          ecotrack_tracking_id VARCHAR(100),
          ecotrack_status VARCHAR(255),
          ecotrack_last_update TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_order_number (order_number),
          INDEX idx_status (status),
          INDEX idx_assigned_to (assigned_to),
          INDEX idx_created_at (created_at)
        )
      `);

      // Sessions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_token_hash (token_hash),
          INDEX idx_expires_at (expires_at)
        )
      `);

      // Tracking logs table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tracking_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_id INT NOT NULL,
          user_id INT,
          action VARCHAR(50) NOT NULL,
          previous_status VARCHAR(50),
          new_status VARCHAR(50),
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_order_id (order_id),
          INDEX idx_user_id (user_id),
          INDEX idx_action (action),
          INDEX idx_created_at (created_at)
        )
      `);

      // Performance metrics table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          date DATE NOT NULL,
          orders_assigned INT DEFAULT 0,
          orders_confirmed INT DEFAULT 0,
          orders_delivered INT DEFAULT 0,
          confirmation_rate DECIMAL(5,2) DEFAULT 0.00,
          delivery_rate DECIMAL(5,2) DEFAULT 0.00,
          avg_confirmation_time INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_date (user_id, date),
          INDEX idx_user_id (user_id),
          INDEX idx_date (date)
        )
      `);

      // User sessions table for session time tracking
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          session_token VARCHAR(255) NOT NULL,
          login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          logout_time TIMESTAMP NULL,
          session_duration INT NULL COMMENT 'Duration in seconds',
          ip_address VARCHAR(45),
          user_agent TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_session_token (session_token),
          INDEX idx_login_time (login_time),
          INDEX idx_is_active (is_active)
        )
      `);

      // Activity logs table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          session_id INT,
          activity_type ENUM('login', 'logout', 'order_create', 'order_update', 'order_delete', 'order_assign', 'order_import', 'order_export', 'user_update', 'export', 'view_page', 'search', 'filter', 'other') NOT NULL,
          activity_description TEXT,
          entity_type VARCHAR(50) COMMENT 'Type of entity affected (order, user, etc.)',
          entity_id INT COMMENT 'ID of the entity affected',
          metadata JSON COMMENT 'Additional activity metadata',
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE SET NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_session_id (session_id),
          INDEX idx_activity_type (activity_type),
          INDEX idx_entity_type (entity_type),
          INDEX idx_created_at (created_at)
        )
      `);

      // Real-time session tracking table for exact time calculations
      await pool.query(`
        CREATE TABLE IF NOT EXISTS real_time_sessions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          session_id INT NOT NULL,
          date DATE NOT NULL,
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP NULL,
          duration_seconds INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          page_views INT DEFAULT 0,
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          socket_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_session_id (session_id),
          INDEX idx_date (date),
          INDEX idx_socket_id (socket_id),
          INDEX idx_is_active (is_active),
          UNIQUE KEY unique_user_session_date (user_id, session_id, date)
        )
      `);

      // Daily session summary table for aggregated data
      await pool.query(`
        CREATE TABLE IF NOT EXISTS daily_session_summary (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          date DATE NOT NULL,
          total_session_time INT DEFAULT 0 COMMENT 'Total time in seconds',
          session_count INT DEFAULT 0,
          page_views INT DEFAULT 0,
          first_login TIME,
          last_logout TIME,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_date (user_id, date),
          INDEX idx_user_id (user_id),
          INDEX idx_date (date)
        )
      `);

      console.log('✅ Database schema initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing database schema:', error);
      throw error;
    }
  }

  // Update orders table schema to add missing status values
  static async updateOrdersSchema() {
    try {
      console.log('🔄 Updating orders table schema...');
      
      // Add missing status values to the enum including tent statuses
      await pool.query(`
  ALTER TABLE orders MODIFY COLUMN status 
  ENUM('pending', 'confirmed', 'import_to_delivery_company', 'processing', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'on_hold', '0_tent', '1_tent', '2_tent', '3_tent', '4_tent', '5_tent', '6_tent') 
        DEFAULT 'pending'
      `);
      
      console.log('✅ Orders table schema updated successfully');
    } catch (error) {
      console.error('❌ Error updating orders schema:', error);
      // Don't throw error as this might fail if columns already exist
    }
  }

  // Add Ecotrack tracking fields if they don't exist
  static async updateEcotrackFields() {
    try {
      console.log('🔄 Adding Ecotrack tracking fields...');

      // Check if columns exist before adding them
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
      `, [process.env.DB_NAME]);

      const existingColumns = columns.map(col => col.COLUMN_NAME);
      
      // Add ecotrack_status if it doesn't exist
      if (!existingColumns.includes('ecotrack_status')) {
        await pool.query('ALTER TABLE orders ADD COLUMN ecotrack_status VARCHAR(50) DEFAULT NULL');
        console.log('✅ Added ecotrack_status column');
      }
      
      // Add ecotrack_last_update if it doesn't exist
      if (!existingColumns.includes('ecotrack_last_update')) {
        await pool.query('ALTER TABLE orders ADD COLUMN ecotrack_last_update TIMESTAMP NULL');
        console.log('✅ Added ecotrack_last_update column');
      }
      
      // Add ecotrack_location if it doesn't exist
      if (!existingColumns.includes('ecotrack_location')) {
        await pool.query('ALTER TABLE orders ADD COLUMN ecotrack_location VARCHAR(255) DEFAULT NULL');
        console.log('✅ Added ecotrack_location column');
      }
      
      // Add tracking_url if it doesn't exist
      if (!existingColumns.includes('tracking_url')) {
        await pool.query('ALTER TABLE orders ADD COLUMN tracking_url VARCHAR(500) DEFAULT NULL');
        console.log('✅ Added tracking_url column');
      }

      console.log('✅ Ecotrack tracking fields check completed');
    } catch (error) {
      console.error('❌ Error adding Ecotrack fields:', error.message);
      // Don't throw error as this might fail if columns already exist
    }
  }

  // Create default admin user
  static async createDefaultAdmin() {
    try {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);

      await pool.query(`
        INSERT IGNORE INTO users (username, email, password, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['admin', 'admin@eco-s.com', hashedPassword, 'System', 'Administrator', 'admin']);

      console.log('✅ Default admin user created (username: admin, password: admin123)');
    } catch (error) {
      console.error('❌ Error creating default admin:', error);
    }
  }
}

module.exports = Database;
