const { pool } = require('../config/database');

/**
 * Add tent statuses and missing statuses to the orders table status ENUM
 */
async function addTentStatuses() {
  try {
    console.log('🔄 Adding tent statuses to orders table...');

    // First, let's check the current ENUM definition
    const [columns] = await pool.query(`
      SHOW COLUMNS FROM orders LIKE 'status'
    `);
    
    console.log('Current status column definition:', columns[0]);

    // Update the ENUM to include all status values including tent statuses
    await pool.query(`
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
        '0_tent',
        '1_tent',
        '2_tent'
      ) DEFAULT 'pending'
    `);

    console.log('✅ Successfully added tent statuses to orders table');

    // Verify the change
    const [updatedColumns] = await pool.query(`
      SHOW COLUMNS FROM orders LIKE 'status'
    `);
    
    console.log('Updated status column definition:', updatedColumns[0]);

  } catch (error) {
    console.error('❌ Error adding tent statuses:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  addTentStatuses()
    .then(() => {
      console.log('✅ Tent statuses migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Tent statuses migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addTentStatuses };
