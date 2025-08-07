import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  List,
  Space,
  Typography,
  Modal,
  Select,
  Table,
  Alert,
  message,
  Spin
} from 'antd';
import {
  FileExcelOutlined,
  ImportOutlined,
  FolderOpenOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import googleAuthService from '../services/googleAuthService';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const GoogleSheetsImporter = ({ onImportSuccess }) => {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [sheetTabs, setSheetTabs] = useState([]);
  const [selectedTab, setSelectedTab] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  
  const { t } = useTranslation();

  useEffect(() => {
    loadGoogleSheets();
  }, []);

  const loadGoogleSheets = async () => {
    try {
      setLoading(true);
      
      // Check if user has Google authentication
      const debugInfo = await googleAuthService.debugUser();
      
      if (!debugInfo.hasGoogleAuth) {
        message.warning('Please connect to Google Sheets first');
        return;
      }
      
      const result = await googleAuthService.listGoogleSheets();
      setSheets(result.sheets || []);
      
      if (!result.sheets || result.sheets.length === 0) {
        message.info('No Google Sheets found in your account');
      } else {
        message.success(`Found ${result.sheets.length} Google Sheets`);
      }
    } catch (error) {
      message.error(`Failed to load Google Sheets: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSheet = async (sheet) => {
    try {
      setSelectedSheet(sheet);
      setLoading(true);
      
      // Load tabs/sheets within the spreadsheet
      const tabsResult = await googleAuthService.getSpreadsheetTabs(sheet.id);
      setSheetTabs(tabsResult.sheets || []);
      
      // Auto-select first tab
      if (tabsResult.sheets && tabsResult.sheets.length > 0) {
        const firstTab = tabsResult.sheets[0];
        setSelectedTab(firstTab);
        await loadPreview(sheet.id, firstTab.title);
      }
    } catch (error) {
      message.error('Failed to load sheet tabs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTab = async (tab) => {
    setSelectedTab(tab);
    if (selectedSheet) {
      await loadPreview(selectedSheet.id, tab.title);
    }
  };

  const loadPreview = async (spreadsheetId, sheetName) => {
    try {
      setLoading(true);
      const preview = await googleAuthService.previewSheetData(spreadsheetId, sheetName);
      setPreviewData(preview);
    } catch (error) {
      message.error('Failed to load preview data');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedSheet || !selectedTab) {
      message.error('Please select a sheet and tab first');
      return;
    }

    try {
      setImporting(true);
      const result = await googleAuthService.importOrdersFromSheet(
        selectedSheet.id,
        selectedTab.title
      );
      
      setImportResult(result);
      setImportModalVisible(false);
      
      if (result.success && result.imported > 0) {
        message.success(`Successfully imported ${result.imported} orders`);
        if (onImportSuccess) {
          onImportSuccess(result);
        }
      } else if (result.success && result.imported === 0) {
        message.warning('No orders were imported. Please check your data format.');
      }
    } catch (error) {
      message.error('Failed to import orders from Google Sheet');
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getPreviewColumns = () => {
    if (!previewData || !previewData.values || previewData.values.length === 0) return [];
    
    const headers = previewData.values[0] || [];
    return headers.map((header, index) => ({
      title: header || `Column ${index + 1}`,
      dataIndex: `col${index}`,
      key: `col${index}`,
      ellipsis: true,
      width: 150
    }));
  };

  const getPreviewDataSource = () => {
    if (!previewData || !previewData.values || previewData.values.length < 2) return [];
    
    const dataRows = previewData.values.slice(1); // Skip header row
    return dataRows.map((row, index) => {
      const record = { key: index };
      row.forEach((cell, cellIndex) => {
        record[`col${cellIndex}`] = cell || '';
      });
      return record;
    });
  };

  if (loading && sheets.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <Text>Loading your Google Sheets files...</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card 
        title={
          <Space>
            <FolderOpenOutlined />
            <span>Your Google Sheets Files</span>
          </Space>
        }
        extra={
          <Button 
            icon={<ImportOutlined />} 
            onClick={loadGoogleSheets}
            loading={loading}
          >
            Refresh
          </Button>
        }
      >
        {sheets.length === 0 ? (
          <div>
            <Alert
              message="No Google Sheets Found"
              description="No Google Sheets files found in your account. Create a Google Sheet first and then click refresh."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Text type="secondary">
                Go to{' '}
                <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer">
                  Google Sheets
                </a>{' '}
                to create a new spreadsheet, then return here and click "Refresh".
              </Text>
            </div>
          </div>
        ) : (
          <List
            dataSource={sheets}
            renderItem={(sheet) => (
              <List.Item
                actions={[
                  <Button 
                    type="primary" 
                    icon={<FileExcelOutlined />}
                    onClick={() => handleSelectSheet(sheet)}
                    loading={loading && selectedSheet?.id === sheet.id}
                  >
                    Select
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={<FileExcelOutlined style={{ fontSize: '20px', color: '#1890ff' }} />}
                  title={sheet.name}
                  description={`Modified: ${formatDate(sheet.modifiedTime)}`}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {selectedSheet && (
        <Card 
          title={`Import from: ${selectedSheet.name}`}
          style={{ marginTop: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>Select Sheet Tab:</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="Choose a tab"
                value={selectedTab?.title}
                onChange={(value) => {
                  const tab = sheetTabs.find(t => t.title === value);
                  if (tab) handleSelectTab(tab);
                }}
              >
                {sheetTabs.map(tab => (
                  <Option key={tab.title} value={tab.title}>
                    {tab.title}
                  </Option>
                ))}
              </Select>
            </div>
            
            {selectedTab && (
              <Button
                type="primary"
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
                disabled={!previewData || previewData.values.length < 2}
                block
              >
                Import Orders from "{selectedTab.title}"
              </Button>
            )}
          </Space>
        </Card>
      )}

      {previewData && (
        <Card 
          title="Data Preview" 
          style={{ marginTop: 16 }}
        >
          <Table
            columns={getPreviewColumns()}
            dataSource={getPreviewDataSource()}
            scroll={{ x: true }}
            pagination={{ pageSize: 3 }}
            size="small"
          />
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card title="Import Complete" style={{ marginTop: 16 }}>
          {importResult.success && importResult.imported > 0 ? (
            <Alert
              message={`Successfully imported ${importResult.imported} orders`}
              type="success"
              showIcon
            />
          ) : (
            <Alert
              message="Import completed with issues"
              description={`${importResult.errors?.length || 0} errors occurred during import`}
              type="warning"
              showIcon
            />
          )}
        </Card>
      )}

      {/* Import Confirmation Modal */}
      <Modal
        title="Import Orders"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setImportModalVisible(false)}>
            Cancel
          </Button>,
          <Button 
            key="import" 
            type="primary" 
            loading={importing}
            onClick={handleImport}
          >
            Import
          </Button>
        ]}
      >
        <Alert
          message={`Import ${previewData?.values ? previewData.values.length - 1 : 0} orders from "${selectedTab?.title}"?`}
          description="This will import orders directly to your database. Orders will be saved with French Excel format mapping."
          type="info"
          showIcon
        />
      </Modal>
    </div>
  );
};

export default GoogleSheetsImporter;
