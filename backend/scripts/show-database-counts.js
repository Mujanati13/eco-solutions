const mysql = require('mysql2/promise');
require('dotenv').config();

async function showDatabaseCounts() {
  let pool;
  
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    console.log('📊 Current Database Record Counts');
    console.log('==================================');
    
    const tables = [
      { name: 'orders', description: 'Customer Orders' },
      { name: 'order_items', description: 'Order Line Items' },
      { name: 'products', description: 'Products Catalog' },
      { name: 'product_variants', description: 'Product Variants' },
      { name: 'stock_levels', description: 'Stock Levels' },
      { name: 'variant_stock_levels', description: 'Variant Stock Levels' },
      { name: 'stock_movements', description: 'Stock Movements' },
      { name: 'variant_stock_movements', description: 'Variant Stock Movements' },
      { name: 'tracking_logs', description: 'Order Tracking Logs' },
      { name: 'google_sheets_processed', description: 'Google Sheets Import History' },
      { name: 'categories', description: 'Product Categories' },
      { name: 'stock_locations', description: 'Warehouse/Store Locations' },
      { name: 'ecotrack_accounts', description: 'EcoTrack Multi-Accounts' }
    ];
    
    let totalRecords = 0;
    
    for (const table of tables) {
      try {
        const [result] = await pool.query(`SELECT COUNT(*) as count FROM ${table.name}`);
        const count = result[0].count;
        totalRecords += count;
        
        const icon = count > 0 ? '📦' : '📭';
        console.log(`  ${icon} ${table.description.padEnd(25)} : ${count.toString().padStart(6)} records`);
      } catch (error) {
        console.log(`  ❓ ${table.description.padEnd(25)} : TABLE NOT FOUND`);
      }
    }
    
    console.log('==================================');
    console.log(`📊 Total Records: ${totalRecords}`);
    
    // Show some sample data
    if (totalRecords > 0) {
      console.log('\n🔍 Sample Data Preview:');
      console.log('=======================');
      
      // Show recent orders
      try {
        const [orders] = await pool.query('SELECT id, order_number, customer_name, total_amount, created_at FROM orders ORDER BY created_at DESC LIMIT 3');
        if (orders.length > 0) {
          console.log('\n📋 Recent Orders:');
          orders.forEach(order => {
            console.log(`   ID: ${order.id} | #${order.order_number} | ${order.customer_name} | ${order.total_amount}DA | ${order.created_at.toISOString().split('T')[0]}`);
          });
        }
      } catch (error) {
        // Ignore if no orders table
      }
      
      // Show sample products
      try {
        const [products] = await pool.query('SELECT id, name, sku, location_id FROM products ORDER BY created_at DESC LIMIT 3');
        if (products.length > 0) {
          console.log('\n🛍️ Recent Products:');
          products.forEach(product => {
            console.log(`   ID: ${product.id} | ${product.name} | SKU: ${product.sku || 'N/A'} | Location: ${product.location_id || 'N/A'}`);
          });
        }
      } catch (error) {
        // Ignore if no products table
      }
      
      // Show locations
      try {
        const [locations] = await pool.query('SELECT id, name, type FROM stock_locations ORDER BY id');
        if (locations.length > 0) {
          console.log('\n🏪 Locations:');
          locations.forEach(location => {
            console.log(`   ID: ${location.id} | ${location.name} | Type: ${location.type}`);
          });
        }
      } catch (error) {
        // Ignore if no locations table
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  showDatabaseCounts().catch(console.error);
}

module.exports = showDatabaseCounts;
