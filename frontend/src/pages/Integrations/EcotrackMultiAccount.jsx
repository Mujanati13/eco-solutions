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
  Select,
  Table,
  Modal,
  Popconfirm,
  Tag,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  ApiOutlined,
  KeyOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ShopOutlined,
  SettingOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import './EcotrackIntegration.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const EcotrackMultiAccount = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [testResults, setTestResults] = useState({});

  // Load locations and accounts on component mount
  useEffect(() => {
    loadLocations();
    loadAccounts();
  }, []);

  // Load available locations (boutiques)
  const loadLocations = async () => {
    try {
      const response = await api.get('/boutiques/locations');
      setLocations(response.data.locations || []);
    } catch (error) {
      console.error('Error loading locations:', error);
      message.error('Failed to load boutiques');
    }
  };

  // Load existing EcoTrack accounts
  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/ecotrack-multi-account/accounts');
      setAccounts(response.data.accounts || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      message.error('Failed to load EcoTrack accounts');
    } finally {
      setLoading(false);
    }
  };

  // Save new or edit existing account
  const handleSaveAccount = async (values) => {
    try {
      setLoading(true);
      
      const url = editingAccount 
        ? `/ecotrack-multi-account/accounts/${editingAccount.id}`
        : '/ecotrack-multi-account/accounts';
      
      const payload = {
        location_id: values.location_id,
        account_name: values.account_name,
        api_token: values.api_token,
        user_guid: values.user_guid,
        is_enabled: values.is_enabled || true,
        is_default: values.is_default || false
      };

      if (editingAccount) {
        await api.put(url, payload);
      } else {
        await api.post(url, payload);
      }

      message.success(editingAccount ? 'Account updated successfully' : 'Account created successfully');
      setModalVisible(false);
      form.resetFields();
      editForm.resetFields();
      setEditingAccount(null);
      await loadAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      const errorMsg = error.response?.data?.message || 'Failed to save account';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Test account connection
  const handleTestConnection = async (account) => {
    try {
      setTesting(true);
      setTestResults(prev => ({ ...prev, [account.id]: 'testing' }));
      
      const response = await api.post('/ecotrack-multi-account/test-connection', {
        account_id: account.id,
        api_token: account.api_token,
        user_guid: account.user_guid
      });

      const result = response.data;
      
      if (result.success) {
        setTestResults(prev => ({ ...prev, [account.id]: 'success' }));
        message.success(`Connection successful for ${account.account_name}`);
      } else {
        setTestResults(prev => ({ ...prev, [account.id]: 'error' }));
        message.error(`Connection failed for ${account.account_name}: ${result.message}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setTestResults(prev => ({ ...prev, [account.id]: 'error' }));
      message.error(`Connection test failed for ${account.account_name}`);
    } finally {
      setTesting(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async (accountId) => {
    try {
      setLoading(true);
      
      await api.delete(`/ecotrack-multi-account/accounts/${accountId}`);
      message.success('Account deleted successfully');
      await loadAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      const errorMsg = error.response?.data?.message || 'Failed to delete account';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Set default account
  const handleSetDefault = async (accountId) => {
    try {
      setLoading(true);
      
      await api.post(`/ecotrack-multi-account/accounts/${accountId}/set-default`);
      message.success('Default account updated');
      await loadAccounts();
    } catch (error) {
      console.error('Error setting default account:', error);
      const errorMsg = error.response?.data?.message || 'Failed to set default account';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const handleEditAccount = (account) => {
    setEditingAccount(account);
    editForm.setFieldsValue({
      location_id: account.location_id,
      account_name: account.account_name,
      api_token: account.api_token,
      user_guid: account.user_guid,
      is_enabled: account.is_enabled,
      is_default: account.is_default
    });
    setModalVisible(true);
  };

  // Get location name by ID
  const getLocationName = (locationId) => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.name : 'Unknown Location';
  };

  // Table columns for accounts
  const columns = [
    {
      title: 'Boutique/Location',
      dataIndex: 'location_id',
      key: 'location_id',
      render: (locationId) => (
        <Space>
          <ShopOutlined />
          <Text strong>{getLocationName(locationId)}</Text>
        </Space>
      ),
    },
    {
      title: 'Account Name',
      dataIndex: 'account_name',
      key: 'account_name',
      render: (name, record) => (
        <Space>
          <Text strong>{name}</Text>
          {record.is_default && <Tag color="gold">Default</Tag>}
        </Space>
      ),
    },
    {
      title: 'API Token',
      dataIndex: 'api_token',
      key: 'api_token',
      render: (token) => (
        <Text code>***{token ? token.slice(-4) : '****'}</Text>
      ),
    },
    {
      title: 'User GUID',
      dataIndex: 'user_guid',
      key: 'user_guid',
      render: (guid) => (
        <Text code>{guid}</Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const testResult = testResults[record.id];
        return (
          <Space>
            {record.is_enabled ? (
              <Tag color="green">Enabled</Tag>
            ) : (
              <Tag color="red">Disabled</Tag>
            )}
            {testResult === 'testing' && (
              <Tag color="blue">Testing...</Tag>
            )}
            {testResult === 'success' && (
              <Tag color="green" icon={<CheckCircleOutlined />}>Connected</Tag>
            )}
            {testResult === 'error' && (
              <Tag color="red" icon={<ExclamationCircleOutlined />}>Failed</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="Test Connection">
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={() => handleTestConnection(record)}
              loading={testResults[record.id] === 'testing'}
            />
          </Tooltip>
          <Tooltip title="Edit Account">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditAccount(record)}
            />
          </Tooltip>
          {!record.is_default && (
            <Tooltip title="Set as Default">
              <Button
                size="small"
                icon={<SettingOutlined />}
                onClick={() => handleSetDefault(record.id)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Are you sure you want to delete this account?"
            onConfirm={() => handleDeleteAccount(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete Account">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="ecotrack-integration">
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card 
            title={
              <Space>
                <SettingOutlined />
                EcoTrack Multi-Account Configuration
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingAccount(null);
                  form.resetFields();
                  setModalVisible(true);
                }}
              >
                Add Account
              </Button>
            }
          >
            <Alert
              message="Multi-Account EcoTrack Integration"
              description={
                <div>
                  <p>Configure multiple EcoTrack accounts, each linked to a specific boutique/location.</p>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li><strong>Location-Based:</strong> Each boutique can have its own EcoTrack account</li>
                    <li><strong>Automatic Selection:</strong> Orders will use the account linked to their boutique</li>
                    <li><strong>Fallback Support:</strong> A default account will be used if no specific account is found</li>
                    <li><strong>Backward Compatible:</strong> Works with existing single-account configurations</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Table
              columns={columns}
              dataSource={accounts}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
      </Row>

      {/* Add/Edit Account Modal */}
      <Modal
        title={editingAccount ? 'Edit EcoTrack Account' : 'Add EcoTrack Account'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingAccount(null);
          form.resetFields();
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={editingAccount ? editForm : form}
          layout="vertical"
          onFinish={handleSaveAccount}
          initialValues={{
            is_enabled: true,
            is_default: false
          }}
        >
          <Form.Item
            label="Boutique/Location"
            name="location_id"
            rules={[{ required: true, message: 'Please select a boutique' }]}
          >
            <Select
              placeholder="Select a boutique"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {locations.map(location => (
                <Option key={location.id} value={location.id}>
                  <Space>
                    <ShopOutlined />
                    {location.name}
                    {location.code && <Text type="secondary">({location.code})</Text>}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Account Name"
            name="account_name"
            rules={[{ required: true, message: 'Please enter an account name' }]}
          >
            <Input 
              placeholder="e.g., Boutique Alger EcoTrack"
              prefix={<UserOutlined />}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="API Token"
                name="api_token"
                rules={[
                  { required: true, message: 'API Token is required' },
                  { min: 10, message: 'API Token must be at least 10 characters' }
                ]}
              >
                <Input.Password 
                  placeholder="Enter EcoTrack API Token"
                  prefix={<KeyOutlined />}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="User GUID"
                name="user_guid"
                rules={[{ required: true, message: 'User GUID is required' }]}
              >
                <Input 
                  placeholder="Enter User GUID"
                  prefix={<ApiOutlined />}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Enable Account"
                name="is_enabled"
                valuePropName="checked"
              >
                <Switch 
                  checkedChildren="Enabled"
                  unCheckedChildren="Disabled"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Set as Default"
                name="is_default"
                valuePropName="checked"
              >
                <Switch 
                  checkedChildren="Default"
                  unCheckedChildren="Regular"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Space>
            <Button 
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<SaveOutlined />}
            >
              {editingAccount ? 'Update Account' : 'Create Account'}
            </Button>
            <Button 
              onClick={() => {
                setModalVisible(false);
                setEditingAccount(null);
                form.resetFields();
                editForm.resetFields();
              }}
            >
              Cancel
            </Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default EcotrackMultiAccount;
