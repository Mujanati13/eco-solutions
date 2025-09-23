const { pool } = require('./config/database');

async function checkDeliveryTables() {
  try {
    // Check all tables
    const [allTables] = await pool.query('SHOW TABLES');
    console.log('All tables in database:');
    allTables.forEach(table => {
      console.log(' -', Object.values(table)[0]);
    });
    
    // Check for delivery pricing related tables
    const deliveryTables = allTables.filter(table => {
      const tableName = Object.values(table)[0].toLowerCase();
      return tableName.includes('delivery') || tableName.includes('pricing') || tableName.includes('tarif');
    });
    
    console.log('\nDelivery/Pricing related tables:');
    deliveryTables.forEach(table => {
      console.log(' -', Object.values(table)[0]);
    });
    
    // Check if wilayas table exists and its structure
    const [wilayasDesc] = await pool.query('DESCRIBE wilayas');
    console.log('\nWilayas table structure:');
    wilayasDesc.forEach(col => {
      console.log(` - ${col.Field}: ${col.Type} (${col.Null === 'YES' ? 'nullable' : 'not null'})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkDeliveryTables();