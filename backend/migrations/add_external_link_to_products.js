const mysql = require('mysql2/promise');
require('dotenv').config();

// Migration to add external_link column to products table
const addExternalLinkToProducts = async () => {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'eco_s_orders',
      port: process.env.DB_PORT || 3306,
      charset: 'utf8mb4'
    });

    console.log('🔄 Adding external_link column to products table...');

    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'products' 
        AND COLUMN_NAME = 'external_link'
    `);

    if (columns.length > 0) {
      console.log('ℹ️  external_link column already exists in products table');
      return;
    }

    // Add external_link column
    await connection.execute(`
      ALTER TABLE products 
      ADD COLUMN external_link VARCHAR(512) NULL 
      AFTER description
    `);

    console.log('✅ Successfully added external_link column to products table');

    // Verify the column was added
    const [updatedColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'products' 
        AND COLUMN_NAME = 'external_link'
    `);

    if (updatedColumns.length > 0) {
      console.log('📋 Column details:', updatedColumns[0]);
    }

  } catch (error) {
    console.error('❌ Error adding external_link column:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run the migration if called directly
if (require.main === module) {
  addExternalLinkToProducts()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addExternalLinkToProducts };
