const express = require('express');
const { pool } = require('../../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    
    // Ensure page and limit are valid integers
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (validPage - 1) * validLimit;

    let whereClause = '1=1';
    const queryParams = [];

    if (role) {
      whereClause += ' AND role = ?';
      queryParams.push(role);
    }

    if (search) {
      whereClause += ' AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`,
      queryParams
    );

    // Get users
    const [users] = await pool.query(
      `SELECT 
        id, username, email, first_name, last_name, role, phone,
        is_active as status, performance_score, total_orders_handled, created_at
       FROM users 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, validLimit, offset]
    );

    // Transform data for frontend
    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status ? 'active' : 'inactive',
      createdAt: user.created_at
    }));

    res.json({
      users: transformedUsers,
      total: countResult[0].total,
      page: validPage,
      limit: validLimit
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields: name, email, password, role' });
    }

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Split name into first and last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // Insert new user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, first_name, last_name, role, phone, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, true)',
      [email, email, hashedPassword, firstName, lastName, role, phone]
    );

    // Get the created user (without password)
    const [newUser] = await pool.query(
      'SELECT id, username, email, first_name, last_name, role, phone, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    const user = newUser[0];
    const transformedUser = {
      id: user.id,
      name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.is_active ? 'active' : 'inactive',
      createdAt: user.created_at
    };

    res.status(201).json({
      message: 'User created successfully',
      user: transformedUser
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, role, phone, status } = req.body;

    // Check if user exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for email uniqueness if email is being updated
    if (email) {
      const [emailCheck] = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (emailCheck.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Split name into first and last name if provided
    let firstName, lastName;
    if (name) {
      const nameParts = name.trim().split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (email) {
      updateFields.push('email = ?', 'username = ?');
      updateValues.push(email, email);
    }
    if (firstName !== undefined) {
      updateFields.push('first_name = ?');
      updateValues.push(firstName);
    }
    if (lastName !== undefined) {
      updateFields.push('last_name = ?');
      updateValues.push(lastName);
    }
    if (role) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (status !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(status === 'active');
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(userId);

    await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated user
    const [updatedUser] = await pool.query(
      'SELECT id, username, email, first_name, last_name, role, phone, is_active, created_at FROM users WHERE id = ?',
      [userId]
    );

    const user = updatedUser[0];
    const transformedUser = {
      id: user.id,
      name: user.first_name + (user.last_name ? ` ${user.last_name}` : ''),
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.is_active ? 'active' : 'inactive',
      createdAt: user.created_at
    };

    res.json({
      message: 'User updated successfully',
      user: transformedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId == req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE id = ?',
      [userId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has assigned orders
    const [orders] = await pool.query(
      'SELECT COUNT(*) as count FROM orders WHERE assigned_to = ?',
      [userId]
    );

    if (orders[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with assigned orders. Please reassign orders first.' 
      });
    }

    // Delete user
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
