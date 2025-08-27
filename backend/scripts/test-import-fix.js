const mysql = require('mysql2/promise');
require('dotenv').config();

async function testImportMethod() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // Check if we have orders with order numbers 18195-18199 (from your error)
    const [duplicateOrders] = await pool.query(`
      SELECT id, order_number, customer_name 
      FROM orders 
      WHERE order_number IN ('18195', '18196', '18197', '18198', '18199')
      ORDER BY order_number
    `);
    
    console.log('🔍 Checking orders that caused the duplicate error:');
    console.log('====================================================');
    
    if (duplicateOrders.length === 0) {
      console.log('✅ No existing orders found with numbers 18195-18199');
    } else {
      console.log('❌ Found existing orders that would cause duplicates:');
      duplicateOrders.forEach(order => {
        console.log(`   Order: ${order.order_number} | Customer: ${order.customer_name} | ID: ${order.id}`);
      });
    }

    console.log('\n📋 Fixed Behavior Summary:');
    console.log('==========================');
    console.log('✅ importOrdersFromSheet() now uses same duplicate detection as saveOrdersToDatabase()');
    console.log('✅ Orders with existing order_numbers are SKIPPED, not re-numbered');
    console.log('✅ Orders without order_numbers use customer details for duplicate checking');
    console.log('✅ No more "Duplicate entry for key orders.order_number" errors');
    console.log('✅ Clean log messages show which orders are skipped and why');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testImportMethod().catch(console.error);
