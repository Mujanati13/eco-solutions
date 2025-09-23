const { pool } = require('./config/database');

async function checkOrdersStructure() {
  try {
    console.log('🔍 Checking orders table structure...');
    
    const [columns] = await pool.query('DESCRIBE orders');
    
    console.log('\n📋 Orders table columns:');
    columns.forEach(col => {
      console.log(`   ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'Nullable' : 'Not Null'}`);
    });
    
    // Also check a sample order to see the data
    console.log('\n📄 Sample order data:');
    const [sampleOrder] = await pool.query('SELECT * FROM orders LIMIT 1');
    
    if (sampleOrder.length > 0) {
      console.log('Sample order fields:');
      Object.keys(sampleOrder[0]).forEach(key => {
        console.log(`   ${key}: ${sampleOrder[0][key]}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking orders structure:', error);
  } finally {
    process.exit();
  }
}

checkOrdersStructure();