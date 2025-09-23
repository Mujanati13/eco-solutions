const { pool } = require('./config/database');

async function fixElMghairData() {
  try {
    console.log('🔍 Finding orders from El M\'Ghair with incorrect wilaya_id...');
    
    // Find orders from El M'Ghair that have wrong wilaya_id
    const [incorrectOrders] = await pool.query(`
      SELECT id, order_number, customer_name, customer_city, wilaya_id, ecotrack_station_code
      FROM orders 
      WHERE (customer_city LIKE '%Ghair%' OR customer_city LIKE '%M''Ghair%') 
        AND wilaya_id != 56
      ORDER BY id DESC 
      LIMIT 20
    `);
    
    console.log(`Found ${incorrectOrders.length} orders with incorrect wilaya_id:`);
    incorrectOrders.forEach(o => {
      console.log(`  Order ${o.order_number}: ${o.customer_name} from ${o.customer_city} - wilaya_id: ${o.wilaya_id} (should be 56)`);
    });
    
    if (incorrectOrders.length > 0) {
      console.log('\n🔧 Would you like to fix these? (This is just a report - not actually fixing)');
      console.log('To fix, you could run:');
      console.log(`UPDATE orders SET wilaya_id = 56 WHERE customer_city LIKE '%Ghair%' OR customer_city LIKE '%M\\'Ghair%';`);
    }
    
    // Also check if there are any orders from El Meniaa with wilaya_id 56
    const [meniaaOrders] = await pool.query(`
      SELECT id, order_number, customer_name, customer_city, wilaya_id
      FROM orders 
      WHERE (customer_city LIKE '%Meniaa%' OR customer_city LIKE '%المنيعة%') 
        AND wilaya_id != 57
      LIMIT 10
    `);
    
    if (meniaaOrders.length > 0) {
      console.log(`\n🔍 Found ${meniaaOrders.length} orders from El Meniaa with incorrect wilaya_id:`);
      meniaaOrders.forEach(o => {
        console.log(`  Order ${o.order_number}: ${o.customer_name} from ${o.customer_city} - wilaya_id: ${o.wilaya_id} (should be 57)`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

fixElMghairData();