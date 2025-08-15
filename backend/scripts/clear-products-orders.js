const mysql = require('mysql2/promise');
require('dotenv').config();

class DatabaseCleaner {
  constructor() {
    this.pool = null;
  }

  async initialize() {
    try {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      
      console.log('✅ Database connection established');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      return false;
    }
  }

  async showCounts() {
    try {
      console.log('\n📊 Current Database Counts:');
      console.log('============================');
      
      const tables = [
        'orders',
        'order_items', 
        'products',
        'product_variants',
        'stock_levels',
        'variant_stock_levels',
        'stock_movements',
        'variant_stock_movements',
        'tracking_logs',
        'google_sheets_processed'
      ];
      
      for (const table of tables) {
        try {
          const [result] = await this.pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`  ${table}: ${result[0].count} records`);
        } catch (error) {
          console.log(`  ${table}: Table not found or error`);
        }
      }
    } catch (error) {
      console.error('❌ Error showing counts:', error.message);
    }
  }

  async clearOrdersAndRelated() {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      console.log('\n🗑️ Clearing Orders and Related Data:');
      console.log('=====================================');
      
      // Clear tracking logs
      console.log('1. Clearing tracking_logs...');
      const [trackingResult] = await connection.query('DELETE FROM tracking_logs');
      console.log(`   ✅ Deleted ${trackingResult.affectedRows} tracking logs`);
      
      // Clear order items
      console.log('2. Clearing order_items...');
      const [orderItemsResult] = await connection.query('DELETE FROM order_items');
      console.log(`   ✅ Deleted ${orderItemsResult.affectedRows} order items`);
      
      // Clear orders
      console.log('3. Clearing orders...');
      const [ordersResult] = await connection.query('DELETE FROM orders');
      console.log(`   ✅ Deleted ${ordersResult.affectedRows} orders`);
      
      // Reset auto-increment counters
      console.log('4. Resetting auto-increment counters...');
      await connection.query('ALTER TABLE orders AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE order_items AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE tracking_logs AUTO_INCREMENT = 1');
      console.log('   ✅ Auto-increment counters reset');
      
      await connection.commit();
      console.log('✅ Orders cleanup completed successfully');
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error clearing orders:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  async clearProductsAndRelated() {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      console.log('\n🗑️ Clearing Products and Related Data:');
      console.log('=======================================');
      
      // Clear variant stock movements
      console.log('1. Clearing variant_stock_movements...');
      const [variantMovementsResult] = await connection.query('DELETE FROM variant_stock_movements');
      console.log(`   ✅ Deleted ${variantMovementsResult.affectedRows} variant stock movements`);
      
      // Clear variant stock levels
      console.log('2. Clearing variant_stock_levels...');
      const [variantStockResult] = await connection.query('DELETE FROM variant_stock_levels');
      console.log(`   ✅ Deleted ${variantStockResult.affectedRows} variant stock levels`);
      
      // Clear product variants
      console.log('3. Clearing product_variants...');
      const [variantsResult] = await connection.query('DELETE FROM product_variants');
      console.log(`   ✅ Deleted ${variantsResult.affectedRows} product variants`);
      
      // Clear stock movements
      console.log('4. Clearing stock_movements...');
      const [stockMovementsResult] = await connection.query('DELETE FROM stock_movements');
      console.log(`   ✅ Deleted ${stockMovementsResult.affectedRows} stock movements`);
      
      // Clear stock levels
      console.log('5. Clearing stock_levels...');
      const [stockLevelsResult] = await connection.query('DELETE FROM stock_levels');
      console.log(`   ✅ Deleted ${stockLevelsResult.affectedRows} stock levels`);
      
      // Clear products
      console.log('6. Clearing products...');
      const [productsResult] = await connection.query('DELETE FROM products');
      console.log(`   ✅ Deleted ${productsResult.affectedRows} products`);
      
      // Reset auto-increment counters
      console.log('7. Resetting auto-increment counters...');
      await connection.query('ALTER TABLE products AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE product_variants AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE stock_levels AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE variant_stock_levels AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE stock_movements AUTO_INCREMENT = 1');
      await connection.query('ALTER TABLE variant_stock_movements AUTO_INCREMENT = 1');
      console.log('   ✅ Auto-increment counters reset');
      
      await connection.commit();
      console.log('✅ Products cleanup completed successfully');
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error clearing products:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  async clearGoogleSheetsData() {
    try {
      console.log('\n🗑️ Clearing Google Sheets Import Data:');
      console.log('=======================================');
      
      // Clear processed files tracking
      const [processedResult] = await this.pool.query('DELETE FROM google_sheets_processed');
      console.log(`✅ Deleted ${processedResult.affectedRows} processed files records`);
      
      // Reset auto-increment
      await this.pool.query('ALTER TABLE google_sheets_processed AUTO_INCREMENT = 1');
      console.log('✅ Auto-increment counter reset');
      
    } catch (error) {
      console.error('❌ Error clearing Google Sheets data:', error.message);
    }
  }

  async performFullCleanup() {
    try {
      console.log('🧹 Starting Full Database Cleanup');
      console.log('==================================');
      
      // Show initial counts
      await this.showCounts();
      
      // Clear orders and related data first (due to foreign key constraints)
      await this.clearOrdersAndRelated();
      
      // Clear products and related data
      await this.clearProductsAndRelated();
      
      // Clear Google Sheets import tracking
      await this.clearGoogleSheetsData();
      
      // Show final counts
      console.log('\n📊 Final Database Counts:');
      console.log('==========================');
      await this.showCounts();
      
      console.log('\n🎉 Database cleanup completed successfully!');
      console.log('   - All orders and order items cleared');
      console.log('   - All products and variants cleared');
      console.log('   - All stock data cleared');
      console.log('   - All tracking logs cleared');
      console.log('   - Google Sheets import history cleared');
      console.log('   - Auto-increment counters reset');
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Main execution function
async function main() {
  const cleaner = new DatabaseCleaner();
  
  try {
    const initialized = await cleaner.initialize();
    if (!initialized) {
      process.exit(1);
    }
    
    // Ask for confirmation
    console.log('⚠️  WARNING: This will permanently delete ALL products and orders!');
    console.log('⚠️  This action cannot be undone!');
    console.log('');
    
    // Check if running with --confirm flag
    const args = process.argv.slice(2);
    if (!args.includes('--confirm')) {
      console.log('❌ To proceed, run this script with --confirm flag:');
      console.log('   node clear-products-orders.js --confirm');
      process.exit(1);
    }
    
    console.log('✅ Confirmation received, starting cleanup...');
    
    await cleaner.performFullCleanup();
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  } finally {
    await cleaner.close();
  }
}

// Handle script arguments
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = DatabaseCleaner;
