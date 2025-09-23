const { pool } = require('./config/database');

async function checkElMghair() {
  try {
    // Check what El M'Ghair's wilaya ID is in the database
    const [wilayas] = await pool.query(`
      SELECT id, code, name_fr, name_ar 
      FROM wilayas 
      WHERE name_fr LIKE '%Ghair%' OR name_fr LIKE '%M''Ghair%' OR name_ar LIKE '%الغير%'
    `);
    
    console.log('Wilayas matching "El M\'Ghair":');
    wilayas.forEach(w => {
      console.log(`ID: ${w.id}, Code: ${w.code}, French: ${w.name_fr}, Arabic: ${w.name_ar}`);
    });
    
    // Also check wilaya 57 and 58
    const [wilaya5758] = await pool.query(`
      SELECT id, code, name_fr, name_ar 
      FROM wilayas 
      WHERE id IN (57, 58)
      ORDER BY id
    `);
    
    console.log('\nWilayas 57 and 58:');
    wilaya5758.forEach(w => {
      console.log(`ID: ${w.id}, Code: ${w.code}, French: ${w.name_fr}, Arabic: ${w.name_ar}`);
    });
    
    // Check recent orders for El M'Ghair
    const [orders] = await pool.query(`
      SELECT id, order_number, customer_city, wilaya_id, ecotrack_station_code
      FROM orders 
      WHERE customer_city LIKE '%Ghair%' OR customer_city LIKE '%M''Ghair%'
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.log('\nRecent orders from El M\'Ghair:');
    orders.forEach(o => {
      console.log(`Order ${o.order_number}: city=${o.customer_city}, wilaya_id=${o.wilaya_id}, station=${o.ecotrack_station_code}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkElMghair();