import api from './api';

export const sessionTimeService = {
  // Get user's session time for today
  getTodaySessionTime: async (userId = null) => {
    const url = userId ? `/sessions/today/${userId}` : '/sessions/today';
    return api.get(url).then(response => response.data);
  },

  // Get user's session time for a specific date
  getSessionTimeByDate: async (date, userId = null) => {
    const url = userId ? `/sessions/date/${date}/${userId}` : `/sessions/date/${date}`;
    return api.get(url).then(response => response.data);
  },

  // Get user's session time for a date range
  getSessionTimeRange: async (startDate, endDate, userId = null) => {
    const url = userId 
      ? `/sessions/range/${startDate}/${endDate}/${userId}` 
      : `/sessions/range/${startDate}/${endDate}`;
    return api.get(url).then(response => response.data);
  },

  // Get all users' session times for a specific date (admin only)
  getAllUsersSessionTime: async (date) => {
    return api.get(`/sessions/all/${date}`).then(response => response.data);
  },

  // Get user session statistics
  getSessionStats: async (startDate, endDate, userId = null) => {
    const url = userId 
      ? `/sessions/stats/${startDate}/${endDate}/${userId}` 
      : `/sessions/stats/${startDate}/${endDate}`;
    return api.get(url).then(response => response.data);
  },

  // Get currently active sessions (admin only)
  getActiveSessions: async () => {
    return api.get('/sessions/active').then(response => response.data);
  },

  // Get detailed session breakdown for a user on a specific date
  getDetailedSessions: async (date, userId = null) => {
    const url = userId ? `/sessions/detailed/${date}/${userId}` : `/sessions/detailed/${date}`;
    return api.get(url).then(response => response.data);
  },

  // Force update session summary for a user (admin only)
  updateSessionSummary: async (userId) => {
    return api.post(`/sessions/update-summary/${userId}`).then(response => response.data);
  },

  // Export session data in various formats
  exportSessionData: async (startDate, endDate, userId = null, format = 'csv') => {
    try {
      // Use the route with optional userId parameter
      const url = userId 
        ? `/sessions/export/${startDate}/${endDate}/${userId}?format=${format}` 
        : `/sessions/export/${startDate}/${endDate}?format=${format}`;
      
      const response = await api.get(url, {
        responseType: 'blob'
      });

      // Get the filename from the response headers or create one
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1].replace(/"/g, '') 
        : `session-data-${startDate}-to-${endDate}.${format === 'excel' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv'}`;

      // Create blob with appropriate content type
      let blob;
      if (format === 'csv') {
        blob = new Blob([response.data], { type: 'text/csv' });
      } else if (format === 'excel') {
        blob = new Blob([response.data], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      } else if (format === 'pdf') {
        blob = new Blob([response.data], { type: 'application/pdf' });
      } else {
        blob = new Blob([response.data], { type: 'text/csv' });
      }

      // Create and trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true, filename };
    } catch (error) {
      console.error('Error exporting session data:', error);
      throw error;
    }
  },

  // Helper function to format session time in hours and minutes
  formatSessionTime: (seconds) => {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    let formatted = '';
    if (hours > 0) {
      formatted += `${hours}h `;
    }
    if (minutes > 0) {
      formatted += `${minutes}m `;
    }
    if (remainingSeconds > 0 && hours === 0) {
      formatted += `${remainingSeconds}s`;
    }

    return formatted.trim() || '0m';
  },

  // Helper function to format time (HH:MM)
  formatTime: (timeString) => {
    if (!timeString) return '-';
    
    // If it's already in HH:MM format, return as is
    if (timeString.includes(':') && timeString.length <= 8) {
      return timeString.substring(0, 5); // Remove seconds if present
    }
    
    // If it's a full timestamp, extract time
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return timeString;
    }
  },

  // Helper function to calculate productivity percentage
  calculateProductivity: (sessionTime, workingHours = 8) => {
    if (!sessionTime) return 0;
    const workingSeconds = workingHours * 3600;
    const productivity = (sessionTime / workingSeconds) * 100;
    return Math.min(productivity, 100); // Cap at 100%
  },

  // Helper function to get session status color
  getSessionStatusColor: (sessionTime, workingHours = 8) => {
    const productivity = sessionTimeService.calculateProductivity(sessionTime, workingHours);
    
    if (productivity >= 80) return 'success';
    if (productivity >= 60) return 'warning';
    if (productivity >= 40) return 'orange';
    return 'error';
  },

  // Helper function to get today's date in YYYY-MM-DD format
  getTodayDate: () => {
    return new Date().toISOString().split('T')[0];
  },

  // Helper function to get date range for common periods
  getDateRange: (period) => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    let startDate;

    switch (period) {
      case 'today':
        startDate = endDate;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 6);
        startDate = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        const monthStart = new Date(today);
        monthStart.setDate(monthStart.getDate() - 29);
        startDate = monthStart.toISOString().split('T')[0];
        break;
      default:
        startDate = endDate;
    }

    return { startDate, endDate };
  }
};

export default sessionTimeService;
