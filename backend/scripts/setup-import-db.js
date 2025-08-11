require('dotenv').config();
const { pool } = require('../config/database');
const DeliveryPricingMigration = require('../migrations/add_delivery_pricing');
const BaladiaSupport = require('../migrations/add_baladia_support');
const { addFrenchExcelColumns } = require('../migrations/add_french_excel_columns');

async function ensureGoogleTokensTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS google_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type VARCHAR(50) DEFAULT 'Bearer',
      expires_at DATETIME NOT NULL,
      scope TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_token (user_id)
    )
  `);
}

async function verifyOrdersColumns() {
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
  `);
  const names = cols.map(c => c.COLUMN_NAME);
  const required = ['wilaya_code','wilaya_id','baladia_id','customer_phone_2','weight','delivery_type','delivery_price'];
  const missing = required.filter(c => !names.includes(c));
  console.log(missing.length ? `⚠️ Missing columns: ${missing.join(', ')}` : '✅ orders table has all required columns');
}

async function main() {
  try {
    const [db] = await pool.query('SELECT DATABASE() as db');
    console.log(`🏷️ Using database: ${db[0].db}`);

    console.log('\n🔄 Running delivery pricing migration (wilayas + orders.wilaya_id)...');
    await DeliveryPricingMigration.up();

    console.log('\n🔄 Running baladia support migration (baladias + orders.baladia_id)...');
    await BaladiaSupport.up();

    console.log('\n🔄 Adding French Excel columns (wilaya_code, weight, customer_phone_2)...');
    await addFrenchExcelColumns();

    console.log('\n🔄 Ensuring google_tokens table...');
    await ensureGoogleTokensTable();

    console.log('\n🔎 Verifying orders table columns...');
    await verifyOrdersColumns();

    console.log('\n✅ Setup completed');
  } catch (e) {
    console.error('❌ Setup failed:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
