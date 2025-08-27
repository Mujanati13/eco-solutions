const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDuplicateDetection() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🧪 Testing Enhanced Duplicate Detection Logic');
    console.log('============================================');
    
    // Test scenarios for duplicate detection
    const testOrders = [
      {
        description: 'Order with order_number',
        order_number: 'TEST-001',
        customer_name: 'John Doe',
        customer_phone: '0555123456',
        total_amount: 2500
      },
      {
        description: 'Order without order_number (should use customer details)',
        order_number: '',
        customer_name: 'Jane Smith',
        customer_phone: '0666789012',
        total_amount: 1800
      },
      {
        description: 'Order without order_number and null value',
        order_number: null,
        customer_name: 'Bob Wilson',
        customer_phone: '0777888999',
        total_amount: 2200
      },
      {
        description: 'Existing order number (should find duplicate)',
        order_number: 'ORD-1755343519912-nese22mwg',
        customer_name: 'Test Customer',
        customer_phone: '0555999888',
        total_amount: 3000
      }
    ];
    
    for (const testOrder of testOrders) {
      console.log(`\n🔍 Testing: ${testOrder.description}`);
      console.log('----------------------------------------');
      
      let isDuplicate = false;
      let duplicateReason = '';
      
      // Same logic as in the updated googleSheets.js
      if (testOrder.order_number && testOrder.order_number.trim() !== '') {
        const [orderCheck] = await pool.query(
          'SELECT id FROM orders WHERE order_number = ? LIMIT 1', 
          [testOrder.order_number]
        );
        if (orderCheck.length > 0) {
          isDuplicate = true;
          duplicateReason = `order number: ${testOrder.order_number}`;
        }
      } else {
        // If no order number, check by customer details
        if (testOrder.customer_phone && testOrder.customer_name) {
          const [customerCheck] = await pool.query(`
            SELECT id FROM orders 
            WHERE customer_phone = ? 
            AND customer_name = ? 
            AND ABS(total_amount - ?) < 0.01
            AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
            LIMIT 1
          `, [testOrder.customer_phone, testOrder.customer_name, testOrder.total_amount || 0]);
          
          if (customerCheck.length > 0) {
            isDuplicate = true;
            duplicateReason = `customer details: ${testOrder.customer_name} (${testOrder.customer_phone})`;
          }
        }
      }
      
      const finalOrderNumber = testOrder.order_number && testOrder.order_number.trim() !== '' 
        ? testOrder.order_number 
        : `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      
      const status = isDuplicate ? '🔄 DUPLICATE' : '✅ NEW';
      const reason = isDuplicate ? ` - Detected by ${duplicateReason}` : '';
      const orderNum = isDuplicate ? testOrder.order_number : finalOrderNumber;
      
      console.log(`   Result: ${status}${reason}`);
      console.log(`   Final Order Number: ${orderNum}`);
    }
    
    console.log('\n📋 Summary of Changes:');
    console.log('======================');
    console.log('✅ Orders WITH order numbers: Duplicate check by order_number');
    console.log('✅ Orders WITHOUT order numbers: Duplicate check by customer details');
    console.log('✅ Customer duplicate check: phone + name + amount (within 1 day)');
    console.log('✅ Auto-generated order numbers only for non-duplicates');
    console.log('✅ This prevents the same customer data from creating multiple orders');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testDuplicateDetection().catch(console.error);
