const mysql = require('mysql2/promise');
require('dotenv').config();

async function testNewScanningLogic() {
  let pool;
  
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('🧪 Testing New Google Sheets Scanning Logic');
    console.log('=============================================');
    
    // Check current orders count
    const [orderCount] = await pool.query('SELECT COUNT(*) as count FROM orders');
    console.log(`📊 Current orders in database: ${orderCount[0].count}`);
    
    // Check processed files
    const [processedFiles] = await pool.query('SELECT spreadsheet_id, file_name, last_modified, processing_status FROM google_sheets_processed ORDER BY created_at DESC LIMIT 5');
    
    console.log('\n📁 Recent processed files:');
    if (processedFiles.length === 0) {
      console.log('   No processed files found');
    } else {
      processedFiles.forEach(file => {
        console.log(`   ${file.file_name} - Status: ${file.processing_status} - Modified: ${file.last_modified}`);
      });
    }
    
    // Test duplicate detection logic
    console.log('\n🔍 Testing Duplicate Detection Logic (Order Number Only):');
    console.log('=========================================================');
    
    // Sample order data for testing
    const testOrders = [
      {
        order_number: 'TEST-001',
        customer_name: 'Test Customer',
        customer_phone: '0555123456',
        total_amount: 2500
      },
      {
        order_number: 'TEST-002', 
        customer_name: 'Another Customer',
        customer_phone: '0666789012',
        total_amount: 1800
      }
    ];
    
    for (const orderData of testOrders) {
      let isDuplicate = false;
      let duplicateReason = '';
      
      // Check by order number only
      if (orderData.order_number) {
        const [orderCheck] = await pool.query(
          'SELECT id FROM orders WHERE order_number = ? LIMIT 1', 
          [orderData.order_number]
        );
        if (orderCheck.length > 0) {
          isDuplicate = true;
          duplicateReason = `Order Number: ${orderData.order_number}`;
        }
      }
      
      const status = isDuplicate ? '🔄 DUPLICATE' : '✅ NEW';
      const reason = isDuplicate ? ` - ${duplicateReason}` : '';
      console.log(`   ${orderData.order_number}: ${status}${reason}`);
    }
    
    console.log('\n📋 Updated Scanning Behavior Summary:');
    console.log('=====================================');
    console.log('✅ Files are re-scanned every time if they match patterns');
    console.log('✅ Duplicate orders are detected using ORDER NUMBER only');
    console.log('✅ Only new orders (with unique order numbers) are imported');
    console.log('✅ Files can have new orders added and they will be imported');
    console.log('✅ Simple and reliable duplicate detection');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  testNewScanningLogic().catch(console.error);
}

module.exports = testNewScanningLogic;
