const ActivityService = require('../services/activityService');
const SessionService = require('../services/sessionService');

// Middleware to automatically log page views
const logPageView = (pageName) => {
  return async (req, res, next) => {
    try {
      if (req.user) {
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        // Get current session
        const session = await SessionService.getActiveSession(token);
        
        await ActivityService.logPageView(
          req.user.id, 
          session?.id || null, 
          pageName, 
          ipAddress, 
          userAgent
        );
      }
    } catch (error) {
      console.error('Error logging page view:', error);
      // Don't block the request if logging fails
    }
    next();
  };
};

// Middleware to log API activities
const logActivity = (activityType, getDescription, getMetadata) => {
  return async (req, res, next) => {
    try {
      if (req.user) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        const session = await SessionService.getActiveSession(token);
        
        await ActivityService.logActivity({
          userId: req.user.id,
          sessionId: session?.id || null,
          activityType,
          description: typeof getDescription === 'function' ? getDescription(req) : getDescription,
          metadata: typeof getMetadata === 'function' ? getMetadata(req) : getMetadata,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        });
      }
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't block the request if logging fails
    }
    next();
  };
};

// Middleware to log order activities
const logOrderActivity = (action) => {
  return async (req, res, next) => {
    // Store original res.json to capture response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log activity after successful response
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        setImmediate(async () => {
          try {
            console.log(`🔍 Logging order activity: ${action} for user ${req.user.username || req.user.id}`);
            
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            const session = await SessionService.getActiveSession(token);
            
            let orderId = req.params.id || req.body.id || data?.order?.id || data?.id;
            let orderNumber = req.body.order_number || data?.order?.order_number || data?.order_number;
            
            // Ensure orderId is always an integer
            if (orderId) {
              orderId = parseInt(orderId) || 0;
            } else {
              orderId = 0;
            }
            
            // For create action, get order details
            let actionDetails = req.body;
            if (action === 'create' && data?.order) {
              orderId = data.order.id;
              orderNumber = data.order.order_number;
              actionDetails = {
                customer_name: data.order.customer_name || req.body.customer_name,
                customer_phone: data.order.customer_phone || req.body.customer_phone,
                customer_city: data.order.customer_city || req.body.customer_city,
                total_amount: data.order.total_amount || req.body.total_amount,
                created_by: req.user.username || `${req.user.first_name} ${req.user.last_name}`.trim()
              };
              console.log(`📦 Order created: ID=${orderId}, Number=${orderNumber}`);
            }
            
            // For import action, log individual order creations
            if (action === 'import' && data) {
              const importedCount = data.imported || 0;
              console.log(`📥 Orders imported: ${importedCount} orders by ${req.user.username}`);
              
              // Log each imported order as a separate order_create activity
              for (let i = 0; i < importedCount; i++) {
                try {
                  await ActivityService.logOrderAction(
                    req.user.id,
                    session?.id || null,
                    'create', // Log as 'create' instead of 'import'
                    0, // Use 0 as placeholder for imported orders
                    {
                      order_number: `Imported order ${i + 1}/${importedCount}`,
                      action_details: {
                        import_batch: true,
                        batch_total: importedCount,
                        order_index: i + 1,
                        created_by: req.user.username || `${req.user.first_name} ${req.user.last_name}`.trim(),
                        imported_by: req.user.username || `${req.user.first_name} ${req.user.last_name}`.trim()
                      },
                      endpoint: req.originalUrl,
                      user_name: req.user.username || `${req.user.first_name} ${req.user.last_name}`.trim()
                    }
                  );
                } catch (logError) {
                  console.error(`❌ Error logging imported order ${i + 1}:`, logError);
                }
              }
              
              // Also log one summary activity for the import action
              orderId = 0;
              orderNumber = `${importedCount} orders imported`;
              actionDetails = {
                imported_count: importedCount,
                total_rows: data.total_rows,
                warnings_count: data.warnings?.length || 0,
                errors_count: data.errors?.length || 0,
                imported_by: req.user.username || `${req.user.first_name} ${req.user.last_name}`.trim()
              };
              
              // Change action to 'import' for the summary log
              action = 'import';
            }
            
            // For assign action, include target user info
            if (action === 'assign' && req.body.assigned_to) {
              actionDetails = {
                ...actionDetails,
                assigned_to_user_id: req.body.assigned_to,
                order_id: orderId,
                assigned_by: req.user.username || `${req.user.first_name} ${req.user.last_name}`.trim()
              };
              console.log(`👤 Order assigned: Order ${orderId} assigned to user ${req.body.assigned_to} by ${req.user.username}`);
            }
            
            const activityResult = await ActivityService.logOrderAction(
              req.user.id,
              session?.id || null,
              action,
              orderId, // orderId is now guaranteed to be an integer
              {
                order_number: orderNumber,
                action_details: actionDetails,
                endpoint: req.originalUrl,
                user_name: req.user.username || `${req.user.first_name} ${req.user.last_name}`.trim()
              }
            );
            
            console.log(`✅ Activity logged: ${action} - Activity ID: ${activityResult}`);
          } catch (error) {
            console.error('❌ Error logging order activity:', error);
          }
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Middleware to log export activities
const logExport = (exportType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log export after successful response
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        setImmediate(async () => {
          try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            const session = await SessionService.getActiveSession(token);
            
            await ActivityService.logExport(
              req.user.id,
              session?.id || null,
              exportType,
              {
                filters: req.query,
                endpoint: req.originalUrl,
                user_name: req.user.username || `${req.user.first_name} ${req.user.last_name}`.trim(),
                exported_by: req.user.username || `${req.user.first_name} ${req.user.last_name}`.trim()
              }
            );
          } catch (error) {
            console.error('Error logging export activity:', error);
          }
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  logPageView,
  logActivity,
  logOrderActivity,
  logExport
};
