const { pool } = require('./config/database');

// Correct wilaya data from the pricing table
const correctWilayaData = [
  { id: 1, name_fr: 'Adrar', name_ar: 'أدرار' },
  { id: 2, name_fr: 'Chlef', name_ar: 'الشلف' },
  { id: 3, name_fr: 'Laghouat', name_ar: 'الأغواط' },
  { id: 4, name_fr: 'Oum El Bouaghi', name_ar: 'أم البواقي' },
  { id: 5, name_fr: 'Batna', name_ar: 'باتنة' },
  { id: 6, name_fr: 'Béjaïa', name_ar: 'بجاية' },
  { id: 7, name_fr: 'Biskra', name_ar: 'بسكرة' },
  { id: 8, name_fr: 'Béchar', name_ar: 'بشار' },
  { id: 9, name_fr: 'Blida', name_ar: 'البليدة' },
  { id: 10, name_fr: 'Bouira', name_ar: 'البويرة' },
  { id: 11, name_fr: 'Tamanrasset', name_ar: 'تمنراست' },
  { id: 12, name_fr: 'Tébessa', name_ar: 'تبسة' },
  { id: 13, name_fr: 'Tlemcen', name_ar: 'تلمسان' },
  { id: 14, name_fr: 'Tiaret', name_ar: 'تيارت' },
  { id: 15, name_fr: 'Tizi Ouzou', name_ar: 'تيزي وزو' },
  { id: 16, name_fr: 'Alger', name_ar: 'الجزائر' },
  { id: 17, name_fr: 'Djelfa', name_ar: 'الجلفة' },
  { id: 18, name_fr: 'Jijel', name_ar: 'جيجل' },
  { id: 19, name_fr: 'Sétif', name_ar: 'سطيف' },
  { id: 20, name_fr: 'Saïda', name_ar: 'سعيدة' },
  { id: 21, name_fr: 'Skikda', name_ar: 'سكيكدة' },
  { id: 22, name_fr: 'Sidi Bel Abbès', name_ar: 'سيدي بلعباس' },
  { id: 23, name_fr: 'Annaba', name_ar: 'عنابة' },
  { id: 24, name_fr: 'Guelma', name_ar: 'قالمة' },
  { id: 25, name_fr: 'Constantine', name_ar: 'قسنطينة' },
  { id: 26, name_fr: 'Médéa', name_ar: 'المدية' },
  { id: 27, name_fr: 'Mostaganem', name_ar: 'مستغانم' },
  { id: 28, name_fr: 'M\'Sila', name_ar: 'المسيلة' },
  { id: 29, name_fr: 'Mascara', name_ar: 'معسكر' },
  { id: 30, name_fr: 'Ouargla', name_ar: 'ورقلة' },
  { id: 31, name_fr: 'Oran', name_ar: 'وهران' },
  { id: 32, name_fr: 'El Bayadh', name_ar: 'البيض' },
  { id: 33, name_fr: 'Illizi', name_ar: 'إليزي' },
  { id: 34, name_fr: 'Bordj Bou Arreridj', name_ar: 'برج بوعريريج' },
  { id: 35, name_fr: 'Boumerdès', name_ar: 'بومرداس' },
  { id: 36, name_fr: 'El Tarf', name_ar: 'الطارف' },
  { id: 37, name_fr: 'Tindouf', name_ar: 'تندوف' },
  { id: 38, name_fr: 'Tissemsilt', name_ar: 'تيسمسيلت' },
  { id: 39, name_fr: 'El Oued', name_ar: 'الوادي' },
  { id: 40, name_fr: 'Khenchela', name_ar: 'خنشلة' },
  { id: 41, name_fr: 'Souk Ahras', name_ar: 'سوق أهراس' },
  { id: 42, name_fr: 'Tipaza', name_ar: 'تيبازة' },
  { id: 43, name_fr: 'Mila', name_ar: 'ميلة' },
  { id: 44, name_fr: 'Aïn Defla', name_ar: 'عين الدفلى' },
  { id: 45, name_fr: 'Naâma', name_ar: 'النعامة' },
  { id: 46, name_fr: 'Aïn Témouchent', name_ar: 'عين تموشنت' },
  { id: 47, name_fr: 'Ghardaïa', name_ar: 'غرداية' },
  { id: 48, name_fr: 'Relizane', name_ar: 'غليزان' },
  { id: 49, name_fr: 'Timimoun', name_ar: 'تيميمون' },
  { id: 51, name_fr: 'Ouled Djellal', name_ar: 'أولاد جلال' },
  { id: 52, name_fr: 'Beni Abbes', name_ar: 'بني عباس' },
  { id: 53, name_fr: 'In Salah', name_ar: 'عين صالح' },
  { id: 55, name_fr: 'Touggourt', name_ar: 'تقرت' },
  { id: 57, name_fr: 'El M\'Ghair', name_ar: 'المغير' },
  { id: 58, name_fr: 'El Meniaa', name_ar: 'المنيعة' }
];

async function updateWilayaData() {
  try {
    console.log('🔄 Starting wilaya data correction...');
    
    // First, backup current data
    console.log('📁 Creating backup of current wilaya data...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wilayas_backup_${Date.now()} AS 
      SELECT * FROM wilayas
    `);
    
    let updateCount = 0;
    
    for (const wilaya of correctWilayaData) {
      // Check if this wilaya exists
      const [existing] = await pool.query(
        'SELECT id, name_fr, name_ar FROM wilayas WHERE id = ?',
        [wilaya.id]
      );
      
      if (existing.length > 0) {
        const current = existing[0];
        if (current.name_fr !== wilaya.name_fr || current.name_ar !== wilaya.name_ar) {
          console.log(`🔧 Updating wilaya ${wilaya.id}:`);
          console.log(`   From: ${current.name_fr} (${current.name_ar})`);
          console.log(`   To:   ${wilaya.name_fr} (${wilaya.name_ar})`);
          
          await pool.query(
            'UPDATE wilayas SET name_fr = ?, name_ar = ?, updated_at = NOW() WHERE id = ?',
            [wilaya.name_fr, wilaya.name_ar, wilaya.id]
          );
          updateCount++;
        } else {
          console.log(`✅ Wilaya ${wilaya.id} (${wilaya.name_fr}) is already correct`);
        }
      } else {
        console.log(`➕ Inserting new wilaya ${wilaya.id}: ${wilaya.name_fr}`);
        await pool.query(
          'INSERT INTO wilayas (id, code, name_fr, name_ar, name_en, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())',
          [wilaya.id, wilaya.id.toString().padStart(2, '0'), wilaya.name_fr, wilaya.name_ar, wilaya.name_fr]
        );
        updateCount++;
      }
    }
    
    console.log(`\n✅ Wilaya update completed! ${updateCount} changes made.`);
    
    // Show the corrected data for verification
    console.log('\n📋 Verification - Corrected wilayas:');
    const [updated] = await pool.query(`
      SELECT id, name_fr, name_ar 
      FROM wilayas 
      WHERE id IN (51, 52, 53, 55, 57, 58)
      ORDER BY id
    `);
    
    updated.forEach(w => {
      console.log(`   ID: ${w.id}, French: ${w.name_fr}, Arabic: ${w.name_ar}`);
    });
    
  } catch (error) {
    console.error('❌ Error updating wilaya data:', error);
  } finally {
    process.exit();
  }
}

updateWilayaData();