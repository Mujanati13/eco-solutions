const { pool } = require('../../config/database');

class RealTimeSessionService {
  // Start a real-time session tracking
  static async startRealTimeSession(userId, sessionId, socketId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [result] = await pool.query(`
        INSERT INTO real_time_sessions 
        (user_id, session_id, date, socket_id, start_time, last_activity)
        VALUES (?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
        socket_id = VALUES(socket_id),
        start_time = NOW(),
        last_activity = NOW(),
        is_active = true,
        end_time = NULL
      `, [userId, sessionId, today, socketId]);

      return result.insertId || result.insertId;
    } catch (error) {
      console.error('Error starting real-time session:', error);
      throw error;
    }
  }

  // Update activity timestamp (called on user interaction)
  static async updateActivity(userId, sessionId, socketId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await pool.query(`
        UPDATE real_time_sessions 
        SET last_activity = NOW(),
            page_views = page_views + 1
        WHERE user_id = ? AND session_id = ? AND date = ? AND is_active = true
      `, [userId, sessionId, today]);

      return true;
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  }

  // End real-time session and calculate duration
  static async endRealTimeSession(userId, sessionId, socketId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await pool.query(`
        UPDATE real_time_sessions 
        SET end_time = NOW(),
            duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()),
            is_active = false
        WHERE user_id = ? AND session_id = ? AND date = ? AND is_active = true
      `, [userId, sessionId, today]);

      // Update daily summary
      await this.updateDailySummary(userId, today);

      return true;
    } catch (error) {
      console.error('Error ending real-time session:', error);
      throw error;
    }
  }

  // Update daily session summary
  static async updateDailySummary(userId, date) {
    try {
      // Calculate totals for the day
      const [sessionData] = await pool.query(`
        SELECT 
          COUNT(*) as session_count,
          SUM(duration_seconds) as total_time,
          SUM(page_views) as total_page_views,
          MIN(TIME(start_time)) as first_login,
          MAX(TIME(COALESCE(end_time, last_activity))) as last_logout
        FROM real_time_sessions
        WHERE user_id = ? AND date = ?
      `, [userId, date]);

      if (sessionData.length > 0) {
        const data = sessionData[0];
        
        await pool.query(`
          INSERT INTO daily_session_summary 
          (user_id, date, total_session_time, session_count, page_views, first_login, last_logout)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          total_session_time = VALUES(total_session_time),
          session_count = VALUES(session_count),
          page_views = VALUES(page_views),
          first_login = VALUES(first_login),
          last_logout = VALUES(last_logout),
          updated_at = NOW()
        `, [
          userId,
          date,
          data.total_time || 0,
          data.session_count || 0,
          data.total_page_views || 0,
          data.first_login,
          data.last_logout
        ]);
      }

      return true;
    } catch (error) {
      console.error('Error updating daily summary:', error);
      throw error;
    }
  }

  // Get user's session time for a specific date
  static async getUserSessionTime(userId, date) {
    try {
      const [result] = await pool.query(`
        SELECT 
          dss.*,
          u.username,
          u.first_name,
          u.last_name,
          u.role
        FROM daily_session_summary dss
        JOIN users u ON dss.user_id = u.id
        WHERE dss.user_id = ? AND dss.date = ?
      `, [userId, date]);

      return result[0] || null;
    } catch (error) {
      console.error('Error getting user session time:', error);
      throw error;
    }
  }

  // Get user's session time for a date range
  static async getUserSessionTimeRange(userId, startDate, endDate) {
    try {
      const [results] = await pool.query(`
        SELECT 
          dss.*,
          u.username,
          u.first_name,
          u.last_name,
          u.role
        FROM daily_session_summary dss
        JOIN users u ON dss.user_id = u.id
        WHERE dss.user_id = ? AND dss.date BETWEEN ? AND ?
        ORDER BY dss.date DESC
      `, [userId, startDate, endDate]);

      return results;
    } catch (error) {
      console.error('Error getting user session time range:', error);
      throw error;
    }
  }

  // Get all users' session times for a specific date
  static async getAllUsersSessionTime(date) {
    try {
      const [results] = await pool.query(`
        SELECT 
          dss.*,
          u.username,
          u.first_name,
          u.last_name,
          u.role
        FROM daily_session_summary dss
        JOIN users u ON dss.user_id = u.id
        WHERE dss.date = ?
        ORDER BY dss.total_session_time DESC
      `, [date]);

      return results;
    } catch (error) {
      console.error('Error getting all users session time:', error);
      throw error;
    }
  }

  // Get session statistics for a user
  static async getUserSessionStats(userId, startDate, endDate) {
    try {
      const [results] = await pool.query(`
        SELECT 
          COUNT(*) as total_days_active,
          SUM(total_session_time) as total_time_seconds,
          AVG(total_session_time) as avg_daily_time,
          SUM(session_count) as total_sessions,
          SUM(page_views) as total_page_views,
          MAX(total_session_time) as max_daily_time,
          MIN(total_session_time) as min_daily_time
        FROM daily_session_summary
        WHERE user_id = ? AND date BETWEEN ? AND ?
      `, [userId, startDate, endDate]);

      return results[0] || null;
    } catch (error) {
      console.error('Error getting user session stats:', error);
      throw error;
    }
  }

  // Get currently active sessions
  static async getActiveSessions() {
    try {
      const [results] = await pool.query(`
        SELECT 
          rts.*,
          u.username,
          u.first_name,
          u.last_name,
          u.role,
          TIMESTAMPDIFF(SECOND, rts.start_time, NOW()) as current_duration
        FROM real_time_sessions rts
        JOIN users u ON rts.user_id = u.id
        WHERE rts.is_active = true
        ORDER BY rts.start_time DESC
      `);

      return results;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      throw error;
    }
  }

  // Cleanup inactive sessions (sessions without activity for more than 30 minutes)
  static async cleanupInactiveSessions() {
    try {
      // Mark sessions as inactive if no activity for 30 minutes
      await pool.query(`
        UPDATE real_time_sessions 
        SET is_active = false,
            end_time = last_activity,
            duration_seconds = TIMESTAMPDIFF(SECOND, start_time, last_activity)
        WHERE is_active = true 
        AND last_activity < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
      `);

      // Update daily summaries for affected sessions
      const [affectedDates] = await pool.query(`
        SELECT DISTINCT user_id, date
        FROM real_time_sessions
        WHERE is_active = false 
        AND updated_at >= DATE_SUB(NOW(), INTERVAL 35 MINUTE)
      `);

      for (const row of affectedDates) {
        await this.updateDailySummary(row.user_id, row.date);
      }

      return true;
    } catch (error) {
      console.error('Error cleaning up inactive sessions:', error);
      throw error;
    }
  }

  // Get detailed session breakdown for a user on a specific date
  static async getUserDetailedSessions(userId, date) {
    try {
      const [results] = await pool.query(`
        SELECT 
          rts.*,
          us.login_time,
          us.logout_time,
          us.ip_address,
          us.user_agent
        FROM real_time_sessions rts
        JOIN user_sessions us ON rts.session_id = us.id
        WHERE rts.user_id = ? AND rts.date = ?
        ORDER BY rts.start_time ASC
      `, [userId, date]);

      return results;
    } catch (error) {
      console.error('Error getting detailed sessions:', error);
      throw error;
    }
  }
}

module.exports = RealTimeSessionService;
