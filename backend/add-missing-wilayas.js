const { pool } = require('./config/database');

async function addMissingWilayas() {
  try {
    console.log('➕ Adding missing wilayas that have orders...');
    
    // Add wilaya 54 (In Guezzam) and 56 (Djanet) 
    const missingWilayas = [
      { id: 54, name_fr: 'In Guezzam', name_ar: 'عين قزام', home_price: 1550, office_price: 1150, pickup_price: 300, express_price: 300 },
      { id: 56, name_fr: 'Djanet', name_ar: 'جانت', home_price: 1550, office_price: 1150, pickup_price: 300, express_price: 300 }
    ];
    
    for (const wilaya of missingWilayas) {
      const [existing] = await pool.query('SELECT id FROM wilayas WHERE id = ?', [wilaya.id]);
      
      if (existing.length > 0) {
        // Update existing
        await pool.query(`
          UPDATE wilayas SET 
            name_fr = ?, 
            name_ar = ?, 
            name_en = ?,
            home_delivery_price = ?,
            office_delivery_price = ?,
            pickup_delivery_price = ?,
            express_delivery_price = ?,
            updated_at = NOW()
          WHERE id = ?
        `, [
          wilaya.name_fr,
          wilaya.name_ar,
          wilaya.name_fr,
          wilaya.home_price,
          wilaya.office_price,
          wilaya.pickup_price,
          wilaya.express_price,
          wilaya.id
        ]);
        console.log(`🔧 Updated wilaya ${wilaya.id}: ${wilaya.name_fr} (Home: ${wilaya.home_price}, Office: ${wilaya.office_price})`);
      } else {
        // Insert new
        await pool.query(`
          INSERT INTO wilayas (
            id, code, name_fr, name_ar, name_en,
            home_delivery_price, office_delivery_price, pickup_delivery_price, express_delivery_price,
            is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
        `, [
          wilaya.id,
          wilaya.id.toString().padStart(2, '0'),
          wilaya.name_fr,
          wilaya.name_ar,
          wilaya.name_fr,
          wilaya.home_price,
          wilaya.office_price,
          wilaya.pickup_price,
          wilaya.express_price
        ]);
        console.log(`➕ Inserted wilaya ${wilaya.id}: ${wilaya.name_fr} (Home: ${wilaya.home_price}, Office: ${wilaya.office_price})`);
      }
    }
    
    // Verify all wilayas
    console.log('\n📋 Final verification - All wilayas (50-58):');
    const [allWilayas] = await pool.query(`
      SELECT id, name_fr, name_ar, home_delivery_price, office_delivery_price
      FROM wilayas 
      WHERE id BETWEEN 50 AND 58
      ORDER BY id
    `);
    
    allWilayas.forEach(w => {
      const officePriceStatus = w.office_delivery_price === '0.00' ? '(Limited service)' : '';
      console.log(`   ID ${w.id}: ${w.name_fr} (${w.name_ar}) - Home: ${w.home_delivery_price}, Office: ${w.office_delivery_price} ${officePriceStatus}`);
    });
    
    console.log('\n✅ All missing wilayas added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding missing wilayas:', error);
  } finally {
    process.exit();
  }
}

addMissingWilayas();