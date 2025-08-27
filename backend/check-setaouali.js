const { pool } = require('./config/database');

async function checkSetaouali() {
  const connection = await pool.getConnection();
  try {
    // Check communes for wilaya 16 (Alger) containing "Setao"
    const [communes] = await connection.query(`
      SELECT id, name, wilaya_id 
      FROM baladias 
      WHERE wilaya_id = 16 
      AND (name LIKE '%Setao%' OR name LIKE '%setao%')
      ORDER BY name
    `);
    
    console.log('🔍 Communes containing "Setao" in wilaya 16:');
    communes.forEach(c => console.log(`  - ID: ${c.id}, Name: ${c.name}`));
    
    // Also check similar sounding names
    const [similar] = await connection.query(`
      SELECT id, name 
      FROM baladias 
      WHERE wilaya_id = 16 
      AND (name LIKE '%Sidi%' OR name LIKE '%Staoueli%' OR name LIKE '%Staouali%')
      ORDER BY name
    `);
    
    console.log('\n🔍 Similar sounding communes in wilaya 16:');
    similar.forEach(c => console.log(`  - ID: ${c.id}, Name: ${c.name}`));
    
    // Check all communes for wilaya 16
    const [allCommunes] = await connection.query(`
      SELECT id, name 
      FROM baladias 
      WHERE wilaya_id = 16 
      ORDER BY name 
      LIMIT 30
    `);
    
    console.log('\n📋 First 30 communes in wilaya 16 (Alger):');
    allCommunes.forEach(c => console.log(`  - ID: ${c.id}, Name: ${c.name}`));
    
  } finally {
    connection.release();
    process.exit(0);
  }
}

checkSetaouali().catch(console.error);