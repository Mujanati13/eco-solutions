import { authService } from './authService'

class SessionManager {
  constructor() {
    this.heartbeatInterval = null
    this.isActive = false
    this.heartbeatFrequency = 5 * 60 * 1000 // 5 minutes
    this.lastActivity = Date.now()
    this.inactivityThreshold = 10 * 60 * 1000 // 10 minutes
  }

  // Start session management
  start() {
    if (this.isActive) return

    this.isActive = true
    console.log('🟢 Session manager started')

    // Start heartbeat
    this.startHeartbeat()

    // Listen for user activity
    this.startActivityTracking()

    // Listen for browser close/refresh events
    this.setupBeforeUnloadHandler()

    // Listen for visibility changes (tab switching)
    this.setupVisibilityHandler()
  }

  // Stop session management
  stop() {
    if (!this.isActive) return

    this.isActive = false
    console.log('🔴 Session manager stopped')

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    this.removeEventListeners()
  }

  // Start periodic heartbeat to keep session alive
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        // Only send heartbeat if user has been active recently
        const timeSinceLastActivity = Date.now() - this.lastActivity
        if (timeSinceLastActivity < this.inactivityThreshold) {
          await authService.heartbeat()
          console.log('💓 Heartbeat sent')
        } else {
          console.log('😴 User inactive, skipping heartbeat')
        }
      } catch (error) {
        console.error('💔 Heartbeat failed:', error)
        // If heartbeat fails, user might be logged out
        if (error.response?.status === 401) {
          this.handleSessionExpired()
        }
      }
    }, this.heartbeatFrequency)
  }

  // Track user activity to determine if they're still active
  startActivityTracking() {
    const updateActivity = () => {
      this.lastActivity = Date.now()
    }

    // Track various user activities
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    // Store event listeners for cleanup
    this.activityEvents = events.map(event => ({ event, handler: updateActivity }))
  }

  // Setup handler for browser close/refresh
  setupBeforeUnloadHandler() {
    this.beforeUnloadHandler = async (event) => {
      try {
        // Use sendBeacon for reliable logout on page unload
        const token = localStorage.getItem('token')
        if (token && navigator.sendBeacon) {
          const logoutData = new FormData()
          logoutData.append('action', 'logout')
          
          // Send logout request via beacon (more reliable than fetch on unload)
          navigator.sendBeacon('/api/auth/logout', logoutData)
        }
      } catch (error) {
        console.error('Error in beforeunload handler:', error)
      }
    }

    window.addEventListener('beforeunload', this.beforeUnloadHandler)
  }

  // Setup handler for tab visibility changes
  setupVisibilityHandler() {
    this.visibilityHandler = () => {
      if (document.hidden) {
        console.log('👁️ Tab hidden')
        // Optionally reduce heartbeat frequency when tab is hidden
      } else {
        console.log('👁️ Tab visible')
        this.lastActivity = Date.now() // Mark as active when tab becomes visible
      }
    }

    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  // Handle session expiration
  handleSessionExpired() {
    console.log('🔒 Session expired')
    this.stop()
    
    // Clear local storage
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    
    // Redirect to login or dispatch logout event
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  // Remove all event listeners
  removeEventListeners() {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler)
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
    }

    if (this.activityEvents) {
      this.activityEvents.forEach(({ event, handler }) => {
        document.removeEventListener(event, handler, true)
      })
    }
  }

  // Get session info
  getSessionInfo() {
    return {
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      timeSinceLastActivity: Date.now() - this.lastActivity,
      heartbeatInterval: this.heartbeatFrequency
    }
  }

  // Force logout (for manual logout or admin actions)
  async forceLogout() {
    try {
      await authService.logout()
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      this.handleSessionExpired()
    }
  }
}

// Create singleton instance
const sessionManager = new SessionManager()

export default sessionManager
