const RolePermissionService = require('../services/rolePermissionService');

// Check if user has a specific permission
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasPermission = await RolePermissionService.userHasPermission(req.user.id, permission);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Permission denied',
          required_permission: permission 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Check if user has any of the specified permissions
const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      for (const permission of permissions) {
        const hasPermission = await RolePermissionService.userHasPermission(req.user.id, permission);
        if (hasPermission) {
          return next();
        }
      }

      return res.status(403).json({ 
        error: 'Permission denied',
        required_permissions: permissions 
      });
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Check if user has all of the specified permissions
const requireAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      for (const permission of permissions) {
        const hasPermission = await RolePermissionService.userHasPermission(req.user.id, permission);
        if (!hasPermission) {
          return res.status(403).json({ 
            error: 'Permission denied',
            missing_permission: permission 
          });
        }
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Check if user has a specific role
const requireRole = (role) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRoles = await RolePermissionService.getUserRoles(req.user.id);
      
      if (!userRoles.includes(role)) {
        return res.status(403).json({ 
          error: 'Role access denied',
          required_role: role 
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Check if user has any of the specified roles
const requireAnyRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRoles = await RolePermissionService.getUserRoles(req.user.id);
      
      const hasRole = roles.some(role => userRoles.includes(role));
      
      if (!hasRole) {
        return res.status(403).json({ 
          error: 'Role access denied',
          required_roles: roles 
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Middleware to add user permissions to request object
const loadUserPermissions = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      req.user.roles = await RolePermissionService.getUserRoles(req.user.id);
      req.user.permissions = await RolePermissionService.getUserPermissions(req.user.id);
    }
    next();
  } catch (error) {
    console.error('Load user permissions error:', error);
    next(); // Continue without permissions
  }
};

// Helper function to check permission without middleware
const checkPermission = async (userId, permission) => {
  try {
    return await RolePermissionService.userHasPermission(userId, permission);
  } catch (error) {
    console.error('Check permission error:', error);
    return false;
  }
};

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  requireAnyRole,
  loadUserPermissions,
  checkPermission
};
