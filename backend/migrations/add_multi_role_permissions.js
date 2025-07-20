const { pool } = require('../config/database');

class MultiRolePermissionMigration {
  static async up() {
    try {
      console.log('🔄 Starting multi-role and permission migration...');

      // Step 1: Create user_roles table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          role_name VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_role (user_id, role_name),
          INDEX idx_user_id (user_id),
          INDEX idx_role_name (role_name)
        )
      `);

      // Step 2: Create permissions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS permissions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL UNIQUE,
          category VARCHAR(50) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_name (name),
          INDEX idx_category (category)
        )
      `);

      // Step 3: Create user_permissions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          permission_name VARCHAR(100) NOT NULL,
          granted_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (permission_name) REFERENCES permissions(name) ON DELETE CASCADE,
          FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
          UNIQUE KEY unique_user_permission (user_id, permission_name),
          INDEX idx_user_id (user_id),
          INDEX idx_permission_name (permission_name)
        )
      `);

      // Step 4: Create role_permissions table (default permissions for roles)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          role_name VARCHAR(50) NOT NULL,
          permission_name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (permission_name) REFERENCES permissions(name) ON DELETE CASCADE,
          UNIQUE KEY unique_role_permission (role_name, permission_name),
          INDEX idx_role_name (role_name),
          INDEX idx_permission_name (permission_name)
        )
      `);

      // Step 5: Update users table to add supervisor and custom roles
      await pool.query(`
        ALTER TABLE users 
        MODIFY COLUMN role ENUM('admin', 'supervisor', 'employee', 'custom') DEFAULT 'employee'
      `);

      console.log('✅ Tables created successfully');

      // Step 6: Insert default permissions
      await this.insertDefaultPermissions();

      // Step 7: Setup default role permissions
      await this.setupDefaultRolePermissions();

      // Step 8: Migrate existing users to new system
      await this.migrateExistingUsers();

      console.log('✅ Multi-role and permission migration completed successfully');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  static async insertDefaultPermissions() {
    console.log('🔄 Inserting default permissions...');

    const permissions = [
      // Order Management Permissions
      { name: 'canViewAllOrders', category: 'orders', description: 'View all orders in the system' },
      { name: 'canAssignOrders', category: 'orders', description: 'Assign orders to users' },
      { name: 'canEditOrders', category: 'orders', description: 'Edit order details' },
      { name: 'canDeleteOrders', category: 'orders', description: 'Delete orders' },
      { name: 'canDistributeOrders', category: 'orders', description: 'Distribute orders automatically' },
      { name: 'canImportOrders', category: 'orders', description: 'Import orders from files' },
      { name: 'canExportOrders', category: 'orders', description: 'Export orders to files' },

      // User Management Permissions
      { name: 'canViewUsers', category: 'users', description: 'View user list and details' },
      { name: 'canCreateUsers', category: 'users', description: 'Create new users' },
      { name: 'canEditUsers', category: 'users', description: 'Edit user details' },
      { name: 'canDeleteUsers', category: 'users', description: 'Delete users' },
      { name: 'canManageRoles', category: 'users', description: 'Manage user roles and permissions' },

      // Reports & Analytics Permissions
      { name: 'canViewReports', category: 'reports', description: 'View reports and analytics' },
      { name: 'canExportReports', category: 'reports', description: 'Export reports' },
      { name: 'canViewPerformance', category: 'reports', description: 'View performance metrics' },
      { name: 'canManageSettings', category: 'reports', description: 'Manage system settings' },
    ];

    for (const permission of permissions) {
      try {
        await pool.query(
          'INSERT IGNORE INTO permissions (name, category, description) VALUES (?, ?, ?)',
          [permission.name, permission.category, permission.description]
        );
      } catch (error) {
        console.error(`Failed to insert permission ${permission.name}:`, error);
      }
    }

    console.log('✅ Default permissions inserted');
  }

  static async setupDefaultRolePermissions() {
    console.log('🔄 Setting up default role permissions...');

    const rolePermissions = {
      admin: [
        'canViewAllOrders', 'canAssignOrders', 'canEditOrders', 'canDeleteOrders',
        'canDistributeOrders', 'canImportOrders', 'canExportOrders',
        'canViewUsers', 'canCreateUsers', 'canEditUsers', 'canDeleteUsers', 'canManageRoles',
        'canViewReports', 'canExportReports', 'canViewPerformance', 'canManageSettings'
      ],
      supervisor: [
        'canViewAllOrders', 'canAssignOrders', 'canEditOrders', 'canDistributeOrders',
        'canImportOrders', 'canExportOrders', 'canViewUsers',
        'canViewReports', 'canExportReports', 'canViewPerformance'
      ],
      employee: [
        'canEditOrders', 'canExportOrders', 'canViewReports'
      ]
    };

    for (const [role, permissions] of Object.entries(rolePermissions)) {
      for (const permission of permissions) {
        try {
          await pool.query(
            'INSERT IGNORE INTO role_permissions (role_name, permission_name) VALUES (?, ?)',
            [role, permission]
          );
        } catch (error) {
          console.error(`Failed to assign permission ${permission} to role ${role}:`, error);
        }
      }
    }

    console.log('✅ Default role permissions setup completed');
  }

  static async migrateExistingUsers() {
    console.log('🔄 Migrating existing users to new system...');

    try {
      // Get all existing users
      const [users] = await pool.query('SELECT id, role FROM users');

      for (const user of users) {
        // Add user to user_roles table
        await pool.query(
          'INSERT IGNORE INTO user_roles (user_id, role_name) VALUES (?, ?)',
          [user.id, user.role]
        );

        // Get default permissions for this role and assign to user
        const [rolePermissions] = await pool.query(
          'SELECT permission_name FROM role_permissions WHERE role_name = ?',
          [user.role]
        );

        for (const rolePerm of rolePermissions) {
          await pool.query(
            'INSERT IGNORE INTO user_permissions (user_id, permission_name) VALUES (?, ?)',
            [user.id, rolePerm.permission_name]
          );
        }
      }

      console.log(`✅ Migrated ${users.length} existing users to new system`);
    } catch (error) {
      console.error('❌ Failed to migrate existing users:', error);
      throw error;
    }
  }

  static async down() {
    try {
      console.log('🔄 Rolling back multi-role and permission migration...');

      // Drop tables in reverse order
      await pool.query('DROP TABLE IF EXISTS role_permissions');
      await pool.query('DROP TABLE IF EXISTS user_permissions');
      await pool.query('DROP TABLE IF EXISTS user_roles');
      await pool.query('DROP TABLE IF EXISTS permissions');

      // Revert users table role column
      await pool.query(`
        ALTER TABLE users 
        MODIFY COLUMN role ENUM('admin', 'employee') DEFAULT 'employee'
      `);

      console.log('✅ Migration rolled back successfully');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
}

module.exports = MultiRolePermissionMigration;
