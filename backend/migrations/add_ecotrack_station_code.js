const { pool } = require('../config/database');

async function addEcotrackStationCode() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🚀 Starting migration: Add ecotrack_station_code column to orders table');
    
    // Check if column already exists
    const [existingColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'ecotrack_station_code'
    `);

    if (existingColumns.length > 0) {
      console.log('✅ Column ecotrack_station_code already exists');
      return;
    }

    // Add the ecotrack_station_code column
    await connection.query(`
      ALTER TABLE orders 
      ADD COLUMN ecotrack_station_code VARCHAR(50) NULL 
      COMMENT 'EcoTrack station code for stop desk delivery'
    `);

    console.log('✅ Successfully added ecotrack_station_code column to orders table');
    
    // Show the updated table structure
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME = 'ecotrack_station_code'
    `);
    
    console.log('📋 New column details:', columns[0]);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Run the migration
addEcotrackStationCode()
  .then(() => {
    console.log('🎉 Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });