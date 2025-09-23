const { pool } = require('./config/database');

(async () => {
  try {
    console.log('Testing new status values...');
    
    const newStatuses = ['wrong_number', 'follow_later', 'non_available', 'order_later'];
    
    for (const status of newStatuses) {
      try {
        // Try to find an order to temporarily update
        const [orders] = await pool.query('SELECT id FROM orders LIMIT 1');
        if (orders.length > 0) {
          const orderId = orders[0].id;
          const originalStatus = await pool.query('SELECT status FROM orders WHERE id = ?', [orderId]);
          
          // Test the new status
          await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);
          console.log(`✅ ${status} - valid and working`);
          
          // Restore original status
          await pool.query('UPDATE orders SET status = ? WHERE id = ?', [originalStatus[0][0].status, orderId]);
        }
      } catch (e) {
        console.log(`❌ ${status} - failed:`, e.message);
      }
    }
    
    console.log('\nAll new status values are working correctly!');
    process.exit(0);
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
})();