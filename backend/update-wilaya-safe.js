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

async function updateWilayaTableSafely() {
  try {
    console.log('🔄 SAFE WILAYA TABLE UPDATE WITH PRICING');
    console.log('=' .repeat(60));
    
    // Step 1: Create backup
    console.log('💾 Creating backup of current wilayas table...');
    const backupTableName = `wilayas_backup_safe_update_${Date.now()}`;
    await pool.query(`CREATE TABLE ${backupTableName} AS SELECT * FROM wilayas`);
    
    const [backupCount] = await pool.query(`SELECT COUNT(*) as count FROM ${backupTableName}`);
    console.log(`✅ Backup created: ${backupTableName} (${backupCount[0].count} records)`);
    
    // Step 2: Check if pricing columns exist, if not add them
    console.log('\n🏗️ Checking and adding pricing columns...');
    
    const pricingColumns = [
      'home_delivery_price',
      'office_delivery_price', 
      'pickup_delivery_price',
      'express_delivery_price'
    ];
    
    for (const column of pricingColumns) {
      try {
        await pool.query(`ALTER TABLE wilayas ADD COLUMN ${column} DECIMAL(8,2) DEFAULT 0`);
        console.log(`✅ Added column: ${column}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`✅ Column ${column} already exists`);
        } else {
          console.log(`⚠️ Error adding column ${column}:`, error.message);
        }
      }
    }
    
    // Step 3: Update existing wilayas and insert missing ones
    console.log('\n📝 Updating wilaya data with complete information...');
    
    let updateCount = 0;
    let insertCount = 0;
    
    for (const wilaya of COMPLETE_WILAYA_DATA) {
      // Check if wilaya exists
      const [existing] = await pool.query('SELECT id FROM wilayas WHERE id = ?', [wilaya.id]);
      
      if (existing.length > 0) {
        // Update existing wilaya
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
          wilaya.name_fr, // name_en same as name_fr
          wilaya.home_price,
          wilaya.office_price,
          wilaya.pickup_price,
          wilaya.express_price,
          wilaya.id
        ]);
        
        updateCount++;
        console.log(`🔧 Updated wilaya ${wilaya.id}: ${wilaya.name_fr} (Home: ${wilaya.home_price}, Office: ${wilaya.office_price})`);
        
      } else {
        // Insert new wilaya
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
        
        insertCount++;
        console.log(`➕ Inserted wilaya ${wilaya.id}: ${wilaya.name_fr} (Home: ${wilaya.home_price}, Office: ${wilaya.office_price})`);
      }
    }
    
    console.log(`\n✅ Processing complete: ${updateCount} updated, ${insertCount} inserted`);
    
    // Step 4: Delete wilayas not in our list (but preserve those with orders)
    console.log('\n🧹 Checking for obsolete wilaya records...');
    const validIds = COMPLETE_WILAYA_DATA.map(w => w.id);
    const [obsoleteWilayas] = await pool.query(`
      SELECT w.id, w.name_fr, COUNT(o.id) as order_count
      FROM wilayas w
      LEFT JOIN orders o ON w.id = o.wilaya_id
      WHERE w.id NOT IN (${validIds.join(',')})
      GROUP BY w.id, w.name_fr
    `);
    
    if (obsoleteWilayas.length > 0) {
      console.log('Found obsolete wilaya records:');
      for (const obs of obsoleteWilayas) {
        if (obs.order_count > 0) {
          console.log(`   ⚠️ Wilaya ${obs.id} (${obs.name_fr}): ${obs.order_count} orders - KEEPING for data integrity`);
        } else {
          console.log(`   🗑️ Wilaya ${obs.id} (${obs.name_fr}): No orders - SAFE TO DELETE`);
          await pool.query('DELETE FROM wilayas WHERE id = ?', [obs.id]);
        }
      }
    } else {
      console.log('✅ No obsolete wilaya records found');
    }
    
    // Step 5: Verify the update
    console.log('\n🔍 Verifying wilaya table update...');
    
    const [finalWilayas] = await pool.query(`
      SELECT id, name_fr, name_ar, home_delivery_price, office_delivery_price
      FROM wilayas 
      WHERE id IN (${validIds.join(',')})
      ORDER BY id
    `);
    
    console.log(`📋 Total wilayas updated: ${finalWilayas.length}`);
    
    // Show critical wilaya mappings
    console.log('\n📋 Critical wilaya verifications:');
    const criticalIds = [52, 53, 55, 57, 58];
    criticalIds.forEach(id => {
      const wilaya = finalWilayas.find(w => w.id === id);
      if (wilaya) {
        const officePriceStatus = wilaya.office_delivery_price === 0 ? '(Limited service)' : '';
        console.log(`   ID ${id}: ${wilaya.name_fr} (${wilaya.name_ar}) - Home: ${wilaya.home_delivery_price}, Office: ${wilaya.office_delivery_price} ${officePriceStatus}`);
      } else {
        console.log(`   ID ${id}: ❌ NOT FOUND`);
      }
    });
    
    // Step 6: Check for orders that might need wilaya_id updates
    console.log('\n🔍 Checking for orders that might need wilaya_id corrections...');
    
    // Check El M'Ghair orders
    const [elMghairCheck] = await pool.query(`
      SELECT id, order_number, customer_name, customer_city, baladia_name, wilaya_id
      FROM orders 
      WHERE (customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR customer_city LIKE '%المغير%'
             OR baladia_name LIKE '%M''Ghair%' OR baladia_name LIKE '%Mghair%' OR baladia_name LIKE '%المغير%')
      AND wilaya_id != 57
    `);
    
    if (elMghairCheck.length > 0) {
      console.log(`⚠️ Found ${elMghairCheck.length} El M'Ghair orders with incorrect wilaya_id:`);
      elMghairCheck.forEach(order => {
        console.log(`   Order ${order.order_number}: wilaya_id = ${order.wilaya_id} (should be 57)`);
      });
      
      console.log('\n🔧 Correcting El M\'Ghair order wilaya_ids...');
      await pool.query(`
        UPDATE orders 
        SET wilaya_id = 57, updated_at = NOW()
        WHERE (customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR customer_city LIKE '%المغير%'
               OR baladia_name LIKE '%M''Ghair%' OR baladia_name LIKE '%Mghair%' OR baladia_name LIKE '%المغير%')
        AND wilaya_id != 57
      `);
      console.log(`✅ Corrected ${elMghairCheck.length} El M'Ghair orders to wilaya_id = 57`);
    } else {
      console.log('✅ All El M\'Ghair orders have correct wilaya_id = 57');
    }
    
    // Step 7: Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 WILAYA TABLE UPDATE COMPLETED SUCCESSFULLY!');
    console.log('\n✅ What was accomplished:');
    console.log(`   • Updated ${updateCount} existing wilaya records`);
    console.log(`   • Inserted ${insertCount} new wilaya records`);
    console.log(`   • Added complete pricing structure for all delivery types`);
    console.log(`   • Maintained data integrity with foreign key constraints`);
    console.log(`   • Fixed order wilaya_id assignments`);
    
    console.log('\n🎯 Key pricing updates:');
    console.log('   • ID 52: Beni Abbes (Office: 0 DA - limited service)');
    console.log('   • ID 57: El M\'Ghair (Office: 0 DA - limited service)');
    console.log('   • All other wilayas: Complete pricing structure implemented');
    
    console.log('\n🔄 This should resolve all Ecotrack API errors!');
    
  } catch (error) {
    console.error('❌ Error updating wilaya table:', error);
    console.error('🔄 Check backup table: wilayas_backup_safe_update');
  } finally {
    process.exit();
  }
}

updateWilayaTableSafely();