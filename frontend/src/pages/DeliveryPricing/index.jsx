import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Tag,
  Space,
  Tooltip,
  Switch,
  Typography,
  Divider,
  Alert,
  Badge,
  Tabs,
  Empty
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  TruckOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  HomeOutlined,
  BankOutlined,
  ShopOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { deliveryPricingService } from '../../services/deliveryPricingService';

const { Title, Text } = Typography;
const { Option } = Select;

const DeliveryPricing = () => {
  const { t } = useTranslation();
  const [wilayas, setWilayas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedWilaya, setSelectedWilaya] = useState(null);
  const [selectedPricing, setSelectedPricing] = useState(null);
  const [stats, setStats] = useState({});
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [wilayasResponse, statsResponse] = await Promise.all([
        deliveryPricingService.getAllWilayasWithPricing(),
        deliveryPricingService.getDeliveryPricingStats()
      ]);
      
      // Ensure we always have arrays/objects
      const wilayasData = Array.isArray(wilayasResponse?.data) ? wilayasResponse.data : 
                         Array.isArray(wilayasResponse) ? wilayasResponse : [];
      const statsData = statsResponse?.data || statsResponse || {};
      
      setWilayas(wilayasData);
      setStats(statsData);
    } catch (error) {
      message.error(t('error.fetchFailed'));
      console.error('Error fetching delivery pricing data:', error);
      setWilayas([]); // Ensure empty array on error
      setStats({});   // Ensure empty object on error
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (wilaya, pricing) => {
    setSelectedWilaya(wilaya);
    setSelectedPricing(pricing);
    form.setFieldsValue(pricing);
    setEditModalVisible(true);
  };

  const handleCreate = (wilaya) => {
    setSelectedWilaya(wilaya);
    createForm.resetFields();
    createForm.setFieldsValue({
      wilaya_id: wilaya.id,
      delivery_type: 'home',
      weight_threshold: 1.0,
      delivery_time_min: 24,
      delivery_time_max: 72,
      priority: 1
    });
    setCreateModalVisible(true);
  };

  const handleUpdate = async (values) => {
    try {
      await deliveryPricingService.updateDeliveryPricing(
        selectedWilaya.id,
        selectedPricing.delivery_type,
        values
      );
      message.success(t('success.updated'));
      setEditModalVisible(false);
      fetchData();
    } catch (error) {
      message.error(t('error.updateFailed'));
      console.error('Error updating pricing:', error);
    }
  };

  const handleCreatePricing = async (values) => {
    try {
      await deliveryPricingService.createDeliveryPricing(values);
      message.success(t('success.created'));
      setCreateModalVisible(false);
      fetchData();
    } catch (error) {
      message.error(t('error.createFailed'));
      console.error('Error creating pricing:', error);
    }
  };

  const handleDelete = async (wilaya, pricing) => {
    try {
      await deliveryPricingService.deleteDeliveryPricing(wilaya.id, pricing.delivery_type);
      message.success(t('success.deleted'));
      fetchData();
    } catch (error) {
      message.error(t('error.deleteFailed'));
      console.error('Error deleting pricing:', error);
    }
  };

  const handleToggleWilayaStatus = async (wilaya, isActive) => {
    try {
      await deliveryPricingService.toggleWilayaStatus(wilaya.id, isActive);
      message.success(t(`success.${isActive ? 'activated' : 'deactivated'}`));
      fetchData();
    } catch (error) {
      message.error(t('error.updateFailed'));
      console.error('Error toggling wilaya status:', error);
    }
  };

  const handleViewDetails = (wilaya) => {
    setSelectedWilaya(wilaya);
    setDetailsModalVisible(true);
  };

  const getDeliveryTypeColor = (type) => {
    const colors = {
      home: 'blue',
      office: 'green',
      pickup_point: 'orange'
    };
    return colors[type] || 'default';
  };

  const getDeliveryTypeIcon = (type) => {
    const icons = {
      home: <HomeOutlined style={{ color: '#1890ff' }} />,
      office: <BankOutlined style={{ color: '#52c41a' }} />,
      pickup_point: <ShopOutlined style={{ color: '#fa8c16' }} />
    };
    return icons[type] || <TruckOutlined />;
  };

  const columns = [
    {
      title: t('delivery.wilaya'),
      key: 'wilaya',
      width: 200,
      fixed: 'left',
      render: (_, wilaya) => (
        <div>
          <Badge 
            status={wilaya.is_active ? 'success' : 'default'} 
            text={
              <span style={{ fontWeight: 'bold' }}>
                {wilaya.code} - {wilaya.name_en}
              </span>
            }
          />
          <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
            {wilaya.name_ar}
          </div>
        </div>
      ),
    },
    {
      title: t('delivery.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive, wilaya) => (
        <Switch
          size="small"
          checked={isActive}
          onChange={(checked) => handleToggleWilayaStatus(wilaya, checked)}
        />
      ),
    },
    {
      title: t('delivery.pricingOptions'),
      key: 'pricing_options',
      render: (_, wilaya) => (
        <div>
          {wilaya.pricing_options && wilaya.pricing_options.length > 0 ? (
            <Space size="small" wrap>
              {wilaya.pricing_options.map((pricing, index) => (
                <Tag 
                  key={index}
                  color={getDeliveryTypeColor(pricing.delivery_type)}
                  style={{ margin: '2px', cursor: 'pointer' }}
                  onClick={() => handleEdit(wilaya, pricing)}
                >
                  {getDeliveryTypeIcon(pricing.delivery_type)}
                  <span style={{ marginLeft: '4px' }}>
                    {pricing.base_price} DA
                  </span>
                </Tag>
              ))}
            </Space>
          ) : (
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description={t('delivery.noPricing')}
              style={{ margin: '8px 0' }}
            />
          )}
        </div>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, wilaya) => (
        <Space size="small">
          <Tooltip title={t('delivery.addPricing')}>
            <Button
              type="primary"
              ghost
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleCreate(wilaya)}
            />
          </Tooltip>
          <Tooltip title={t('delivery.viewDetails')}>
            <Button
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => handleViewDetails(wilaya)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 8px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Row justify="space-between" align="middle">
          <Col xs={24} sm={12}>
            <Title level={2} style={{ margin: 0 }}>
              <TruckOutlined /> {t('delivery.managePricing')}
            </Title>
          </Col>
          <Col xs={24} sm={12} style={{ textAlign: 'right', marginTop: '8px' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
              size="large"
            >
              {t('common.refresh')}
            </Button>
          </Col>
        </Row>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('delivery.totalWilayas')}
              value={stats.total_wilayas || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ fontSize: '20px' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('delivery.activeWilayas')}
              value={stats.active_wilayas || 0}
              prefix={<TruckOutlined />}
              valueStyle={{ fontSize: '20px', color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('delivery.avgPrice')}
              value={stats.avg_base_price || 0}
              suffix="DA"
              precision={0}
              valueStyle={{ fontSize: '20px', color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={t('delivery.pricingRules')}
              value={stats.total_pricing_rules || 0}
              valueStyle={{ fontSize: '20px', color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Info Alert */}
      <Alert
        message={t('delivery.info')}
        description={t('delivery.infoDescription')}
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
        closable
      />

      {/* Main Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={wilayas}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              t('common.pagination', { start: range[0], end: range[1], total }),
            responsive: true
          }}
          scroll={{ x: 600 }}
        />
      </Card>

      {/* Details Modal */}
      <Modal
        title={
          <span>
            <InfoCircleOutlined /> {t('delivery.wilayaDetails')} - {selectedWilaya?.name_en}
          </span>
        }
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            {t('common.close')}
          </Button>
        ]}
        width={700}
      >
        {selectedWilaya && (
          <div>
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col span={12}>
                <Card size="small" title={t('delivery.wilayaInfo')}>
                  <p><strong>{t('delivery.code')}:</strong> {selectedWilaya.code}</p>
                  <p><strong>{t('delivery.nameEn')}:</strong> {selectedWilaya.name_en}</p>
                  <p><strong>{t('delivery.nameAr')}:</strong> {selectedWilaya.name_ar}</p>
                  <p><strong>{t('delivery.nameFr')}:</strong> {selectedWilaya.name_fr}</p>
                  <p><strong>{t('common.status')}:</strong> 
                    <Badge 
                      status={selectedWilaya.is_active ? 'success' : 'error'} 
                      text={selectedWilaya.is_active ? t('common.active') : t('common.inactive')}
                      style={{ marginLeft: '8px' }}
                    />
                  </p>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title={t('delivery.quickActions')}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />} 
                      onClick={() => {
                        setDetailsModalVisible(false);
                        handleCreate(selectedWilaya);
                      }}
                      block
                    >
                      {t('delivery.addPricing')}
                    </Button>
                    <Button 
                      icon={selectedWilaya.is_active ? <DeleteOutlined /> : <PlusOutlined />}
                      onClick={() => {
                        handleToggleWilayaStatus(selectedWilaya, !selectedWilaya.is_active);
                        setDetailsModalVisible(false);
                      }}
                      block
                      danger={selectedWilaya.is_active}
                    >
                      {selectedWilaya.is_active ? t('common.deactivate') : t('common.activate')}
                    </Button>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card size="small" title={t('delivery.pricingOptions')}>
              {selectedWilaya.pricing_options && selectedWilaya.pricing_options.length > 0 ? (
                <Tabs
                  items={selectedWilaya.pricing_options.map((pricing, index) => ({
                    key: index.toString(),
                    label: (
                      <span>
                        {getDeliveryTypeIcon(pricing.delivery_type)}
                        <span style={{ marginLeft: '8px' }}>
                          {t(`delivery.types.${pricing.delivery_type}`)}
                        </span>
                      </span>
                    ),
                    children: (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <div><strong>{t('delivery.basePrice')}:</strong> {pricing.base_price} DA</div>
                            <div><strong>{t('delivery.weightThreshold')}:</strong> {pricing.weight_threshold} kg</div>
                            <div><strong>{t('delivery.additionalWeightPrice')}:</strong> {pricing.additional_weight_price} DA/kg</div>
                          </Space>
                        </Col>
                        <Col span={12}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <div><strong>{t('delivery.deliveryTime')}:</strong> {pricing.delivery_time_min}-{pricing.delivery_time_max} hours</div>
                            <div><strong>{t('delivery.priority')}:</strong> {pricing.priority}</div>
                            {pricing.notes && <div><strong>{t('delivery.notes')}:</strong> {pricing.notes}</div>}
                          </Space>
                        </Col>
                        <Col span={24} style={{ marginTop: '16px' }}>
                          <Space>
                            <Button 
                              type="primary" 
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => {
                                setDetailsModalVisible(false);
                                handleEdit(selectedWilaya, pricing);
                              }}
                            >
                              {t('common.edit')}
                            </Button>
                            <Popconfirm
                              title={t('common.confirmDelete')}
                              onConfirm={() => {
                                handleDelete(selectedWilaya, pricing);
                                setDetailsModalVisible(false);
                              }}
                              okText={t('common.yes')}
                              cancelText={t('common.no')}
                            >
                              <Button 
                                danger 
                                size="small"
                                icon={<DeleteOutlined />}
                              >
                                {t('common.delete')}
                              </Button>
                            </Popconfirm>
                          </Space>
                        </Col>
                      </Row>
                    )
                  }))}
                />
              ) : (
                <Empty 
                  description={t('delivery.noPricing')}
                  style={{ padding: '40px 0' }}
                />
              )}
            </Card>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={
          <span>
            <EditOutlined /> {t('delivery.editPricing')}
          </span>
        }
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Alert
            message={`${selectedWilaya?.name_en} - ${t(`delivery.types.${selectedPricing?.delivery_type}`)}`}
            type="info"
            style={{ marginBottom: '16px' }}
          />

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="base_price"
                label={t('delivery.basePrice')}
                rules={[{ required: true, message: t('validation.required') }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  addonAfter="DA"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="weight_threshold"
                label={t('delivery.weightThreshold')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.1}
                  addonAfter="kg"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="additional_weight_price"
                label={t('delivery.additionalWeightPrice')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  addonAfter="DA/kg"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="priority"
                label={t('delivery.priority')}
              >
                <Select size="large">
                  <Option value={1}>🔴 {t('delivery.priorities.high')}</Option>
                  <Option value={2}>🟡 {t('delivery.priorities.normal')}</Option>
                  <Option value={3}>🟢 {t('delivery.priorities.low')}</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item
                name="delivery_time_min"
                label={t('delivery.minTime')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  addonAfter="h"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item
                name="delivery_time_max"
                label={t('delivery.maxTime')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  addonAfter="h"
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="notes"
                label={t('delivery.notes')}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row justify="end" gutter={8} style={{ marginTop: '16px' }}>
            <Col>
              <Button size="large" onClick={() => setEditModalVisible(false)}>
                {t('common.cancel')}
              </Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" size="large">
                {t('common.update')}
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Create Modal */}
      <Modal
        title={
          <span>
            <PlusOutlined /> {t('delivery.addPricing')}
          </span>
        }
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreatePricing}
        >
          <Form.Item name="wilaya_id" hidden>
            <Input />
          </Form.Item>

          <Alert
            message={selectedWilaya?.name_en}
            type="info"
            style={{ marginBottom: '16px' }}
          />

          <Form.Item
            name="delivery_type"
            label={t('delivery.type')}
            rules={[{ required: true, message: t('validation.required') }]}
          >
            <Select size="large" placeholder={t('delivery.selectType')}>
              <Option value="home">
                <HomeOutlined /> {t('delivery.types.home')}
              </Option>
              <Option value="office">
                <BankOutlined /> {t('delivery.types.office')}
              </Option>
              <Option value="pickup_point">
                <ShopOutlined /> {t('delivery.types.pickup_point')}
              </Option>
            </Select>
          </Form.Item>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="base_price"
                label={t('delivery.basePrice')}
                rules={[{ required: true, message: t('validation.required') }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  addonAfter="DA"
                  size="large"
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="weight_threshold"
                label={t('delivery.weightThreshold')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.1}
                  addonAfter="kg"
                  size="large"
                  placeholder="1.0"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="additional_weight_price"
                label={t('delivery.additionalWeightPrice')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  addonAfter="DA/kg"
                  size="large"
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="priority"
                label={t('delivery.priority')}
              >
                <Select size="large" placeholder={t('delivery.selectPriority')}>
                  <Option value={1}>🔴 {t('delivery.priorities.high')}</Option>
                  <Option value={2}>🟡 {t('delivery.priorities.normal')}</Option>
                  <Option value={3}>🟢 {t('delivery.priorities.low')}</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item
                name="delivery_time_min"
                label={t('delivery.minTime')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  addonAfter="h"
                  size="large"
                  placeholder="24"
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item
                name="delivery_time_max"
                label={t('delivery.maxTime')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  addonAfter="h"
                  size="large"
                  placeholder="72"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="notes"
                label={t('delivery.notes')}
              >
                <Input.TextArea rows={2} placeholder={t('delivery.notesPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <Row justify="end" gutter={8} style={{ marginTop: '16px' }}>
            <Col>
              <Button size="large" onClick={() => setCreateModalVisible(false)}>
                {t('common.cancel')}
              </Button>
            </Col>
            <Col>
              <Button type="primary" htmlType="submit" size="large">
                {t('common.create')}
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default DeliveryPricing;
