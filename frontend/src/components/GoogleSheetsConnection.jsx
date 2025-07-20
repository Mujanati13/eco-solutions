import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Alert,
  Space,
  Typography,
  Divider,
  Tag,
  Avatar,
  message,
  Spin,
  Modal
} from 'antd';
import {
  GoogleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DisconnectOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import googleAuthService from '../services/googleAuthService';

const { Title, Text, Paragraph } = Typography;

const GoogleSheetsConnection = () => {
  const [authStatus, setAuthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionTest, setConnectionTest] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const status = await googleAuthService.getAuthStatus();
      setAuthStatus(status);
      
      // If authenticated, test the connection
      if (status.isAuthenticated) {
        await testConnection();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      message.error('Failed to check Google authentication status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      
      // Open authentication popup
      const result = await googleAuthService.openAuthPopup();
      
      if (result.isAuthenticated) {
        setAuthStatus(result);
        message.success('Google Sheets connected successfully!');
        
        // Test the connection
        await testConnection();
      }
    } catch (error) {
      console.error('Authentication error:', error);
      message.error('Failed to connect to Google Sheets');
    } finally {
      setConnecting(false);
    }
  };

  const handleReconnect = async () => {
    try {
      setConnecting(true);
      
      // Force re-authentication to get new permissions
      message.info('Re-authenticating to get updated permissions...');
      const result = await googleAuthService.openAuthPopup();
      
      if (result.isAuthenticated) {
        setAuthStatus(result);
        message.success('Google Sheets reconnected with updated permissions!');
        
        // Test the connection
        await testConnection();
      }
    } catch (error) {
      console.error('Re-authentication error:', error);
      message.error('Failed to reconnect to Google Sheets');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Modal.confirm({
      title: 'Disconnect Google Sheets',
      content: 'Are you sure you want to disconnect from Google Sheets? You will need to re-authenticate to sync orders.',
      icon: <ExclamationCircleOutlined />,
      okText: 'Disconnect',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await googleAuthService.revokeAuth();
          setAuthStatus({ isAuthenticated: false, profile: null });
          setConnectionTest(null);
          message.success('Google Sheets disconnected successfully');
        } catch (error) {
          console.error('Error disconnecting:', error);
          message.error('Failed to disconnect from Google Sheets');
        }
      }
    });
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      const result = await googleAuthService.testConnection();
      setConnectionTest({ success: true, data: result });
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionTest({ 
        success: false, 
        error: error.response?.data?.error || 'Connection test failed' 
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text>Loading Google Sheets connection status...</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title={
      <Space>
        <GoogleOutlined style={{ color: '#4285f4' }} />
        <span>Google Sheets Integration</span>
      </Space>
    }>
      {!authStatus?.isAuthenticated ? (
        <div>
          <Alert
            message="Google Sheets Not Connected"
            description="Connect your Google account to sync orders with Google Sheets automatically."
            type="warning"
            showIcon
            style={{ marginBottom: '24px' }}
          />
          
          <Paragraph>
            <strong>What you can do after connecting:</strong>
          </Paragraph>
          <ul>
            <li>Automatically sync all orders to Google Sheets</li>
            <li>Import orders from Google Sheets</li>
            <li>Real-time synchronization when orders are updated</li>
            <li>Access your data from anywhere with Google Sheets</li>
          </ul>
          
          <Divider />
          
          <Space>
            <Button
              type="primary"
              icon={<GoogleOutlined />}
              size="large"
              loading={connecting}
              onClick={handleConnect}
            >
              {connecting ? 'Connecting...' : 'Connect Google Sheets'}
            </Button>
            
            <Button
              icon={<ReloadOutlined />}
              onClick={checkAuthStatus}
              disabled={connecting}
            >
              Refresh Status
            </Button>
          </Space>
        </div>
      ) : (
        <div>
          <Alert
            message="Google Sheets Connected"
            description="Your account is successfully connected to Google Sheets."
            type="success"
            showIcon
            style={{ marginBottom: '16px' }}
          />
          
          {authStatus.profile && (
            <div style={{ marginBottom: '24px' }}>
              <Title level={5}>Connected Account</Title>
              <Space>
                <Avatar src={authStatus.profile.picture} />
                <div>
                  <div><strong>{authStatus.profile.name}</strong></div>
                  <Text type="secondary">{authStatus.profile.email}</Text>
                </div>
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  Connected
                </Tag>
              </Space>
            </div>
          )}
          
          <Divider />
          
          <Space>
            <Button
              type="primary"
              icon={<GoogleOutlined />}
              loading={connecting}
              onClick={handleReconnect}
            >
              {connecting ? 'Reconnecting...' : 'Reconnect for Enhanced Access'}
            </Button>
            
            <Button
              icon={<ReloadOutlined />}
              onClick={checkAuthStatus}
            >
              Refresh Status
            </Button>
            
            <Button
              danger
              icon={<DisconnectOutlined />}
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </Space>
        </div>
      )}
    </Card>
  );
};

export default GoogleSheetsConnection;
