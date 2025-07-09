const { pool } = require('./config/database');

async function addGoogleSheetsPermissions() {
  try {
    const permissions = [
      {
        name: 'canImportFromGoogleSheets',
        category: 'integrations',
        description: 'Import orders from Google Sheets'
      },
      {
        name: 'canExportToGoogleSheets',
        category: 'integrations',
        description: 'Export orders to Google Sheets'
      },
      {
        name: 'canManageGoogleSheets',
        category: 'integrations',
        description: 'Manage Google Sheets integration settings'
      },
      {
        name: 'canViewIntegrations',
        category: 'integrations',
        description: 'View integrations and connection status'
      }
    ];

    console.log('Adding Google Sheets permissions...');
    
    for (const perm of permissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO permissions (name, category, description) VALUES (?, ?, ?)',
          [perm.name, perm.category, perm.description]
        );
        console.log('✅ Added permission:', perm.name);
      } catch (error) {
        console.log('⚠️  Permission already exists:', perm.name);
      }
    }

    // Assign to admin role
    console.log('\nAssigning permissions to admin role...');
    for (const perm of permissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
          ['admin', perm.name]
        );
        console.log('✅ Assigned to admin:', perm.name);
      } catch (error) {
        console.log('⚠️  Already assigned to admin:', perm.name);
      }
    }

    // Assign import/export to supervisor role
    console.log('\nAssigning import/export permissions to supervisor role...');
    const supervisorPerms = ['canImportFromGoogleSheets', 'canExportToGoogleSheets', 'canViewIntegrations'];
    for (const perm of supervisorPerms) {
      try {
        await pool.query(
          'INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
          ['supervisor', perm]
        );
        console.log('✅ Assigned to supervisor:', perm);
      } catch (error) {
        console.log('⚠️  Already assigned to supervisor:', perm);
      }
    }

    console.log('\n✅ Google Sheets permissions setup complete!');
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

addGoogleSheetsPermissions();
