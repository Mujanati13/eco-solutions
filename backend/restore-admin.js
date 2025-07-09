const { pool } = require('./config/database');

(async () => {
  try {
    console.log('Restoring admin account...');
    
    // Fix the admin user role
    await pool.query('UPDATE users SET role = ? WHERE username = ? OR id = ?', ['admin', 'admin', 1]);
    
    console.log('✅ Admin role restored');
    
    // Verify the fix
    const [adminUsers] = await pool.query('SELECT id, username, role FROM users WHERE role = "admin"');
    
    if (adminUsers.length > 0) {
      console.log('\nAdmin users:');
      adminUsers.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
      });
    } else {
      console.log('\n❌ No admin users found!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
