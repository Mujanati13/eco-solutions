const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection, pool } = require('../config/database');
const Database = require('../config/initDatabase');
const trackingCronService = require('./services/trackingCronService');
const SessionCleanupService = require('./services/sessionCleanupService');
const sessionTimeoutService = require('./services/sessionTimeoutService');
const { trackSessionActivity } = require('./middleware/sessionTracker');
const socketService = require('./services/socketService');

// Import routes
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const dashboardSimpleRoutes = require('./routes/dashboard-simple');
const integrationRoutes = require('./routes/integrations');
const performanceRoutes = require('./routes/performance');
const adminRoutes = require('./routes/admin');
const sessionRoutes = require('./routes/sessions');
const stockRoutes = require('./routes/stock');
const categoriesRoutes = require('./routes/categories');
const variantsRoutes = require('./routes/variants');
const googleAuthRoutes = require('./routes/googleAuth');
const deliveryPricingRoutes = require('./routes/delivery-pricing');
const orderProductRoutes = require('./routes/orderProduct');
const ecotrackFeesRoutes = require('./routes/ecotrackFees');
const ecotrackRoutes = require('./routes/ecotrack');
const ecotrackMultiAccountRoutes = require('./routes/ecotrackMultiAccount');
const boutiquesRoutes = require('./routes/boutiques');
const autoImportRoutes = require('./routes/autoImport');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      process.env.FRONTEND_URL || 'https://eco-s.albech.me',
      process.env.CLIENT_URL || 'https://eco-s.albech.me'
    ]
  : [
      'http://localhost:3000',
      'https://eco-s.albech.me',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session activity tracking middleware (after body parsing, before routes)
app.use('/api', trackSessionActivity);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dashboard-simple', dashboardSimpleRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/variants', variantsRoutes);
app.use('/api/google', googleAuthRoutes);
app.use('/api/delivery-pricing', deliveryPricingRoutes);
app.use('/api/ecotrack-fees', ecotrackFeesRoutes);
app.use('/api/order-product', orderProductRoutes);
app.use('/api/auto-import', autoImportRoutes);
app.use('/api/ecotrack', ecotrackRoutes);
app.use('/api/ecotrack-multi-account', ecotrackMultiAccountRoutes);
app.use('/api/boutiques', boutiquesRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'validation') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details
    });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await testConnection();
    await Database.initializeSchema();
    await Database.updateOrdersSchema();
    await Database.updateEcotrackFields();
    await Database.createDefaultAdmin();
    
    // Initialize Socket.IO
    socketService.initialize(server);
    
    server.listen(PORT, async () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      console.log(`🔌 Socket.IO server running`);
      
      // Start tracking cron service
      trackingCronService.start();
      
      // Start session cleanup service
      SessionCleanupService.start();
      
      // Start session timeout service for automatic pause/resume
      sessionTimeoutService.start();
      
      // Initialize and start auto Google Sheets importer
      try {
        const AutoGoogleSheetsImporter = require('./services/autoGoogleSheetsImporter');
        const autoImporter = new AutoGoogleSheetsImporter();
        const initialized = await autoImporter.initialize();
        
        if (initialized) {
          // Start automatic scanning every 5 minutes by default
          autoImporter.startAutomaticScanning('*/5 * * * *');
          console.log('🤖 Auto Google Sheets importer started (every 5 minutes)');
        } else {
          console.log('⚠️  Auto Google Sheets importer not started - admin user not found or not authenticated');
        }
      } catch (error) {
        console.error('⚠️  Failed to start auto importer:', error.message);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n🔄 ${signal} received, shutting down gracefully...`);
  
  try {
    // End all active sessions before shutdown
    const [activeSessions] = await pool.query(`
      UPDATE user_sessions 
      SET logout_time = NOW(), 
          session_duration = TIMESTAMPDIFF(SECOND, login_time, NOW()),
          is_active = false
      WHERE is_active = true
    `);
    
    if (activeSessions.affectedRows > 0) {
      console.log(`🔒 Ended ${activeSessions.affectedRows} active sessions`);
    }
    
    // End all active real-time sessions
    const [activeRealTimeSessions] = await pool.query(`
      UPDATE real_time_sessions 
      SET end_time = NOW(),
          duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()),
          is_active = false
      WHERE is_active = true
    `);
    
    if (activeRealTimeSessions.affectedRows > 0) {
      console.log(`🔒 Ended ${activeRealTimeSessions.affectedRows} active real-time sessions`);
    }
    
    // Stop cleanup services
    SessionCleanupService.stop();
    trackingCronService.stop();
    sessionTimeoutService.stop();
    
    // Close database connections
    await pool.end();
    
    // Close server
    server.close(() => {
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.log('⚠️ Forcing shutdown...');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

module.exports = app;
