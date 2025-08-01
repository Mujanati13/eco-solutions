const { pool } = require('../config/database');

async function updateDeliveryTypeEnum() {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('🔄 Updating delivery_type enum to include domicile and desk options...');
    
    // Check current enum values
    const [enumInfo] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'delivery_type'
    `);
    
    console.log('Current enum values:', enumInfo[0]?.COLUMN_TYPE);
    
    // Update the enum to include all delivery types
    await connection.query(`
      ALTER TABLE orders 
      MODIFY COLUMN delivery_type ENUM(
        'domicile', 
        'desk', 
        'home', 
        'office', 
        'pickup_point'
      ) DEFAULT 'home'
    `);
    
    console.log('✅ Updated delivery_type enum successfully');
    
    // Verify the change
    const [updatedEnumInfo] = await connection.query(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'delivery_type'
    `);
    
    console.log('Updated enum values:', updatedEnumInfo[0]?.COLUMN_TYPE);
    
    await connection.commit();
    console.log('✅ Delivery type enum update completed successfully');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error updating delivery type enum:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  updateDeliveryTypeEnum()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { updateDeliveryTypeEnum };
