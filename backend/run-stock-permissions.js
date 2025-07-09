const mysql = require('mysql2/promise');
require('dotenv').config();

async function runStockMigration() {
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
    console.log('🔄 Starting stock management migration...');

    // Step 1: Add stock management permissions
    console.log('🔄 Adding stock management permissions...');

    const permissions = [
      // Product Management Permissions
      { name: 'canViewProducts', category: 'stock', description: 'View products and inventory' },
      { name: 'canCreateProducts', category: 'stock', description: 'Create new products' },
      { name: 'canEditProducts', category: 'stock', description: 'Edit product details' },
      { name: 'canDeleteProducts', category: 'stock', description: 'Delete products' },
      
      // Stock Management Permissions
      { name: 'canViewStock', category: 'stock', description: 'View stock levels and movements' },
      { name: 'canManageStock', category: 'stock', description: 'Adjust stock levels' },
      { name: 'canTransferStock', category: 'stock', description: 'Transfer stock between locations' },
      { name: 'canViewStockReports', category: 'stock', description: 'View stock reports and analytics' },
      
      // Purchase Order Permissions
      { name: 'canViewPurchaseOrders', category: 'stock', description: 'View purchase orders' },
      { name: 'canCreatePurchaseOrders', category: 'stock', description: 'Create purchase orders' },
      { name: 'canApprovePurchaseOrders', category: 'stock', description: 'Approve purchase orders' },
      { name: 'canReceiveStock', category: 'stock', description: 'Receive stock from suppliers' },
    ];

    for (const permission of permissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO permissions (name, category, description) VALUES (?, ?, ?)',
          [permission.name, permission.category, permission.description]
        );
        console.log(`✅ Added permission: ${permission.name}`);
      } catch (error) {
        console.error(`❌ Failed to insert permission ${permission.name}:`, error);
      }
    }

    // Step 2: Add stock permissions to admin role
    console.log('🔄 Assigning stock permissions to admin role...');
    const adminPermissions = [
      'canViewProducts', 'canCreateProducts', 'canEditProducts', 'canDeleteProducts',
      'canViewStock', 'canManageStock', 'canTransferStock', 'canViewStockReports',
      'canViewPurchaseOrders', 'canCreatePurchaseOrders', 'canApprovePurchaseOrders', 'canReceiveStock'
    ];

    for (const permission of adminPermissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
          ['admin', permission]
        );
        console.log(`✅ Assigned ${permission} to admin`);
      } catch (error) {
        console.error(`❌ Failed to assign permission ${permission} to admin:`, error);
      }
    }

    // Step 3: Add basic stock permissions to supervisor role
    console.log('🔄 Assigning stock permissions to supervisor role...');
    const supervisorPermissions = [
      'canViewProducts', 'canCreateProducts', 'canEditProducts',
      'canViewStock', 'canManageStock', 'canTransferStock', 'canViewStockReports',
      'canViewPurchaseOrders', 'canCreatePurchaseOrders', 'canReceiveStock'
    ];

    for (const permission of supervisorPermissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
          ['supervisor', permission]
        );
        console.log(`✅ Assigned ${permission} to supervisor`);
      } catch (error) {
        console.error(`❌ Failed to assign permission ${permission} to supervisor:`, error);
      }
    }

    // Step 4: Add basic viewing permissions to employee role
    console.log('🔄 Assigning stock permissions to employee role...');
    const employeePermissions = [
      'canViewProducts', 'canViewStock'
    ];

    for (const permission of employeePermissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
          ['employee', permission]
        );
        console.log(`✅ Assigned ${permission} to employee`);
      } catch (error) {
        console.error(`❌ Failed to assign permission ${permission} to employee:`, error);
      }
    }

    console.log('✅ Stock management permissions migration completed successfully!');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runStockMigration();
