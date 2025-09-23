const { pool } = require('./config/database');

async function testWilayaMappingFix() {
  try {
    console.log('🧪 Testing wilaya mapping fix...');
    
    // Test 1: Verify wilaya mappings in database
    console.log('\n📋 Test 1: Current wilaya mappings (50-58):');
    const [wilayas] = await pool.query(`
      SELECT id, name_fr, name_ar 
      FROM wilayas 
      WHERE id BETWEEN 50 AND 58
      ORDER BY id
    `);
    
    wilayas.forEach(w => {
      console.log(`   ID: ${w.id} = ${w.name_fr} (${w.name_ar})`);
    });
    
    // Test 2: Check order assignments
    console.log('\n📋 Test 2: Order assignments for corrected wilayas:');
    const [orderCounts] = await pool.query(`
      SELECT wilaya_id, COUNT(*) as order_count
      FROM orders 
      WHERE wilaya_id IN (50, 51, 52, 53, 54, 55, 56, 57, 58)
      GROUP BY wilaya_id
      ORDER BY wilaya_id
    `);
    
    orderCounts.forEach(row => {
      console.log(`   Wilaya ${row.wilaya_id}: ${row.order_count} orders`);
    });
    
    // Test 3: Check specific problem cases
    console.log('\n📋 Test 3: Specific case analysis:');
    
    // El M'Ghair orders (should be wilaya_id = 57)
    const [elMghairOrders] = await pool.query(`
      SELECT COUNT(*) as count, wilaya_id
      FROM orders 
      WHERE customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR customer_city LIKE '%المغير%'
      GROUP BY wilaya_id
    `);
    
    if (elMghairOrders.length > 0) {
      console.log('   El M\'Ghair orders:');
      elMghairOrders.forEach(row => {
        console.log(`     ${row.count} orders assigned to wilaya_id = ${row.wilaya_id} ${row.wilaya_id === 57 ? '✅' : '❌'}`);
      });
    } else {
      console.log('   No El M\'Ghair orders found');
    }
    
    // Djanet orders (should be wilaya_id = 56)
    const [djanetOrders] = await pool.query(`
      SELECT COUNT(*) as count, wilaya_id
      FROM orders 
      WHERE customer_city LIKE '%Djanet%' OR customer_city LIKE '%جانت%'
      GROUP BY wilaya_id
    `);
    
    if (djanetOrders.length > 0) {
      console.log('   Djanet orders:');
      djanetOrders.forEach(row => {
        console.log(`     ${row.count} orders assigned to wilaya_id = ${row.wilaya_id} ${row.wilaya_id === 56 ? '✅' : '❌'}`);
      });
    } else {
      console.log('   No Djanet orders found');
    }
    
    console.log('\n✅ Wilaya mapping test completed!');
    console.log('\n🎯 Expected results:');
    console.log('   - ID 56 = Djanet (جانت)');
    console.log('   - ID 57 = El M\'Ghair (المغير)');
    console.log('   - Djanet orders assigned to wilaya_id = 56');
    console.log('   - El M\'Ghair orders assigned to wilaya_id = 57');
    console.log('   - This should prevent Ecotrack station code mismatches');
    
  } catch (error) {
    console.error('❌ Error testing wilaya mappings:', error);
  } finally {
    process.exit();
  }
}

testWilayaMappingFix();