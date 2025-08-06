import { collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { v4 as uuidv4 } from 'uuid';

class FirebaseTraceService {
  constructor() {
    this.collection = 'api_traces';
    this.sessionId = uuidv4(); // Unique session identifier
  }

  /**
   * Log a new API request trace to Firebase
   * @param {Object} traceData - The trace data to log
   */
  async logTrace(traceData) {
    try {
      // Clean the data to ensure no undefined values
      const cleanedData = this.cleanData(traceData);
      
      const trace = {
        id: uuidv4(),
        sessionId: this.sessionId,
        timestamp: Timestamp.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...cleanedData,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, this.collection), trace);
      return trace;
    } catch (error) {
      console.error('Error logging trace to Firebase:', error);
      throw error;
    }
  }

  /**
   * Clean data to remove undefined values and ensure Firebase compatibility
   * @param {Object} data - Data to clean
   */
  cleanData(data) {
    if (data === null || data === undefined) {
      return null;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.cleanData(item)).filter(item => item !== undefined && item !== null);
    }
    
    if (typeof data === 'object') {
      const cleaned = {};
      Object.entries(data).forEach(([key, value]) => {
        // Skip undefined, null, or empty string values
        if (value !== undefined && value !== null && value !== '') {
          const cleanedValue = this.cleanData(value);
          if (cleanedValue !== undefined && cleanedValue !== null && cleanedValue !== '') {
            // Ensure the key is valid and value is serializable
            try {
              // Test serialization
              JSON.stringify(cleanedValue);
              cleaned[key] = cleanedValue;
            } catch (error) {
              console.warn(`Failed to serialize field ${key}:`, error);
              // Store a safe representation
              cleaned[key] = String(cleanedValue);
            }
          }
        }
      });
      return cleaned;
    }
    
    // For primitive values, ensure they're serializable
    if (typeof data === 'function') {
      return '[Function]';
    }
    
    if (typeof data === 'symbol') {
      return data.toString();
    }
    
    return data;
  }

  /**
   * Convert timestamp safely for display
   * @param {any} timestamp - Timestamp to convert (Firestore Timestamp, Date, string, or number)
   * @returns {Date} - JavaScript Date object
   */
  convertTimestamp(timestamp) {
    try {
      // Firestore Timestamp object
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      
      // Already a Date object
      if (timestamp instanceof Date) {
        return timestamp;
      }
      
      // String or number timestamp
      if (timestamp) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Fallback to current time
      return new Date();
    } catch (error) {
      console.warn('Failed to convert timestamp:', timestamp, error);
      return new Date();
    }
  }

  /**
   * Log HTTP request start
   * @param {string} requestId - Unique request identifier
   * @param {Object} requestData - Request details
   */
  async logRequestStart(requestId, requestData) {
    const now = new Date();
    const traceData = {
      requestId,
      type: 'REQUEST_START',
      method: requestData.method || 'GET',
      url: requestData.url,
      headers: requestData.headers || {},
      body: requestData.body || null,
      environment: requestData.environment || 'unknown',
      startTime: Date.now(),
      timestamp: requestData.timestamp || now.toISOString(),
      status: 'PENDING',
      requestSize: requestData.requestSize || 0,
      userAgent: requestData.userAgent || navigator.userAgent,
      // Enhanced timing data
      timingDetails: {
        requestInitiated: now.toISOString(),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        millisecond: now.getMilliseconds()
      }
    };

    return await this.logTrace(traceData);
  }

  /**
   * Log HTTP request completion
   * @param {string} requestId - Unique request identifier
   * @param {Object} responseData - Response details
   */
  async logRequestComplete(requestId, responseData) {
    const now = new Date();
    const traceData = {
      requestId,
      type: 'REQUEST_COMPLETE',
      method: responseData.method || 'UNKNOWN',
      url: responseData.url,
      status: responseData.success ? 'SUCCESS' : 'ERROR',
      statusCode: responseData.statusCode,
      statusText: responseData.statusText || '',
      responseTime: responseData.responseTime,
      responseSize: responseData.responseSize || 0,
      responseHeaders: responseData.headers || {},
      responseBody: responseData.body || null,
      error: responseData.error || null,
      endTime: Date.now(),
      timestamp: responseData.timestamp || now.toISOString(),
      // Enhanced timing data
      timingDetails: {
        requestCompleted: now.toISOString(),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        millisecond: now.getMilliseconds(),
        durationMs: responseData.responseTime
      }
    };

    return await this.logTrace(traceData);
  }

  /**
   * Log custom application events
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Event details
   */
  async logEvent(eventType, eventData) {
    const traceData = {
      requestId: eventData.requestId || uuidv4(),
      type: eventType,
      status: 'INFO',
      message: eventData.message,
      data: eventData.data || {},
      timestamp: Date.now()
    };

    return await this.logTrace(traceData);
  }

  /**
   * Retrieve traces from Firebase
   * @param {Object} options - Query options
   */
  async getTraces(options = {}) {
    try {
      const {
        limitCount = 100,
        sessionId = null,
        requestId = null,
        status = null,
        startDate = null,
        endDate = null
      } = options;

      // Simplified query to avoid index requirements
      // We'll do filtering client-side for now
      let q;
      
      if (sessionId) {
        // Simple query with sessionId filter
        q = query(
          collection(db, this.collection),
          where('sessionId', '==', sessionId),
          limit(limitCount)
        );
      } else {
        // Simple query with just ordering and limit
        q = query(
          collection(db, this.collection),
          orderBy('timestamp', 'desc'),
          limit(limitCount)
        );
      }

      const querySnapshot = await getDocs(q);
      let traces = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        traces.push({
          id: doc.id,
          ...data,
          // Handle timestamp conversion safely
          timestamp: this.convertTimestamp(data.timestamp)
        });
      });

      // Client-side filtering to avoid index requirements
      if (requestId) {
        traces = traces.filter(trace => trace.requestId === requestId);
      }
      if (status) {
        traces = traces.filter(trace => trace.status === status);
      }
      if (startDate && endDate) {
        traces = traces.filter(trace => {
          const traceTime = trace.timestamp;
          return traceTime >= startDate && traceTime <= endDate;
        });
      }

      // Sort by timestamp (newest first) if not already sorted
      traces.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return traces;
    } catch (error) {
      console.error('Error retrieving traces from Firebase:', error);
      throw error;
    }
  }

  /**
   * Get traces for current session
   */
  async getCurrentSessionTraces() {
    // For now, just get recent traces instead of filtering by sessionId
    // to avoid compound index requirements
    const traces = await this.getTraces({ limitCount: 50 });
    
    // Filter out CONNECTION_TEST traces
    return traces.filter(trace => 
      trace.type !== 'CONNECTION_TEST' && 
      !(trace.message && trace.message.includes('Testing Firebase connection'))
    );
  }

  /**
   * Get traces filtered by HTTP method
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {Object} options - Additional filter options
   */
  async getTracesByMethod(method, options = {}) {
    try {
      const traces = await this.getTraces(options);
      return traces.filter(trace => trace.method === method.toUpperCase());
    } catch (error) {
      console.error('Error retrieving traces by method:', error);
      throw error;
    }
  }

  /**
   * Get traces within a time range
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @param {Object} options - Additional filter options
   */
  async getTracesByTimeRange(startTime, endTime, options = {}) {
    try {
      const traces = await this.getTraces(options);
      return traces.filter(trace => {
        const traceTime = trace.timestamp;
        return traceTime >= startTime && traceTime <= endTime;
      });
    } catch (error) {
      console.error('Error retrieving traces by time range:', error);
      throw error;
    }
  }

  /**
   * Get method statistics
   */
  async getMethodStatistics() {
    try {
      // Use simple query with just ordering - no sessionId filter
      const q = query(
        collection(db, this.collection),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      const querySnapshot = await getDocs(q);
      const traces = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        traces.push({
          id: doc.id,
          ...data,
          timestamp: this.convertTimestamp(data.timestamp)
        });
      });

      const stats = {
        totalRequests: 0,
        byMethod: {},
        byStatus: {},
        responseTimeStats: {
          total: 0,
          average: 0,
          min: Infinity,
          max: 0
        }
      };

      const completedRequests = traces.filter(trace => 
        trace.type === 'REQUEST_COMPLETE' &&
        trace.type !== 'CONNECTION_TEST' &&
        !(trace.message && trace.message.includes('Testing Firebase connection'))
      );
      stats.totalRequests = completedRequests.length;

      completedRequests.forEach(trace => {
        const method = trace.method || 'UNKNOWN';
        const status = trace.status || 'UNKNOWN';
        const responseTime = trace.responseTime || 0;

        // Count by method
        if (!stats.byMethod[method]) {
          stats.byMethod[method] = { count: 0, totalTime: 0, avgTime: 0 };
        }
        stats.byMethod[method].count++;
        stats.byMethod[method].totalTime += responseTime;
        stats.byMethod[method].avgTime = Math.round(stats.byMethod[method].totalTime / stats.byMethod[method].count);

        // Count by status
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        // Response time statistics
        if (responseTime > 0) {
          stats.responseTimeStats.total += responseTime;
          stats.responseTimeStats.min = Math.min(stats.responseTimeStats.min, responseTime);
          stats.responseTimeStats.max = Math.max(stats.responseTimeStats.max, responseTime);
        }
      });

      // Calculate average response time
      if (stats.totalRequests > 0) {
        stats.responseTimeStats.average = Math.round(stats.responseTimeStats.total / stats.totalRequests);
      }

      // Fix infinite min value
      if (stats.responseTimeStats.min === Infinity) {
        stats.responseTimeStats.min = 0;
      }

      return stats;
    } catch (error) {
      console.error('Error getting method statistics:', error);
      throw error;
    }
  }

  /**
   * Get request analytics
   */
  async getRequestAnalytics() {
    try {
      // Use simple query with just ordering - no sessionId filter
      const q = query(
        collection(db, this.collection),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      const querySnapshot = await getDocs(q);
      const traces = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        traces.push({
          id: doc.id,
          ...data,
          timestamp: this.convertTimestamp(data.timestamp)
        });
      });
      
      const requests = {};
      const analytics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        requestsByStatus: {},
        requestsByType: {},
        timeline: []
      };

      // Process traces safely, excluding CONNECTION_TEST traces
      traces.forEach(trace => {
        try {
          // Skip CONNECTION_TEST traces
          if (trace.type === 'CONNECTION_TEST' || 
              (trace.message && trace.message.includes('Testing Firebase connection'))) {
            return;
          }
          
          const { requestId, type, status, responseTime } = trace;

          // Group by request ID
          if (requestId) {
            if (!requests[requestId]) {
              requests[requestId] = { start: null, complete: null };
            }
            
            if (type === 'REQUEST_START') {
              requests[requestId].start = trace;
            } else if (type === 'REQUEST_COMPLETE') {
              requests[requestId].complete = trace;
            }
          }

          // Count by status
          if (status) {
            analytics.requestsByStatus[status] = (analytics.requestsByStatus[status] || 0) + 1;
          }
          
          // Count by type
          if (type) {
            analytics.requestsByType[type] = (analytics.requestsByType[type] || 0) + 1;
          }
        } catch (traceError) {
          console.warn('Error processing trace:', traceError);
        }
      });

      // Calculate analytics for completed requests
      const completedRequests = Object.values(requests).filter(req => req.start && req.complete);
      
      analytics.totalRequests = completedRequests.length;
      analytics.successfulRequests = completedRequests.filter(req => req.complete.status === 'SUCCESS').length;
      analytics.failedRequests = completedRequests.filter(req => req.complete.status === 'ERROR').length;
      
      if (completedRequests.length > 0) {
        const totalResponseTime = completedRequests.reduce((sum, req) => {
          const responseTime = req.complete.responseTime || 0;
          return sum + responseTime;
        }, 0);
        analytics.averageResponseTime = Math.round(totalResponseTime / completedRequests.length);
      }

      // Create timeline (limit to avoid performance issues)
      analytics.timeline = traces
        .slice(0, 50) // Limit timeline entries
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map(trace => ({
          time: trace.timestamp,
          type: trace.type || 'UNKNOWN',
          status: trace.status || 'UNKNOWN',
          message: this.formatTraceMessage(trace)
        }));

      return analytics;
    } catch (error) {
      console.error('Error getting request analytics:', error);
      // Return default analytics instead of throwing
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        requestsByStatus: {},
        requestsByType: {},
        timeline: []
      };
    }
  }

  /**
   * Format trace message for display
   */
  formatTraceMessage(trace) {
    switch (trace.type) {
      case 'REQUEST_START':
        return `${trace.method} ${trace.url} - Request started`;
      case 'REQUEST_COMPLETE':
        return `Request completed - ${trace.status} (${trace.responseTime}ms)`;
      default:
        return trace.message || `${trace.type} event`;
    }
  }

  /**
   * Clear traces older than specified days
   * @param {number} days - Number of days to keep
   */
  async clearOldTraces(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const q = query(
        collection(db, this.collection),
        where('timestamp', '<', Timestamp.fromDate(cutoffDate))
      );

      const querySnapshot = await getDocs(q);
      const batch = [];
      
      querySnapshot.forEach((doc) => {
        batch.push(doc.ref);
      });

      // Note: You'd need to implement batch delete using Firebase Admin SDK
      // This is a placeholder for the cleanup logic
      console.log(`Found ${batch.length} traces to delete older than ${days} days`);
      
      return batch.length;
    } catch (error) {
      console.error('Error clearing old traces:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const traceService = new FirebaseTraceService();
export default FirebaseTraceService;
