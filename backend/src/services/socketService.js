const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const RealTimeSessionService = require('./realTimeSessionService');
const SessionService = require('./sessionService');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> {socketId, sessionId, lastActivity}
    this.userSockets = new Map(); // socketId -> {userId, sessionId}
  }

  // Initialize Socket.IO server
  initialize(server) {
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [
          process.env.FRONTEND_URL || 'https://eco-s.albech.me',
          process.env.CLIENT_URL || 'https://eco-s.albech.me',
          'https://eco-s.albech.me',
          'https://api-ecos.albech.me'
        ]
      : [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173'
        ];

    this.io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
    this.startActivityTracking();
    
    console.log('✅ Socket.IO server initialized');
    return this.io;
  }

  // Setup socket event handlers
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Handle authentication
      socket.on('authenticate', async (data) => {
        try {
          await this.authenticateSocket(socket, data.token);
        } catch (error) {
          console.error('Socket authentication error:', error);
          socket.emit('auth_error', { message: 'Authentication failed' });
          socket.disconnect();
        }
      });

      // Handle user activity
      socket.on('user_activity', async (data) => {
        try {
          await this.updateUserActivity(socket, data);
        } catch (error) {
          console.error('Error updating user activity:', error);
        }
      });

      // Handle page view
      socket.on('page_view', async (data) => {
        try {
          await this.trackPageView(socket, data);
        } catch (error) {
          console.error('Error tracking page view:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', async (reason) => {
        console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        await this.handleDisconnection(socket);
      });

      // Handle manual logout
      socket.on('logout', async () => {
        await this.handleLogout(socket);
      });
    });
  }

  // Authenticate socket connection
  async authenticateSocket(socket, token) {
    try {
      if (!token) {
        throw new Error('No token provided');
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      // Get user info directly from database
      const { pool } = require('../../config/database');
      const [users] = await pool.query(`
        SELECT id, username, first_name, last_name, role, is_active
        FROM users
        WHERE id = ? AND is_active = true
      `, [userId]);

      if (!users || users.length === 0) {
        throw new Error('User not found or inactive');
      }

      const user = users[0];

      // Create or get active session
      let sessionId;
      try {
        // Try to get existing active session
        const session = await SessionService.getActiveSession(token);
        if (session) {
          sessionId = session.id;
        } else {
          // Create new session if none exists
          sessionId = await SessionService.createSession(
            userId, 
            token, 
            socket.handshake.address, 
            socket.handshake.headers['user-agent']
          );
        }
      } catch (sessionError) {
        // If session operations fail, create a new session
        console.log('Creating new session for socket authentication');
        sessionId = await SessionService.createSession(
          userId, 
          token, 
          socket.handshake.address, 
          socket.handshake.headers['user-agent']
        );
      }

      // Store user info in socket
      socket.userId = userId;
      socket.sessionId = sessionId;
      socket.userInfo = {
        id: userId,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      };

      // Start real-time session tracking
      await RealTimeSessionService.startRealTimeSession(userId, sessionId, socket.id);

      // Store in maps
      this.connectedUsers.set(userId, {
        socketId: socket.id,
        sessionId: sessionId,
        lastActivity: new Date(),
        userInfo: socket.userInfo
      });

      this.userSockets.set(socket.id, {
        userId: userId,
        sessionId: sessionId
      });

      // Join user-specific room
      socket.join(`user_${userId}`);

      // Emit authentication success
      socket.emit('authenticated', {
        userId: userId,
        sessionId: sessionId,
        userInfo: socket.userInfo
      });

      console.log(`User ${userId} (${user.username}) authenticated on socket ${socket.id}`);

      // Notify about active session
      this.broadcastActiveUsers();

    } catch (error) {
      console.error('Socket authentication failed:', error);
      throw error;
    }
  }

  // Update user activity
  async updateUserActivity(socket, data) {
    if (!socket.userId || !socket.sessionId) {
      return;
    }

    try {
      // Update last activity time
      const userConnection = this.connectedUsers.get(socket.userId);
      if (userConnection) {
        userConnection.lastActivity = new Date();
        this.connectedUsers.set(socket.userId, userConnection);
      }

      // Update in database
      await RealTimeSessionService.updateActivity(
        socket.userId, 
        socket.sessionId, 
        socket.id
      );

      // Emit activity confirmation
      socket.emit('activity_tracked', {
        timestamp: new Date().toISOString(),
        activityType: data.activityType || 'general'
      });

    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  }

  // Track page view
  async trackPageView(socket, data) {
    if (!socket.userId || !socket.sessionId) {
      return;
    }

    try {
      await this.updateUserActivity(socket, { activityType: 'page_view' });
      
      // Log page view if needed
      console.log(`User ${socket.userId} viewed page: ${data.page}`);
      
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  }

  // Handle socket disconnection
  async handleDisconnection(socket) {
    try {
      const userSocket = this.userSockets.get(socket.id);
      
      if (userSocket) {
        const { userId, sessionId } = userSocket;
        
        // End real-time session
        await RealTimeSessionService.endRealTimeSession(userId, sessionId, socket.id);
        
        // Remove from maps
        this.connectedUsers.delete(userId);
        this.userSockets.delete(socket.id);
        
        console.log(`User ${userId} disconnected from socket ${socket.id}`);
        
        // Broadcast updated active users
        this.broadcastActiveUsers();
      }
    } catch (error) {
      console.error('Error handling disconnection:', error);
    }
  }

  // Handle manual logout
  async handleLogout(socket) {
    try {
      await this.handleDisconnection(socket);
      socket.disconnect();
    } catch (error) {
      console.error('Error handling logout:', error);
    }
  }

  // Broadcast active users to all connected clients
  broadcastActiveUsers() {
    try {
      const activeUsers = Array.from(this.connectedUsers.entries()).map(([userId, data]) => ({
        userId,
        userInfo: data.userInfo,
        lastActivity: data.lastActivity,
        sessionId: data.sessionId
      }));

      this.io.emit('active_users_update', {
        count: activeUsers.length,
        users: activeUsers
      });
    } catch (error) {
      console.error('Error broadcasting active users:', error);
    }
  }

  // Get currently connected users
  getConnectedUsers() {
    return Array.from(this.connectedUsers.entries()).map(([userId, data]) => ({
      userId,
      ...data
    }));
  }

  // Send message to specific user
  sendToUser(userId, event, data) {
    try {
      this.io.to(`user_${userId}`).emit(event, data);
    } catch (error) {
      console.error('Error sending message to user:', error);
    }
  }

  // Broadcast to all users
  broadcast(event, data) {
    try {
      this.io.emit(event, data);
    } catch (error) {
      console.error('Error broadcasting message:', error);
    }
  }

  // Start periodic activity tracking
  startActivityTracking() {
    // Clean up inactive sessions every 5 minutes
    setInterval(async () => {
      try {
        await RealTimeSessionService.cleanupInactiveSessions();
      } catch (error) {
        console.error('Error in periodic cleanup:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Update daily summaries every hour
    setInterval(async () => {
      try {
        const connectedUsers = this.getConnectedUsers();
        const today = new Date().toISOString().split('T')[0];
        
        for (const user of connectedUsers) {
          await RealTimeSessionService.updateDailySummary(user.userId, today);
        }
      } catch (error) {
        console.error('Error in periodic summary update:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    console.log('✅ Activity tracking intervals started');
  }

  // Force update session for a user
  async forceUpdateUserSession(userId) {
    try {
      const userConnection = this.connectedUsers.get(userId);
      if (userConnection) {
        const today = new Date().toISOString().split('T')[0];
        await RealTimeSessionService.updateDailySummary(userId, today);
        
        // Send updated session info to user
        const sessionTime = await RealTimeSessionService.getUserSessionTime(userId, today);
        this.sendToUser(userId, 'session_time_update', sessionTime);
      }
    } catch (error) {
      console.error('Error forcing session update:', error);
    }
  }
}

// Export singleton instance
module.exports = new SocketService();
