import axios from 'axios';
import { traceService } from './FirebaseTraceService';
import { v4 as uuidv4 } from 'uuid';

class HTTPInterceptor {
  constructor() {
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
    this.activeRequests = new Map(); // Track active requests
  }

  setupRequestInterceptor() {
    axios.interceptors.request.use(
      async (config) => {
        const requestId = uuidv4();
        const startTime = Date.now();
        const timestamp = new Date().toISOString();
        
        // Store request metadata for response interceptor
        config.metadata = {
          requestId,
          startTime,
          timestamp,
          url: this.buildFullUrl(config),
          method: config.method?.toUpperCase() || 'GET'
        };

        // Store active request
        this.activeRequests.set(requestId, {
          ...config.metadata,
          status: 'PENDING',
          config: config
        });

        // Enhanced logging for POST and GET methods
        const requestDetails = {
          method: config.metadata.method,
          url: config.metadata.url,
          headers: this.sanitizeHeaders(config.headers),
          body: config.metadata.method === 'POST' ? this.sanitizeRequestBody(config.data) : null,
          environment: this.detectEnvironment(config.metadata.url),
          timestamp: timestamp,
          userAgent: navigator.userAgent,
          requestSize: config.data ? this.calculateRequestSize(config.data) : 0
        };

        // Log request start to Firebase
        try {
          await traceService.logRequestStart(requestId, requestDetails);
          console.log(`🚀 [${config.metadata.method}] Request started:`, {
            id: requestId,
            url: config.metadata.url,
            time: timestamp
          });
        } catch (error) {
          console.warn('Failed to log request start:', error);
        }

        return config;
      },
      async (error) => {
        // Log request error
        try {
          await traceService.logEvent('REQUEST_SETUP_ERROR', {
            message: 'Request interceptor error',
            error: error.message,
            timestamp: new Date().toISOString(),
            data: { config: error.config }
          });
        } catch (logError) {
          console.warn('Failed to log request error:', logError);
        }
        
        return Promise.reject(error);
      }
    );
  }

  setupResponseInterceptor() {
    axios.interceptors.response.use(
      async (response) => {
        const { metadata } = response.config;
        if (!metadata) return response;

        const endTime = Date.now();
        const responseTime = endTime - metadata.startTime;
        const responseSize = this.calculateResponseSize(response);
        const timestamp = new Date().toISOString();

        // Enhanced response logging
        const responseDetails = {
          success: true,
          statusCode: response.status,
          statusText: response.statusText,
          responseTime,
          responseSize,
          headers: this.sanitizeHeaders(response.headers),
          body: this.sanitizeResponseBody(response.data),
          url: metadata.url,
          method: metadata.method,
          timestamp: timestamp,
          requestId: metadata.requestId
        };

        // Update active request
        if (this.activeRequests.has(metadata.requestId)) {
          this.activeRequests.set(metadata.requestId, {
            ...this.activeRequests.get(metadata.requestId),
            status: 'SUCCESS',
            responseTime,
            endTime,
            response: responseDetails
          });
        }

        // Log successful response to Firebase
        try {
          await traceService.logRequestComplete(metadata.requestId, responseDetails);
          console.log(`✅ [${metadata.method}] Request completed:`, {
            id: metadata.requestId,
            url: metadata.url,
            status: response.status,
            time: responseTime + 'ms',
            timestamp: timestamp
          });
        } catch (error) {
          console.warn('Failed to log response:', error);
        }

        return response;
      },
      async (error) => {
        const config = error.config;
        const metadata = config?.metadata;
        
        if (metadata) {
          const endTime = Date.now();
          const responseTime = endTime - metadata.startTime;
          const timestamp = new Date().toISOString();
          
          // Enhanced error logging
          const errorDetails = {
            success: false,
            statusCode: error.response?.status || 0,
            statusText: error.response?.statusText || 'Network Error',
            responseTime,
            responseSize: this.calculateResponseSize(error.response),
            headers: this.sanitizeHeaders(error.response?.headers),
            body: this.sanitizeResponseBody(error.response?.data),
            error: {
              message: error.message,
              code: error.code,
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            url: metadata.url,
            method: metadata.method,
            timestamp: timestamp,
            requestId: metadata.requestId
          };

          // Update active request
          if (this.activeRequests.has(metadata.requestId)) {
            this.activeRequests.set(metadata.requestId, {
              ...this.activeRequests.get(metadata.requestId),
              status: 'ERROR',
              responseTime,
              endTime,
              error: errorDetails
            });
          }

          // Log error response to Firebase
          try {
            await traceService.logRequestComplete(metadata.requestId, errorDetails);
            console.log(`❌ [${metadata.method}] Request failed:`, {
              id: metadata.requestId,
              url: metadata.url,
              status: error.response?.status || 0,
              error: error.message,
              time: responseTime + 'ms',
              timestamp: timestamp
            });
          } catch (logError) {
            console.warn('Failed to log error response:', logError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  buildFullUrl(config) {
    const baseURL = config.baseURL || '';
    const url = config.url || '';
    
    if (url.startsWith('http')) {
      return url;
    }
    
    return baseURL + url;
  }

  detectEnvironment(url) {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return 'local';
    } else if (url.includes('staging') || url.includes('dev')) {
      return 'staging';
    } else if (url.includes('test')) {
      return 'test';
    } else {
      return 'production';
    }
  }

  sanitizeHeaders(headers) {
    if (!headers) return {};
    
    const sanitized = {};
    
    // Handle different header object types (AxiosHeaders, plain objects, etc.)
    const headerEntries = typeof headers.entries === 'function' 
      ? Array.from(headers.entries()) 
      : Object.entries(headers);
    
    // Only include headers that have defined values
    headerEntries.forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        try {
          // Ensure the value is a string and valid
          const stringValue = String(value).trim();
          if (stringValue) {
            sanitized[key] = stringValue;
          }
        } catch (error) {
          console.warn(`Failed to sanitize header ${key}:`, error);
        }
      }
    });
    
    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
    sensitiveHeaders.forEach(header => {
      const lowerKey = Object.keys(sanitized).find(k => k.toLowerCase() === header);
      if (lowerKey) {
        sanitized[lowerKey] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  sanitizeRequestBody(data) {
    if (!data) return null;
    
    try {
      const serialized = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Limit body size for storage
      if (serialized.length > 10000) {
        return serialized.substring(0, 10000) + '... [TRUNCATED]';
      }
      
      return this.redactSensitiveData(serialized);
    } catch (error) {
      return '[SERIALIZATION_ERROR]';
    }
  }

  sanitizeResponseBody(data) {
    if (!data) return null;
    
    try {
      const serialized = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Limit response body size for storage
      if (serialized.length > 50000) {
        return serialized.substring(0, 50000) + '... [TRUNCATED]';
      }
      
      return this.redactSensitiveData(serialized);
    } catch (error) {
      return '[SERIALIZATION_ERROR]';
    }
  }

  redactSensitiveData(data) {
    if (typeof data !== 'string') return data;
    
    // Redact common sensitive patterns
    const patterns = [
      { regex: /"password"\s*:\s*"[^"]*"/gi, replacement: '"password":"[REDACTED]"' },
      { regex: /"token"\s*:\s*"[^"]*"/gi, replacement: '"token":"[REDACTED]"' },
      { regex: /"apiKey"\s*:\s*"[^"]*"/gi, replacement: '"apiKey":"[REDACTED]"' },
      { regex: /"secret"\s*:\s*"[^"]*"/gi, replacement: '"secret":"[REDACTED]"' },
      { regex: /"email"\s*:\s*"[^@]*@[^"]*"/gi, replacement: '"email":"[REDACTED]"' }
    ];
    
    let sanitized = data;
    patterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern.regex, pattern.replacement);
    });
    
    return sanitized;
  }

  calculateResponseSize(response) {
    if (!response?.data) return 0;
    
    try {
      return new Blob([JSON.stringify(response.data)]).size;
    } catch (error) {
      return 0;
    }
  }

  calculateRequestSize(data) {
    if (!data) return 0;
    
    try {
      return new Blob([typeof data === 'string' ? data : JSON.stringify(data)]).size;
    } catch (error) {
      return 0;
    }
  }

  // Method to get all active requests
  getActiveRequests() {
    return Array.from(this.activeRequests.values());
  }

  // Method to get requests by method type
  getRequestsByMethod(method) {
    return Array.from(this.activeRequests.values()).filter(req => req.method === method.toUpperCase());
  }

  // Method to get request statistics
  getRequestStats() {
    const requests = Array.from(this.activeRequests.values());
    const stats = {
      total: requests.length,
      byMethod: {},
      byStatus: {},
      averageResponseTime: 0,
      totalResponseTime: 0
    };

    requests.forEach(req => {
      // Count by method
      stats.byMethod[req.method] = (stats.byMethod[req.method] || 0) + 1;
      
      // Count by status
      stats.byStatus[req.status] = (stats.byStatus[req.status] || 0) + 1;
      
      // Calculate response times
      if (req.responseTime) {
        stats.totalResponseTime += req.responseTime;
      }
    });

    // Calculate average response time
    const completedRequests = requests.filter(req => req.responseTime);
    if (completedRequests.length > 0) {
      stats.averageResponseTime = Math.round(stats.totalResponseTime / completedRequests.length);
    }

    return stats;
  }

  // Method to clear completed requests (keep only recent ones)
  cleanupRequests(maxAge = 5 * 60 * 1000) { // 5 minutes default
    const cutoff = Date.now() - maxAge;
    const toRemove = [];
    
    this.activeRequests.forEach((req, id) => {
      if (req.startTime < cutoff && req.status !== 'PENDING') {
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => this.activeRequests.delete(id));
    return toRemove.length;
  }

  // Method to manually log custom events
  async logCustomEvent(eventType, message, data = {}) {
    try {
      await traceService.logEvent(eventType, {
        message,
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn('Failed to log custom event:', error);
    }
  }

  // Method to get current session traces
  async getSessionTraces() {
    try {
      return await traceService.getCurrentSessionTraces();
    } catch (error) {
      console.error('Failed to get session traces:', error);
      return [];
    }
  }

  // Method to get request analytics
  async getAnalytics() {
    try {
      return await traceService.getRequestAnalytics();
    } catch (error) {
      console.error('Failed to get analytics:', error);
      return null;
    }
  }
}

// Create singleton instance
export const httpInterceptor = new HTTPInterceptor();
export default HTTPInterceptor;
