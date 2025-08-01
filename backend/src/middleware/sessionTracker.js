const SessionService = require('../services/sessionService');
const RealTimeSessionService = require('../services/realTimeSessionService');

// Middleware to track session activity and update last activity timestamp
const trackSessionActivity = async (req, res, next) => {
  try {
    if (req.user) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (token) {
        // Update traditional session activity timestamp in background
        setImmediate(async () => {
          try {
            await SessionService.updateSessionActivity(token);
          } catch (error) {
            console.error('Error updating session activity:', error);
          }
        });

        // Track API activity for real-time session timeout management
        setImmediate(async () => {
          try {
            // Get session ID from request headers or generate one
            const sessionId = req.headers['x-session-id'] || 
                            req.sessionID || 
                            `session_${req.user.id}_${new Date().toISOString().split('T')[0]}`;
            
            // Track the API activity for timeout management
            await RealTimeSessionService.trackApiActivity(req.user.id, sessionId, {
              endpoint: req.path,
              method: req.method,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('Error tracking API activity for session timeout:', error);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error in session activity tracking:', error);
    // Don't block the request if session tracking fails
  }
  next();
};

module.exports = {
  trackSessionActivity
};
