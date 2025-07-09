import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  message,
  Popconfirm,
  Tag,
  Tooltip,
  Row,
  Col,
  Typography,
  Alert,
  Divider,
  Tabs,
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  BarcodeOutlined,
  DollarOutlined,
  InboxOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import variantService from '../services/variantService';
import { usePermissions } from '../hooks/usePermissions';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const ProductVariants = ({ product, visible, onClose }) => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [viewingVariant, setViewingVariant] = useState(null);
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Permissions
  const canViewVariants = hasPermission('canViewProducts');
  const canEditVariants = hasPermission('canEditProducts');
  const canDeleteVariants = hasPermission('canDeleteProducts');

  useEffect(() => {
    if (visible && product && canViewVariants) {
      fetchVariants();
    }
  }, [visible, product, canViewVariants]);

  const fetchVariants = async () => {
    try {
      setLoading(true);
      const response = await variantService.getVariantsByProduct(product.id, { with_stock: true });
      setVariants(response.data.variants);
    } catch (error) {
      message.error(t('common.error.fetchFailed'));
      console.error('Error fetching variants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingVariant(null);
    form.resetFields();
    form.setFieldsValue({
      product_id: product.id,
      is_active: true,
      sku: variantService.generateSku(product.sku, 'VAR'),
      cost_price: product.cost_price || 0,
      selling_price: product.selling_price || 0
    });
    setModalVisible(true);
  };

  const handleEdit = (variant) => {
    setEditingVariant(variant);
    form.setFieldsValue({
      ...variant,
      attributes: variant.attributes ? JSON.parse(variant.attributes) : {}
    });
    setModalVisible(true);
  };

  const handleView = async (variant) => {
    try {
      const response = await variantService.getVariant(variant.id);
      setViewingVariant(response.data.variant);
      setStockModalVisible(true);
    } catch (error) {
      message.error(t('common.error.fetchFailed'));
    }
  };

  const handleDelete = async (variant) => {
    try {
      await variantService.deleteVariant(variant.id);
      message.success(t('common.success.deleted'));
      fetchVariants();
    } catch (error) {
      message.error(error.message || t('common.error.deleteFailed'));
    }
  };

  const handleSave = async (values) => {
    try {
      // Validate variant data
      const errors = variantService.validateVariant(values);
      if (errors.length > 0) {
        message.error(errors.join(', '));
        return;
      }

      if (editingVariant) {
        await variantService.updateVariant(editingVariant.id, values);
        message.success(t('common.success.updated'));
      } else {
        await variantService.createVariant(values);
        message.success(t('common.success.created'));
      }
      setModalVisible(false);
      fetchVariants();
    } catch (error) {
      message.error(error.message || t('common.error.saveFailed'));
    }
  };

  const generateSku = () => {
    const variantName = form.getFieldValue('variant_name');
    if (variantName) {
      const newSku = variantService.generateSku(product.sku, variantName);
      form.setFieldsValue({ sku: newSku });
    }
  };

  const columns = [
    {
      title: t('variants.variantName'),
      dataIndex: 'variant_name',
      key: 'variant_name',
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          {record.color && <Tag color={record.color}>{record.color}</Tag>}
          {record.size && <Tag>{record.size}</Tag>}
        </Space>
      ),
    },
    {
      title: t('variants.sku'),
      dataIndex: 'sku',
      key: 'sku',
      render: (text) => (
        <Space>
          <BarcodeOutlined />
          <Text code>{text}</Text>
        </Space>
      ),
    },
    {
      title: t('variants.prices'),
      key: 'prices',
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Text>
            <DollarOutlined /> {t('variants.cost')}: {record.cost_price}
          </Text>
          <Text>
            <DollarOutlined /> {t('variants.selling')}: {record.selling_price}
          </Text>
        </Space>
      ),
    },
    {
      title: t('variants.stock'),
      dataIndex: 'total_stock',
      key: 'total_stock',
      align: 'center',
      render: (stock) => (
        <Badge
          count={stock || 0}
          style={{
            backgroundColor: stock > 0 ? '#52c41a' : '#f5222d'
          }}
        />
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      align: 'center',
      render: (is_active) => (
        <Tag color={is_active ? 'success' : 'default'}>
          {is_active ? t('common.active') : t('common.inactive')}
        </Tag>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title={t('common.view')}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
              size="small"
            />
          </Tooltip>
          {canEditVariants && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                size="small"
              />
            </Tooltip>
          )}
          {canDeleteVariants && (
            <Popconfirm
              title={t('common.confirmDelete')}
              onConfirm={() => handleDelete(record)}
            >
              <Tooltip title={t('common.delete')}>
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                  size="small"
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (!canViewVariants) {
    return (
      <Alert
        message={t('common.accessDenied')}
        description={t('common.noPermission')}
        type="warning"
        showIcon
      />
    );
  }

  return (
    <>
      <Modal
        title={`${t('variants.title')} - ${product?.name}`}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Text type="secondary">{t('variants.description')}</Text>
            </Col>
            <Col>
              {canEditVariants && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                >
                  {t('variants.createVariant')}
                </Button>
              )}
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={variants}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} ${t('common.of')} ${total} ${t('common.items')}`
          }}
          size="small"
        />
      </Modal>

      {/* Create/Edit Variant Modal */}
      <Modal
        title={editingVariant ? t('variants.editVariant') : t('variants.createVariant')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{ is_active: true }}
        >
          <Form.Item name="product_id" hidden>
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="variant_name"
                label={t('variants.variantName')}
                rules={[
                  { required: true, message: t('validation.required') },
                  { min: 2, message: t('validation.minLength', { min: 2 }) }
                ]}
              >
                <Input
                  placeholder={t('variants.variantNamePlaceholder')}
                  onBlur={generateSku}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sku"
                label={t('variants.sku')}
                rules={[
                  { required: true, message: t('validation.required') },
                  { min: 2, message: t('validation.minLength', { min: 2 }) }
                ]}
              >
                <Input placeholder={t('variants.skuPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="cost_price"
                label={t('variants.costPrice')}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="selling_price"
                label={t('variants.sellingPrice')}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="color"
                label={t('variants.color')}
              >
                <Input placeholder={t('variants.colorPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="size"
                label={t('variants.size')}
              >
                <Input placeholder={t('variants.sizePlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="weight"
                label={t('variants.weight')}
              >
                <InputNumber
                  min={0}
                  precision={3}
                  style={{ width: '100%' }}
                  placeholder="0.000"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="material"
                label={t('variants.material')}
              >
                <Input placeholder={t('variants.materialPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dimensions"
                label={t('variants.dimensions')}
              >
                <Input placeholder={t('variants.dimensionsPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="barcode"
            label={t('variants.barcode')}
          >
            <Input placeholder={t('variants.barcodePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="is_active"
            label={t('common.status')}
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t('common.active')}
              unCheckedChildren={t('common.inactive')}
            />
          </Form.Item>

          <Divider />

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit">
                {editingVariant ? t('common.update') : t('common.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* View Variant Stock Modal */}
      <Modal
        title={`${t('variants.stockLevels')} - ${viewingVariant?.variant_name}`}
        open={stockModalVisible}
        onCancel={() => setStockModalVisible(false)}
        footer={null}
        width={800}
      >
        {viewingVariant && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card size="small">
                  <Text strong>{t('variants.variantInfo')}</Text>
                  <br />
                  <Text>SKU: {viewingVariant.sku}</Text>
                  <br />
                  <Text>Cost: ${viewingVariant.cost_price}</Text>
                  <br />
                  <Text>Selling: ${viewingVariant.selling_price}</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <Text strong>{t('variants.attributes')}</Text>
                  <br />
                  <Text>Color: {viewingVariant.color || '-'}</Text>
                  <br />
                  <Text>Size: {viewingVariant.size || '-'}</Text>
                  <br />
                  <Text>Weight: {viewingVariant.weight || '-'}</Text>
                </Card>
              </Col>
            </Row>

            <Table
              columns={[
                {
                  title: t('stock.location'),
                  dataIndex: 'location_name',
                  key: 'location_name',
                },
                {
                  title: t('stock.quantity'),
                  dataIndex: 'quantity',
                  key: 'quantity',
                  align: 'center',
                },
                {
                  title: t('stock.reserved'),
                  dataIndex: 'reserved_quantity',
                  key: 'reserved_quantity',
                  align: 'center',
                },
                {
                  title: t('stock.available'),
                  dataIndex: 'available_quantity',
                  key: 'available_quantity',
                  align: 'center',
                  render: (qty) => (
                    <Tag color={qty > 0 ? 'success' : 'error'}>
                      {qty}
                    </Tag>
                  ),
                },
              ]}
              dataSource={viewingVariant.stock_levels || []}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        )}
      </Modal>
    </>
  );
};

export default ProductVariants;
