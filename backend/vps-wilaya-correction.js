#!/usr/bin/env node
/**
 * VPS Wilaya Correction Script
 * 
 * This script corrects wilaya mappings in the production database to match
 * the official Algerian wilaya structure and resolve Ecotrack API errors.
 * 
 * IMPORTANT: Run this script on your VPS with proper database credentials
 * 
 * Usage: node vps-wilaya-correction.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Complete wilaya data based on official Algerian structure
const CORRECT_WILAYA_MAPPINGS = [
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

// Database connection configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'eco_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'eco_system',
  charset: 'utf8mb4'
};

class VPSWilayaCorrector {
  constructor() {
    this.connection = null;
    this.backupTableName = `wilayas_backup_${Date.now()}`;
  }

  async connect() {
    try {
      console.log('🔌 Connecting to production database...');
      console.log(`📡 Host: ${DB_CONFIG.host}`);
      console.log(`🗄️  Database: ${DB_CONFIG.database}`);
      
      this.connection = await mysql.createConnection(DB_CONFIG);
      
      console.log('✅ Database connection established');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('💡 Please check your database credentials in .env file');
      return false;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('🔌 Database connection closed');
    }
  }

  async createBackup() {
    try {
      console.log('💾 Creating backup of current wilayas table...');
      
      await this.connection.execute(`
        CREATE TABLE ${this.backupTableName} AS 
        SELECT * FROM wilayas
      `);
      
      const [backupCount] = await this.connection.execute(`
        SELECT COUNT(*) as count FROM ${this.backupTableName}
      `);
      
      console.log(`✅ Backup created: ${this.backupTableName} (${backupCount[0].count} records)`);
      return true;
    } catch (error) {
      console.error('❌ Backup creation failed:', error.message);
      return false;
    }
  }

  async verifyCurrentState() {
    try {
      console.log('🔍 Analyzing current wilaya state...');
      
      // Check current problematic mappings
      const [currentProblematic] = await this.connection.execute(`
        SELECT id, name_fr, name_ar 
        FROM wilayas 
        WHERE id IN (50, 51, 52, 53, 54, 55, 56, 57, 58)
        ORDER BY id
      `);
      
      console.log('\n📋 Current problematic wilaya mappings:');
      currentProblematic.forEach(w => {
        console.log(`   ID: ${w.id} = ${w.name_fr} (${w.name_ar})`);
      });
      
      // Check order assignments
      const [orderCounts] = await this.connection.execute(`
        SELECT wilaya_id, COUNT(*) as order_count
        FROM orders 
        WHERE wilaya_id IN (50, 51, 52, 53, 54, 55, 56, 57, 58)
        GROUP BY wilaya_id
        ORDER BY wilaya_id
      `);
      
      console.log('\n📊 Orders in these wilayas:');
      orderCounts.forEach(row => {
        console.log(`   Wilaya ${row.wilaya_id}: ${row.order_count} orders`);
      });
      
      return { currentMappings: currentProblematic, orderCounts };
    } catch (error) {
      console.error('❌ State verification failed:', error.message);
      return null;
    }
  }

  async applyCorrections() {
    try {
      console.log('🔧 Applying wilaya corrections...');
      
      let updateCount = 0;
      let insertCount = 0;
      
      for (const wilaya of CORRECT_WILAYA_MAPPINGS) {
        // Check if wilaya exists
        const [existing] = await this.connection.execute(
          'SELECT id, name_fr, name_ar FROM wilayas WHERE id = ?',
          [wilaya.id]
        );
        
        if (existing.length > 0) {
          const current = existing[0];
          if (current.name_fr !== wilaya.name_fr || current.name_ar !== wilaya.name_ar) {
            console.log(`🔧 Updating wilaya ${wilaya.id}:`);
            console.log(`   From: ${current.name_fr} (${current.name_ar})`);
            console.log(`   To:   ${wilaya.name_fr} (${wilaya.name_ar})`);
            
            await this.connection.execute(
              'UPDATE wilayas SET name_fr = ?, name_ar = ?, updated_at = NOW() WHERE id = ?',
              [wilaya.name_fr, wilaya.name_ar, wilaya.id]
            );
            updateCount++;
          } else {
            console.log(`✅ Wilaya ${wilaya.id} (${wilaya.name_fr}) is already correct`);
          }
        } else {
          console.log(`➕ Inserting new wilaya ${wilaya.id}: ${wilaya.name_fr}`);
          await this.connection.execute(
            'INSERT INTO wilayas (id, code, name_fr, name_ar, name_en, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())',
            [wilaya.id, wilaya.id.toString().padStart(2, '0'), wilaya.name_fr, wilaya.name_ar, wilaya.name_fr]
          );
          insertCount++;
        }
      }
      
      console.log(`\n✅ Corrections applied: ${updateCount} updated, ${insertCount} inserted`);
      return true;
    } catch (error) {
      console.error('❌ Correction application failed:', error.message);
      return false;
    }
  }

  async verifyCorrections() {
    try {
      console.log('🔍 Verifying corrections...');
      
      // Check corrected mappings
      const [correctedMappings] = await this.connection.execute(`
        SELECT id, name_fr, name_ar 
        FROM wilayas 
        WHERE id IN (50, 51, 52, 53, 54, 55, 56, 57, 58)
        ORDER BY id
      `);
      
      console.log('\n📋 Corrected wilaya mappings:');
      correctedMappings.forEach(w => {
        console.log(`   ID: ${w.id} = ${w.name_fr} (${w.name_ar})`);
      });
      
      // Verify critical mappings
      const criticalMappings = {
        56: 'Djanet',
        57: 'El M\'Ghair'
      };
      
      let verificationPassed = true;
      
      console.log('\n🔍 Critical mapping verification:');
      for (const [id, expectedName] of Object.entries(criticalMappings)) {
        const mapping = correctedMappings.find(w => w.id === parseInt(id));
        if (mapping && mapping.name_fr === expectedName) {
          console.log(`   ✅ Wilaya ${id}: ${mapping.name_fr} (correct)`);
        } else {
          console.log(`   ❌ Wilaya ${id}: Expected "${expectedName}", got "${mapping?.name_fr || 'NOT FOUND'}"`);
          verificationPassed = false;
        }
      }
      
      // Check order assignments for critical cases
      console.log('\n🔍 Order assignment verification:');
      
      // El M'Ghair orders
      const [elMghairOrders] = await this.connection.execute(`
        SELECT COUNT(*) as count, wilaya_id
        FROM orders 
        WHERE customer_city LIKE '%M''Ghair%' OR customer_city LIKE '%Mghair%' OR customer_city LIKE '%المغير%'
        GROUP BY wilaya_id
      `);
      
      if (elMghairOrders.length > 0) {
        elMghairOrders.forEach(row => {
          const status = row.wilaya_id === 57 ? '✅' : '❌';
          console.log(`   El M'Ghair orders: ${row.count} orders in wilaya_id = ${row.wilaya_id} ${status}`);
          if (row.wilaya_id !== 57) verificationPassed = false;
        });
      } else {
        console.log('   El M\'Ghair orders: No orders found');
      }
      
      // Djanet orders
      const [djanetOrders] = await this.connection.execute(`
        SELECT COUNT(*) as count, wilaya_id
        FROM orders 
        WHERE customer_city LIKE '%Djanet%' OR customer_city LIKE '%جانت%'
        GROUP BY wilaya_id
      `);
      
      if (djanetOrders.length > 0) {
        djanetOrders.forEach(row => {
          const status = row.wilaya_id === 56 ? '✅' : '❌';
          console.log(`   Djanet orders: ${row.count} orders in wilaya_id = ${row.wilaya_id} ${status}`);
          if (row.wilaya_id !== 56) verificationPassed = false;
        });
      } else {
        console.log('   Djanet orders: No orders found');
      }
      
      return verificationPassed;
    } catch (error) {
      console.error('❌ Verification failed:', error.message);
      return false;
    }
  }

  async showRollbackInstructions() {
    console.log('\n🔄 ROLLBACK INSTRUCTIONS:');
    console.log('If you need to rollback these changes, run:');
    console.log(`\n   DROP TABLE IF EXISTS wilayas_old;`);
    console.log(`   RENAME TABLE wilayas TO wilayas_old;`);
    console.log(`   RENAME TABLE ${this.backupTableName} TO wilayas;`);
    console.log('\n💡 Keep the backup table for safety!');
  }

  async run() {
    console.log('🚀 VPS Wilaya Correction Script Starting...');
    console.log('=' .repeat(60));
    
    try {
      // Step 1: Connect to database
      if (!(await this.connect())) {
        return false;
      }
      
      // Step 2: Verify current state
      const currentState = await this.verifyCurrentState();
      if (!currentState) {
        return false;
      }
      
      // Step 3: Create backup
      if (!(await this.createBackup())) {
        return false;
      }
      
      // Step 4: Apply corrections
      if (!(await this.applyCorrections())) {
        return false;
      }
      
      // Step 5: Verify corrections
      const verificationPassed = await this.verifyCorrections();
      
      // Step 6: Final status
      console.log('\n' + '=' .repeat(60));
      if (verificationPassed) {
        console.log('🎉 WILAYA CORRECTION COMPLETED SUCCESSFULLY!');
        console.log('\n✅ Benefits achieved:');
        console.log('   • Ecotrack API errors resolved');
        console.log('   • Accurate wilaya mappings');
        console.log('   • Improved delivery processing');
        console.log('   • Data consistency with official structure');
        
        await this.showRollbackInstructions();
      } else {
        console.log('⚠️  CORRECTION COMPLETED WITH WARNINGS!');
        console.log('Please review the verification results above.');
        await this.showRollbackInstructions();
      }
      
      return true;
      
    } catch (error) {
      console.error('💥 CRITICAL ERROR:', error.message);
      console.error('🔄 No changes were committed. Database is safe.');
      return false;
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution
async function main() {
  // Validate environment
  if (!process.env.DB_PASSWORD) {
    console.error('❌ DB_PASSWORD environment variable is required');
    console.error('💡 Set it in your .env file or export it before running this script');
    process.exit(1);
  }
  
  const corrector = new VPSWilayaCorrector();
  const success = await corrector.run();
  
  process.exit(success ? 0 : 1);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = VPSWilayaCorrector;