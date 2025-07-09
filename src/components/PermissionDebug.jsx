import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';
import { Card, Typography, List, Tag } from 'antd';

const { Title, Text } = Typography;

const PermissionDebug = () => {
  const { user } = useAuth();
  const { 
    permissions, 
    roles, 
    loading, 
    hasPermission,
    isAdmin,
    isSupervisor 
  } = usePermissions();

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <Card title="Permission Debug Info" style={{ margin: '20px' }}>
      <Title level={4}>User Info</Title>
      <Text>Username: {user?.username}</Text><br />
      <Text>User ID: {user?.id}</Text><br />
      <Text>Legacy Role: {user?.role}</Text><br />
      
      <Title level={4}>Current Roles</Title>
      {roles.length > 0 ? (
        roles.map(role => <Tag key={role} color="blue">{role}</Tag>)
      ) : (
        <Text type="secondary">No roles assigned</Text>
      )}
      
      <Title level={4}>Current Permissions</Title>
      {permissions.length > 0 ? (
        <List
          size="small"
          dataSource={permissions}
          renderItem={permission => (
            <List.Item>
              <Tag color="green">{permission}</Tag>
            </List.Item>
          )}
        />
      ) : (
        <Text type="secondary">No permissions assigned</Text>
      )}
      
      <Title level={4}>Permission Checks</Title>
      <Text>canViewReports: {hasPermission('canViewReports') ? '✅' : '❌'}</Text><br />
      <Text>canViewPerformance: {hasPermission('canViewPerformance') ? '✅' : '❌'}</Text><br />
      <Text>isAdmin(): {isAdmin() ? '✅' : '❌'}</Text><br />
      <Text>isSupervisor(): {isSupervisor() ? '✅' : '❌'}</Text><br />
    </Card>
  );
};

export default PermissionDebug;
