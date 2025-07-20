const { pool } = require('../../config/database');

class RolePermissionService {
  // Get all available roles
  static async getRoles() {
    try {
      const [roles] = await pool.query(`
        SELECT DISTINCT role_name as name 
        FROM role_permissions 
        ORDER BY 
          CASE role_name 
            WHEN 'admin' THEN 1 
            WHEN 'supervisor' THEN 2 
            WHEN 'employee' THEN 3 
            ELSE 4 
          END
      `);
      return roles;
    } catch (error) {
      console.error('Get roles error:', error);
      throw error;
    }
  }

  // Get all available permissions
  static async getPermissions() {
    try {
      const [permissions] = await pool.query(`
        SELECT name, category, description 
        FROM permissions 
        ORDER BY category, name
      `);
      
      // Group permissions by category
      const grouped = permissions.reduce((acc, perm) => {
        if (!acc[perm.category]) {
          acc[perm.category] = [];
        }
        acc[perm.category].push({
          key: perm.name,
          label: perm.description || perm.name
        });
        return acc;
      }, {});

      return grouped;
    } catch (error) {
      console.error('Get permissions error:', error);
      throw error;
    }
  }

  // Get user's roles
  static async getUserRoles(userId) {
    try {
      const [roles] = await pool.query(`
        SELECT role_name 
        FROM user_roles 
        WHERE user_id = ?
      `, [userId]);
      
      return roles.map(r => r.role_name);
    } catch (error) {
      console.error('Get user roles error:', error);
      throw error;
    }
  }

  // Get user's permissions (both from roles and individual permissions)
  static async getUserPermissions(userId) {
    try {
      // Get permissions from user's roles
      const [rolePermissions] = await pool.query(`
        SELECT DISTINCT rp.permission_name
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_name = rp.role_name
        WHERE ur.user_id = ?
      `, [userId]);

      // Get individual permissions
      const [userPermissions] = await pool.query(`
        SELECT permission_name
        FROM user_permissions
        WHERE user_id = ?
      `, [userId]);

      // Combine and deduplicate
      const allPermissions = new Set();
      rolePermissions.forEach(p => allPermissions.add(p.permission_name));
      userPermissions.forEach(p => allPermissions.add(p.permission_name));

      return Array.from(allPermissions);
    } catch (error) {
      console.error('Get user permissions error:', error);
      throw error;
    }
  }

  // Check if user has specific permission
  static async userHasPermission(userId, permissionName) {
    try {
      // Check from roles
      const [roleCheck] = await pool.query(`
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_name = rp.role_name
        WHERE ur.user_id = ? AND rp.permission_name = ?
        LIMIT 1
      `, [userId, permissionName]);

      if (roleCheck.length > 0) return true;

      // Check individual permissions
      const [userCheck] = await pool.query(`
        SELECT 1
        FROM user_permissions
        WHERE user_id = ? AND permission_name = ?
        LIMIT 1
      `, [userId, permissionName]);

      return userCheck.length > 0;
    } catch (error) {
      console.error('Check user permission error:', error);
      throw error;
    }
  }

  // Set user roles (replaces existing roles)
  static async setUserRoles(userId, roles, grantedBy = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Remove existing roles
      await connection.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);

      // Add new roles
      if (roles && roles.length > 0) {
        for (const role of roles) {
          await connection.query(
            'INSERT INTO user_roles (user_id, role_name) VALUES (?, ?)',
            [userId, role]
          );
        }

        // Update the legacy role field with the first role for backward compatibility
        await connection.query(
          'UPDATE users SET role = ? WHERE id = ?',
          [roles[0], userId]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Set user roles error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Set user permissions (replaces existing individual permissions)
  static async setUserPermissions(userId, permissions, grantedBy = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Remove existing individual permissions
      await connection.query('DELETE FROM user_permissions WHERE user_id = ?', [userId]);

      // Add new permissions
      if (permissions && permissions.length > 0) {
        for (const permission of permissions) {
          await connection.query(
            'INSERT INTO user_permissions (user_id, permission_name, granted_by) VALUES (?, ?, ?)',
            [userId, permission, grantedBy]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Set user permissions error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get role's default permissions
  static async getRolePermissions(roleName) {
    try {
      const [permissions] = await pool.query(`
        SELECT permission_name
        FROM role_permissions
        WHERE role_name = ?
      `, [roleName]);

      return permissions.map(p => p.permission_name);
    } catch (error) {
      console.error('Get role permissions error:', error);
      throw error;
    }
  }

  // Get user with roles and permissions
  static async getUserWithRolesAndPermissions(userId) {
    try {
      // Get basic user info
      const [users] = await pool.query(`
        SELECT id, username, email, first_name, last_name, role, phone,
               is_active, performance_score, total_orders_handled, created_at
        FROM users 
        WHERE id = ?
      `, [userId]);

      if (users.length === 0) {
        return null;
      }

      const user = users[0];

      // Get user's roles
      user.roles = await this.getUserRoles(userId);

      // Get user's permissions
      user.permissions = await this.getUserPermissions(userId);

      return user;
    } catch (error) {
      console.error('Get user with roles and permissions error:', error);
      throw error;
    }
  }

  // Get all users with their roles and permissions
  static async getAllUsersWithRolesAndPermissions(filters = {}) {
    try {
      const { page = 1, limit = 20, role, is_active, search } = filters;
      
      const validPage = Math.max(1, parseInt(page) || 1);
      const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (validPage - 1) * validLimit;

      let whereClause = '1=1';
      const queryParams = [];

      if (role) {
        whereClause += ' AND u.role = ?';
        queryParams.push(role);
      }

      if (is_active !== undefined) {
        whereClause += ' AND u.is_active = ?';
        queryParams.push(is_active === 'true');
      }

      if (search) {
        whereClause += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      // Get total count
      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`,
        queryParams
      );

      // Get users
      const userQuery = `
        SELECT 
          u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.phone,
          u.is_active, u.performance_score, u.total_orders_handled, u.created_at
        FROM users u
        WHERE ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const userQueryParams = [...queryParams, validLimit, offset];
      const [users] = await pool.query(userQuery, userQueryParams);

      // Get roles and permissions for each user
      for (const user of users) {
        user.roles = await this.getUserRoles(user.id);
        user.permissions = await this.getUserPermissions(user.id);
      }

      return {
        users,
        pagination: {
          page: validPage,
          limit: validLimit,
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / validLimit)
        }
      };
    } catch (error) {
      console.error('Get all users with roles and permissions error:', error);
      throw error;
    }
  }

  // Create user with roles and permissions
  static async createUserWithRolesAndPermissions(userData, createdBy = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { 
        username, email, password, first_name, last_name, phone, 
        roles = ['employee'], permissions = [], is_active = true 
      } = userData;

      // Insert user
      const [userResult] = await connection.query(
        `INSERT INTO users (username, email, password, first_name, last_name, role, phone, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, email, password, first_name, last_name, roles[0] || 'employee', phone, is_active]
      );

      const userId = userResult.insertId;

      // Set roles
      if (roles && roles.length > 0) {
        for (const role of roles) {
          await connection.query(
            'INSERT INTO user_roles (user_id, role_name) VALUES (?, ?)',
            [userId, role]
          );
        }
      }

      // Set permissions
      if (permissions && permissions.length > 0) {
        for (const permission of permissions) {
          await connection.query(
            'INSERT INTO user_permissions (user_id, permission_name, granted_by) VALUES (?, ?, ?)',
            [userId, permission, createdBy]
          );
        }
      }

      await connection.commit();
      return userId;
    } catch (error) {
      await connection.rollback();
      console.error('Create user with roles and permissions error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update user with roles and permissions
  static async updateUserWithRolesAndPermissions(userId, userData, updatedBy = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { 
        username, email, first_name, last_name, phone, 
        roles, permissions, is_active 
      } = userData;

      // Update basic user info
      const updateFields = [];
      const updateValues = [];

      if (username !== undefined) {
        updateFields.push('username = ?');
        updateValues.push(username);
      }
      if (email !== undefined) {
        updateFields.push('email = ?');
        updateValues.push(email);
      }
      if (first_name !== undefined) {
        updateFields.push('first_name = ?');
        updateValues.push(first_name);
      }
      if (last_name !== undefined) {
        updateFields.push('last_name = ?');
        updateValues.push(last_name);
      }
      if (phone !== undefined) {
        updateFields.push('phone = ?');
        updateValues.push(phone);
      }
      if (is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(is_active);
      }

      if (updateFields.length > 0) {
        updateValues.push(userId);
        await connection.query(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }

      // Update roles if provided
      if (roles !== undefined) {
        await connection.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
        
        if (roles && roles.length > 0) {
          for (const role of roles) {
            await connection.query(
              'INSERT INTO user_roles (user_id, role_name) VALUES (?, ?)',
              [userId, role]
            );
          }

          // Update legacy role field
          await connection.query(
            'UPDATE users SET role = ? WHERE id = ?',
            [roles[0], userId]
          );
        }
      }

      // Update permissions if provided
      if (permissions !== undefined) {
        await connection.query('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
        
        if (permissions && permissions.length > 0) {
          for (const permission of permissions) {
            await connection.query(
              'INSERT INTO user_permissions (user_id, permission_name, granted_by) VALUES (?, ?, ?)',
              [userId, permission, updatedBy]
            );
          }
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Update user with roles and permissions error:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = RolePermissionService;
