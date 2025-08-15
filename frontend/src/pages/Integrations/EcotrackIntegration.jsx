import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Form,
  Input,
  message,
  Typography,
  Divider,
  Alert,
  Space,
  Switch,
  Tooltip,
  Tabs,
} from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  ApiOutlined,
  KeyOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ShopOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ecotrackService } from '../../services/ecotrackService';
import { configService } from '../../services/configService';
import EcotrackMultiAccount from './EcotrackMultiAccount';
import './EcotrackIntegration.css';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const EcotrackIntegration = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [configSaved, setConfigSaved] = useState(false);
  const [config, setConfig] = useState({
    apiToken: '',
    userGuid: '',
    isEnabled: false
  });

  // Load existing configuration on component mount
  useEffect(() => {
    loadConfiguration();
    
    // Add debug function to window for testing
    window.testEcotrackGuidLength = async (testGuid) => {
      try {
        console.log(`🧪 Testing GUID: "${testGuid}" (${testGuid.length} characters)`);
        
        // Save the test GUID
        const saveResponse = await fetch('/api/ecotrack/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            apiToken: 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG',
            userGuid: testGuid,
            isEnabled: true
          })
        });

        if (saveResponse.ok) {
          const saveResult = await saveResponse.json();
          console.log('✅ Save successful');

          // Check what was actually stored
          const checkResponse = await fetch('/api/ecotrack/credentials', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (checkResponse.ok) {
            const checkResult = await checkResponse.json();
            const storedGuid = checkResult.userGuid;
            
            console.log('📊 Results:');
            console.log(`   Input: "${testGuid}" (${testGuid.length} chars)`);
            console.log(`   Stored: "${storedGuid}" (${storedGuid.length} chars)`);
            console.log(`   Truncated: ${testGuid !== storedGuid ? 'YES ❌' : 'NO ✅'}`);
            
            if (testGuid !== storedGuid) {
              console.log(`   Lost: "${testGuid.slice(storedGuid.length)}"`);
            }
            
            return { input: testGuid, stored: storedGuid, truncated: testGuid !== storedGuid };
          }
        } else {
          console.log('❌ Save failed:', saveResponse.status);
        }
      } catch (error) {
        console.error('❌ Test failed:', error);
      }
    };
    
    // Add credential debugging functions
    window.debugEcotrackCredentials = async () => {
      console.log('� DEBUGGING ECOTRACK CREDENTIALS');
      console.log('=' .repeat(50));
      
      try {
        console.log('\n1️⃣ Current cached credentials:');
        const currentCache = configService.credentialsCache;
        const cacheAge = configService.cacheTimestamp ? Date.now() - configService.cacheTimestamp : null;
        console.log('   Cached:', !!currentCache);
        console.log('   Cache age:', cacheAge ? Math.round(cacheAge / 1000) + 's' : 'N/A');
        if (currentCache) {
          console.log('   API Token:', currentCache.apiToken ? '***' + currentCache.apiToken.slice(-4) : 'Not set');
          console.log('   User GUID:', currentCache.userGuid || 'Not set');
        }
        
        console.log('\n2️⃣ Fresh credentials from backend:');
        const freshCreds = await configService.forceRefreshCredentials();
        console.log('   API Token:', freshCreds.apiToken ? '***' + freshCreds.apiToken.slice(-4) : 'Not set');
        console.log('   User GUID:', freshCreds.userGuid || 'Not set');
        
        console.log('\n3️⃣ Test credentials retrieval:');
        const testCreds = await configService.getEcotrackCredentials();
        console.log('   API Token:', testCreds.apiToken ? '***' + testCreds.apiToken.slice(-4) : 'Not set');
        console.log('   User GUID:', testCreds.userGuid || 'Not set');
        
        return { fresh: freshCreds, test: testCreds };
      } catch (error) {
        console.error('❌ Debug failed:', error);
      }
    };
    
    console.log('�🛠️ Debug functions available:');
    console.log('   window.testEcotrackGuidLength("2QG0JDFPf")');
    console.log('   window.debugEcotrackCredentials()');
  }, []);

  // Load configuration from backend
  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ecotrack/config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfig({
          apiToken: data.fullApiToken || data.apiToken || '',
          userGuid: data.fullUserGuid || data.userGuid || '',
          isEnabled: data.isEnabled || false
        });
        
        form.setFieldsValue({
          apiToken: data.fullApiToken || data.apiToken || '',
          userGuid: data.fullUserGuid || data.userGuid || '',
          isEnabled: data.isEnabled || false
        });
        
        if ((data.fullApiToken || data.apiToken) && (data.fullUserGuid || data.userGuid)) {
          setConfigSaved(true);
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save configuration
  const handleSaveConfiguration = async (values) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/ecotrack/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          apiToken: values.apiToken,
          userGuid: values.userGuid,
          isEnabled: values.isEnabled || false
        })
      });

      if (response.ok) {
        setConfig({
          apiToken: values.apiToken,
          userGuid: values.userGuid,
          isEnabled: values.isEnabled || false
        });
        setConfigSaved(true);
        setConnectionStatus(null); // Reset connection status when config changes
        
        // Clear the credentials cache so next API calls get fresh credentials
        configService.refreshCredentials();
        
        message.success(t('ecotrack.configSaved'));
      } else {
        const error = await response.json();
        message.error(t('ecotrack.configSaveError') + ': ' + (error.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      message.error(t('ecotrack.configSaveError') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setConnectionStatus(null);
      
      const formValues = form.getFieldsValue();
      
      if (!formValues.apiToken || !formValues.userGuid) {
        message.error(t('ecotrack.testRequiredFields'));
        return;
      }

      const response = await fetch('/api/ecotrack/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          apiToken: formValues.apiToken,
          userGuid: formValues.userGuid
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setConnectionStatus({
          success: true,
          message: result.message || t('ecotrack.connectionSuccess')
        });
        message.success(t('ecotrack.connectionSuccess'));
      } else {
        setConnectionStatus({
          success: false,
          message: result.message || t('ecotrack.connectionError')
        });
        message.error(t('ecotrack.connectionError') + ': ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus({
        success: false,
        message: error.message
      });
      message.error(t('ecotrack.connectionError') + ': ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="ecotrack-integration">
      <Tabs defaultActiveKey="single" type="card" size="large">
        <TabPane 
          tab={
            <Space>
              <GlobalOutlined />
              Single Account (Legacy)
            </Space>
          } 
          key="single"
        >
          <Row gutter={[24, 24]}>
            <Col span={24}>
              <Card 
                title={
                  <Space>
                    <SettingOutlined />
                    {t('ecotrack.configuration')}
                  </Space>
                }
                extra={
                  <Space>
                    {configSaved && (
                      <Text type="success">
                        <CheckCircleOutlined /> {t('ecotrack.configurationSaved')}
                      </Text>
                    )}
                  </Space>
                }
              >
                <Alert
                  message="Legacy Single Account Configuration"
                  description={
                    <div>
                      <p>This is the original single-account configuration. It's recommended to use the Multi-Account setup for better organization.</p>
                      <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                        <li><strong>API Token:</strong> {t('ecotrack.apiTokenDescription')}</li>
                        <li><strong>User GUID:</strong> {t('ecotrack.userGuidDescription')}</li>
                      </ul>
                      <p style={{ color: '#1890ff', fontWeight: 'bold' }}>💡 Switch to "Multi-Account" tab for location-based EcoTrack accounts!</p>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSaveConfiguration}
                  initialValues={{
                    isEnabled: false
                  }}
                >
                  <Row gutter={[16, 0]}>
                    <Col xs={24} lg={12}>
                      <Form.Item
                        label={
                          <Space>
                            <KeyOutlined />
                            {t('ecotrack.apiToken')}
                          </Space>
                        }
                        name="apiToken"
                        rules={[
                          { required: true, message: t('ecotrack.apiTokenRequired') },
                          { min: 10, message: t('ecotrack.apiTokenLength') }
                        ]}
                      >
                        <Input.Password 
                          placeholder={t('ecotrack.apiTokenPlaceholder')}
                          size="large"
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} lg={12}>
                      <Form.Item
                        label={
                          <Space>
                            <UserOutlined />
                            {t('ecotrack.userGuid')}
                            {config.userGuid && (
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                (Current: {config.userGuid} - {config.userGuid.length} chars)
                              </Text>
                            )}
                          </Space>
                        }
                        name="userGuid"
                        rules={[
                          { required: true, message: t('ecotrack.userGuidRequired') }
                        ]}
                      >
                        <Input 
                          placeholder="2QG0JDFPf"
                          size="large"
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value && value.length > 0) {
                              console.log(`GUID input: "${value}" (${value.length} characters)`);
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label={t('ecotrack.enableIntegration')}
                    name="isEnabled"
                    valuePropName="checked"
                  >
                    <Switch 
                      checkedChildren={t('common.enabled')}
                      unCheckedChildren={t('common.disabled')}
                    />
                  </Form.Item>

                  <Divider />

                  {/* Connection Status */}
                  {connectionStatus && (
                    <Alert
                      message={connectionStatus.success ? t('ecotrack.connectionSuccess') : t('ecotrack.connectionError')}
                      description={connectionStatus.message}
                      type={connectionStatus.success ? 'success' : 'error'}
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <Space size="large">
                    <Button 
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      icon={<SaveOutlined />}
                      size="large"
                    >
                      {t('ecotrack.saveConfiguration')}
                    </Button>

                  </Space>
                </Form>
              </Card>
            </Col>

            {/* Configuration Status Card */}
            <Col span={24}>
              <Card title={t('ecotrack.integrationStatus')} size="small">
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                        {config.apiToken ? (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        ) : (
                          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                        )}
                      </div>
                      <Text strong>{t('ecotrack.apiToken')}</Text>
                      <div>
                        <Text type={config.apiToken ? 'success' : 'secondary'}>
                          {config.apiToken ? t('ecotrack.configured') : t('ecotrack.notConfigured')}
                        </Text>
                      </div>
                    </div>
                  </Col>

                  <Col xs={24} sm={8}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                        {config.userGuid ? (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        ) : (
                          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                        )}
                      </div>
                      <Text strong>{t('ecotrack.userGuid')}</Text>
                      <div>
                        <Text type={config.userGuid ? 'success' : 'secondary'}>
                          {config.userGuid ? (
                            <>
                              {config.userGuid} ({config.userGuid.length} chars)
                            </>
                          ) : t('ecotrack.notConfigured')}
                        </Text>
                      </div>
                    </div>
                  </Col>

                  <Col xs={24} sm={8}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                        {config.isEnabled ? (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        ) : (
                          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                        )}
                      </div>
                      <Text strong>{t('ecotrack.integration')}</Text>
                      <div>
                        <Text type={config.isEnabled ? 'success' : 'secondary'}>
                          {config.isEnabled ? t('common.enabled') : t('common.disabled')}
                        </Text>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Debug/Testing Section - Development Only */}
            {process.env.NODE_ENV === 'development' && (
              <Col span={24}>
                <Card title="🛠️ Debug & Testing" size="small" style={{ border: '1px dashed #d9d9d9' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text type="secondary">
                      Test GUID length handling with different values:
                    </Text>
                    <Space wrap>
                      <Button 
                        size="small" 
                        onClick={() => window.testEcotrackGuidLength && window.testEcotrackGuidLength('2QG0JDFP')}
                      >
                        Test 8-char GUID
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => window.testEcotrackGuidLength && window.testEcotrackGuidLength('2QG0JDFPf')}
                      >
                        Test 9-char GUID
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => window.testEcotrackGuidLength && window.testEcotrackGuidLength('2QG0JDFPfull')}
                      >
                        Test 12-char GUID
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => {
                          console.log('🔄 Reloading configuration...');
                          loadConfiguration();
                        }}
                      >
                        Reload Config
                      </Button>
                    </Space>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Check browser console for detailed test results. These tests help identify where GUID truncation occurs.
                    </Text>
                  </Space>
                </Card>
              </Col>
            )}
          </Row>
        </TabPane>

        <TabPane 
          tab={
            <Space>
              <ShopOutlined />
              Multi-Account (Recommended)
            </Space>
          } 
          key="multi"
        >
          <EcotrackMultiAccount />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default EcotrackIntegration;
