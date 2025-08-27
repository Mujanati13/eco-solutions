const { pool } = require('./config/database');

async function checkWilayaAndStation() {
  try {
    // Check what wilaya ID should be for "Oum El Bouaghi"
    const [wilayas] = await pool.query(`
      SELECT id, code, name_fr, name_ar 
      FROM wilayas 
      WHERE name_fr LIKE '%Oum%' OR name_ar LIKE '%البواقي%'
    `);
    
    console.log('Wilayas matching "Oum El Bouaghi":');
    wilayas.forEach(w => {
      console.log(`ID: ${w.id}, Code: ${w.code}, French: ${w.name_fr}, Arabic: ${w.name_ar}`);
    });
    
    // Check what station 15B is
    console.log('\nStation 15B info would need to be checked with EcoTrack API...');
    
    // Also check wilaya 42 to see what it actually is
    const [wilaya42] = await pool.query(`
      SELECT id, code, name_fr, name_ar 
      FROM wilayas 
      WHERE id = 42
    `);
    
    console.log('\nWilaya 42 is:');
    if (wilaya42.length > 0) {
      console.log(`ID: ${wilaya42[0].id}, Code: ${wilaya42[0].code}, French: ${wilaya42[0].name_fr}, Arabic: ${wilaya42[0].name_ar}`);
    } else {
      console.log('Wilaya 42 not found!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkWilayaAndStation();