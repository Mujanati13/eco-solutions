const { pool } = require('../config/database');

class DeliveryPricingMigration {
  static async up() {
    try {
      console.log('🔄 Creating delivery pricing tables...');

      // Create Wilayas table with all 48 Algerian wilayas
      await pool.query(`
        CREATE TABLE IF NOT EXISTS wilayas (
          id INT PRIMARY KEY AUTO_INCREMENT,
          code VARCHAR(2) NOT NULL UNIQUE,
          name_ar VARCHAR(100) NOT NULL,
          name_fr VARCHAR(100) NOT NULL,
          name_en VARCHAR(100) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_code (code),
          INDEX idx_is_active (is_active)
        )
      `);

      // Create delivery pricing table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS delivery_pricing (
          id INT PRIMARY KEY AUTO_INCREMENT,
          wilaya_id INT NOT NULL,
          delivery_type ENUM('home', 'office', 'pickup_point') DEFAULT 'home',
          base_price DECIMAL(8,2) NOT NULL DEFAULT 0.00,
          weight_threshold DECIMAL(5,2) DEFAULT 1.00 COMMENT 'Weight in KG',
          additional_weight_price DECIMAL(8,2) DEFAULT 0.00 COMMENT 'Price per additional KG',
          volume_threshold DECIMAL(8,2) DEFAULT 0.00 COMMENT 'Volume in cubic meters',
          additional_volume_price DECIMAL(8,2) DEFAULT 0.00 COMMENT 'Price per additional cubic meter',
          delivery_time_min INT DEFAULT 24 COMMENT 'Minimum delivery time in hours',
          delivery_time_max INT DEFAULT 72 COMMENT 'Maximum delivery time in hours',
          is_active BOOLEAN DEFAULT true,
          priority INT DEFAULT 1 COMMENT 'Delivery priority (1=highest)',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (wilaya_id) REFERENCES wilayas(id) ON DELETE CASCADE,
          INDEX idx_wilaya_id (wilaya_id),
          INDEX idx_delivery_type (delivery_type),
          INDEX idx_is_active (is_active),
          UNIQUE KEY unique_wilaya_delivery_type (wilaya_id, delivery_type)
        )
      `);

      // Insert all 48 Algerian wilayas
      const wilayas = [
        ['01', 'أدرار', 'Adrar', 'Adrar'],
        ['02', 'الشلف', 'Chlef', 'Chlef'],
        ['03', 'الأغواط', 'Laghouat', 'Laghouat'],
        ['04', 'أم البواقي', 'Oum El Bouaghi', 'Oum El Bouaghi'],
        ['05', 'باتنة', 'Batna', 'Batna'],
        ['06', 'بجاية', 'Béjaïa', 'Bejaia'],
        ['07', 'بسكرة', 'Biskra', 'Biskra'],
        ['08', 'بشار', 'Béchar', 'Bechar'],
        ['09', 'البليدة', 'Blida', 'Blida'],
        ['10', 'البويرة', 'Bouira', 'Bouira'],
        ['11', 'تمنراست', 'Tamanrasset', 'Tamanrasset'],
        ['12', 'تبسة', 'Tébessa', 'Tebessa'],
        ['13', 'تلمسان', 'Tlemcen', 'Tlemcen'],
        ['14', 'تيارت', 'Tiaret', 'Tiaret'],
        ['15', 'تيزي وزو', 'Tizi Ouzou', 'Tizi Ouzou'],
        ['16', 'الجزائر', 'Alger', 'Algiers'],
        ['17', 'الجلفة', 'Djelfa', 'Djelfa'],
        ['18', 'جيجل', 'Jijel', 'Jijel'],
        ['19', 'سطيف', 'Sétif', 'Setif'],
        ['20', 'سعيدة', 'Saïda', 'Saida'],
        ['21', 'سكيكدة', 'Skikda', 'Skikda'],
        ['22', 'سيدي بلعباس', 'Sidi Bel Abbès', 'Sidi Bel Abbes'],
        ['23', 'عنابة', 'Annaba', 'Annaba'],
        ['24', 'قالمة', 'Guelma', 'Guelma'],
        ['25', 'قسنطينة', 'Constantine', 'Constantine'],
        ['26', 'المدية', 'Médéa', 'Medea'],
        ['27', 'مستغانم', 'Mostaganem', 'Mostaganem'],
        ['28', 'المسيلة', 'M\'Sila', 'M\'Sila'],
        ['29', 'معسكر', 'Mascara', 'Mascara'],
        ['30', 'ورقلة', 'Ouargla', 'Ouargla'],
        ['31', 'وهران', 'Oran', 'Oran'],
        ['32', 'البيض', 'El Bayadh', 'El Bayadh'],
        ['33', 'إليزي', 'Illizi', 'Illizi'],
        ['34', 'برج بوعريريج', 'Bordj Bou Arréridj', 'Bordj Bou Arreridj'],
        ['35', 'بومرداس', 'Boumerdès', 'Boumerdes'],
        ['36', 'الطارف', 'El Tarf', 'El Tarf'],
        ['37', 'تندوف', 'Tindouf', 'Tindouf'],
        ['38', 'تيسمسيلت', 'Tissemsilt', 'Tissemsilt'],
        ['39', 'الوادي', 'El Oued', 'El Oued'],
        ['40', 'خنشلة', 'Khenchela', 'Khenchela'],
        ['41', 'سوق أهراس', 'Souk Ahras', 'Souk Ahras'],
        ['42', 'تيبازة', 'Tipaza', 'Tipaza'],
        ['43', 'ميلة', 'Mila', 'Mila'],
        ['44', 'عين الدفلى', 'Aïn Defla', 'Ain Defla'],
        ['45', 'النعامة', 'Naâma', 'Naama'],
        ['46', 'عين تموشنت', 'Aïn Témouchent', 'Ain Temouchent'],
        ['47', 'غرداية', 'Ghardaïa', 'Ghardaia'],
        ['48', 'غليزان', 'Relizane', 'Relizane']
      ];

      for (const wilaya of wilayas) {
        await pool.query(`
          INSERT IGNORE INTO wilayas (code, name_ar, name_fr, name_en)
          VALUES (?, ?, ?, ?)
        `, wilaya);
      }

      // Insert default delivery pricing for major cities (lower rates)
      const majorCities = ['16', '31', '25', '19', '06', '21', '23']; // Algiers, Oran, Constantine, Setif, Bejaia, Skikda, Annaba
      
      for (const cityCode of majorCities) {
        const [wilayaResult] = await pool.query('SELECT id FROM wilayas WHERE code = ?', [cityCode]);
        if (wilayaResult.length > 0) {
          const wilayaId = wilayaResult[0].id;
          
          // Home delivery for major cities
          await pool.query(`
            INSERT IGNORE INTO delivery_pricing (wilaya_id, delivery_type, base_price, weight_threshold, additional_weight_price, delivery_time_min, delivery_time_max, priority)
            VALUES (?, 'home', 400.00, 1.00, 50.00, 24, 48, 1)
          `, [wilayaId]);
          
          // Office delivery for major cities
          await pool.query(`
            INSERT IGNORE INTO delivery_pricing (wilaya_id, delivery_type, base_price, weight_threshold, additional_weight_price, delivery_time_min, delivery_time_max, priority)
            VALUES (?, 'office', 350.00, 1.00, 50.00, 24, 48, 1)
          `, [wilayaId]);
        }
      }

      // Insert default delivery pricing for other wilayas (higher rates)
      const [allWilayas] = await pool.query('SELECT id, code FROM wilayas WHERE code NOT IN (?)', [majorCities]);
      
      for (const wilaya of allWilayas) {
        // Home delivery for other cities
        await pool.query(`
          INSERT IGNORE INTO delivery_pricing (wilaya_id, delivery_type, base_price, weight_threshold, additional_weight_price, delivery_time_min, delivery_time_max, priority)
          VALUES (?, 'home', 600.00, 1.00, 100.00, 48, 96, 2)
        `, [wilaya.id]);
        
        // Office delivery for other cities
        await pool.query(`
          INSERT IGNORE INTO delivery_pricing (wilaya_id, delivery_type, base_price, weight_threshold, additional_weight_price, delivery_time_min, delivery_time_max, priority)
          VALUES (?, 'office', 550.00, 1.00, 100.00, 48, 96, 2)
        `, [wilaya.id]);
      }

      // Add wilaya fields to orders table
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
      `, [process.env.DB_NAME || 'eco_s_db']);

      const existingColumns = columns.map(col => col.COLUMN_NAME);
      
      if (!existingColumns.includes('wilaya_id')) {
        await pool.query('ALTER TABLE orders ADD COLUMN wilaya_id INT');
        await pool.query('ALTER TABLE orders ADD FOREIGN KEY (wilaya_id) REFERENCES wilayas(id)');
        await pool.query('ALTER TABLE orders ADD INDEX idx_wilaya_id (wilaya_id)');
        console.log('✅ Added wilaya_id to orders table');
      }
      
      if (!existingColumns.includes('delivery_type')) {
        await pool.query("ALTER TABLE orders ADD COLUMN delivery_type ENUM('home', 'office', 'pickup_point') DEFAULT 'home'");
        await pool.query('ALTER TABLE orders ADD INDEX idx_delivery_type (delivery_type)');
        console.log('✅ Added delivery_type to orders table');
      }
      
      if (!existingColumns.includes('delivery_price')) {
        await pool.query('ALTER TABLE orders ADD COLUMN delivery_price DECIMAL(8,2) DEFAULT 0.00');
        console.log('✅ Added delivery_price to orders table');
      }
      
      if (!existingColumns.includes('product_weight')) {
        await pool.query('ALTER TABLE orders ADD COLUMN product_weight DECIMAL(5,2) DEFAULT 1.00 COMMENT "Weight in KG"');
        console.log('✅ Added product_weight to orders table');
      }

      console.log('✅ Delivery pricing migration completed successfully');
    } catch (error) {
      console.error('❌ Error in delivery pricing migration:', error);
      throw error;
    }
  }

  static async down() {
    try {
      console.log('🔄 Rolling back delivery pricing migration...');
      
      // Remove columns from orders table
      await pool.query('ALTER TABLE orders DROP FOREIGN KEY orders_ibfk_3');
      await pool.query('ALTER TABLE orders DROP COLUMN wilaya_id');
      await pool.query('ALTER TABLE orders DROP COLUMN delivery_type');
      await pool.query('ALTER TABLE orders DROP COLUMN delivery_price');
      await pool.query('ALTER TABLE orders DROP COLUMN product_weight');
      
      // Drop tables
      await pool.query('DROP TABLE IF EXISTS delivery_pricing');
      await pool.query('DROP TABLE IF EXISTS wilayas');
      
      console.log('✅ Delivery pricing migration rolled back successfully');
    } catch (error) {
      console.error('❌ Error rolling back delivery pricing migration:', error);
      throw error;
    }
  }
}

module.exports = DeliveryPricingMigration;
