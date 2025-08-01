const RealTimeSessionService = require('./realTimeSessionService');

class SessionTimeoutService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  // Start the background job to check for inactive sessions every 2 minutes
  start() {
    if (this.isRunning) {
      console.log('⚠️  Session timeout service is already running');
      return;
    }

    console.log('🚀 Starting session timeout service...');
    console.log('⏰ Will check for inactive sessions every 2 minutes');
    console.log('🕐 Sessions inactive for more than 10 minutes will be paused');
    
    this.isRunning = true;
    
    // Run immediately on start
    this.checkInactiveSessions();
    
    // Then run every 2 minutes (120000 ms)
    this.intervalId = setInterval(() => {
      this.checkInactiveSessions();
    }, 120000);

    return this;
  }

  // Stop the background job
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('⏹️  Session timeout service stopped');
    }
  }

  // Check and pause inactive sessions
  async checkInactiveSessions() {
    try {
      const pausedCount = await RealTimeSessionService.pauseInactiveSessions();
      
      if (pausedCount > 0) {
        console.log(`⏸️  Paused ${pausedCount} inactive sessions at ${new Date().toISOString()}`);
      }
      
      // Also log active sessions count for monitoring
      const activeCount = await this.getActiveSessionsCount();
      console.log(`📊 Current active sessions: ${activeCount} | Paused this cycle: ${pausedCount}`);
      
    } catch (error) {
      console.error('❌ Error checking inactive sessions:', error);
    }
  }

  // Get count of currently active sessions
  async getActiveSessionsCount() {
    try {
      const RealTimeSessionService = require('./realTimeSessionService');
      const { pool } = require('../../config/database');
      
      const [result] = await pool.query(`
        SELECT COUNT(*) as count 
        FROM real_time_sessions 
        WHERE is_active = true AND is_paused = false
      `);
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  // Get session statistics for monitoring
  async getSessionStats() {
    try {
      const { pool } = require('../../config/database');
      
      const [stats] = await pool.query(`
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN is_active = true AND is_paused = false THEN 1 ELSE 0 END) as active_sessions,
          SUM(CASE WHEN is_active = true AND is_paused = true THEN 1 ELSE 0 END) as paused_sessions,
          SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as ended_sessions,
          AVG(COALESCE(paused_duration, 0)) as avg_paused_duration,
          AVG(resume_count) as avg_resume_count
        FROM real_time_sessions 
        WHERE date >= CURDATE()
      `);
      
      return stats[0] || {};
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {};
    }
  }

  // Manual trigger for testing
  async triggerCheck() {
    console.log('🔧 Manually triggering inactive session check...');
    await this.checkInactiveSessions();
  }
}

// Create a singleton instance
const sessionTimeoutService = new SessionTimeoutService();

module.exports = sessionTimeoutService;
