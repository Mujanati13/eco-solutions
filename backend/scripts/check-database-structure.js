const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('🔍 Checking Database Structure for Wilayas and Baladias');
    console.log('=========================================================');
    
    // Check wilayas table structure
    const [wilayaColumns] = await pool.query('DESCRIBE wilayas');
    console.log('\n📍 Wilayas Table Structure:');
    wilayaColumns.forEach(col => {
      console.log(`  ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check baladias table structure
    const [baladiaColumns] = await pool.query('DESCRIBE baladias');
    console.log('\n🏘️ Baladias Table Structure:');
    baladiaColumns.forEach(col => {
      console.log(`  ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Sample wilayas
    const [wilayas] = await pool.query('SELECT id, code, name_en, name_fr, name_ar FROM wilayas ORDER BY code LIMIT 5');
    console.log('\n📍 Sample Wilayas:');
    wilayas.forEach(w => {
      const name = w.name_en || w.name_fr || w.name_ar;
      console.log(`  ID: ${w.id} | Code: ${w.code} | Name: ${name}`);
    });

    // Sample baladias for Alger (wilaya_id = 16)
    const [baladias] = await pool.query('SELECT id, wilaya_id, name_ar, name_fr, name_en FROM baladias WHERE wilaya_id = 16 LIMIT 5');
    console.log('\n🏘️ Sample Baladias (Wilaya 16 - Alger):');
    baladias.forEach(b => {
      const name = b.name_en || b.name_fr || b.name_ar;
      console.log(`  ID: ${b.id} | Wilaya: ${b.wilaya_id} | Name: ${name}`);
    });

    // Check orders table for baladia fields
    const [ordersColumns] = await pool.query('DESCRIBE orders');
    const baladiaFields = ordersColumns.filter(col => col.Field.includes('baladia'));
    console.log('\n📋 Orders Table - Baladia Fields:');
    baladiaFields.forEach(col => {
      console.log(`  ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Sample orders with baladia data
    const [orders] = await pool.query('SELECT id, wilaya_id, baladia_id, baladia_name FROM orders WHERE baladia_id IS NOT NULL LIMIT 5');
    console.log('\n📋 Sample Orders with Baladia:');
    if (orders.length === 0) {
      console.log('  No orders found with baladia_id');
    } else {
      orders.forEach(o => {
        console.log(`  Order: ${o.id} | Wilaya: ${o.wilaya_id} | Baladia ID: ${o.baladia_id} | Baladia Name: ${o.baladia_name}`);
      });
    }

    // Count of baladias per wilaya
    const [baladiaCount] = await pool.query(`
      SELECT w.id, w.name_en as wilaya_name, COUNT(b.id) as baladia_count 
      FROM wilayas w 
      LEFT JOIN baladias b ON w.id = b.wilaya_id 
      GROUP BY w.id, w.name_en 
      HAVING baladia_count > 0 
      ORDER BY baladia_count DESC 
      LIMIT 10
    `);
    console.log('\n📊 Top Wilayas by Baladia Count:');
    baladiaCount.forEach(wc => {
      console.log(`  ${wc.wilaya_name} (ID: ${wc.id}): ${wc.baladia_count} baladias`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkDatabase().catch(console.error);
