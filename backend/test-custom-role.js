const { pool } = require('./config/database');

(async () => {
  try {
    console.log('Testing custom role insertion...');
    
    // Test updating a user to have custom role
    await pool.query(`
      UPDATE users SET role = 'custom' WHERE id = 1 LIMIT 1
    `);
    
    console.log('✅ Successfully updated user to custom role');
    
    // Verify the change
    const [result] = await pool.query(`
      SELECT id, username, role FROM users WHERE role = 'custom' LIMIT 1
    `);
    
    if (result.length > 0) {
      console.log('User with custom role:', result[0]);
    } else {
      console.log('No users found with custom role');
    }
    
    // Reset back to employee for safety
    await pool.query(`
      UPDATE users SET role = 'employee' WHERE role = 'custom'
    `);
    
    console.log('✅ Reset user role back to employee');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing custom role:', error);
    process.exit(1);
  }
})();
