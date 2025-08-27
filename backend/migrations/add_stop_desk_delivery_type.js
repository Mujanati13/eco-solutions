const mysql = require('mysql2/promise');
require('dotenv').config();

// Migration to add 'stop_desk' to delivery_type ENUM
const addStopDeskDeliveryType = async () => {
  let connection;
  
  try {
    // Create database connection using same config as backend
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'eco_s_db',
      port: process.env.DB_PORT || 3306,
      charset: 'utf8mb4'
    });

    console.log('🔄 Starting delivery_type ENUM update to add "stop_desk"...');

    // Check current ENUM values for orders table
    const [ordersColumns] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'delivery_type'
    `);

    if (ordersColumns.length > 0) {
      console.log('📋 Current orders.delivery_type ENUM:', ordersColumns[0].COLUMN_TYPE);
      
      // Check if stop_desk is already in the ENUM
      if (ordersColumns[0].COLUMN_TYPE.includes('stop_desk')) {
        console.log('✅ stop_desk already exists in orders.delivery_type ENUM');
      } else {
        // Update orders table delivery_type ENUM
        await connection.execute(`
          ALTER TABLE orders 
          MODIFY COLUMN delivery_type ENUM(
            'home', 
            'office', 
            'pickup_point', 
            'express', 
            'standard', 
            'overnight', 
            'weekend', 
            'economy',
            'les_changes',
            'stop_desk'
          ) DEFAULT 'home'
        `);
        console.log('✅ Updated orders.delivery_type ENUM to include "stop_desk"');
      }
    }

    // Check current ENUM values for delivery_pricing table
    const [pricingColumns] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'delivery_pricing' 
        AND COLUMN_NAME = 'delivery_type'
    `);

    if (pricingColumns.length > 0) {
      console.log('📋 Current delivery_pricing.delivery_type ENUM:', pricingColumns[0].COLUMN_TYPE);
      
      // Check if stop_desk is already in the ENUM
      if (pricingColumns[0].COLUMN_TYPE.includes('stop_desk')) {
        console.log('✅ stop_desk already exists in delivery_pricing.delivery_type ENUM');
      } else {
        // Update delivery_pricing table delivery_type ENUM
        await connection.execute(`
          ALTER TABLE delivery_pricing 
          MODIFY COLUMN delivery_type ENUM(
            'home', 
            'office', 
            'pickup_point', 
            'express', 
            'standard', 
            'overnight', 
            'weekend', 
            'economy',
            'les_changes',
            'stop_desk'
          ) DEFAULT 'home'
        `);
        console.log('✅ Updated delivery_pricing.delivery_type ENUM to include "stop_desk"');
      }
    }

    // Verify the changes
    const [updatedOrdersColumns] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'delivery_type'
    `);

    const [updatedPricingColumns] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'delivery_pricing' 
        AND COLUMN_NAME = 'delivery_type'
    `);

    console.log('🔍 Verification:');
    console.log('📋 Updated orders.delivery_type ENUM:', updatedOrdersColumns[0]?.COLUMN_TYPE);
    console.log('📋 Updated delivery_pricing.delivery_type ENUM:', updatedPricingColumns[0]?.COLUMN_TYPE);

    console.log('✅ "stop_desk" delivery type migration completed successfully');

  } catch (error) {
    console.error('❌ Error adding "stop_desk" delivery type:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run the migration if called directly
if (require.main === module) {
  addStopDeskDeliveryType()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addStopDeskDeliveryType };