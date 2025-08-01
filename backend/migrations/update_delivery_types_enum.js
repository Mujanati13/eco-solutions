const mysql = require('mysql2/promise');

// Migration to update delivery_type ENUM to include new types
const updateDeliveryTypesEnum = async () => {
  let connection;
  
  try {
    // Create connection using environment variables or default values
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'eco_system',
      port: process.env.DB_PORT || 3306
    });

    console.log('🔄 Starting delivery_type ENUM update migration...');

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
          'economy'
        ) DEFAULT 'home'
      `);
      console.log('✅ Updated orders.delivery_type ENUM with new values');
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
          'economy'
        ) DEFAULT 'home'
      `);
      console.log('✅ Updated delivery_pricing.delivery_type ENUM with new values');
    }

    // Insert default pricing for new delivery types if they don't exist
    console.log('🔄 Adding default pricing for new delivery types...');
    
    // Get all existing wilayas
    const [wilayas] = await connection.execute('SELECT id FROM wilayas LIMIT 10');
    
    for (const wilaya of wilayas) {
      // Add pricing for new delivery types with reasonable defaults
      const newDeliveryTypes = [
        { type: 'express', basePrice: 500, additionalWeight: 50, minTime: 1, maxTime: 2, priority: 'high' },
        { type: 'standard', basePrice: 300, additionalWeight: 30, minTime: 2, maxTime: 5, priority: 'normal' },
        { type: 'overnight', basePrice: 800, additionalWeight: 80, minTime: 1, maxTime: 1, priority: 'high' },
        { type: 'weekend', basePrice: 600, additionalWeight: 60, minTime: 2, maxTime: 3, priority: 'normal' },
        { type: 'economy', basePrice: 200, additionalWeight: 20, minTime: 5, maxTime: 10, priority: 'low' }
      ];

      for (const deliveryType of newDeliveryTypes) {
        try {
          await connection.execute(`
            INSERT IGNORE INTO delivery_pricing 
            (wilaya_id, delivery_type, base_price, weight_threshold, additional_weight_price, 
             delivery_time_min, delivery_time_max, priority, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 1.0, ?, ?, ?, ?, true, NOW(), NOW())
          `, [
            wilaya.id,
            deliveryType.type,
            deliveryType.basePrice,
            deliveryType.additionalWeight,
            deliveryType.minTime,
            deliveryType.maxTime,
            deliveryType.priority
          ]);
        } catch (error) {
          // Ignore duplicate key errors
          if (!error.message.includes('Duplicate entry')) {
            console.error(`⚠️ Error adding ${deliveryType.type} pricing for wilaya ${wilaya.id}:`, error.message);
          }
        }
      }
    }

    console.log('✅ Added default pricing for new delivery types');

    // Verify the changes
    const [verifyOrders] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'orders' 
        AND COLUMN_NAME = 'delivery_type'
    `);

    const [verifyPricing] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'delivery_pricing' 
        AND COLUMN_NAME = 'delivery_type'
    `);

    console.log('📋 Final orders.delivery_type ENUM:', verifyOrders[0]?.COLUMN_TYPE);
    console.log('📋 Final delivery_pricing.delivery_type ENUM:', verifyPricing[0]?.COLUMN_TYPE);

    console.log('🎉 Delivery type ENUM update migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Function to rollback the migration
const rollbackDeliveryTypesEnum = async () => {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'eco_system',
      port: process.env.DB_PORT || 3306
    });

    console.log('🔄 Rolling back delivery_type ENUM to original values...');

    // Revert orders table delivery_type ENUM to original values
    await connection.execute(`
      ALTER TABLE orders 
      MODIFY COLUMN delivery_type ENUM('home', 'office', 'pickup_point') DEFAULT 'home'
    `);

    // Revert delivery_pricing table delivery_type ENUM to original values
    await connection.execute(`
      ALTER TABLE delivery_pricing 
      MODIFY COLUMN delivery_type ENUM('home', 'office', 'pickup_point') DEFAULT 'home'
    `);

    // Remove pricing entries for new delivery types
    await connection.execute(`
      DELETE FROM delivery_pricing 
      WHERE delivery_type IN ('express', 'standard', 'overnight', 'weekend', 'economy')
    `);

    console.log('✅ Rollback completed successfully!');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  updateDeliveryTypesEnum()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = {
  up: updateDeliveryTypesEnum,
  down: rollbackDeliveryTypesEnum
};
