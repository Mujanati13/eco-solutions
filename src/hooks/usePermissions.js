import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';

export const usePermissions = () => {
  const [permissions, setPermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchUserPermissions = useCallback(async () => {
    console.log('🔐 fetchUserPermissions called', {
      timestamp: new Date().toISOString(),
      userId: user?.id,
      stack: new Error().stack
    });
    
    if (!user?.id) {
      console.log('❌ No user ID, skipping permissions fetch');
      setLoading(false);
      return;
    }

    try {
      // Get effective permissions for the current user
      const response = await userService.getUserEffectivePermissions(user.id);
      console.log('🔍 Permissions API Response:', response);
      
      // Handle the response properly - response is already the data from userService
      if (response && typeof response === 'object') {
        setPermissions(response.permissions || []);
        setRoles(response.roles || []);
        console.log('✅ Successfully loaded permissions:', response.permissions);
        console.log('✅ Successfully loaded roles:', response.roles);
      } else {
        throw new Error('API returned invalid response format');
      }
    } catch (error) {
      console.error('Failed to fetch user permissions:', error);
      console.log('🔄 Using fallback permission logic for user:', user);
      
      // Fallback to role-based permissions for backward compatibility
      const userRoles = user.roles || (user.role ? [user.role] : ['employee']);
      setRoles(userRoles);
      console.log('📋 User roles for fallback:', userRoles);
      
      // Set basic permissions based on role for fallback
      if (userRoles.includes('admin')) {
        const adminPerms = [
          'canViewAllOrders', 'canAssignOrders', 'canEditOrders', 'canDeleteOrders',
          'canDistributeOrders', 'canImportOrders', 'canExportOrders',
          'canViewUsers', 'canCreateUsers', 'canEditUsers', 'canDeleteUsers', 'canManageRoles',
          'canViewReports', 'canExportReports', 'canViewPerformance', 'canManageSettings'
        ];
        setPermissions(adminPerms);
        console.log('🔧 Fallback: Set admin permissions:', adminPerms);
      } else if (userRoles.includes('supervisor')) {
        const supervisorPerms = [
          'canViewAllOrders', 'canAssignOrders', 'canEditOrders', 'canDistributeOrders',
          'canImportOrders', 'canExportOrders', 'canViewUsers',
          'canViewReports', 'canExportReports', 'canViewPerformance'
        ];
        setPermissions(supervisorPerms);
        console.log('🔧 Fallback: Set supervisor permissions:', supervisorPerms);
      } else if (userRoles.includes('employee')) {
        const employeePerms = ['canEditOrders', 'canExportOrders'];
        setPermissions(employeePerms);
        console.log('🔧 Fallback: Set employee permissions:', employeePerms);
      } else if (userRoles.includes('custom')) {
        // Custom role gets NO default permissions - must be explicitly assigned
        setPermissions([]);
        console.log('🔧 Fallback: Custom role gets no permissions');
      } else {
        // Unknown roles get minimal permissions
        const minimalPerms = ['canEditOrders'];
        setPermissions(minimalPerms);
        console.log('🔧 Fallback: Set minimal permissions for unknown role:', minimalPerms);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id])

  useEffect(() => {
    console.log('🔐 usePermissions useEffect triggered', {
      timestamp: new Date().toISOString(),
      userId: user?.id,
      stack: new Error().stack
    });
    
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  const hasPermission = useCallback((permission) => {
    return permissions.includes(permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((permissionList) => {
    return permissionList.some(permission => permissions.includes(permission));
  }, [permissions]);

  const hasAllPermissions = useCallback((permissionList) => {
    return permissionList.every(permission => permissions.includes(permission));
  }, [permissions]);

  const hasRole = (role) => {
    return roles.includes(role);
  };

  const hasAnyRole = (roleList) => {
    return roleList.some(role => roles.includes(role));
  };

  const isAdmin = () => {
    return hasRole('admin');
  };

  const isSupervisor = () => {
    return hasRole('supervisor') || hasRole('admin');
  };

  const isEmployee = () => {
    return hasRole('employee');
  };

  return {
    permissions,
    roles,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isAdmin,
    isSupervisor,
    isEmployee,
  };
};
