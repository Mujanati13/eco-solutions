const { pool } = require('./config/database');

(async () => {
  try {
    console.log('Checking user roles...');
    
    // Get all users
    const [users] = await pool.query('SELECT id, username, role FROM users ORDER BY id');
    
    console.log('\nCurrent users:');
    users.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
    });
    
    // Find admin users
    const adminUsers = users.filter(user => user.username === 'admin' || user.id === 1);
    
    if (adminUsers.length > 0) {
      console.log('\nAdmin users found:');
      adminUsers.forEach(admin => {
        console.log(`ID: ${admin.id}, Username: ${admin.username}, Role: ${admin.role}`);
        
        // If admin user is not admin role, fix it
        if (admin.role !== 'admin') {
          console.log(`⚠️  Admin user ${admin.username} has role '${admin.role}' instead of 'admin'`);
          console.log('Fixing admin role...');
          
          // Fix the admin role
          pool.query('UPDATE users SET role = ? WHERE id = ?', ['admin', admin.id]);
          console.log(`✅ Fixed admin role for user ${admin.username}`);
        } else {
          console.log(`✅ Admin user ${admin.username} has correct role`);
        }
      });
    } else {
      console.log('\n⚠️  No admin users found!');
    }
    
    // Final verification
    const [finalUsers] = await pool.query('SELECT id, username, role FROM users WHERE role = "admin"');
    console.log('\nFinal admin users:');
    finalUsers.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
