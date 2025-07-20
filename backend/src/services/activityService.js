const { pool } = require('../../config/database');

class ActivityService {
  // Log user activity
  static async logActivity(options) {
    const {
      userId,
      sessionId = null,
      activityType,
      description,
      entityType = null,
      entityId = null,
      metadata = null,
      ipAddress = null,
      userAgent = null
    } = options;

    try {
      const [result] = await pool.query(`
        INSERT INTO activity_logs 
        (user_id, session_id, activity_type, activity_description, entity_type, entity_id, metadata, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        sessionId,
        activityType,
        description,
        entityType,
        entityId,
        metadata ? JSON.stringify(metadata) : null,
        ipAddress,
        userAgent
      ]);

      return result.insertId;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  }

  // Get user activity logs
  static async getUserActivities(userId, options = {}) {
    const {
      limit = 100,
      offset = 0,
      activityType = null,
      startDate = null,
      endDate = null
    } = options;

    try {
      let whereClause = 'al.user_id = ?';
      const params = [userId];

      if (activityType) {
        whereClause += ' AND al.activity_type = ?';
        params.push(activityType);
      }

      if (startDate) {
        whereClause += ' AND al.created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND al.created_at <= ?';
        params.push(endDate);
      }

      params.push(limit, offset);

      const [activities] = await pool.query(`
        SELECT 
          al.*,
          us.login_time as session_start
        FROM activity_logs al
        LEFT JOIN user_sessions us ON al.session_id = us.id
        WHERE ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `, params);

      return activities;
    } catch (error) {
      console.error('Error getting user activities:', error);
      throw error;
    }
  }

  // Get all activities (admin only)
  static async getAllActivities(options = {}) {
    const {
      limit = 100,
      offset = 0,
      userId = null,
      activityType = null,
      startDate = null,
      endDate = null
    } = options;

    try {
      let whereClause = '1=1';
      const params = [];

      if (userId) {
        whereClause += ' AND al.user_id = ?';
        params.push(userId);
      }

      if (activityType) {
        whereClause += ' AND al.activity_type = ?';
        params.push(activityType);
      }

      if (startDate) {
        whereClause += ' AND al.created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND al.created_at <= ?';
        params.push(endDate);
      }

      params.push(limit, offset);

      const [activities] = await pool.query(`
        SELECT 
          al.*,
          u.username,
          u.first_name,
          u.last_name,
          us.login_time as session_start
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        LEFT JOIN user_sessions us ON al.session_id = us.id
        WHERE ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `, params);

      return activities;
    } catch (error) {
      console.error('Error getting all activities:', error);
      throw error;
    }
  }

  // Get activity statistics
  static async getActivityStats(userId = null, startDate = null, endDate = null) {
    try {
      let whereClause = '1=1';
      const params = [];

      if (userId) {
        whereClause += ' AND user_id = ?';
        params.push(userId);
      }

      if (startDate) {
        whereClause += ' AND created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND created_at <= ?';
        params.push(endDate);
      }

      const [stats] = await pool.query(`
        SELECT 
          activity_type,
          COUNT(*) as count,
          DATE(created_at) as activity_date
        FROM activity_logs
        WHERE ${whereClause}
        GROUP BY activity_type, DATE(created_at)
        ORDER BY activity_date DESC, count DESC
      `, params);

      return stats;
    } catch (error) {
      console.error('Error getting activity stats:', error);
      throw error;
    }
  }

  // Clean up old activity logs (older than specified days)
  static async cleanupOldActivities(daysToKeep = 90) {
    try {
      const [result] = await pool.query(`
        DELETE FROM activity_logs 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [daysToKeep]);

      console.log(`Cleaned up ${result.affectedRows} old activity logs`);
      return result.affectedRows;
    } catch (error) {
      console.error('Error cleaning up old activities:', error);
      throw error;
    }
  }

  // Log common activities with predefined formats
  static async logLogin(userId, sessionId, ipAddress, userAgent) {
    return this.logActivity({
      userId,
      sessionId,
      activityType: 'login',
      description: 'User logged in',
      ipAddress,
      userAgent
    });
  }

  static async logLogout(userId, sessionId, ipAddress, userAgent) {
    return this.logActivity({
      userId,
      sessionId,
      activityType: 'logout',
      description: 'User logged out',
      ipAddress,
      userAgent
    });
  }

  static async logOrderAction(userId, sessionId, action, orderId, metadata = {}) {
    const activityTypes = {
      'create': 'order_create',
      'update': 'order_update',
      'delete': 'order_delete',
      'assign': 'order_assign',
      'import': 'order_import'
    };

    // Create appropriate description based on action type
    let description = `Order ${action}`;
    if (action === 'import') {
      const importedCount = metadata?.action_details?.imported_count || 0;
      description = `Imported ${importedCount} orders`;
    } else if (orderId && orderId !== 0) {
      description = `Order ${action} - Order #${orderId}`;
    }

    return this.logActivity({
      userId,
      sessionId,
      activityType: activityTypes[action] || 'order_update',
      description,
      entityType: 'order',
      entityId: orderId,
      metadata
    });
  }

  static async logPageView(userId, sessionId, page, ipAddress, userAgent) {
    return this.logActivity({
      userId,
      sessionId,
      activityType: 'view_page',
      description: `Viewed page: ${page}`,
      metadata: { page },
      ipAddress,
      userAgent
    });
  }

  static async logExport(userId, sessionId, exportType, metadata = {}) {
    return this.logActivity({
      userId,
      sessionId,
      activityType: 'order_export',
      description: `Exported ${exportType}`,
      metadata: { exportType, ...metadata }
    });
  }

  // Get activities count for pagination
  static async getActivitiesCount(options = {}) {
    const {
      userId = null,
      activityType = null,
      startDate = null,
      endDate = null
    } = options;

    try {
      let whereClause = '1=1';
      const params = [];

      if (userId) {
        whereClause += ' AND al.user_id = ?';
        params.push(userId);
      }

      if (activityType) {
        whereClause += ' AND al.activity_type = ?';
        params.push(activityType);
      }

      if (startDate) {
        whereClause += ' AND al.created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND al.created_at <= ?';
        params.push(endDate);
      }

      const [result] = await pool.query(`
        SELECT COUNT(*) as total
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        WHERE ${whereClause}
      `, params);

      return result[0].total;
    } catch (error) {
      console.error('Error getting activities count:', error);
      throw error;
    }
  }
}

module.exports = ActivityService;
