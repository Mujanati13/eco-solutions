const { pool } = require('./config/database');

async function checkOrdersSchema() {
  try {
    const [rows] = await pool.query('DESCRIBE orders');
    console.log('Orders table columns:');
    rows.forEach(row => {
      console.log(`${row.Field}: ${row.Type} ${row.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${row.Default ? `DEFAULT ${row.Default}` : ''}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkOrdersSchema();