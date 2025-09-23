const { pool } = require('./config/database');

async function analyzeAndFixOrderWilayas() {
  try {
    console.log('🔍 Analyzing order wilaya assignments...');
    
    // First, let's see what orders we have with problematic wilayas
    console.log('\n📊 Checking orders in the newly corrected wilayas (51, 52, 53, 55, 57, 58):');
    
    const [wilayaOrders] = await pool.query(`
      SELECT wilaya_id, COUNT(*) as order_count
      FROM orders 
      WHERE wilaya_id IN (51, 52, 53, 55, 56, 57, 58)
      GROUP BY wilaya_id
      ORDER BY wilaya_id
    `);
    
    wilayaOrders.forEach(row => {
      console.log(`   Wilaya ${row.wilaya_id}: ${row.order_count} orders`);
    });
    
    // Check for orders with wilaya_id = 56 (which should be El M'Ghair according to old mapping)
    console.log('\n🔍 Checking orders currently assigned to wilaya_id = 56:');
    const [wilaya56Orders] = await pool.query(`
      SELECT id, customer_name, customer_city, wilaya_id, created_at
      FROM orders 
      WHERE wilaya_id = 56
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (wilaya56Orders.length > 0) {
      console.log(`Found ${wilaya56Orders.length} orders with wilaya_id = 56:`);
      wilaya56Orders.forEach(order => {
        console.log(`   Order ${order.id}: ${order.customer_name} - ${order.customer_city}`);
      });
    } else {
      console.log('No orders found with wilaya_id = 56');
    }
    
    // Check for orders with wilaya_id = 57 that might be El M'Ghair
    console.log('\n🔍 Checking orders currently assigned to wilaya_id = 57:');
    const [wilaya57Orders] = await pool.query(`
      SELECT id, customer_name, customer_city, wilaya_id, created_at
      FROM orders 
      WHERE wilaya_id = 57
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (wilaya57Orders.length > 0) {
      console.log(`Found ${wilaya57Orders.length} orders with wilaya_id = 57:`);
      wilaya57Orders.forEach(order => {
        console.log(`   Order ${order.id}: ${order.customer_name} - ${order.customer_city}`);
      });
      
      // Check if any of these orders have "El M'Ghair" in customer_city
      const [elMghairOrders] = await pool.query(`
        SELECT id, customer_name, customer_city, wilaya_id
        FROM orders 
        WHERE wilaya_id = 57 
        AND (customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR 
             customer_city LIKE '%المغير%')
      `);
      
      if (elMghairOrders.length > 0) {
        console.log(`\n🚨 Found ${elMghairOrders.length} orders with El M'Ghair locations but wrong wilaya_id (57 instead of 57):`);
        elMghairOrders.forEach(order => {
          console.log(`   Order ${order.id}: ${order.customer_name} - ${order.customer_city}`);
        });
        
        // Ask for confirmation to fix these orders
        console.log('\n❓ These orders should be updated to wilaya_id = 57 (El M\'Ghair)');
        console.log('   Do you want to proceed with fixing these orders? (Manual confirmation needed)');
      }
    } else {
      console.log('No orders found with wilaya_id = 57');
    }
    
    // Show current wilaya mapping for reference
    console.log('\n📋 Current wilaya mapping for reference:');
    const [currentWilayas] = await pool.query(`
      SELECT id, name_fr, name_ar 
      FROM wilayas 
      WHERE id IN (51, 52, 53, 55, 56, 57, 58)
      ORDER BY id
    `);
    
    currentWilayas.forEach(w => {
      console.log(`   ID: ${w.id} = ${w.name_fr} (${w.name_ar})`);
    });
    
  } catch (error) {
    console.error('❌ Error analyzing orders:', error);
  } finally {
    process.exit();
  }
}

analyzeAndFixOrderWilayas();