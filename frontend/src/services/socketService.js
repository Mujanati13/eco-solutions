import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.activityTimer = null;
    this.lastActivity = Date.now();
    this.sessionStartTime = null;
  }

  // Connect to Socket.IO server
  connect(token) {
    if (this.socket && this.isConnected) {
      console.log('Socket already connected');
      return;
    }

    if (!token) {
      console.warn('No token provided for socket connection');
      return;
    }

    // Get socket URL from environment variables or fallback to API base URL
    let serverUrl = import.meta.env.VITE_SOCKET_URL || 
                    import.meta.env.VITE_API_BASE_URL;
    
    // If no environment variables, try to construct from current location
    if (!serverUrl) {
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const hostname = window.location.hostname;
      const port = import.meta.env.VITE_API_PORT || '5000';
      
      // For localhost development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        serverUrl = `${protocol}//${hostname}:${port}`;
      } else {
        // For production/VPS deployment
        serverUrl = `${protocol}//${hostname}`;
      }
    }

    console.log('Connecting to Socket.IO server at:', serverUrl);

    this.socket = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true
    });

    this.setupEventHandlers();
    
    // Wait for connection before authenticating
    this.socket.on('connect', () => {
      console.log('Socket.IO connected, authenticating...');
      this.authenticate(token);
    });
    
    this.startActivityTracking();
  }

  // Setup socket event handlers
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Socket.IO connected');
      this.isConnected = true;
      this.sessionStartTime = Date.now();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
      this.isConnected = false;
      this.sessionStartTime = null;
    });

    this.socket.on('authenticated', (data) => {
      console.log('Socket.IO authenticated:', data);
      this.emit('authenticated', data);
    });

    this.socket.on('auth_error', (error) => {
      console.error('Socket.IO authentication error:', error);
      this.emit('authError', error);
    });

    this.socket.on('active_users_update', (data) => {
      this.emit('activeUsersUpdate', data);
    });

    this.socket.on('session_time_update', (data) => {
      this.emit('sessionTimeUpdate', data);
    });

    this.socket.on('activity_tracked', (data) => {
      this.emit('activityTracked', data);
    });

    this.socket.on('reconnect', () => {
      console.log('Socket.IO reconnected');
      // Re-authenticate on reconnection
      const token = localStorage.getItem('token');
      if (token) {
        this.authenticate(token);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
    });
  }

  // Authenticate with the server
  authenticate(token) {
    if (this.socket && token) {
      this.socket.emit('authenticate', { token });
    }
  }

  // Disconnect from server
  disconnect() {
    if (this.socket) {
      this.socket.emit('logout');
      this.socket.disconnect();
      this.isConnected = false;
      this.sessionStartTime = null;
      this.stopActivityTracking();
    }
  }

  // Track user activity
  trackActivity(activityType = 'general', data = {}) {
    if (this.socket && this.isConnected) {
      this.lastActivity = Date.now();
      this.socket.emit('user_activity', {
        activityType,
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }

  // Track page view
  trackPageView(page, data = {}) {
    if (this.socket && this.isConnected) {
      this.socket.emit('page_view', {
        page,
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }

  // Start automatic activity tracking
  startActivityTracking() {
    // Track mouse movements, clicks, and keyboard events
    const trackMouseActivity = () => this.trackActivity('mouse_move');
    const trackClickActivity = () => this.trackActivity('click');
    const trackKeyActivity = () => this.trackActivity('keyboard');
    const trackScrollActivity = () => this.trackActivity('scroll');

    // Add event listeners with throttling
    let mouseThrottle = false;
    let scrollThrottle = false;

    const throttledMouseMove = () => {
      if (!mouseThrottle) {
        mouseThrottle = true;
        setTimeout(() => {
          trackMouseActivity();
          mouseThrottle = false;
        }, 10000); // Track mouse activity every 10 seconds
      }
    };

    const throttledScroll = () => {
      if (!scrollThrottle) {
        scrollThrottle = true;
        setTimeout(() => {
          trackScrollActivity();
          scrollThrottle = false;
        }, 5000); // Track scroll activity every 5 seconds
      }
    };

    document.addEventListener('mousemove', throttledMouseMove);
    document.addEventListener('click', trackClickActivity);
    document.addEventListener('keydown', trackKeyActivity);
    document.addEventListener('scroll', throttledScroll);

    // Send periodic heartbeat every 30 seconds
    this.activityTimer = setInterval(() => {
      this.trackActivity('heartbeat');
    }, 30000);

    // Store event listeners for cleanup
    this.eventListeners = {
      mousemove: throttledMouseMove,
      click: trackClickActivity,
      keydown: trackKeyActivity,
      scroll: throttledScroll
    };
  }

  // Stop activity tracking
  stopActivityTracking() {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }

    // Remove event listeners
    if (this.eventListeners) {
      Object.entries(this.eventListeners).forEach(([event, handler]) => {
        document.removeEventListener(event, handler);
      });
      this.eventListeners = null;
    }
  }

  // Get current session duration
  getSessionDuration() {
    if (this.sessionStartTime) {
      return Math.floor((Date.now() - this.sessionStartTime) / 1000);
    }
    return 0;
  }

  // Get formatted session duration
  getFormattedSessionDuration() {
    const seconds = this.getSessionDuration();
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  // Add event listener
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Remove event listener
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Emit event to listeners
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in socket event listener:', error);
        }
      });
    }
  }

  // Check if connected
  isSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected;
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isSocketConnected(),
      sessionDuration: this.getSessionDuration(),
      formattedDuration: this.getFormattedSessionDuration(),
      lastActivity: this.lastActivity
    };
  }
}

// Export singleton instance
export default new SocketService();
