const SessionService = require('../services/sessionService');

// Middleware to track session activity and update last activity timestamp
const trackSessionActivity = async (req, res, next) => {
  try {
    if (req.user) {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (token) {
        // Update session activity timestamp in background
        setImmediate(async () => {
          try {
            await SessionService.updateSessionActivity(token);
          } catch (error) {
            console.error('Error updating session activity:', error);
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
