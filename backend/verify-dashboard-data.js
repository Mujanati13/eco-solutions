const { pool } = require('./config/database');

async function verifyDashboardData() {
  try {
    console.log('🔍 Verifying Dashboard Data...\n');

    // Check orders table
    console.log('📦 Orders Analysis:');
    const [orderStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_orders,
        SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as total_revenue
      FROM orders
    `);
    
    console.log('  Total Orders:', orderStats[0].total_orders);
    console.log('  Pending Orders:', orderStats[0].pending_orders);
    console.log('  Confirmed Orders:', orderStats[0].confirmed_orders);
    console.log('  Delivered Orders:', orderStats[0].delivered_orders);
    console.log('  Today Orders:', orderStats[0].today_orders);
    console.log('  Total Revenue:', `$${orderStats[0].total_revenue || 0}`);
    
    // Check order distribution
    console.log('\n📊 Order Status Distribution:');
    const [statusDistribution] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `);
    
    statusDistribution.forEach(row => {
      console.log(`  ${row.status}: ${row.count} orders (${row.percentage}%)`);
    });

    // Check if products table exists and get product stats
    console.log('\n🛍️ Product Management Analysis:');
    try {
      const [productStats] = await pool.query(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(DISTINCT category) as categories_count
        FROM products 
        WHERE is_active = true
      `);
      
      console.log('  Total Active Products:', productStats[0].total_products);
      console.log('  Product Categories:', productStats[0].categories_count);
      
      // Check stock levels if table exists
      try {
        const [stockStats] = await pool.query(`
          SELECT 
            COUNT(DISTINCT p.id) as products_with_stock,
            SUM(p.cost_price * COALESCE(sl.total_available, 0)) as total_stock_value
          FROM products p
          LEFT JOIN (
            SELECT product_id, SUM(quantity_available) as total_available
            FROM stock_levels
            GROUP BY product_id
          ) sl ON p.id = sl.product_id
          WHERE p.is_active = true
        `);
        
        console.log('  Products with Stock Levels:', stockStats[0].products_with_stock);
        console.log('  Total Stock Value:', `$${stockStats[0].total_stock_value || 0}`);
      } catch (stockError) {
        console.log('  ⚠️ Stock levels table not found or inaccessible');
      }
      
    } catch (productError) {
      console.log('  ⚠️ Products table not found - Product management not available');
    }

    // Check users and performance
    console.log('\n👥 User & Performance Analysis:');
    const [userStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'employee' AND is_active = true THEN 1 END) as active_employees,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count
      FROM users
    `);
    
    console.log('  Total Users:', userStats[0].total_users);
    console.log('  Active Employees:', userStats[0].active_employees);
    console.log('  Administrators:', userStats[0].admin_count);
    
    // Check recent activity
    console.log('\n📈 Recent Activity Analysis:');
    const [recentOrders] = await pool.query(`
      SELECT COUNT(*) as recent_orders
      FROM orders 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    
    console.log('  Orders in Last 7 Days:', recentOrders[0].recent_orders);
    
    // Check tracking logs
    try {
      const [trackingLogs] = await pool.query(`
        SELECT COUNT(*) as total_logs
        FROM tracking_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `);
      
      console.log('  Tracking Logs (7 days):', trackingLogs[0].total_logs);
    } catch (logError) {
      console.log('  ⚠️ Tracking logs not accessible');
    }

    // Check performance metrics
    try {
      const [perfMetrics] = await pool.query(`
        SELECT COUNT(*) as performance_records
        FROM performance_metrics 
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      `);
      
      console.log('  Performance Records (30 days):', perfMetrics[0].performance_records);
    } catch (perfError) {
      console.log('  ⚠️ Performance metrics not accessible');
    }

    console.log('\n✅ Dashboard Data Verification Complete');
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (orderStats[0].total_orders === 0) {
      console.log('  - No orders found. Consider importing sample data or creating test orders.');
    }
    if (userStats[0].active_employees === 0) {
      console.log('  - No active employees found. Create employee accounts for proper workflow.');
    }
    
    try {
      const [productCheck] = await pool.query('SELECT COUNT(*) as count FROM products');
      if (productCheck[0].count === 0) {
        console.log('  - No products found. Consider adding products for inventory management.');
      }
    } catch (e) {
      console.log('  - Products table not set up. Run stock table creation script if needed.');
    }

  } catch (error) {
    console.error('❌ Error verifying dashboard data:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run verification
verifyDashboardData();
