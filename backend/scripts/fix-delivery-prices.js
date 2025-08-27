const { pool } = require('../config/database');

/**
 * Script to fix corrupted delivery prices in orders table
 * This script identifies and fixes orders where delivery_price equals total_amount
 */

async function fixDeliveryPrices() {
  try {
    console.log('🔍 Starting delivery price corruption fix...');

    // Find orders where delivery_price equals total_amount (data corruption)
    const [corruptedOrders] = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.delivery_price,
        o.wilaya_id,
        w.code as wilaya_code,
        w.name_en as wilaya_name
      FROM orders o
      LEFT JOIN wilayas w ON o.wilaya_id = w.id
      WHERE o.delivery_price = o.total_amount 
        AND o.total_amount > 0
        AND o.delivery_price > 0
      ORDER BY o.id
    `);

    console.log(`📊 Found ${corruptedOrders.length} orders with corrupted delivery prices`);

    if (corruptedOrders.length === 0) {
      console.log('✅ No corrupted delivery prices found!');
      return;
    }

    // Define major cities (lower delivery rates)
    const majorCities = ['16', '31', '25', '19', '06', '21', '23']; // Algiers, Oran, Constantine, Setif, Bejaia, Skikda, Annaba
    
    let fixedCount = 0;
    let errors = [];

    for (const order of corruptedOrders) {
      try {
        let correctedDeliveryPrice = 400; // Default fallback
        
        if (order.wilaya_id && order.wilaya_code) {
          // Try to get actual delivery pricing from database
          const [pricing] = await pool.query(`
            SELECT base_price 
            FROM delivery_pricing 
            WHERE wilaya_id = ? AND delivery_type = 'home' AND is_active = true
            ORDER BY priority ASC
            LIMIT 1
          `, [order.wilaya_id]);
          
          if (pricing.length > 0) {
            correctedDeliveryPrice = parseFloat(pricing[0].base_price);
          } else {
            // Use default pricing based on wilaya
            correctedDeliveryPrice = majorCities.includes(order.wilaya_code) ? 400 : 600;
          }
        }

        // Update the order with corrected delivery price
        const newFinalTotal = parseFloat(order.total_amount) + correctedDeliveryPrice;
        
        await pool.query(`
          UPDATE orders 
          SET delivery_price = ?, updated_at = NOW()
          WHERE id = ?
        `, [correctedDeliveryPrice, order.id]);

        console.log(`✅ Fixed order ${order.order_number}: ${order.delivery_price} DA → ${correctedDeliveryPrice} DA`);
        fixedCount++;
        
      } catch (error) {
        console.error(`❌ Error fixing order ${order.order_number}:`, error.message);
        errors.push(`Order ${order.order_number}: ${error.message}`);
      }
    }

    console.log(`\n📈 Fix Summary:`);
    console.log(`   Total corrupted orders: ${corruptedOrders.length}`);
    console.log(`   Successfully fixed: ${fixedCount}`);
    console.log(`   Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      errors.forEach(error => console.log(`   • ${error}`));
    }

    console.log('\n✅ Delivery price fix completed!');

  } catch (error) {
    console.error('💥 Fatal error during delivery price fix:', error);
    process.exit(1);
  }
}

// Add validation script to check for delivery price issues
async function validateDeliveryPrices() {
  try {
    console.log('🔍 Validating delivery prices...');

    // Check for various delivery price issues
    const checks = [
      {
        name: 'Orders with delivery_price = total_amount',
        query: `
          SELECT COUNT(*) as count 
          FROM orders 
          WHERE delivery_price = total_amount 
            AND total_amount > 0
        `
      },
      {
        name: 'Orders with unreasonable delivery prices (< 50 DA)',
        query: `
          SELECT COUNT(*) as count 
          FROM orders 
          WHERE delivery_price < 50 
            AND delivery_price > 0
        `
      },
      {
        name: 'Orders with unreasonable delivery prices (> 2000 DA)',
        query: `
          SELECT COUNT(*) as count 
          FROM orders 
          WHERE delivery_price > 2000
        `
      },
      {
        name: 'Orders with null/zero delivery prices',
        query: `
          SELECT COUNT(*) as count 
          FROM orders 
          WHERE (delivery_price IS NULL OR delivery_price = 0)
            AND total_amount > 0
        `
      }
    ];

    console.log('📊 Delivery Price Validation Results:');
    for (const check of checks) {
      const [result] = await pool.query(check.query);
      const count = result[0].count;
      const status = count > 0 ? '⚠️' : '✅';
      console.log(`   ${status} ${check.name}: ${count} orders`);
    }

  } catch (error) {
    console.error('Error during validation:', error);
  }
}

// Main execution
async function main() {
  if (process.argv.includes('--validate')) {
    await validateDeliveryPrices();
  } else if (process.argv.includes('--fix')) {
    await fixDeliveryPrices();
  } else {
    console.log('🔧 Delivery Price Fix Utility');
    console.log('');
    console.log('Usage:');
    console.log('  node fix-delivery-prices.js --validate   # Check for delivery price issues');
    console.log('  node fix-delivery-prices.js --fix        # Fix corrupted delivery prices');
    console.log('');
    console.log('Examples:');
    console.log('  # Check current issues');
    console.log('  node fix-delivery-prices.js --validate');
    console.log('');
    console.log('  # Fix corrupted delivery prices');
    console.log('  node fix-delivery-prices.js --fix');
  }
  
  process.exit(0);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

// Run the script
main();