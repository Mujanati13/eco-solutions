import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Form,
  Input,
  Select,
  Upload,
  message,
  Table,
  Tabs,
  Space,
  Typography,
  Divider,
  Tag,
  Modal,
  Steps,
  Alert,
  Tooltip,
} from 'antd';
import {
  UploadOutlined,
  SendOutlined,
  SearchOutlined,
  PlusOutlined,
  FileTextOutlined,
  AimOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TruckOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ecotrackService } from '../../services/ecotrackService';
import './EcotrackIntegration.css';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

const EcotrackIntegration = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [bulkForm] = Form.useForm();
  const [trackingForm] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [trackingResults, setTrackingResults] = useState([]);
  const [bulkResults, setBulkResults] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [activeTab, setActiveTab] = useState('single');

  // Single order creation
  const handleSingleOrder = async (values) => {
    setLoading(true);
    try {
      // Convert form values to backend format
      const orderData = {
        order_number: values.order_number,
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        customer_email: values.customer_email || '',
        customer_address: values.customer_address,
        customer_city: values.customer_city,
        total_amount: parseFloat(values.total_amount),
        product_name: values.product_name,
        product_details: { name: values.product_name },
        notes: values.notes,
        delivery_type: values.delivery_type || 'home'
      };

      const result = await ecotrackService.createOrder(orderData);
      
      if (result.tracking) {
        // Show success message with database status
        const successMessage = result.savedToDatabase 
          ? t('ecotrack.orderCreatedAndSaved', { tracking: result.tracking, orderId: result.localOrderId })
          : t('ecotrack.orderCreatedEcotrackOnly', { tracking: result.tracking });
        
        message.success(successMessage);
        
        // Show warning if local save failed
        if (result.savedToDatabase === false && result.localError) {
          message.warning(t('ecotrack.localSaveWarning', { error: result.localError }));
        }
        
        form.resetFields();
        
        // Add to tracking results
        setTrackingResults(prev => [...prev, {
          ref_client: values.order_number,
          tracking: result.tracking,
          status: 'CREATED',
          created_at: new Date().toISOString(),
          savedToDatabase: result.savedToDatabase,
          localOrderId: result.localOrderId
        }]);
      }
    } catch (error) {
      message.error(t('ecotrack.orderError') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Bulk order creation
  const handleBulkOrders = async () => {
    if (csvData.length === 0) {
      message.error(t('ecotrack.noDataToSubmit'));
      return;
    }

    setLoading(true);
    try {
      const result = await ecotrackService.createBulkOrders(csvData);
      
      if (result.trackings && result.trackings.length > 0) {
        const successMessage = t('ecotrack.bulkOrdersCreated', { 
          total: csvData.length,
          success: result.successCount,
          errors: result.errorCount
        });
        
        message.success(successMessage);
        
        // Show summary of database saves
        const savedToDb = result.results.filter(r => r.savedToDatabase).length;
        if (savedToDb < result.successCount) {
          message.warning(t('ecotrack.bulkLocalSaveWarning', { 
            ecotrack: result.successCount, 
            database: savedToDb 
          }));
        }
        
        setBulkResults(result.results || []);
        setCsvData([]);
      } else {
        message.error(t('ecotrack.bulkOrderError') + ': No orders were created successfully');
      }
    } catch (error) {
      message.error(t('ecotrack.bulkOrderError') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Track parcel
  const handleTracking = async (values) => {
    setLoading(true);
    try {
      const result = await ecotrackService.trackParcel(values.tracking_number);
      
      // Check if the result has the expected format
      if (result && result[values.tracking_number]) {
        const trackingData = result[values.tracking_number];
        
        // Extract current status from the latest activity
        const latestActivity = trackingData.activity && trackingData.activity.length > 0 
          ? trackingData.activity[0] 
          : null;
        
        const currentStatus = latestActivity ? latestActivity.event_key : 'upload';
        const statusDescription = latestActivity ? latestActivity.event : 'Uploadé sur le système';
        
        // Update tracking results
        setTrackingResults(prev => {
          const existing = prev.find(item => item.tracking === values.tracking_number);
          const newItem = {
            tracking: values.tracking_number,
            status: currentStatus,
            statusDescription: statusDescription,
            recipientName: trackingData.recipientName,
            shippedBy: trackingData.shippedBy,
            orderInfo: trackingData.OrderInfo,
            statusHistory: trackingData.activity || [],
            lastUpdate: latestActivity ? latestActivity.date : trackingData.OrderInfo?.created_at
          };
          
          if (existing) {
            return prev.map(item => 
              item.tracking === values.tracking_number ? newItem : item
            );
          } else {
            return [...prev, newItem];
          }
        });
        
        trackingForm.resetFields();
        message.success(t('ecotrack.trackingUpdated'));
      } else {
        message.error(t('ecotrack.trackingNotFound'));
      }
    } catch (error) {
      message.error(t('ecotrack.trackingError') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV/Excel upload
  const handleFileUpload = (file) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (fileExtension === 'csv') {
      handleCSVUpload(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      handleExcelUpload(file);
    } else {
      message.error(t('ecotrack.unsupportedFileFormat'));
      return false;
    }
    
    return false; // Prevent default upload
  };

  // Handle CSV upload
  const handleCSVUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const data = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = values[index] || '';
            });
            return obj;
          });
        
        setCsvData(data);
        message.success(t('ecotrack.fileUploaded', { count: data.length, format: 'CSV' }));
      } catch (error) {
        message.error(t('ecotrack.csvError') + ': ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  // Handle Excel upload
  const handleExcelUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // Import XLSX library dynamically
        import('xlsx').then((XLSX) => {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get first worksheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          setCsvData(jsonData);
          message.success(t('ecotrack.fileUploaded', { count: jsonData.length, format: 'Excel' }));
        }).catch((error) => {
          console.error('Failed to import XLSX library:', error);
          message.error(t('ecotrack.excelLibraryError'));
        });
      } catch (error) {
        message.error(t('ecotrack.excelError') + ': ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Status icon helper
  const getStatusIcon = (status) => {
    switch (status) {
      case 'CREATED':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'IN_TRANSIT':
        return <TruckOutlined style={{ color: '#1890ff' }} />;
      case 'DELIVERED':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  // Status color helper
  const getStatusColor = (status) => {
    switch (status) {
      case 'upload':
        return 'default';
      case 'customer_validation':
        return 'success';
      case 'validation_collect_colis':
        return 'processing';
      case 'fdr_activated':
        return 'warning';
      case 'livre':
      case 'livred':
        return 'success';
      case 'return_client':
      case 'return_refused':
        return 'error';
      case 'CREATED':
        return 'warning';
      case 'IN_TRANSIT':
        return 'processing';
      case 'DELIVERED':
        return 'success';
      default:
        return 'default';
    }
  };

  // Table columns for tracking results
  const trackingColumns = [
    {
      title: t('ecotrack.trackingNumber'),
      dataIndex: 'tracking',
      key: 'tracking',
      render: (text, record) => (
        <div>
          <Text code>{text}</Text>
          {record.savedToDatabase === true && (
            <Tag color="green" size="small" style={{ marginLeft: 8 }}>
              Saved to DB
            </Tag>
          )}
          {record.savedToDatabase === false && (
            <Tag color="orange" size="small" style={{ marginLeft: 8 }}>
              Ecotrack Only
            </Tag>
          )}
          {record.localOrderId && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              Order ID: {record.localOrderId}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('ecotrack.recipient'),
      dataIndex: 'recipientName',
      key: 'recipientName',
      render: (text, record) => record.orderInfo?.client || text || '-',
    },
    {
      title: t('ecotrack.phone'),
      dataIndex: 'phone',
      key: 'phone',
      render: (text, record) => record.orderInfo?.phone || '-',
    },
    {
      title: t('ecotrack.address'),
      dataIndex: 'address',
      key: 'address',
      render: (text, record) => record.orderInfo?.adresse || '-',
    },
    {
      title: t('ecotrack.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <div>
          <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
            {status}
          </Tag>
          {record.statusDescription && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {record.statusDescription}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t('ecotrack.amount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (text, record) => record.orderInfo?.montant ? `${record.orderInfo.montant} DA` : '-',
    },
    {
      title: t('ecotrack.lastUpdate'),
      dataIndex: 'lastUpdate',
      key: 'lastUpdate',
      render: (text) => text ? new Date(text).toLocaleString() : '-',
    },
  ];

  // CSV preview columns
  const csvColumns = csvData.length > 0 ? Object.keys(csvData[0]).map(key => ({
    title: key,
    dataIndex: key,
    key: key,
    ellipsis: true,
  })) : [];

  return (
    <div className="ecotrack-integration">
      <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
        <TabPane 
          tab={
            <span>
              <PlusOutlined />
              {t('ecotrack.singleOrder')}
            </span>
          } 
          key="single"
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={24}>
              <Card title={t('ecotrack.createOrder')} className="form-card">
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSingleOrder}
                  initialValues={{
                    delivery_type: 'home',
                    can_open: 1,
                    stock: 0,
                  }}
                >
                  <Form.Item
                    label={t('ecotrack.refClient')}
                    name="order_number"
                    rules={[{ required: true, message: t('ecotrack.refClientRequired') }]}
                  >
                    <Input placeholder="ORDER123456" />
                  </Form.Item>

                  <Form.Item
                    label={t('ecotrack.customerName')}
                    name="customer_name"
                    rules={[{ required: true, message: t('ecotrack.customerNameRequired') }]}
                  >
                    <Input placeholder="Nom du client" />
                  </Form.Item>

                  <Form.Item
                    label={t('ecotrack.mobile')}
                    name="customer_phone"
                    rules={[
                      { required: true, message: t('ecotrack.mobileRequired') },
                      { pattern: /^[0-9]{10}$/, message: t('ecotrack.mobileFormat') }
                    ]}
                  >
                    <Input placeholder="0612345678" />
                  </Form.Item>

                  <Form.Item
                    label={t('ecotrack.email')}
                    name="customer_email"
                    rules={[
                      { type: 'email', message: t('ecotrack.emailFormat') }
                    ]}
                  >
                    <Input placeholder="client@example.com" />
                  </Form.Item>

                  <Form.Item
                    label={t('ecotrack.address')}
                    name="customer_address"
                    rules={[{ required: true, message: t('ecotrack.addressRequired') }]}
                  >
                    <Input placeholder="123 Rue de la Paix" />
                  </Form.Item>

                  <Form.Item
                    label={t('ecotrack.city')}
                    name="customer_city"
                    rules={[{ required: true, message: t('ecotrack.cityRequired') }]}
                  >
                    <Input placeholder="Alger" />
                  </Form.Item>

                  <Form.Item
                    label={t('ecotrack.totalAmount')}
                    name="total_amount"
                    rules={[{ required: true, message: t('ecotrack.totalAmountRequired') }]}
                  >
                    <Input type="number" min={0} placeholder="2500" />
                  </Form.Item>

                  <Form.Item
                    label={t('ecotrack.productName')}
                    name="product_name"
                    rules={[{ required: true, message: t('ecotrack.productNameRequired') }]}
                  >
                    <Input placeholder="Nom du produit" />
                  </Form.Item>

                  <Form.Item
                    label={t('ecotrack.remarks')}
                    name="notes"
                  >
                    <TextArea rows={3} placeholder={t('ecotrack.remarksPlaceholder')} />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={t('ecotrack.deliveryType')}
                        name="delivery_type"
                      >
                        <Select>
                          <Option value="home">{t('ecotrack.homeDelivery')}</Option>
                          <Option value="stop_desk">{t('ecotrack.stopDesk')}</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      loading={loading}
                      icon={<SendOutlined />}
                      size="large"
                      block
                    >
                      {t('ecotrack.createOrder')}
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <FileTextOutlined />
              {t('ecotrack.bulkOrders')}
            </span>
          } 
          key="bulk"
        >
          <Row gutter={[24, 24]}>
            <Col span={24}>
              <Card title={t('ecotrack.bulkUpload')} className="upload-card">
                <Alert
                  message={t('ecotrack.fileFormatInfo')}
                  description={
                    <div>
                      <p>{t('ecotrack.supportedFormats')}:</p>
                      <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                        <li><strong>CSV:</strong> {t('ecotrack.csvDescription')}</li>
                        <li><strong>Excel (XLSX/XLS):</strong> {t('ecotrack.excelDescription')}</li>
                      </ul>
                      <p>{t('ecotrack.expectedHeaders')}:</p>
                      <Text code>type_id,ref_client,product_codes,quantite,mobile,email,remarque,is_fragile,sms_alert</Text>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Upload
                  accept=".csv,.xlsx,.xls"
                  beforeUpload={handleFileUpload}
                  showUploadList={false}
                  disabled={loading}
                >
                  <Button icon={<UploadOutlined />} size="large">
                    {t('ecotrack.uploadFile')}
                  </Button>
                </Upload>

                {csvData.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Title level={4}>{t('ecotrack.filePreview')} ({csvData.length} rows)</Title>
                    <Table
                      columns={csvColumns}
                      dataSource={csvData}
                      rowKey={(record, index) => index}
                      pagination={{ pageSize: 10 }}
                      size="small"
                      scroll={{ x: 'max-content' }}
                    />
                    
                    <div style={{ marginTop: 16, textAlign: 'center' }}>
                      <Button
                        type="primary"
                        size="large"
                        loading={loading}
                        onClick={handleBulkOrders}
                        icon={<SendOutlined />}
                      >
                        {t('ecotrack.submitBulkOrders')}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </Col>

            {bulkResults.length > 0 && (
              <Col span={24}>
                <Card title={t('ecotrack.bulkResults')} className="results-card">
                  <Table
                    columns={[
                      ...trackingColumns,
                      {
                        title: t('ecotrack.mobile'),
                        dataIndex: 'mobile',
                        key: 'mobile',
                      },
                      {
                        title: t('ecotrack.email'),
                        dataIndex: 'email',
                        key: 'email',
                      },
                    ]}
                    dataSource={bulkResults}
                    rowKey="tracking"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                </Card>
              </Col>
            )}
          </Row>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <SearchOutlined />
              {t('ecotrack.tracking')}
            </span>
          } 
          key="tracking"
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={8}>
              <Card title={t('ecotrack.trackParcel')} className="form-card">
                <Form
                  form={trackingForm}
                  layout="vertical"
                  onFinish={handleTracking}
                >
                  <Form.Item
                    label={t('ecotrack.trackingNumber')}
                    name="tracking_number"
                    rules={[{ required: true, message: t('ecotrack.trackingNumberRequired') }]}
                  >
                    <Input placeholder="ECSJFS2008106396" />
                  </Form.Item>

                  <Form.Item>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      loading={loading}
                      icon={<SearchOutlined />}
                      block
                    >
                      {t('ecotrack.trackParcel')}
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </Col>

            <Col xs={24} lg={16}>
              <Card title={t('ecotrack.trackingHistory')} className="tracking-card">
                {trackingResults.map((item, index) => (
                  <div key={index} className="tracking-item">
                    <div className="tracking-header">
                      <Text strong>{item.tracking}</Text>
                      <Tag color={getStatusColor(item.status)}>
                        {getStatusIcon(item.status)} {item.status}
                      </Tag>
                    </div>
                    
                    {/* Order Information */}
                    {item.orderInfo && (
                      <div style={{ marginTop: 16, marginBottom: 16 }}>
                        <Text strong>{t('ecotrack.orderInfo')}:</Text>
                        <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginTop: '8px' }}>
                          <div><Text strong>{t('ecotrack.recipient')}:</Text> {item.orderInfo.client}</div>
                          <div><Text strong>{t('ecotrack.phone')}:</Text> {item.orderInfo.phone}</div>
                          <div><Text strong>{t('ecotrack.address')}:</Text> {item.orderInfo.adresse}, {item.orderInfo.commune}</div>
                          <div><Text strong>{t('ecotrack.amount')}:</Text> {item.orderInfo.montant} DA</div>
                          <div><Text strong>{t('ecotrack.product')}:</Text> {item.orderInfo.produit}</div>
                          {item.orderInfo.remarque && (
                            <div><Text strong>{t('ecotrack.notes')}:</Text> {item.orderInfo.remarque}</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Activity History */}
                    {item.statusHistory && item.statusHistory.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <Text strong>{t('ecotrack.activityHistory')}:</Text>
                        <Steps 
                          direction="vertical" 
                          size="small" 
                          current={item.statusHistory.length - 1}
                          style={{ marginTop: 16 }}
                        >
                          {item.statusHistory.map((step, stepIndex) => (
                            <Step
                              key={stepIndex}
                              title={step.event}
                              description={
                                <div>
                                  <div>{new Date(step.date).toLocaleString()}</div>
                                  {step.by && <div><Text type="secondary">{t('ecotrack.by')}: {step.by}</Text></div>}
                                  {step.content && <div><Text type="secondary">{step.content}</Text></div>}
                                </div>
                              }
                              status={stepIndex === 0 ? 'process' : 'finish'}
                            />
                          ))}
                        </Steps>
                      </div>
                    )}
                    
                    {index < trackingResults.length - 1 && <Divider />}
                  </div>
                ))}
                
                {trackingResults.length === 0 && (
                  <div className="empty-state">
                    <AimOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                    <p>{t('ecotrack.noTrackingData')}</p>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default EcotrackIntegration;
