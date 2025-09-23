const { pool } = require('./config/database');

async function checkDeliveryPricing() {
  try {
    // Check table structure
    const [desc] = await pool.query('DESCRIBE delivery_pricing');
    console.log('delivery_pricing table structure:');
    desc.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check sample data
    const [sample] = await pool.query('SELECT * FROM delivery_pricing LIMIT 5');
    console.log('\nSample data:');
    sample.forEach((row, i) => {
      console.log(`Row ${i + 1}:`, row);
    });
    
    // Check count
    const [count] = await pool.query('SELECT COUNT(*) as total FROM delivery_pricing');
    console.log(`\nTotal rows: ${count[0].total}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkDeliveryPricing();