import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Alert,
  Input,
  Form,
  message,
  Spin,
  Statistic,
  Tag,
  Modal,
  List,
  Divider,
  Switch,
  Tooltip,
  Progress,
  Collapse,
  Table,
  Badge,
  Timeline,
  Descriptions,
  notification,
  Select,
  DatePicker
} from 'antd';
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  GoogleOutlined,
  RocketOutlined,
  ImportOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  SettingOutlined,
  DatabaseOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { integrationsService } from '../../services/integrationsService';
import { usePermissions } from '../../hooks/usePermissions';
import GoogleSheetsConnection from '../../components/GoogleSheetsConnection';
import api from '../../services/api';
import './GoogleSheets.css';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { Option } = Select;
const { RangePicker } = DatePicker;

const GoogleSheetsAutoImport = () => {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [autoScanStatus, setAutoScanStatus] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [processedFiles, setProcessedFiles] = useState([]);
  const [scanProgress, setScanProgress] = useState(null);
  const [realtimeUpdates, setRealtimeUpdates] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [cronPattern, setCronPattern] = useState('*/5 * * * *'); // Default: every 5 minutes
  const [fileNamePatterns, setFileNamePatterns] = useState([
    'order', 'commande', 'cmd', 'livraison', 'delivery', 'client', 'vente', 'boutique'
  ]);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  // Load saved settings from backend on component mount
  useEffect(() => {
    loadFileNamePatterns();
    
    const savedCronPattern = localStorage.getItem('googleSheets_cronPattern');
    if (savedCronPattern) {
      setCronPattern(savedCronPattern);
    }
  }, []);

  // Load file name patterns from backend
  const loadFileNamePatterns = async () => {
    try {
      const response = await api.get('/auto-import/file-patterns');
      if (response.data.success && response.data.patterns) {
        setFileNamePatterns(response.data.patterns);
      }
    } catch (error) {
      console.warn('Error loading file name patterns from backend:', error);
    }
  };

  // Save settings to backend and localStorage
  const saveSettings = async () => {
    try {
      setLoading(true);
      
      // Save file patterns to backend
      const patternsResponse = await api.post('/auto-import/file-patterns', { patterns: fileNamePatterns });
      
      if (!patternsResponse.data.success) {
        throw new Error('Failed to save file patterns to backend');
      }
      
      // Save cron pattern to localStorage (backend handles this in start-auto-scan)
      localStorage.setItem('googleSheets_cronPattern', cronPattern);
      
      message.success('Settings saved successfully');
      setSettingsVisible(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      message.error('Failed to save settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
    loadStatistics();
    loadProcessedFiles();
    
    // Set up periodic updates if realtime is enabled
    let interval;
    if (realtimeUpdates) {
      interval = setInterval(() => {
        loadStatistics();
        loadProcessedFiles();
      }, 30000); // Update every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [realtimeUpdates]);

  const checkConnection = async () => {
    try {
      setLoading(true);
      const result = await integrationsService.testGoogleSheetsConnection();
      setConnectionStatus('connected');
    } catch (error) {
      setConnectionStatus('disconnected');
      console.error('Connection test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await api.get('/auto-import/stats');
      const data = response.data;
      setStatistics(data.stats);
      setAutoScanStatus(!data.stats.isRunning);
      
      if (data.stats.last_run) {
        setLastScanTime(new Date(data.stats.last_run));
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const loadProcessedFiles = async () => {
    try {
      const response = await api.get('/auto-import/processed-files');
      setProcessedFiles(response.data.files || []);
    } catch (error) {
      console.error('Failed to load processed files:', error);
    }
  };

  const handleManualScan = async () => {
    try {
      setLoading(true);
      setScanProgress({ current: 0, total: 100, status: 'Scanning Google Drive...' });
      
      const response = await api.post('/auto-import/scan-all');
      const result = response.data;
      
      if (result.success) {
        notification.success({
          message: 'Scan Completed',
          description: `Found ${result.results.newFiles} new files and imported ${result.results.totalOrdersImported} orders`,
          duration: 5
        });
        
        // Update scan history
        setScanHistory(prev => [
          {
            timestamp: new Date(),
            type: 'manual',
            filesProcessed: result.results.processedFiles,
            ordersImported: result.results.totalOrdersImported,
            errors: result.results.errors.length
          },
          ...prev.slice(0, 9) // Keep last 10 scans
        ]);
        
        // Refresh data
        await loadStatistics();
        await loadProcessedFiles();
      } else {
        message.error(result.error || 'Scan failed');
      }
    } catch (error) {
      console.error('Manual scan error:', error);
      message.error('Failed to perform scan');
    } finally {
      setLoading(false);
      setScanProgress(null);
    }
  };

  const handleToggleAutoScan = async () => {
    try {
      setLoading(true);
      
      const endpoint = autoScanStatus ? '/auto-import/stop-auto-scan' : '/auto-import/start-auto-scan';
      const body = autoScanStatus ? {} : { cronPattern };
      
      const response = await api.post(endpoint, body);
      const result = response.data;
      
      if (result.success) {
        setAutoScanStatus(!autoScanStatus);
        message.success(result.message);
      } else {
        message.error(result.error);
      }
    } catch (error) {
      console.error('Toggle auto scan error:', error);
      message.error('Failed to toggle automatic scanning');
    } finally {
      setLoading(false);
    }
  };

  // Columns for processed files table
  const processedFilesColumns = [
    {
      title: 'File Name',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (text) => (
        <Space>
          <FileOutlined />
          <Text ellipsis style={{ maxWidth: 300 }}>{text}</Text>
        </Space>
      )
    },
    {
      title: 'Orders Imported',
      dataIndex: 'orders_imported',
      key: 'orders_imported',
      render: (count) => (
        <Badge count={count} style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }} />
      )
    },
    {
      title: 'Last Modified',
      dataIndex: 'last_modified',
      key: 'last_modified',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Processed',
      dataIndex: 'last_processed',
      key: 'last_processed',
      render: (date) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <Text type="secondary">{new Date(date).toLocaleDateString()}</Text>
        </Tooltip>
      )
    }
  ];

  // Cron pattern options
  const cronOptions = [
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every 30 minutes', value: '*/30 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 2 hours', value: '0 */2 * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Custom', value: 'custom' }
  ];

  if (!hasPermission('canViewIntegrations')) {
    return (
      <div className="google-sheets-access-denied">
        <Alert
          message={t('errors.accessDenied')}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="google-sheets-container">
      <div className="google-sheets-header">
        <Title level={2}>
          <GoogleOutlined className="google-sheets-icon" />
          Automatic Google Sheets Monitor
        </Title>
        <Text type="secondary">
          Monitor and automatically import orders from your connected shops
        </Text>
      </div>

      {/* Connection Status Card */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <GoogleSheetsConnection />
          </Col>
          <Col xs={24} md={12}>
            <Space size="large" style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                icon={<SettingOutlined />}
                onClick={() => setSettingsVisible(true)}
              >
                Settings
              </Button>
              <Switch
                checked={realtimeUpdates}
                onChange={setRealtimeUpdates}
                checkedChildren="Live"
                unCheckedChildren="Manual"
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Statistics Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Files Processed"
              value={statistics?.total_files_processed || 0}
              prefix={<FileOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Orders Imported"
              value={statistics?.total_orders_imported || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Average per File"
              value={statistics?.avg_orders_per_file || 0}
              precision={1}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Auto Scan Status"
              value={autoScanStatus ? "Running" : "Stopped"}
              prefix={autoScanStatus ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              valueStyle={{ color: autoScanStatus ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Control Panel */}
      <Card title="Control Panel" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<SyncOutlined />}
                loading={loading}
                onClick={handleManualScan}
                size="large"
                block
              >
                Scan All Files Now
              </Button>
              {lastScanTime && (
                <Text type="secondary">
                  Last scan: {lastScanTime.toLocaleString()}
                </Text>
              )}
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type={autoScanStatus ? "danger" : "default"}
                icon={autoScanStatus ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                loading={loading}
                onClick={handleToggleAutoScan}
                size="large"
                block
              >
                {autoScanStatus ? 'Stop Auto Scan' : 'Start Auto Scan'}
              </Button>
              <Text type="secondary">
                Frequency: {cronPattern === '*/5 * * * *' ? 'Every 5 minutes' : 
                          cronPattern === '*/15 * * * *' ? 'Every 15 minutes' :
                          cronPattern === '*/30 * * * *' ? 'Every 30 minutes' : 
                          cronPattern === '0 * * * *' ? 'Every hour' : 'Custom'}
              </Text>
            </Space>
          </Col>
          <Col xs={24} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  loadStatistics();
                  loadProcessedFiles();
                }}
                size="large"
                block
              >
                Refresh Data
              </Button>
              <Text type="secondary">
                Real-time updates: {realtimeUpdates ? 'Enabled' : 'Disabled'}
              </Text>
            </Space>
          </Col>
        </Row>

        {/* Scan Progress */}
        {scanProgress && (
          <div style={{ marginTop: 16 }}>
            <Progress
              percent={scanProgress.current}
              status="active"
              format={() => scanProgress.status}
            />
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Recent Scan History" size="small">
            {scanHistory.length > 0 ? (
              <Timeline size="small">
                {scanHistory.map((scan, index) => (
                  <Timeline.Item
                    key={index}
                    color={scan.errors > 0 ? 'red' : 'green'}
                    dot={scan.type === 'manual' ? <SyncOutlined /> : <ClockCircleOutlined />}
                  >
                    <div>
                      <Text strong>{scan.type === 'manual' ? 'Manual' : 'Auto'} Scan</Text>
                      <br />
                      <Text type="secondary">{scan.timestamp.toLocaleString()}</Text>
                      <br />
                      <Space size="small">
                        <Tag color="blue">{scan.filesProcessed} files</Tag>
                        <Tag color="green">{scan.ordersImported} orders</Tag>
                        {scan.errors > 0 && <Tag color="red">{scan.errors} errors</Tag>}
                      </Space>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <Text type="secondary">No scan history available</Text>
            )}
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="File Name Patterns" size="small">
            <Paragraph type="secondary">
              Files matching these patterns will be automatically processed:
            </Paragraph>
            <Space wrap>
              {fileNamePatterns.map((pattern, index) => (
                <Tag key={index} color="processing">
                  {pattern}*
                </Tag>
              ))}
            </Space>
            <div style={{ marginTop: 12 }}>
              <Button size="small" onClick={() => setSettingsVisible(true)}>
                Configure Patterns
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Processed Files Table */}
      <Card title="Recently Processed Files">
        <Table
          columns={processedFilesColumns}
          dataSource={processedFiles}
          rowKey="spreadsheet_id"
          pagination={{ pageSize: 10 }}
          loading={loading}
          size="small"
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Settings Modal */}
      <Modal
        title="Auto Import Settings"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSettingsVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={saveSettings}
          >
            Save Settings
          </Button>
        ]}
        width={600}
      >
        <Form layout="vertical">
          <Form.Item label="Scan Frequency">
            <Select
              value={cronPattern}
              onChange={setCronPattern}
              style={{ width: '100%' }}
            >
              {cronOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
            {cronPattern === 'custom' && (
              <Input
                placeholder="Enter custom cron pattern (e.g., 0 */2 * * *)"
                style={{ marginTop: 8 }}
                onChange={(e) => setCronPattern(e.target.value)}
              />
            )}
          </Form.Item>

          <Form.Item label="File Name Patterns">
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="Add file name patterns"
              value={fileNamePatterns}
              onChange={setFileNamePatterns}
            >
              {fileNamePatterns.map(pattern => (
                <Option key={pattern} value={pattern}>
                  {pattern}
                </Option>
              ))}
            </Select>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Files containing these keywords will be automatically processed
            </Text>
          </Form.Item>

          <Form.Item>
            <Alert
              message="Auto Import Information"
              description="The system will automatically scan your Google Drive for new order files and import them to your database. Make sure your Google account is properly connected and has access to the shop order files."
              type="info"
              showIcon
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GoogleSheetsAutoImport;
