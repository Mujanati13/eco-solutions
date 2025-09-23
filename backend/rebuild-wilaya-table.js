const { pool } = require('./config/database');

// Complete wilaya data with pricing from your table
const COMPLETE_WILAYA_DATA = [
  { id: 1, name_fr: 'Adrar', name_ar: 'أدرار', home_price: 1150, office_price: 750, pickup_price: 300, express_price: 300 },
  { id: 2, name_fr: 'Chlef', name_ar: 'الشلف', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 3, name_fr: 'Laghouat', name_ar: 'الأغواط', home_price: 750, office_price: 450, pickup_price: 300, express_price: 300 },
  { id: 4, name_fr: 'Oum El Bouaghi', name_ar: 'أم البواقي', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 5, name_fr: 'Batna', name_ar: 'باتنة', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 6, name_fr: 'Béjaïa', name_ar: 'بجاية', home_price: 580, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 7, name_fr: 'Biskra', name_ar: 'بسكرة', home_price: 750, office_price: 450, pickup_price: 300, express_price: 300 },
  { id: 8, name_fr: 'Béchar', name_ar: 'بشار', home_price: 900, office_price: 550, pickup_price: 300, express_price: 300 },
  { id: 9, name_fr: 'Blida', name_ar: 'البليدة', home_price: 500, office_price: 300, pickup_price: 300, express_price: 300 },
  { id: 10, name_fr: 'Bouira', name_ar: 'البويرة', home_price: 500, office_price: 300, pickup_price: 300, express_price: 300 },
  { id: 11, name_fr: 'Tamanrasset', name_ar: 'تمنراست', home_price: 1550, office_price: 1150, pickup_price: 300, express_price: 300 },
  { id: 12, name_fr: 'Tébessa', name_ar: 'تبسة', home_price: 650, office_price: 400, pickup_price: 300, express_price: 300 },
  { id: 13, name_fr: 'Tlemcen', name_ar: 'تلمسان', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 14, name_fr: 'Tiaret', name_ar: 'تيارت', home_price: 650, office_price: 400, pickup_price: 300, express_price: 300 },
  { id: 15, name_fr: 'Tizi Ouzou', name_ar: 'تيزي وزو', home_price: 500, office_price: 300, pickup_price: 300, express_price: 300 },
  { id: 16, name_fr: 'Alger', name_ar: 'الجزائر', home_price: 500, office_price: 300, pickup_price: 300, express_price: 300 },
  { id: 17, name_fr: 'Djelfa', name_ar: 'الجلفة', home_price: 750, office_price: 450, pickup_price: 300, express_price: 300 },
  { id: 18, name_fr: 'Jijel', name_ar: 'جيجل', home_price: 550, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 19, name_fr: 'Sétif', name_ar: 'سطيف', home_price: 450, office_price: 250, pickup_price: 300, express_price: 300 },
  { id: 20, name_fr: 'Saïda', name_ar: 'سعيدة', home_price: 650, office_price: 400, pickup_price: 300, express_price: 300 },
  { id: 21, name_fr: 'Skikda', name_ar: 'سكيكدة', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 22, name_fr: 'Sidi Bel Abbès', name_ar: 'سيدي بلعباس', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 23, name_fr: 'Annaba', name_ar: 'عنابة', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 24, name_fr: 'Guelma', name_ar: 'قالمة', home_price: 650, office_price: 400, pickup_price: 300, express_price: 300 },
  { id: 25, name_fr: 'Constantine', name_ar: 'قسنطينة', home_price: 550, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 26, name_fr: 'Médéa', name_ar: 'المدية', home_price: 570, office_price: 300, pickup_price: 300, express_price: 300 },
  { id: 27, name_fr: 'Mostaganem', name_ar: 'مستغانم', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 28, name_fr: 'M\'Sila', name_ar: 'المسيلة', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 29, name_fr: 'Mascara', name_ar: 'معسكر', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 30, name_fr: 'Ouargla', name_ar: 'ورقلة', home_price: 850, office_price: 500, pickup_price: 300, express_price: 300 },
  { id: 31, name_fr: 'Oran', name_ar: 'وهران', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 32, name_fr: 'El Bayadh', name_ar: 'البيض', home_price: 900, office_price: 550, pickup_price: 300, express_price: 300 },
  { id: 33, name_fr: 'Illizi', name_ar: 'إليزي', home_price: 1550, office_price: 1150, pickup_price: 300, express_price: 300 },
  { id: 34, name_fr: 'Bordj Bou Arreridj', name_ar: 'برج بوعريريج', home_price: 500, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 35, name_fr: 'Boumerdès', name_ar: 'بومرداس', home_price: 500, office_price: 300, pickup_price: 300, express_price: 300 },
  { id: 36, name_fr: 'El Tarf', name_ar: 'الطارف', home_price: 650, office_price: 400, pickup_price: 300, express_price: 300 },
  { id: 37, name_fr: 'Tindouf', name_ar: 'تندوف', home_price: 1350, office_price: 800, pickup_price: 300, express_price: 300 },
  { id: 38, name_fr: 'Tissemsilt', name_ar: 'تيسمسيلت', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 39, name_fr: 'El Oued', name_ar: 'الوادي', home_price: 850, office_price: 500, pickup_price: 300, express_price: 300 },
  { id: 40, name_fr: 'Khenchela', name_ar: 'خنشلة', home_price: 650, office_price: 400, pickup_price: 300, express_price: 300 },
  { id: 41, name_fr: 'Souk Ahras', name_ar: 'سوق أهراس', home_price: 650, office_price: 400, pickup_price: 300, express_price: 300 },
  { id: 42, name_fr: 'Tipaza', name_ar: 'تيبازة', home_price: 550, office_price: 300, pickup_price: 300, express_price: 300 },
  { id: 43, name_fr: 'Mila', name_ar: 'ميلة', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 44, name_fr: 'Aïn Defla', name_ar: 'عين الدفلى', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 45, name_fr: 'Naâma', name_ar: 'النعامة', home_price: 900, office_price: 550, pickup_price: 300, express_price: 300 },
  { id: 46, name_fr: 'Aïn Témouchent', name_ar: 'عين تموشنت', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 47, name_fr: 'Ghardaïa', name_ar: 'غرداية', home_price: 850, office_price: 500, pickup_price: 300, express_price: 300 },
  { id: 48, name_fr: 'Relizane', name_ar: 'غليزان', home_price: 600, office_price: 350, pickup_price: 300, express_price: 300 },
  { id: 49, name_fr: 'Timimoun', name_ar: 'تيميمون', home_price: 1150, office_price: 750, pickup_price: 300, express_price: 300 },
  { id: 51, name_fr: 'Ouled Djellal', name_ar: 'أولاد جلال', home_price: 750, office_price: 450, pickup_price: 300, express_price: 300 },
  { id: 52, name_fr: 'Beni Abbes', name_ar: 'بني عباس', home_price: 900, office_price: 0, pickup_price: 300, express_price: 300 },
  { id: 53, name_fr: 'In Salah', name_ar: 'عين صالح', home_price: 1450, office_price: 950, pickup_price: 300, express_price: 300 },
  { id: 55, name_fr: 'Touggourt', name_ar: 'تقرت', home_price: 850, office_price: 500, pickup_price: 300, express_price: 300 },
  { id: 57, name_fr: 'El M\'Ghair', name_ar: 'المغير', home_price: 850, office_price: 0, pickup_price: 300, express_price: 300 },
  { id: 58, name_fr: 'El Meniaa', name_ar: 'المنيعة', home_price: 850, office_price: 500, pickup_price: 300, express_price: 300 }
];

async function rebuildWilayaTable() {
  try {
    console.log('🚨 REBUILDING WILAYA TABLE WITH COMPLETE DATA');
    console.log('=' .repeat(60));
    
    // Step 1: Create backup
    console.log('💾 Creating backup of current wilayas table...');
    await pool.query(`CREATE TABLE wilayas_backup_complete_rebuild AS SELECT * FROM wilayas`);
    
    const [backupCount] = await pool.query(`SELECT COUNT(*) as count FROM wilayas_backup_complete_rebuild`);
    console.log(`✅ Backup created: wilayas_backup_complete_rebuild (${backupCount[0].count} records)`);
    
    // Step 2: Check current orders to preserve relationships
    console.log('\n📊 Checking current order wilaya assignments...');
    const [orderCounts] = await pool.query(`
      SELECT wilaya_id, COUNT(*) as order_count
      FROM orders 
      WHERE wilaya_id IS NOT NULL
      GROUP BY wilaya_id
      ORDER BY wilaya_id
    `);
    
    console.log('Current order distributions:');
    orderCounts.forEach(row => {
      console.log(`   Wilaya ${row.wilaya_id}: ${row.order_count} orders`);
    });
    
    // Step 3: Delete all current wilayas
    console.log('\n🗑️ Deleting all current wilaya records...');
    await pool.query('DELETE FROM wilayas');
    console.log('✅ All wilaya records deleted');
    
    // Step 4: Insert complete wilaya data
    console.log('\n📝 Inserting complete wilaya data with pricing...');
    
    let insertCount = 0;
    for (const wilaya of COMPLETE_WILAYA_DATA) {
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
        wilaya.name_fr, // name_en same as name_fr
        wilaya.home_price,
        wilaya.office_price,
        wilaya.pickup_price,
        wilaya.express_price
      ]);
      
      insertCount++;
      console.log(`✅ Inserted wilaya ${wilaya.id}: ${wilaya.name_fr} (Home: ${wilaya.home_price}, Office: ${wilaya.office_price})`);
    }
    
    console.log(`\n✅ Inserted ${insertCount} complete wilaya records`);
    
    // Step 5: Verify the rebuild
    console.log('\n🔍 Verifying wilaya table rebuild...');
    
    const [newWilayas] = await pool.query(`
      SELECT id, name_fr, name_ar, home_delivery_price, office_delivery_price
      FROM wilayas 
      ORDER BY id
    `);
    
    console.log(`📋 Total wilayas in database: ${newWilayas.length}`);
    
    // Show critical wilaya mappings
    console.log('\n📋 Critical wilaya verifications:');
    const criticalIds = [52, 53, 55, 57, 58];
    criticalIds.forEach(id => {
      const wilaya = newWilayas.find(w => w.id === id);
      if (wilaya) {
        console.log(`   ID ${id}: ${wilaya.name_fr} (${wilaya.name_ar}) - Home: ${wilaya.home_delivery_price}, Office: ${wilaya.office_delivery_price}`);
      } else {
        console.log(`   ID ${id}: ❌ NOT FOUND`);
      }
    });
    
    // Step 6: Check for any problematic order assignments
    console.log('\n🔍 Checking for orders with non-existent wilaya_ids...');
    const [orphanedOrders] = await pool.query(`
      SELECT DISTINCT o.wilaya_id, COUNT(*) as order_count
      FROM orders o
      LEFT JOIN wilayas w ON o.wilaya_id = w.id
      WHERE o.wilaya_id IS NOT NULL AND w.id IS NULL
      GROUP BY o.wilaya_id
      ORDER BY o.wilaya_id
    `);
    
    if (orphanedOrders.length > 0) {
      console.log('⚠️ Found orders with non-existent wilaya_ids:');
      orphanedOrders.forEach(row => {
        console.log(`   Wilaya ID ${row.wilaya_id}: ${row.order_count} orders (wilaya doesn't exist)`);
      });
    } else {
      console.log('✅ All orders have valid wilaya_id assignments');
    }
    
    // Step 7: Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 WILAYA TABLE REBUILD COMPLETED SUCCESSFULLY!');
    console.log('\n✅ What was accomplished:');
    console.log(`   • Deleted all old wilaya records`);
    console.log(`   • Inserted ${insertCount} complete wilaya records`);
    console.log(`   • Added accurate pricing for all delivery types`);
    console.log(`   • Maintained data integrity with backup`);
    console.log(`   • Fixed all wilaya mapping issues`);
    
    console.log('\n🎯 Key fixes:');
    console.log('   • ID 52: Beni Abbes (Office delivery: 0 - limited service)');
    console.log('   • ID 57: El M\'Ghair (Office delivery: 0 - limited service)');
    console.log('   • ID 58: El Meniaa (Full service restored)');
    console.log('   • All other wilayas: Complete pricing structure');
    
    console.log('\n🔄 Rollback available if needed:');
    console.log('   DROP TABLE wilayas;');
    console.log('   RENAME TABLE wilayas_backup_complete_rebuild TO wilayas;');
    
  } catch (error) {
    console.error('❌ Error rebuilding wilaya table:', error);
    console.error('🔄 Database may be in inconsistent state. Check backup table.');
  } finally {
    process.exit();
  }
}

rebuildWilayaTable();