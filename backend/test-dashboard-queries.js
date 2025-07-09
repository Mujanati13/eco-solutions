const { pool } = require('./config/database');

async function testDashboardEndpoints() {
  try {
    console.log('🧪 Testing Dashboard Data Queries...\n');

    // Test order statistics query
    console.log('📦 Testing Order Statistics Query:');
    const [orderStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as total_revenue
      FROM orders
    `);
    console.log('✅ Order stats query successful:', orderStats[0]);

    // Test order distribution query
    console.log('\n📊 Testing Order Distribution Query:');
    const [distribution] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log('✅ Order distribution query successful:', distribution.length, 'status types found');

    // Test trends query
    console.log('\n📈 Testing Order Trends Query:');
    const [trends] = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(total_amount) as total_revenue
      FROM orders
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    console.log('✅ Order trends query successful:', trends.length, 'data points found');

    // Test product statistics if products table exists
    console.log('\n🛍️ Testing Product Statistics Query:');
    try {
      const [productStats] = await pool.query(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(DISTINCT category) as categories_count
        FROM products 
        WHERE is_active = true
      `);
      console.log('✅ Product stats query successful:', productStats[0]);

      // Test stock levels query
      console.log('\n📦 Testing Stock Levels Query:');
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
      console.log('✅ Stock levels query successful:', stockStats[0]);

      // Test low stock alerts query
      console.log('\n⚠️ Testing Low Stock Alerts Query:');
      const [alerts] = await pool.query(`
        SELECT 
          p.id, p.name, p.sku, p.category, p.minimum_stock_level as reorder_level,
          COALESCE(SUM(sl.quantity_available), 0) as current_stock,
          (p.minimum_stock_level - COALESCE(SUM(sl.quantity_available), 0)) as shortage
        FROM products p
        LEFT JOIN stock_levels sl ON p.id = sl.product_id
        WHERE p.is_active = true
        GROUP BY p.id
        HAVING current_stock <= p.minimum_stock_level
        ORDER BY shortage DESC
        LIMIT 5
      `);
      console.log('✅ Low stock alerts query successful:', alerts.length, 'alerts found');

    } catch (productError) {
      console.log('⚠️ Product queries failed - Product management not fully set up:', productError.message);
    }

    // Test recent orders query
    console.log('\n📋 Testing Recent Orders Query:');
    const [recentOrders] = await pool.query(`
      SELECT 
        o.id, o.order_number, o.customer_name, o.customer_phone,
        o.status, o.total_amount, o.created_at,
        u.first_name as assigned_first_name,
        u.last_name as assigned_last_name
      FROM orders o
      LEFT JOIN users u ON o.assigned_to = u.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);
    console.log('✅ Recent orders query successful:', recentOrders.length, 'orders found');

    console.log('\n✅ All Dashboard Queries Test Complete!');

    // Data quality checks
    console.log('\n🔍 Data Quality Checks:');
    
    // Check for null values in critical fields
    const [nullChecks] = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN customer_name IS NULL OR customer_name = '' THEN 1 END) as missing_names,
        COUNT(CASE WHEN customer_phone IS NULL OR customer_phone = '' THEN 1 END) as missing_phones,
        COUNT(CASE WHEN total_amount IS NULL OR total_amount = 0 THEN 1 END) as zero_amounts
      FROM orders
    `);
    
    console.log('  Missing customer names:', nullChecks[0].missing_names, '/', nullChecks[0].total_orders);
    console.log('  Missing phone numbers:', nullChecks[0].missing_phones, '/', nullChecks[0].total_orders);
    console.log('  Zero amounts:', nullChecks[0].zero_amounts, '/', nullChecks[0].total_orders);

    if (nullChecks[0].missing_names > 0) {
      console.log('  ⚠️ Some orders have missing customer names');
    }
    if (nullChecks[0].missing_phones > 0) {
      console.log('  ⚠️ Some orders have missing phone numbers');
    }
    if (nullChecks[0].zero_amounts > 0) {
      console.log('  ⚠️ Some orders have zero amounts');
    }

  } catch (error) {
    console.error('❌ Error testing dashboard queries:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run test
testDashboardEndpoints();
