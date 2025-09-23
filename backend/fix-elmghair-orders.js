const { pool } = require('./config/database');

async function fixElMghairOrderWilaya() {
  try {
    console.log('🔍 Checking El M\'Ghair orders with incorrect wilaya_id...');
    
    // Find El M'Ghair orders that have wrong wilaya_id
    const [elMghairOrders] = await pool.query(`
      SELECT id, order_number, customer_name, customer_city, baladia_name, wilaya_id
      FROM orders 
      WHERE (customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR customer_city LIKE '%المغير%'
             OR baladia_name LIKE '%M''Ghair%' OR baladia_name LIKE '%Mghair%' OR baladia_name LIKE '%المغير%')
      AND wilaya_id != 57
    `);
    
    if (elMghairOrders.length > 0) {
      console.log(`\n🚨 Found ${elMghairOrders.length} El M'Ghair orders with incorrect wilaya_id:`);
      
      elMghairOrders.forEach(order => {
        console.log(`   Order ${order.order_number} (ID: ${order.id}): ${order.customer_name}`);
        console.log(`     City: ${order.customer_city}, Baladia: ${order.baladia_name}`);
        console.log(`     Current wilaya_id: ${order.wilaya_id} ❌ (should be 57)`);
      });
      
      console.log('\n🔧 Correcting wilaya_id for these orders...');
      
      // Update the orders to have correct wilaya_id = 57
      const [updateResult] = await pool.query(`
        UPDATE orders 
        SET wilaya_id = 57, updated_at = NOW()
        WHERE (customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR customer_city LIKE '%المغير%'
               OR baladia_name LIKE '%M''Ghair%' OR baladia_name LIKE '%Mghair%' OR baladia_name LIKE '%المغير%')
        AND wilaya_id != 57
      `);
      
      console.log(`✅ Updated ${updateResult.affectedRows} orders to wilaya_id = 57`);
      
      // Verify the fix
      const [verifyOrders] = await pool.query(`
        SELECT id, order_number, customer_name, customer_city, baladia_name, wilaya_id
        FROM orders 
        WHERE (customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR customer_city LIKE '%المغير%'
               OR baladia_name LIKE '%M''Ghair%' OR baladia_name LIKE '%Mghair%' OR baladia_name LIKE '%المغير%')
      `);
      
      console.log('\n📋 Verification - All El M\'Ghair orders after fix:');
      verifyOrders.forEach(order => {
        const status = order.wilaya_id === 57 ? '✅' : '❌';
        console.log(`   Order ${order.order_number}: wilaya_id = ${order.wilaya_id} ${status}`);
      });
      
    } else {
      console.log('✅ No El M\'Ghair orders found with incorrect wilaya_id');
    }
    
    // Check the specific order from the error
    console.log('\n🔍 Checking order 19334 specifically...');
    const [specificOrder] = await pool.query(`
      SELECT id, order_number, customer_name, customer_city, baladia_name, wilaya_id
      FROM orders 
      WHERE order_number = '19334'
    `);
    
    if (specificOrder.length > 0) {
      const order = specificOrder[0];
      console.log(`Order 19334 details:`);
      console.log(`   Customer: ${order.customer_name}`);
      console.log(`   City: ${order.customer_city}`);
      console.log(`   Baladia: ${order.baladia_name}`);
      console.log(`   Current wilaya_id: ${order.wilaya_id} ${order.wilaya_id === 57 ? '✅' : '❌'}`);
      
      if (order.wilaya_id !== 57 && (order.customer_city.includes("M'Ghair") || order.baladia_name.includes("m'ghair"))) {
        console.log('🔧 This order needs wilaya_id correction to 57');
      }
    } else {
      console.log('❌ Order 19334 not found');
    }
    
  } catch (error) {
    console.error('❌ Error fixing El M\'Ghair orders:', error);
  } finally {
    process.exit();
  }
}

fixElMghairOrderWilaya();