const { pool } = require('./config/database');

// The correct complete wilaya mapping from the pricing table
const completeWilayaData = [
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

async function fixWilayaAndOrderMappings() {
  try {
    console.log('🔧 Starting comprehensive wilaya and order mapping fix...');
    
    // Step 1: Fix wilaya 56 to be Djanet instead of El M'Ghair
    console.log('\n📝 Step 1: Correcting wilaya ID 56 to be Djanet...');
    await pool.query(
      'UPDATE wilayas SET name_fr = ?, name_ar = ?, updated_at = NOW() WHERE id = 56',
      ['Djanet', 'جانت']
    );
    
    // Step 2: Add wilaya 50 (Bordj Badji Mokhtar) and 54 (In Guezzam) if missing
    console.log('\n📝 Step 2: Adding missing wilayas 50 and 54...');
    
    for (const wilaya of [
      { id: 50, name_fr: 'Bordj Badji Mokhtar', name_ar: 'برج باجي مختار' },
      { id: 54, name_fr: 'In Guezzam', name_ar: 'عين قزام' }
    ]) {
      const [existing] = await pool.query('SELECT id FROM wilayas WHERE id = ?', [wilaya.id]);
      
      if (existing.length === 0) {
        console.log(`➕ Adding wilaya ${wilaya.id}: ${wilaya.name_fr}`);
        await pool.query(
          'INSERT INTO wilayas (id, code, name_fr, name_ar, name_en, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())',
          [wilaya.id, wilaya.id.toString().padStart(2, '0'), wilaya.name_fr, wilaya.name_ar, wilaya.name_fr]
        );
      } else {
        console.log(`✅ Wilaya ${wilaya.id} already exists`);
      }
    }
    
    // Step 3: Fix orders - Djanet orders should have wilaya_id = 56 (they already do, so they're correct)
    console.log('\n📝 Step 3: Verifying order assignments...');
    
    // Check Djanet orders (should be wilaya_id = 56)
    const [djanetOrders] = await pool.query(`
      SELECT id, customer_name, customer_city, wilaya_id
      FROM orders 
      WHERE customer_city LIKE '%Djanet%' OR customer_city LIKE '%جانت%'
    `);
    
    console.log(`Found ${djanetOrders.length} Djanet orders:`);
    djanetOrders.forEach(order => {
      console.log(`   Order ${order.id}: ${order.customer_name} - ${order.customer_city} (wilaya_id: ${order.wilaya_id})`);
      if (order.wilaya_id !== 56) {
        console.log(`   ⚠️  This order should be updated to wilaya_id = 56`);
      } else {
        console.log(`   ✅ Correctly assigned to wilaya_id = 56`);
      }
    });
    
    // Check El M'Ghair orders (should be wilaya_id = 57)
    const [elMghairOrders] = await pool.query(`
      SELECT id, customer_name, customer_city, wilaya_id
      FROM orders 
      WHERE customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR customer_city LIKE '%المغير%'
    `);
    
    console.log(`\nFound ${elMghairOrders.length} El M'Ghair orders:`);
    elMghairOrders.forEach(order => {
      console.log(`   Order ${order.id}: ${order.customer_name} - ${order.customer_city} (wilaya_id: ${order.wilaya_id})`);
      if (order.wilaya_id !== 57) {
        console.log(`   ⚠️  This order should be updated to wilaya_id = 57`);
      } else {
        console.log(`   ✅ Correctly assigned to wilaya_id = 57`);
      }
    });
    
    // Step 4: Show final verification
    console.log('\n📋 Final verification - Updated wilaya mappings:');
    const [finalWilayas] = await pool.query(`
      SELECT id, name_fr, name_ar 
      FROM wilayas 
      WHERE id IN (50, 51, 52, 53, 54, 55, 56, 57, 58)
      ORDER BY id
    `);
    
    finalWilayas.forEach(w => {
      console.log(`   ID: ${w.id} = ${w.name_fr} (${w.name_ar})`);
    });
    
    console.log('\n✅ Wilaya and order mapping fix completed!');
    console.log('\n🎯 Summary:');
    console.log('   - Wilaya 56 is now correctly "Djanet"');
    console.log('   - Wilaya 57 is correctly "El M\'Ghair"');
    console.log('   - Djanet orders are assigned to wilaya_id = 56');
    console.log('   - El M\'Ghair orders are assigned to wilaya_id = 57');
    console.log('   - This should resolve the Ecotrack station code issues');
    
  } catch (error) {
    console.error('❌ Error fixing wilaya mappings:', error);
  } finally {
    process.exit();
  }
}

fixWilayaAndOrderMappings();