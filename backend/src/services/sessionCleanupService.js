const cron = require('node-cron');
const SessionService = require('./sessionService');
const ActivityService = require('./activityService');

class SessionCleanupService {
  static start() {
    console.log('🕒 Starting session cleanup service...');

    // Run every 15 minutes to cleanup inactive sessions
    cron.schedule('*/15 * * * *', async () => {
      try {
        await SessionService.cleanupInactiveSessions();
      } catch (error) {
        console.error('Error in scheduled session cleanup:', error);
      }
    });

    // Run every hour to cleanup very old sessions
    cron.schedule('0 * * * *', async () => {
      try {
        await SessionService.cleanupOldSessions();
      } catch (error) {
        console.error('Error in scheduled old session cleanup:', error);
      }
    });

    // Run daily at 3 AM to cleanup old activity logs
    cron.schedule('0 3 * * *', async () => {
      try {
        const activityRetentionDays = process.env.ACTIVITY_RETENTION_DAYS || 90;
        await ActivityService.cleanupOldActivities(activityRetentionDays);
      } catch (error) {
        console.error('Error in scheduled activity cleanup:', error);
      }
    });

    console.log('✅ Session cleanup service started');
  }

  static stop() {
    cron.destroy();
    console.log('🛑 Session cleanup service stopped');
  }

  // Manual cleanup method for testing or admin actions
  static async runManualCleanup() {
    try {
      console.log('🧹 Running manual session cleanup...');
      
      const inactiveSessions = await SessionService.cleanupInactiveSessions();
      const oldSessions = await SessionService.cleanupOldSessions();
      const oldActivities = await ActivityService.cleanupOldActivities();

      console.log(`✅ Manual cleanup completed:
        - Inactive sessions: ${inactiveSessions}
        - Old sessions: ${oldSessions}
        - Old activities: ${oldActivities}`);

      return {
        inactive_sessions: inactiveSessions,
        old_sessions: oldSessions,
        old_activities: oldActivities
      };
    } catch (error) {
      console.error('Error in manual cleanup:', error);
      throw error;
    }
  }
}

module.exports = SessionCleanupService;
