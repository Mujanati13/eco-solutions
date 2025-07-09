const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const RealTimeSessionService = require('../services/realTimeSessionService');
const socketService = require('../services/socketService');

const router = express.Router();

// Get user's session time for today
router.get('/today/:userId?', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const today = new Date().toISOString().split('T')[0];
    const sessionTime = await RealTimeSessionService.getUserSessionTime(userId, today);
    
    res.json({
      success: true,
      data: sessionTime
    });
  } catch (error) {
    console.error('Error fetching today session time:', error);
    res.status(500).json({ error: 'Failed to fetch session time' });
  }
});

// Get user's session time for a specific date
router.get('/date/:date/:userId?', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sessionTime = await RealTimeSessionService.getUserSessionTime(userId, date);
    
    res.json({
      success: true,
      data: sessionTime
    });
  } catch (error) {
    console.error('Error fetching session time for date:', error);
    res.status(500).json({ error: 'Failed to fetch session time' });
  }
});

// Get user's session time for a date range
router.get('/range/:startDate/:endDate/:userId?', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sessionTimes = await RealTimeSessionService.getUserSessionTimeRange(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: sessionTimes
    });
  } catch (error) {
    console.error('Error fetching session time range:', error);
    res.status(500).json({ error: 'Failed to fetch session time range' });
  }
});

// Get all users' session times for a specific date (admin only)
router.get('/all/:date', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { date } = req.params;
    const sessionTimes = await RealTimeSessionService.getAllUsersSessionTime(date);
    
    res.json({
      success: true,
      data: sessionTimes
    });
  } catch (error) {
    console.error('Error fetching all users session times:', error);
    res.status(500).json({ error: 'Failed to fetch session times' });
  }
});

// Get user session statistics
router.get('/stats/:startDate/:endDate/:userId?', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await RealTimeSessionService.getUserSessionStats(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session stats' });
  }
});

// Get currently active sessions (admin only)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const activeSessions = await RealTimeSessionService.getActiveSessions();
    const connectedUsers = socketService.getConnectedUsers();
    
    res.json({
      success: true,
      data: {
        activeSessions,
        connectedUsers,
        totalActive: connectedUsers.length
      }
    });
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// Get detailed session breakdown for a user on a specific date
router.get('/detailed/:date/:userId?', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const detailedSessions = await RealTimeSessionService.getUserDetailedSessions(userId, date);
    
    res.json({
      success: true,
      data: detailedSessions
    });
  } catch (error) {
    console.error('Error fetching detailed sessions:', error);
    res.status(500).json({ error: 'Failed to fetch detailed sessions' });
  }
});

// Force update session summary for a user (admin only)
router.post('/update-summary/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    await RealTimeSessionService.updateDailySummary(userId, today);
    await socketService.forceUpdateUserSession(parseInt(userId));
    
    res.json({
      success: true,
      message: 'Session summary updated successfully'
    });
  } catch (error) {
    console.error('Error updating session summary:', error);
    res.status(500).json({ error: 'Failed to update session summary' });
  }
});

// Export session data to CSV
router.get('/export/:startDate/:endDate/:userId?', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const userId = req.params.userId || req.user.userId;
    
    // Check if user can access this data
    if (req.user.role !== 'admin' && req.user.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sessionTimes = await RealTimeSessionService.getUserSessionTimeRange(userId, startDate, endDate);
    
    // Convert to CSV format
    const csvHeader = 'Date,User ID,Username,First Name,Last Name,Role,Total Session Time (seconds),Session Count,Page Views,First Login,Last Logout';
    const csvRows = sessionTimes.map(session => [
      session.date,
      session.user_id,
      session.username,
      session.first_name,
      session.last_name,
      session.role,
      session.total_session_time,
      session.session_count,
      session.page_views,
      session.first_login || '',
      session.last_logout || ''
    ].join(','));
    
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="session-times-${startDate}-to-${endDate}.csv"`);
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error exporting session data:', error);
    res.status(500).json({ error: 'Failed to export session data' });
  }
});

module.exports = router;
