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
  Divider
} from 'antd';
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  GoogleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { integrationsService } from '../../services/integrationsService';
import { usePermissions } from '../../hooks/usePermissions';
import GoogleSheetsConnection from '../../components/GoogleSheetsConnection';
import GoogleSheetsImporter from '../../components/GoogleSheetsImporter';
import './GoogleSheets.css';

const { Title, Text, Paragraph } = Typography;

const GoogleSheets = () => {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [sheetInfo, setSheetInfo] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [customRange, setCustomRange] = useState('');
  const [importResult, setImportResult] = useState(null);
  
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

  const handleSync = async () => {
    try {
      setLoading(true);
      const result = await integrationsService.exportToGoogleSheets();
      message.success(t('integrations.googleSheets.syncSuccess', { count: result.count }));
      setLastSync(new Date().toISOString());
    } catch (error) {
      message.error(t('integrations.googleSheets.syncError'));
      console.error('Sync error:', error);
    } finally {
      setLoading(false);
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
    </div>
  );
};

export default GoogleSheets;
