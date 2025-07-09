const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const SessionService = require('../services/sessionService');
const ActivityService = require('../services/activityService');

const router = express.Router();

// Get all sessions (admin only)
router.get('/sessions', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const { 
      user_id, 
      limit = 100, 
      offset = 0,
      start_date,
      end_date,
      is_active 
    } = req.query;

    // Build query conditions
    let whereClause = '1=1';
    const params = [];

    if (user_id) {
      whereClause += ' AND us.user_id = ?';
      params.push(user_id);
    }

    if (start_date) {
      whereClause += ' AND us.login_time >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND us.login_time <= ?';
      params.push(end_date);
    }

    if (is_active !== undefined) {
      whereClause += ' AND us.is_active = ?';
      params.push(is_active === 'true');
    }

    params.push(parseInt(limit), parseInt(offset));

    const { pool } = require('../../config/database');
    const [sessions] = await pool.query(`
      SELECT 
        us.*,
        u.username,
        u.first_name,
        u.last_name,
        u.role
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE ${whereClause}
      ORDER BY us.login_time DESC
      LIMIT ? OFFSET ?
    `, params);

    // Get total count for pagination
    const [countResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE ${whereClause}
    `, params.slice(0, -2)); // Remove limit and offset from params

    res.json({ 
      sessions,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get all sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all activities (admin only)
router.get('/activities', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const { 
      user_id,
      activity_type,
      limit = 100, 
      offset = 0,
      start_date,
      end_date 
    } = req.query;

    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    // Get total count for pagination
    const totalActivities = await ActivityService.getActivitiesCount({
      userId: user_id,
      activityType: activity_type,
      startDate: start_date,
      endDate: end_date
    });

    const activities = await ActivityService.getAllActivities({
      userId: user_id,
      activityType: activity_type,
      limit: parsedLimit,
      offset: parsedOffset,
      startDate: start_date,
      endDate: end_date
    });

    res.json({ 
      activities,
      total: totalActivities,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: totalActivities,
        page: Math.floor(parsedOffset / parsedLimit) + 1,
        pages: Math.ceil(totalActivities / parsedLimit)
      }
    });
  } catch (error) {
    console.error('Get all activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session statistics for all users (admin only)
router.get('/session-stats', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    const stats = await SessionService.getSessionStats(user_id, start_date, end_date);
    
    res.json({ stats });
  } catch (error) {
    console.error('Session stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get activity statistics for all users (admin only)
router.get('/activity-stats', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const { user_id, start_date, end_date } = req.query;
    const stats = await ActivityService.getActivityStats(user_id, start_date, end_date);
    
    res.json({ stats });
  } catch (error) {
    console.error('Activity stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Force end active sessions (admin only)
router.post('/sessions/:sessionId/end', authenticateToken, requirePermission('canManageRoles'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { pool } = require('../../config/database');
    
    const [result] = await pool.query(`
      UPDATE user_sessions 
      SET logout_time = NOW(), 
          session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW()),
          is_active = false
      WHERE id = ? AND is_active = true
    `, [sessionId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Session not found or already ended' });
    }

    res.json({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cleanup old sessions and activities (admin only)
router.post('/cleanup', authenticateToken, requirePermission('canManageRoles'), async (req, res) => {
  try {
    const { 
      session_days = 30, 
      activity_days = 90 
    } = req.body;

    // Cleanup inactive sessions
    const sessionsCleanedUp = await SessionService.cleanupInactiveSessions();
    
    // Cleanup old activities
    const activitiesCleanedUp = await ActivityService.cleanupOldActivities(activity_days);

    res.json({ 
      message: 'Cleanup completed successfully',
      sessions_cleaned: sessionsCleanedUp,
      activities_cleaned: activitiesCleanedUp
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard statistics (admin only)
router.get('/dashboard-stats', authenticateToken, requirePermission('canViewUsers'), async (req, res) => {
  try {
    const { pool } = require('../../config/database');
    
    // Get active sessions count
    const [activeSessions] = await pool.query(`
      SELECT COUNT(*) as count FROM user_sessions WHERE is_active = true
    `);

    // Get today's activities count
    const [todayActivities] = await pool.query(`
      SELECT COUNT(*) as count FROM activity_logs 
      WHERE DATE(created_at) = CURDATE()
    `);

    // Get average session duration for last 7 days
    const [avgDuration] = await pool.query(`
      SELECT AVG(session_duration) as avg_duration
      FROM user_sessions 
      WHERE login_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND session_duration IS NOT NULL
    `);

    // Get most active users today
    const [activeUsers] = await pool.query(`
      SELECT 
        u.first_name,
        u.last_name,
        u.username,
        COUNT(al.id) as activity_count
      FROM users u
      JOIN activity_logs al ON u.id = al.user_id
      WHERE DATE(al.created_at) = CURDATE()
      GROUP BY u.id
      ORDER BY activity_count DESC
      LIMIT 5
    `);

    res.json({
      active_sessions: activeSessions[0].count,
      today_activities: todayActivities[0].count,
      avg_session_duration: Math.round(avgDuration[0].avg_duration || 0),
      most_active_users: activeUsers
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
