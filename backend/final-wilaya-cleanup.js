const { pool } = require('./config/database');

async function finalWilayaCleanup() {
  try {
    console.log('🧹 Final wilaya database cleanup...');
    
    // The exact wilaya mappings that should exist
    const exactMappings = [
      { id: 50, name_fr: 'Bordj Badji Mokhtar', name_ar: 'برج باجي مختار' },
      { id: 51, name_fr: 'Ouled Djellal', name_ar: 'أولاد جلال' },
      { id: 52, name_fr: 'Beni Abbes', name_ar: 'بني عباس' },
      { id: 53, name_fr: 'In Salah', name_ar: 'عين صالح' },
      { id: 54, name_fr: 'In Guezzam', name_ar: 'عين قزام' },
      { id: 55, name_fr: 'Touggourt', name_ar: 'تقرت' },
      { id: 56, name_fr: 'Djanet', name_ar: 'جانت' },
      { id: 57, name_fr: 'El M\'Ghair', name_ar: 'المغير' },
      { id: 58, name_fr: 'El Meniaa', name_ar: 'المنيعة' }
    ];
    
    console.log('\n🔧 Applying exact mappings...');
    
    for (const mapping of exactMappings) {
      const [current] = await pool.query(
        'SELECT name_fr, name_ar FROM wilayas WHERE id = ?',
        [mapping.id]
      );
      
      if (current.length > 0) {
        if (current[0].name_fr !== mapping.name_fr || current[0].name_ar !== mapping.name_ar) {
          console.log(`🔧 Updating wilaya ${mapping.id}:`);
          console.log(`   From: ${current[0].name_fr} (${current[0].name_ar})`);
          console.log(`   To:   ${mapping.name_fr} (${mapping.name_ar})`);
          
          await pool.query(
            'UPDATE wilayas SET name_fr = ?, name_ar = ?, updated_at = NOW() WHERE id = ?',
            [mapping.name_fr, mapping.name_ar, mapping.id]
          );
        } else {
          console.log(`✅ Wilaya ${mapping.id} (${mapping.name_fr}) is correct`);
        }
      } else {
        console.log(`➕ Adding missing wilaya ${mapping.id}: ${mapping.name_fr}`);
        await pool.query(
          'INSERT INTO wilayas (id, code, name_fr, name_ar, name_en, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())',
          [mapping.id, mapping.id.toString().padStart(2, '0'), mapping.name_fr, mapping.name_ar, mapping.name_fr]
        );
      }
    }
    
    console.log('\n📋 Final verification - Corrected wilayas (50-58):');
    const [finalMappings] = await pool.query(`
      SELECT id, name_fr, name_ar 
      FROM wilayas 
      WHERE id BETWEEN 50 AND 58
      ORDER BY id
    `);
    
    finalMappings.forEach(w => {
      console.log(`   ID: ${w.id} = ${w.name_fr} (${w.name_ar})`);
    });
    
    console.log('\n✅ Final cleanup completed!');
    console.log('\n🎯 The database now matches your pricing table format exactly.');
    console.log('   This should resolve all Ecotrack station code mismatches.');
    
  } catch (error) {
    console.error('❌ Error during final cleanup:', error);
  } finally {
    process.exit();
  }
}

finalWilayaCleanup();