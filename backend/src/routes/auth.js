const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/database');
const { validateRequest, schemas } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const SessionService = require('../services/sessionService');
const ActivityService = require('../services/activityService');

const router = express.Router();

// Register new user
router.post('/register', validateRequest(schemas.register), async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, phone, role = 'employee' } = req.body;

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password, first_name, last_name, phone, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, email, hashedPassword, first_name, last_name, phone, role]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.insertId,
        username,
        email,
        first_name,
        last_name,
        role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', validateRequest(schemas.login), async (req, res) => {
  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Find user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND is_active = true',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Create session tracking
    const sessionId = await SessionService.createSession(user.id, token, ipAddress, userAgent);

    // Store session in database (for compatibility with existing system)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await pool.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, token, expiresAt]
    );

    // Log login activity
    await ActivityService.logLogin(user.id, sessionId, ipAddress, userAgent);

    // Clean up expired sessions
    await pool.query(
      'DELETE FROM sessions WHERE expires_at < NOW()'
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Get session info before ending it
    const session = await SessionService.getActiveSession(token);

    // End session tracking
    await SessionService.endSession(token);

    // Log logout activity
    if (session) {
      await ActivityService.logLogout(req.user.id, session.id, ipAddress, userAgent);
    }

    // Remove session from database
    await pool.query(
      'DELETE FROM sessions WHERE token_hash = ?',
      [token]
    );

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, username, email, first_name, last_name, role, phone, 
              performance_score, total_orders_handled, created_at 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, email, phone } = req.body;
    
    const updateFields = [];
    const updateValues = [];
    
    if (first_name) {
      updateFields.push('first_name = ?');
      updateValues.push(first_name);
    }
    if (last_name) {
      updateFields.push('last_name = ?');
      updateValues.push(last_name);
    }
    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateValues.push(req.user.id);
    
    await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get current user
    const [users] = await pool.query(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Heartbeat endpoint to keep session alive
router.post('/heartbeat', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      // Update session activity
      await SessionService.updateSessionActivity(token);
    }
    
    res.json({ 
      status: 'alive',
      timestamp: new Date().toISOString(),
      user: {
        id: req.user.id,
        username: req.user.username
      }
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user session history
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, start_date, end_date } = req.query;
    const sessions = await SessionService.getUserSessions(req.user.id, parseInt(limit), start_date, end_date);
    
    res.json({ sessions });
  } catch (error) {
    console.error('Sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export user session history
router.get('/sessions/export', authenticateToken, async (req, res) => {
  try {
    const { format = 'csv', start_date, end_date } = req.query;
    const sessions = await SessionService.getUserSessions(req.user.id, 1000, start_date, end_date);
    
    // Convert to CSV format
    const headers = ['Login Time', 'Logout Time', 'Duration (seconds)', 'Status', 'IP Address', 'Browser'];
    const csvContent = [
      headers.join(','),
      ...sessions.map(session => [
        new Date(session.login_time).toISOString(),
        session.logout_time ? new Date(session.logout_time).toISOString() : 'Still Active',
        session.session_duration || 0,
        session.is_active ? 'Active' : (session.logout_time ? 'Completed' : 'Expired'),
        session.ip_address || 'Unknown',
        session.user_agent ? session.user_agent.split(' ')[0] : 'Unknown'
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=session_history_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
    
  } catch (error) {
    console.error('Sessions export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user activity logs
router.get('/activities', authenticateToken, async (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0, 
      activity_type, 
      start_date, 
      end_date 
    } = req.query;

    const activities = await ActivityService.getUserActivities(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      activityType: activity_type,
      startDate: start_date,
      endDate: end_date
    });
    
    res.json({ activities });
  } catch (error) {
    console.error('Activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session statistics
router.get('/session-stats', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const stats = await SessionService.getSessionStats(req.user.id, start_date, end_date);
    
    res.json({ stats });
  } catch (error) {
    console.error('Session stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity statistics  
router.get('/activity-stats', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const stats = await ActivityService.getActivityStats(req.user.id, start_date, end_date);
    
    res.json({ stats });
  } catch (error) {
    console.error('Activity stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
