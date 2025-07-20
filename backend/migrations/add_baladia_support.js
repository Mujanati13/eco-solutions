const { pool } = require('../config/database');

class BaladiaSupport {
  static async up() {
    try {
      console.log('🔄 Adding Baladia support to delivery system...');

      // Create Baladias table for communes/municipalities
      await pool.query(`
        CREATE TABLE IF NOT EXISTS baladias (
          id INT PRIMARY KEY AUTO_INCREMENT,
          code VARCHAR(6) NOT NULL UNIQUE,
          name_ar VARCHAR(100) NOT NULL,
          name_fr VARCHAR(100) NOT NULL,
          name_en VARCHAR(100) NOT NULL,
          wilaya_id INT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          delivery_zone ENUM('urban', 'suburban', 'rural') DEFAULT 'urban',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (wilaya_id) REFERENCES wilayas(id) ON DELETE CASCADE,
          INDEX idx_wilaya_id (wilaya_id),
          INDEX idx_code (code),
          INDEX idx_is_active (is_active),
          INDEX idx_delivery_zone (delivery_zone)
        )
      `);

      // Add baladia support to delivery pricing
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'delivery_pricing'
      `, [process.env.DB_NAME || 'eco_s_orders']);

      const existingColumns = columns.map(col => col.COLUMN_NAME);

      if (!existingColumns.includes('baladia_id')) {
        await pool.query('ALTER TABLE delivery_pricing ADD COLUMN baladia_id INT');
        await pool.query('ALTER TABLE delivery_pricing ADD FOREIGN KEY (baladia_id) REFERENCES baladias(id) ON DELETE SET NULL');
        await pool.query('ALTER TABLE delivery_pricing ADD INDEX idx_baladia_id (baladia_id)');
        console.log('✅ Added baladia_id to delivery_pricing table');
      }

      if (!existingColumns.includes('pricing_level')) {
        await pool.query("ALTER TABLE delivery_pricing ADD COLUMN pricing_level ENUM('wilaya', 'baladia') DEFAULT 'wilaya'");
        await pool.query('ALTER TABLE delivery_pricing ADD INDEX idx_pricing_level (pricing_level)');
        console.log('✅ Added pricing_level to delivery_pricing table');
      }

      // Update orders table to support baladia
      const [orderColumns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
      `, [process.env.DB_NAME || 'eco_s_orders']);

      const existingOrderColumns = orderColumns.map(col => col.COLUMN_NAME);

      if (!existingOrderColumns.includes('baladia_id')) {
        await pool.query('ALTER TABLE orders ADD COLUMN baladia_id INT');
        await pool.query('ALTER TABLE orders ADD FOREIGN KEY (baladia_id) REFERENCES baladias(id) ON DELETE SET NULL');
        await pool.query('ALTER TABLE orders ADD INDEX idx_baladia_id (baladia_id)');
        console.log('✅ Added baladia_id to orders table');
      }

      if (!existingOrderColumns.includes('pricing_level')) {
        await pool.query("ALTER TABLE orders ADD COLUMN pricing_level ENUM('wilaya', 'baladia') DEFAULT 'wilaya'");
        await pool.query('ALTER TABLE orders ADD INDEX idx_pricing_level (pricing_level)');
        console.log('✅ Added pricing_level to orders table');
      }

      // Insert sample baladias for Algiers (16)
      const sampleBaladias = [
        ['160001', 'الجزائر الوسطى', 'Alger Centre', 'Algiers Center', 16, 'urban'],
        ['160002', 'باب الوادي', 'Bab El Oued', 'Bab El Oued', 16, 'urban'],
        ['160003', 'القصبة', 'La Casbah', 'The Casbah', 16, 'urban'],
        ['160004', 'بولوغين', 'Bologhine', 'Bologhine', 16, 'urban'],
        ['160005', 'الحراش', 'El Harrach', 'El Harrach', 16, 'suburban'],
        ['160006', 'برج الكيفان', 'Bordj El Kiffan', 'Bordj El Kiffan', 16, 'suburban'],
        ['160007', 'دار البيضاء', 'Dar El Beida', 'Dar El Beida', 16, 'suburban'],
        ['160008', 'الدرارية', 'Draria', 'Draria', 16, 'suburban'],
        ['160009', 'زرالدة', 'Zeralda', 'Zeralda', 16, 'rural'],
        ['160010', 'الشراقة', 'Cheraga', 'Cheraga', 16, 'suburban']
      ];

      // Get Algiers wilaya ID
      const [algiers] = await pool.query('SELECT id FROM wilayas WHERE code = ?', ['16']);
      if (algiers.length > 0) {
        const wilayaId = algiers[0].id;
        
        for (const baladia of sampleBaladias) {
          await pool.query(`
            INSERT IGNORE INTO baladias (code, name_ar, name_fr, name_en, wilaya_id, delivery_zone)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [...baladia.slice(0, 4), wilayaId, baladia[5]]);
        }
        console.log('✅ Added sample baladias for Algiers');
      }

      console.log('✅ Baladia support migration completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in baladia support migration:', error);
      throw error;
    }
  }

  static async down() {
    try {
      console.log('🔄 Rolling back baladia support...');
      
      await pool.query('ALTER TABLE orders DROP FOREIGN KEY IF EXISTS orders_ibfk_baladia');
      await pool.query('ALTER TABLE orders DROP COLUMN IF EXISTS baladia_id');
      await pool.query('ALTER TABLE orders DROP COLUMN IF EXISTS pricing_level');
      
      await pool.query('ALTER TABLE delivery_pricing DROP FOREIGN KEY IF EXISTS delivery_pricing_ibfk_baladia');
      await pool.query('ALTER TABLE delivery_pricing DROP COLUMN IF EXISTS baladia_id');
      await pool.query('ALTER TABLE delivery_pricing DROP COLUMN IF EXISTS pricing_level');
      
      await pool.query('DROP TABLE IF EXISTS baladias');
      
      console.log('✅ Baladia support rollback completed');
      return true;
    } catch (error) {
      console.error('❌ Error rolling back baladia support:', error);
      throw error;
    }
  }
}

module.exports = BaladiaSupport;

// Run migration if called directly
if (require.main === module) {
  BaladiaSupport.up()
    .then(() => {
      console.log('✅ Baladia support migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
