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
  Collapse
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
  EyeOutlined,
  ImportOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { integrationsService } from '../../services/integrationsService';
import { usePermissions } from '../../hooks/usePermissions';
import GoogleSheetsConnection from '../../components/GoogleSheetsConnection';
import GoogleSheetsImporter from '../../components/GoogleSheetsImporter';
import './GoogleSheets.css';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const GoogleSheets = () => {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [sheetInfo, setSheetInfo] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [ecotrackImportModalVisible, setEcotrackImportModalVisible] = useState(false);
  const [customRange, setCustomRange] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [ecotrackImportResult, setEcotrackImportResult] = useState(null);
  const [createEcotrackDeliveries, setCreateEcotrackDeliveries] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [form] = Form.useForm();

  useEffect(() => {
    checkConnection();
    loadSheetInfo();
  }, []);

  const checkConnection = async () => {
    try {
      setLoading(true);
      const result = await integrationsService.testGoogleSheetsConnection();
      setConnectionStatus('connected');
      message.success(t('integrations.googleSheets.connectionSuccess'));
    } catch (error) {
      setConnectionStatus('disconnected');
      console.error('Connection test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSheetInfo = async () => {
    try {
      const info = await integrationsService.getGoogleSheetsInfo();
      setSheetInfo(info);
    } catch (error) {
      console.error('Failed to load sheet info:', error);
    }
  };

  const handleImport = async (values) => {
    try {
      setLoading(true);
      const sheetRange = values?.sheetRange || 'Orders!A2:L';
      const result = await integrationsService.importFromGoogleSheets(sheetRange);
      
      setImportResult(result);
      setImportModalVisible(false);
      
      if (result.imported > 0) {
        message.success(t('integrations.googleSheets.importSuccess', { count: result.imported }));
      } else {
        message.info(t('integrations.googleSheets.noData'));
      }
      
      setLastSync(new Date().toISOString());
    } catch (error) {
      message.error(t('integrations.googleSheets.importError'));
      console.error('Import error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const result = await integrationsService.exportToGoogleSheets();
      message.success(t('integrations.googleSheets.exportSuccess', { count: result.count }));
      setLastSync(new Date().toISOString());
    } catch (error) {
      message.error(t('integrations.googleSheets.exportError'));
      console.error('Export error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEcotrackImport = async (values) => {
    try {
      setLoading(true);
      setImportProgress(0);
      
      const sheetRange = values?.sheetRange || 'Orders!A2:L';
      
      // First, preview if in preview mode
      if (previewMode) {
        const result = await integrationsService.importFromGoogleSheetsToEcotrack(sheetRange, {
          validateOnly: true
        });
        
        setEcotrackImportResult(result);
        message.info(t('integrations.googleSheets.previewComplete', { count: result.count }));
        setImportProgress(100);
        return;
      }
      
      // Update progress periodically
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 500);
      
      const result = await integrationsService.importFromGoogleSheetsToEcotrack(sheetRange, {
        createEcotrackDeliveries,
        skipDuplicates,
        saveToDatabase: true // Enable database storage
      });
      
      clearInterval(progressInterval);
      setImportProgress(100);
      
      setEcotrackImportResult(result);
      setEcotrackImportModalVisible(false);
      
      if (result.success && result.imported > 0) {
        const ecotrackMessage = createEcotrackDeliveries 
          ? t('integrations.googleSheets.ecotrackImportSuccess', { 
              orders: result.imported, 
              deliveries: result.ecotrackDeliveries 
            })
          : t('integrations.googleSheets.importSuccess', { count: result.imported });
        
        message.success(ecotrackMessage);

        // Show database save status
        if (result.databaseSaved) {
          message.info(t('integrations.googleSheets.ordersSavedToDatabase', { count: result.databaseSaved }));
        }
        if (result.databaseFailed && result.databaseFailed > 0) {
          message.warning(t('integrations.googleSheets.databaseSaveWarning', { count: result.databaseFailed }));
        }
      } else if (result.count === 0) {
        message.info(t('integrations.googleSheets.noData'));
      } else {
        message.warning(t('integrations.googleSheets.partialImport', { 
          imported: result.imported, 
          total: result.count 
        }));
      }
      
      setLastSync(new Date().toISOString());
    } catch (error) {
      message.error(t('integrations.googleSheets.ecotrackImportError'));
      console.error('Ecotrack import error:', error);
    } finally {
      setLoading(false);
      setImportProgress(0);
    }
  };

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
          {t('integrations.googleSheets.title')}
        </Title>
        <Text type="secondary">{t('integrations.googleSheets.subtitle')}</Text>
      </div>

      {/* Google Sheets Connection Section */}
      <div style={{ marginBottom: 24 }}>
        <GoogleSheetsConnection />
      </div>

      {/* Google Sheets Importer Section */}
      <div style={{ marginBottom: 24 }}>
        <GoogleSheetsImporter 
          onImportSuccess={(result) => {
            // Handle successful import
            message.success(`Successfully imported ${result.imported} orders from Google Sheets`);
            // You could refresh order data here or trigger other actions
          }}
        />
      </div>

      {/* Enhanced Import with Ecotrack Integration */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RocketOutlined style={{ color: '#1890ff' }} />
            {t('integrations.googleSheets.ecotrackImportTitle')}
          </div>
        }
        style={{ marginBottom: 24 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            {t('integrations.googleSheets.ecotrackImportDescription')}
          </Text>
        </div>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Button
                type="primary"
                icon={<ImportOutlined />}
                size="large"
                onClick={() => {
                  setPreviewMode(false);
                  setEcotrackImportModalVisible(true);
                }}
                loading={loading}
                style={{ width: '100%' }}
              >
                {t('integrations.googleSheets.importWithEcotrack')}
              </Button>
            </Col>
            <Col xs={24} sm={12}>
              <Button
                icon={<EyeOutlined />}
                size="large"
                onClick={() => {
                  setPreviewMode(true);
                  setEcotrackImportModalVisible(true);
                }}
                loading={loading}
                style={{ width: '100%' }}
              >
                {t('integrations.googleSheets.previewImport')}
              </Button>
            </Col>
          </Row>

          {/* Import Results */}
          {ecotrackImportResult && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('integrations.googleSheets.totalFound')}
                    value={ecotrackImportResult.count}
                    prefix={<InfoCircleOutlined />}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('integrations.googleSheets.imported')}
                    value={ecotrackImportResult.imported || 0}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('integrations.googleSheets.ecotrackDeliveries')}
                    value={ecotrackImportResult.ecotrackDeliveries || 0}
                    prefix={<RocketOutlined style={{ color: '#1890ff' }} />}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={t('integrations.googleSheets.warnings')}
                    value={ecotrackImportResult.totalWarnings || 0}
                    prefix={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                  />
                </Col>
              </Row>

              {/* Database Save Status */}
              {(ecotrackImportResult.databaseSaved > 0 || ecotrackImportResult.databaseFailed > 0) && (
                <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ecotrackImportResult.databaseSaved > 0 && (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      {t('integrations.googleSheets.savedToDatabase', { count: ecotrackImportResult.databaseSaved })}
                    </Tag>
                  )}
                  {ecotrackImportResult.databaseFailed > 0 && (
                    <Tag color="orange" icon={<ExclamationCircleOutlined />}>
                      {t('integrations.googleSheets.ecotrackOnly', { count: ecotrackImportResult.databaseFailed })}
                    </Tag>
                  )}
                </div>
              )}

              {/* Show errors and warnings */}
              {(ecotrackImportResult.errors?.length > 0 || ecotrackImportResult.warnings?.length > 0) && (
                <Collapse ghost style={{ marginTop: 16 }}>
                  {ecotrackImportResult.errors?.length > 0 && (
                    <Panel header={`${t('integrations.googleSheets.errors')} (${ecotrackImportResult.totalErrors})`} key="errors">
                      <List
                        size="small"
                        dataSource={ecotrackImportResult.errors}
                        renderItem={error => (
                          <List.Item>
                            <Text type="danger">{error}</Text>
                          </List.Item>
                        )}
                      />
                    </Panel>
                  )}
                  {ecotrackImportResult.warnings?.length > 0 && (
                    <Panel header={`${t('integrations.googleSheets.warnings')} (${ecotrackImportResult.totalWarnings})`} key="warnings">
                      <List
                        size="small"
                        dataSource={ecotrackImportResult.warnings}
                        renderItem={warning => (
                          <List.Item>
                            <Text type="warning">{warning}</Text>
                          </List.Item>
                        )}
                      />
                    </Panel>
                  )}
                </Collapse>
              )}
            </Card>
          )}
        </Space>
      </Card>

      {/* Ecotrack Import Modal */}
      <Modal
        title={
          previewMode 
            ? t('integrations.googleSheets.previewImport')
            : t('integrations.googleSheets.importWithEcotrack')
        }
        open={ecotrackImportModalVisible}
        onCancel={() => setEcotrackImportModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form form={form} onFinish={handleEcotrackImport} layout="vertical">
          <Form.Item
            label={t('integrations.googleSheets.sheetRange')}
            name="sheetRange"
            initialValue="Orders!A2:L"
            tooltip={t('integrations.googleSheets.sheetRangeTooltip')}
          >
            <Input placeholder="Orders!A2:L" />
          </Form.Item>

          {!previewMode && (
            <>
              <Form.Item label={t('integrations.googleSheets.options')}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text>{t('integrations.googleSheets.createEcotrackDeliveries')}</Text>
                    <Switch
                      checked={createEcotrackDeliveries}
                      onChange={setCreateEcotrackDeliveries}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text>{t('integrations.googleSheets.skipDuplicates')}</Text>
                    <Switch
                      checked={skipDuplicates}
                      onChange={setSkipDuplicates}
                    />
                  </div>
                </Space>
              </Form.Item>

              {createEcotrackDeliveries && (
                <Alert
                  message={t('integrations.googleSheets.ecotrackInfo')}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
            </>
          )}

          {loading && importProgress > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text>{t('integrations.googleSheets.processing')}</Text>
              <Progress percent={importProgress} status="active" />
            </div>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {previewMode 
                  ? t('integrations.googleSheets.preview')
                  : t('integrations.googleSheets.startImport')
                }
              </Button>
              <Button onClick={() => setEcotrackImportModalVisible(false)}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GoogleSheets;
