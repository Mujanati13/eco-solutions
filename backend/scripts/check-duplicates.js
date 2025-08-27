const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDuplicates() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    // Check for duplicate order numbers
    const [duplicates] = await pool.query(`
      SELECT order_number, COUNT(*) as count 
      FROM orders 
      WHERE order_number IS NOT NULL AND order_number != '' 
      GROUP BY order_number 
      HAVING COUNT(*) > 1 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    console.log('🔍 Duplicate Order Numbers:');
    console.log('===========================');
    if (duplicates.length === 0) {
      console.log('✅ No duplicate order numbers found');
    } else {
      duplicates.forEach(dup => {
        console.log(`❌ Order Number: ${dup.order_number} - Count: ${dup.count}`);
      });
    }

    // Check recent orders
    const [recent] = await pool.query(`
      SELECT id, order_number, customer_name, created_at 
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('\n📊 Recent Orders:');
    console.log('=================');
    recent.forEach(order => {
      console.log(`ID: ${order.id} | Order: ${order.order_number || 'N/A'} | Customer: ${order.customer_name} | Created: ${order.created_at}`);
    });

    // Check total orders count
    const [totalCount] = await pool.query('SELECT COUNT(*) as total FROM orders');
    console.log(`\n📈 Total orders in database: ${totalCount[0].total}`);

  } catch (error) {
    console.error('❌ Error checking duplicates:', error);
  } finally {
    await pool.end();
  }
}

checkDuplicates().catch(console.error);
