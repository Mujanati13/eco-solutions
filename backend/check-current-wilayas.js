const { pool } = require('./config/database');

async function checkCurrentWilayas() {
  try {
    // Check current wilaya data, especially around IDs 56-58
    const [wilayas] = await pool.query(`
      SELECT id, code, name_fr, name_ar 
      FROM wilayas 
      WHERE id BETWEEN 50 AND 60
      ORDER BY id
    `);
    
    console.log('Current wilayas (50-60):');
    wilayas.forEach(w => {
      console.log(`ID: ${w.id}, Code: ${w.code}, French: ${w.name_fr}, Arabic: ${w.name_ar}`);
    });
    
    // Check total count
    const [count] = await pool.query('SELECT COUNT(*) as total FROM wilayas');
    console.log(`\nTotal wilayas in database: ${count[0].total}`);
    
    // Check for specific problematic wilayas
    const [elMghair] = await pool.query(`
      SELECT id, code, name_fr, name_ar 
      FROM wilayas 
      WHERE name_fr LIKE '%Ghair%' OR name_fr LIKE '%M''Ghair%'
    `);
    
    console.log('\nEl M\'Ghair related wilayas:');
    elMghair.forEach(w => {
      console.log(`ID: ${w.id}, Code: ${w.code}, French: ${w.name_fr}, Arabic: ${w.name_ar}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkCurrentWilayas();