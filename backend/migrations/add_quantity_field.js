const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function addQuantityField() {
  try {
    console.log('🔄 Adding quantity field to orders table...');
    
    // Add quantity field to orders table
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN quantity INT DEFAULT 1 
      AFTER product_weight
    `);
    
    console.log('✅ Added quantity field to orders table');
    
    // Update existing orders to extract quantity from product_details
    console.log('🔄 Updating existing orders with quantity from product_details...');
    
    const [orders] = await pool.query('SELECT id, product_details FROM orders WHERE product_details IS NOT NULL');
    
    for (const order of orders) {
      try {
        let productDetails;
        if (typeof order.product_details === 'string') {
          productDetails = JSON.parse(order.product_details);
        } else {
          productDetails = order.product_details;
        }
        
        const quantity = parseInt(productDetails.quantity) || 1;
        
        await pool.query(
          'UPDATE orders SET quantity = ? WHERE id = ?',
          [quantity, order.id]
        );
        
        console.log(`✅ Updated order ${order.id} with quantity ${quantity}`);
      } catch (error) {
        console.warn(`⚠️ Failed to update order ${order.id}:`, error.message);
      }
    }
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addQuantityField();
}

module.exports = { addQuantityField };