const { pool } = require('../config/database');

/**
 * Migration: Add new status options to orders table
 * Adds: wrong_number, follow_later, non_available, order_later
 */

async function up() {
  console.log('Adding new status options to orders table...');
  
  try {
    // Update the ENUM column to include new status values
    await pool.query(`
      ALTER TABLE orders 
      MODIFY COLUMN status ENUM(
        'pending',
        'confirmed', 
        'import_to_delivery_company',
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
        '0_tent',
        '1_tent',
        '2_tent', 
        '3_tent',
        '4_tent',
        '5_tent',
        '6_tent'
      ) DEFAULT 'pending'
    `);
    
    console.log('✅ Successfully added new status options to orders table');
    
    // Show current status column definition
    const [rows] = await pool.query('DESCRIBE orders');
    const statusColumn = rows.find(r => r.Field === 'status');
    console.log('Updated status column:', statusColumn);
    
  } catch (error) {
    console.error('❌ Error adding new status options:', error);
    throw error;
  }
}

async function down() {
  console.log('Removing new status options from orders table...');
  
  try {
    // First, update any orders with new statuses to 'pending'
    await pool.query(`
      UPDATE orders 
      SET status = 'pending' 
      WHERE status IN ('wrong_number', 'follow_later', 'non_available', 'order_later')
    `);
    
    // Revert to original ENUM values
    await pool.query(`
      ALTER TABLE orders 
      MODIFY COLUMN status ENUM(
        'pending',
        'confirmed',
        'import_to_delivery_company', 
        'processing',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'returned',
        'on_hold',
        '0_tent',
        '1_tent',
        '2_tent',
        '3_tent', 
        '4_tent',
        '5_tent',
        '6_tent'
      ) DEFAULT 'pending'
    `);
    
    console.log('✅ Successfully removed new status options from orders table');
    
  } catch (error) {
    console.error('❌ Error removing new status options:', error);
    throw error;
  }
}

module.exports = { up, down };

// Run migration if called directly
if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}