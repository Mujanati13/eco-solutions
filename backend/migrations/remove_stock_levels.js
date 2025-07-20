const { pool } = require('../config/database');

/**
 * Migration: Remove minimum and maximum stock levels and add stock alert thresholds
 * This migration removes the minimum_stock_level and maximum_stock_level columns from products table
 * and adds a stock alert system based on fixed thresholds
 */

async function up() {
  try {
    console.log('Starting migration: Remove minimum/maximum stock levels...');

    // Step 1: Remove minimum_stock_level and maximum_stock_level columns
    console.log('Removing minimum_stock_level and maximum_stock_level columns...');
    
    // Check if columns exist and drop them separately
    try {
      await pool.query(`ALTER TABLE products DROP COLUMN minimum_stock_level`);
      console.log('Dropped minimum_stock_level column');
    } catch (error) {
      if (error.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
        throw error;
      }
      console.log('minimum_stock_level column does not exist, skipping...');
    }
    
    try {
      await pool.query(`ALTER TABLE products DROP COLUMN maximum_stock_level`);
      console.log('Dropped maximum_stock_level column');
    } catch (error) {
      if (error.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
        throw error;
      }
      console.log('maximum_stock_level column does not exist, skipping...');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

async function down() {
  try {
    console.log('Rolling back migration: Remove minimum/maximum stock levels...');

    // Add back the columns with default values
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN minimum_stock_level INT DEFAULT 0,
      ADD COLUMN maximum_stock_level INT DEFAULT NULL
    `);

    console.log('Rollback completed successfully');
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}

module.exports = { up, down };

// If running directly
if (require.main === module) {
  up().then(() => {
    console.log('Migration completed');
    process.exit(0);
  }).catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
