const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eco_s_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

async function addFrenchExcelColumns() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('🔄 Adding French Excel format columns to orders table...');
    
    // Check if columns already exist
    const [existing] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME IN ('wilaya_code', 'weight', 'metro_delivery', 'customer_phone_2')
    `, [dbConfig.database]);
    
    const existingColumns = existing.map(row => row.COLUMN_NAME);
    
    // Add wilaya_code column if it doesn't exist
    if (!existingColumns.includes('wilaya_code')) {
      await connection.query(`
        ALTER TABLE orders 
        ADD COLUMN wilaya_code VARCHAR(10) NULL COMMENT 'Code wilaya for delivery'
      `);
      console.log('✅ Added wilaya_code column');
    }
    
    // Add weight column if it doesn't exist
    if (!existingColumns.includes('weight')) {
      await connection.query(`
        ALTER TABLE orders 
        ADD COLUMN weight DECIMAL(8,2) DEFAULT 0 COMMENT 'Package weight in kg'
      `);
      console.log('✅ Added weight column');
    }
    
    // Add metro_delivery column if it doesn't exist
    if (!existingColumns.includes('metro_delivery')) {
      await connection.query(`
        ALTER TABLE orders 
        ADD COLUMN metro_delivery BOOLEAN DEFAULT FALSE COMMENT 'Metro delivery option'
      `);
      console.log('✅ Added metro_delivery column');
    }
    
    // Add customer_phone_2 column if it doesn't exist
    if (!existingColumns.includes('customer_phone_2')) {
      await connection.query(`
        ALTER TABLE orders 
        ADD COLUMN customer_phone_2 VARCHAR(20) NULL COMMENT 'Secondary phone number'
      `);
      console.log('✅ Added customer_phone_2 column');
    }
    
    console.log('🎉 French Excel format columns migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  addFrenchExcelColumns()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addFrenchExcelColumns };
