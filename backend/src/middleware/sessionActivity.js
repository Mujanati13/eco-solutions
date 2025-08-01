const RealTimeSessionService = require('../services/realTimeSessionService');

// Middleware to track API activity for session timeout management
const trackSessionActivity = async (req, res, next) => {
  // Only track activity for authenticated users
  if (req.user && req.user.id) {
    try {
      // Get session ID from request headers or generate one
      const sessionId = req.headers['x-session-id'] || req.sessionID || `session_${req.user.id}_${Date.now()}`;
      
      // Track the API activity
      await RealTimeSessionService.trackApiActivity(req.user.id, sessionId, {
        endpoint: req.path,
        method: req.method,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error tracking session activity:', error);
      // Don't block the request if tracking fails
    }
  }
  
  next();
};

module.exports = { trackSessionActivity };
