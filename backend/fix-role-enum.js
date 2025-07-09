const { pool } = require('./config/database');

(async () => {
  try {
    console.log('Updating users table to support custom role...');
    
    // Update the users table to include 'custom' role
    await pool.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('admin', 'supervisor', 'employee', 'custom') DEFAULT 'employee'
    `);
    
    console.log('✅ Users table updated successfully to support custom role');
    
    // Verify the change
    const [result] = await pool.query(`
      SHOW COLUMNS FROM users WHERE Field = 'role'
    `);
    
    console.log('Role column info:', result[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating users table:', error);
    process.exit(1);
  }
})();
