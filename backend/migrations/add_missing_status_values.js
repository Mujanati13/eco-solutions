const { pool } = require('../config/database');

async function addMissingStatusValues() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Adding missing status ENUM values to orders table...');
    
    // Get current ENUM values
    const [columns] = await connection.query('DESCRIBE orders');
    const statusColumn = columns.find(col => col.Field === 'status');
    console.log('📋 Current status ENUM:', statusColumn.Type);
    
    // Add missing status values to the ENUM
    const alterQuery = `
      ALTER TABLE orders 
      MODIFY COLUMN status ENUM(
        'pending',
        'confirmed', 
        'processing',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'returned',
        'on_hold',
        'wrong_number',
        'follow_later',
        'non_available', 
        'order_later',
        '1_tent',
        '2_tent',
        '3_tent',
        '4_tent',
        '5_tent',
        '6_tent',
        'import_to_delivery_company'
      ) DEFAULT 'pending'
    `;
    
    await connection.query(alterQuery);
    
    // Verify the changes
    const [newColumns] = await connection.query('DESCRIBE orders');
    const newStatusColumn = newColumns.find(col => col.Field === 'status');
    console.log('✅ Updated status ENUM:', newStatusColumn.Type);
    
    console.log('✅ Successfully added missing status values!');
    
  } catch (error) {
    console.error('❌ Error adding missing status values:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  addMissingStatusValues()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addMissingStatusValues;