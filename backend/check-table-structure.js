const { pool } = require('./config/database');

async function checkTableStructure() {
  try {
    console.log('🔍 Checking Table Structures...\n');

    // Check products table structure
    console.log('📦 Products Table Structure:');
    try {
      const [productColumns] = await pool.query('DESCRIBE products');
      console.log('Columns:', productColumns.map(col => `${col.Field} (${col.Type})`).join(', '));
      
      // Check if reorder_level exists
      const hasReorderLevel = productColumns.some(col => col.Field === 'reorder_level');
      console.log('Has reorder_level column:', hasReorderLevel);
      
      if (!hasReorderLevel) {
        console.log('⚠️ Missing reorder_level column - need to add it');
      }
    } catch (error) {
      console.log('❌ Products table not found:', error.message);
    }

    // Check stock_levels table structure
    console.log('\n📦 Stock Levels Table Structure:');
    try {
      const [stockColumns] = await pool.query('DESCRIBE stock_levels');
      console.log('Columns:', stockColumns.map(col => `${col.Field} (${col.Type})`).join(', '));
    } catch (error) {
      console.log('❌ Stock levels table not found:', error.message);
    }

    // Check stock_movements table structure
    console.log('\n📦 Stock Movements Table Structure:');
    try {
      const [movementColumns] = await pool.query('DESCRIBE stock_movements');
      console.log('Columns:', movementColumns.map(col => `${col.Field} (${col.Type})`).join(', '));
    } catch (error) {
      console.log('❌ Stock movements table not found:', error.message);
    }

    // Check orders table structure
    console.log('\n📦 Orders Table Structure:');
    try {
      const [orderColumns] = await pool.query('DESCRIBE orders');
      console.log('Columns:', orderColumns.map(col => `${col.Field} (${col.Type})`).join(', '));
    } catch (error) {
      console.log('❌ Orders table not found:', error.message);
    }

  } catch (error) {
    console.error('❌ Error checking table structure:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run check
checkTableStructure();
