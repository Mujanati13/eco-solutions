const { pool } = require('../config/database');

/**
 * Backfill performance metrics for existing orders
 * This script calculates and populates the performance_metrics table
 * based on existing order data in the database
 */

async function backfillPerformanceMetrics() {
  try {
    console.log('🔄 Starting performance metrics backfill...');

    // Clear existing performance metrics to ensure clean data
    console.log('🗑️  Clearing existing performance metrics...');
    await pool.query('DELETE FROM performance_metrics');

    // Get all orders with assigned_to and their dates
    const [orders] = await pool.query(`
      SELECT 
        assigned_to,
        status,
        DATE(created_at) as order_date,
        COUNT(*) as count
      FROM orders 
      WHERE assigned_to IS NOT NULL
      GROUP BY assigned_to, status, DATE(created_at)
      ORDER BY order_date DESC, assigned_to
    `);

    console.log(`📊 Found ${orders.length} order groups to process...`);

    // Process each order group
    const metrics = new Map();

    for (const orderGroup of orders) {
      const { assigned_to, status, order_date, count } = orderGroup;
      const key = `${assigned_to}_${order_date}`;

      if (!metrics.has(key)) {
        metrics.set(key, {
          user_id: assigned_to,
          date: order_date,
          orders_assigned: 0,
          orders_confirmed: 0,
          orders_delivered: 0
        });
      }

      const metric = metrics.get(key);

      // Count all assigned orders
      metric.orders_assigned += count;

      // Count confirmed orders
      if (status === 'confirmed') {
        metric.orders_confirmed += count;
      }

      // Count delivered orders
      if (status === 'delivered') {
        metric.orders_delivered += count;
      }
    }

    console.log(`💾 Inserting ${metrics.size} performance metric records...`);

    // Insert the calculated metrics
    for (const metric of metrics.values()) {
      await pool.query(`
        INSERT INTO performance_metrics 
        (user_id, date, orders_assigned, orders_confirmed, orders_delivered)
        VALUES (?, ?, ?, ?, ?)
      `, [
        metric.user_id,
        metric.date,
        metric.orders_assigned,
        metric.orders_confirmed,
        metric.orders_delivered
      ]);
    }

    // Verify the results
    const [summary] = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(orders_assigned) as total_assigned,
        SUM(orders_confirmed) as total_confirmed,
        SUM(orders_delivered) as total_delivered,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM performance_metrics
    `);

    console.log('✅ Backfill completed successfully!');
    console.log('📈 Summary:');
    console.log(`   - Total records: ${summary[0].total_records}`);
    console.log(`   - Unique users: ${summary[0].unique_users}`);
    console.log(`   - Total assigned: ${summary[0].total_assigned}`);
    console.log(`   - Total confirmed: ${summary[0].total_confirmed}`);
    console.log(`   - Total delivered: ${summary[0].total_delivered}`);
    console.log(`   - Date range: ${summary[0].earliest_date} to ${summary[0].latest_date}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill if this script is executed directly
if (require.main === module) {
  backfillPerformanceMetrics();
}

module.exports = { backfillPerformanceMetrics };