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
} from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  ApiOutlined,
  KeyOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ecotrackService } from '../../services/ecotrackService';
import './EcotrackIntegration.css';

const { Title, Text, Paragraph } = Typography;

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
          apiToken: data.apiToken || '',
          userGuid: data.userGuid || '',
          isEnabled: data.isEnabled || false
        });
        
        form.setFieldsValue({
          apiToken: data.apiToken || '',
          userGuid: data.userGuid || '',
          isEnabled: data.isEnabled || false
        });
        
        if (data.apiToken && data.userGuid) {
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
              message={t('ecotrack.configurationInfo')}
              description={
                <div>
                  <p>{t('ecotrack.configurationDescription')}</p>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li><strong>API Token:</strong> {t('ecotrack.apiTokenDescription')}</li>
                    <li><strong>User GUID:</strong> {t('ecotrack.userGuidDescription')}</li>
                  </ul>
                  <p>{t('ecotrack.configurationNote')}</p>
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
                      </Space>
                    }
                    name="userGuid"
                   
                  >
                    <Input 
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      size="large"
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

                <Button
                  type="default"
                  onClick={handleTestConnection}
                  loading={testing}
                  icon={<ApiOutlined />}
                  size="large"
                  disabled={!form.getFieldsValue().apiToken || !form.getFieldsValue().userGuid}
                >
                  {t('ecotrack.testConnection')}
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
                      {config.userGuid ? t('ecotrack.configured') : t('ecotrack.notConfigured')}
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
      </Row>
    </div>
  );
};

export default EcotrackIntegration;
