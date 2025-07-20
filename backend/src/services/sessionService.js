const { pool } = require('../../config/database');

class SessionService {
  // Create a new session when user logs in
  static async createSession(userId, sessionToken, ipAddress, userAgent) {
    try {
      const [result] = await pool.query(`
        INSERT INTO user_sessions (user_id, session_token, login_time, ip_address, user_agent, is_active)
        VALUES (?, ?, NOW(), ?, ?, true)
      `, [userId, sessionToken, ipAddress, userAgent]);

      return result.insertId;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  // End session when user logs out
  static async endSession(sessionToken) {
    try {
      // Calculate session duration and update logout time
      const [result] = await pool.query(`
        UPDATE user_sessions 
        SET logout_time = NOW(), 
            session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW()),
            is_active = false
        WHERE session_token = ? AND is_active = true
      `, [sessionToken]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  // Get active session by token
  static async getActiveSession(sessionToken) {
    try {
      const [sessions] = await pool.query(`
        SELECT us.*, u.username, u.first_name, u.last_name, u.role
        FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        WHERE us.session_token = ? AND us.is_active = true
      `, [sessionToken]);

      return sessions[0] || null;
    } catch (error) {
      console.error('Error getting active session:', error);
      throw error;
    }
  }

  // Get user session history
  static async getUserSessions(userId, limit = 50, startDate = null, endDate = null) {
    try {
      let whereClause = 'user_id = ?';
      const params = [userId];

      if (startDate) {
        whereClause += ' AND login_time >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND login_time <= ?';
        params.push(endDate);
      }

      const [sessions] = await pool.query(`
        SELECT id, login_time, logout_time, session_duration, ip_address, user_agent, is_active
        FROM user_sessions
        WHERE ${whereClause}
        ORDER BY login_time DESC
        LIMIT ?
      `, [...params, limit]);

      return sessions;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw error;
    }
  }

  // Update session last activity timestamp
  static async updateSessionActivity(sessionToken) {
    try {
      const [result] = await pool.query(`
        UPDATE user_sessions 
        SET updated_at = NOW()
        WHERE session_token = ? AND is_active = true
      `, [sessionToken]);

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating session activity:', error);
      throw error;
    }
  }

  // End session by user ID (for forced logout or cleanup)
  static async endUserSessions(userId, reason = 'cleanup') {
    try {
      const [result] = await pool.query(`
        UPDATE user_sessions 
        SET logout_time = NOW(), 
            session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW()),
            is_active = false
        WHERE user_id = ? AND is_active = true
      `, [userId]);

      console.log(`Ended ${result.affectedRows} sessions for user ${userId} (${reason})`);
      return result.affectedRows;
    } catch (error) {
      console.error('Error ending user sessions:', error);
      throw error;
    }
  }

  // Clean up expired inactive sessions
  static async cleanupInactiveSessions() {
    try {
      // Mark sessions as inactive if they haven't been updated in configurable time
      const inactiveThresholdHours = process.env.SESSION_INACTIVE_HOURS || 2;
      
      const [result] = await pool.query(`
        UPDATE user_sessions 
        SET is_active = false, logout_time = NOW(),
            session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
        WHERE is_active = true 
        AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
        AND logout_time IS NULL
      `, [inactiveThresholdHours]);

      if (result.affectedRows > 0) {
        console.log(`Cleaned up ${result.affectedRows} inactive sessions (idle > ${inactiveThresholdHours}h)`);
      }
      return result.affectedRows;
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      throw error;
    }
  }

  // Clean up very old sessions (force cleanup after 24 hours regardless of activity)
  static async cleanupOldSessions() {
    try {
      const [result] = await pool.query(`
        UPDATE user_sessions 
        SET is_active = false, logout_time = NOW(),
            session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW())
        WHERE is_active = true 
        AND login_time < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND logout_time IS NULL
      `);

      if (result.affectedRows > 0) {
        console.log(`Force cleaned up ${result.affectedRows} old sessions (> 24 hours)`);
      }
      return result.affectedRows;
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      throw error;
    }
  }

  // Get session statistics
  static async getSessionStats(userId = null, startDate = null, endDate = null) {
    try {
      let whereClause = '1=1';
      const params = [];

      if (userId) {
        whereClause += ' AND user_id = ?';
        params.push(userId);
      }

      if (startDate) {
        whereClause += ' AND login_time >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND login_time <= ?';
        params.push(endDate);
      }

      const [stats] = await pool.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN logout_time IS NOT NULL THEN 1 END) as completed_sessions,
          AVG(session_duration) as avg_duration_seconds,
          MAX(session_duration) as max_duration_seconds,
          MIN(session_duration) as min_duration_seconds,
          SUM(session_duration) as total_time_seconds
        FROM user_sessions
        WHERE ${whereClause}
      `, params);

      return stats[0];
    } catch (error) {
      console.error('Error getting session stats:', error);
      throw error;
    }
  }
}

module.exports = SessionService;
