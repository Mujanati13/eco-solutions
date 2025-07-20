const express = require('express');
const { pool } = require('../../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { requirePermission, requireAnyRole, loadUserPermissions } = require('../middleware/permissions');
const { validateRequest, schemas } = require('../middleware/validation');
const RolePermissionService = require('../services/rolePermissionService');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Get all users for dropdown (simplified, no pagination)
router.get('/all', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, username, first_name, last_name, role
       FROM users 
       WHERE is_active = true
       ORDER BY first_name, last_name, username`
    );

    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users with roles and permissions (admin or canViewUsers permission)
router.get('/', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const result = await RolePermissionService.getAllUsersWithRolesAndPermissions(req.query);
    res.json(result);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID with roles and permissions
router.get('/:id', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const user = await RolePermissionService.getUserWithRolesAndPermissions(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Protect the main admin account (ID 1 or username 'admin') from role changes
    if ((user.id === 1 || user.username === 'admin') && (updates.role || updates.roles)) {
      // Only allow admin to admin updates for the main admin account
      if (updates.role && updates.role !== 'admin') {
        return res.status(403).json({ error: 'Cannot change admin account role' });
      }
      if (updates.roles && !updates.roles.includes('admin')) {
        return res.status(403).json({ error: 'Admin account must have admin role' });
      }
      // Ensure admin account always has admin role
      if (updates.roles) {
        updates.roles = ['admin'];
      } else {
        updates.role = 'admin';
      }
    }

    // Get user's recent orders
    const [orders] = await pool.query(
      `SELECT id, order_number, customer_name, status, total_amount, created_at
       FROM orders WHERE assigned_to = ? OR confirmed_by = ?
       ORDER BY created_at DESC LIMIT 10`,
      [req.params.id, req.params.id]
    );

    // Get user's performance metrics for the last 30 days
    const [metrics] = await pool.query(
      `SELECT * FROM performance_metrics 
       WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY date DESC`,
      [req.params.id]
    );

    res.json({
      user,
      recent_orders: orders,
      performance_metrics: metrics
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user with roles and permissions
router.post('/', authenticateToken, requirePermission('canCreateUsers'), validateRequest(schemas.createUser), async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, role, roles, permissions, phone, is_active } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email, password' });
    }

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username || email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare user data
    const userData = {
      username: username || email,
      email,
      password: hashedPassword,
      first_name: first_name || '',
      last_name: last_name || '',
      phone: phone || null,
      roles: roles || [role || 'employee'], // Support both single role and multi-role
      permissions: permissions || [],
      is_active: is_active !== undefined ? is_active : true
    };

    // Create user with roles and permissions
    const userId = await RolePermissionService.createUserWithRolesAndPermissions(userData, req.user.id);

    // Get the created user with roles and permissions
    const newUser = await RolePermissionService.getUserWithRolesAndPermissions(userId);

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user with roles and permissions
router.put('/:id', authenticateToken, requirePermission('canEditUsers'), validateRequest(schemas.updateUser), async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = req.body;

    // Check if user exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for email uniqueness if email is being updated
    if (updates.email) {
      const [emailCheck] = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [updates.email, userId]
      );

      if (emailCheck.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Update user with roles and permissions
    await RolePermissionService.updateUserWithRolesAndPermissions(userId, updates, req.user.id);

    // Get updated user with roles and permissions
    const updatedUser = await RolePermissionService.getUserWithRolesAndPermissions(userId);

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset user password
router.put('/:id/reset-password', authenticateToken, requirePermission('canEditUsers'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Check if user exists
    const [users] = await pool.query(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    // Invalidate all user sessions
    await pool.query(
      'DELETE FROM sessions WHERE user_id = ?',
      [userId]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate user (admin only)
router.put('/:id/deactivate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deactivating themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const [result] = await pool.query(
      'UPDATE users SET is_active = false WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Invalidate all user sessions
    await pool.query(
      'DELETE FROM sessions WHERE user_id = ?',
      [userId]
    );

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Activate user (admin only)
router.put('/:id/activate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    const [result] = await pool.query(
      'UPDATE users SET is_active = true WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User activated successfully' });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get user details first to check if it's the main admin
    const [users] = await pool.query('SELECT id, username, role FROM users WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userToDelete = users[0];
    
    // Protect main admin account (ID 1 or username 'admin') from deletion
    if (userToDelete.id === 1 || userToDelete.username === 'admin') {
      return res.status(403).json({ error: 'Cannot delete the main admin account' });
    }

    const [result] = await pool.query(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all available roles
router.get('/roles', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const roles = await RolePermissionService.getRoles();
    res.json(roles);
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all available permissions
router.get('/permissions', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const permissions = await RolePermissionService.getPermissions();
    res.json(permissions);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user roles
router.put('/:id/roles', authenticateToken, requirePermission('canManageRoles'), validateRequest(schemas.updateUserRoles), async (req, res) => {
  try {
    const userId = req.params.id;
    const { roles } = req.body;

    await RolePermissionService.setUserRoles(userId, roles, req.user.id);

    res.json({ message: 'User roles updated successfully' });
  } catch (error) {
    console.error('Update user roles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user permissions
router.put('/:id/permissions', authenticateToken, requirePermission('canManageRoles'), validateRequest(schemas.updateUserPermissions), async (req, res) => {
  try {
    const userId = req.params.id;
    const { permissions } = req.body;

    await RolePermissionService.setUserPermissions(userId, permissions, req.user.id);

    res.json({ message: 'User permissions updated successfully' });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's effective permissions
router.get('/:id/effective-permissions', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    
    // Allow users to view their own permissions, or require canViewUsers for others
    if (userId !== currentUserId) {
      // Check if user has permission to view other users' permissions
      const userPermissions = await RolePermissionService.getUserPermissions(currentUserId);
      if (!userPermissions.includes('canViewUsers')) {
        return res.status(403).json({ error: 'Permission denied' });
      }
    }
    
    const permissions = await RolePermissionService.getUserPermissions(userId);
    const roles = await RolePermissionService.getUserRoles(userId);
    
    res.json({ 
      permissions,
      roles: roles.map(r => r.role_name)
    });
  } catch (error) {
    console.error('Get user effective permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
