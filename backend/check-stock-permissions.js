const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkStockPermissions() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'eco_s_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  try {
    console.log('=== STOCK PERMISSIONS ===');
    const [permissions] = await pool.query(
      'SELECT name, category, description FROM permissions WHERE category = ?', 
      ['stock']
    );
    console.log('Stock permissions found:', permissions.length);
    permissions.forEach(p => console.log(`  - ${p.name}: ${p.description}`));
    
    console.log('\n=== ROLE PERMISSIONS FOR STOCK ===');
    const [rolePerms] = await pool.query(`
      SELECT rp.role_name, rp.permission_name 
      FROM role_permissions rp 
      JOIN permissions p ON rp.permission_name = p.name 
      WHERE p.category = 'stock' 
      ORDER BY rp.role_name, rp.permission_name
    `);
    
    const roleGroups = {};
    rolePerms.forEach(rp => {
      if (!roleGroups[rp.role_name]) roleGroups[rp.role_name] = [];
      roleGroups[rp.role_name].push(rp.permission_name);
    });
    
    console.log('Role assignments:');
    for (const [role, perms] of Object.entries(roleGroups)) {
      console.log(`  ${role}: ${perms.join(', ')}`);
    }
    
    if (Object.keys(roleGroups).length === 0) {
      console.log('  No stock permissions assigned to any roles yet');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkStockPermissions();
