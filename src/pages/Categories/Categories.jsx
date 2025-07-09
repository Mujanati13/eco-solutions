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
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  FileOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import categoryService from '../../services/categoryService';
import { usePermissions } from '../../hooks/usePermissions';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

const Categories = () => {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form] = Form.useForm();

  // Permissions
  const canViewCategories = hasPermission('canViewProducts');
  const canEditCategories = hasPermission('canEditProducts');
  const canDeleteCategories = hasPermission('canDeleteProducts');

  useEffect(() => {
    if (canViewCategories) {
      fetchCategories();
    }
  }, [canViewCategories]);

  useEffect(() => {
    filterCategories();
  }, [searchTerm, categories]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryService.getCategories({ with_products: true });
      const flatCategories = await categoryService.getFlatCategories();
      setCategories(flatCategories);
    } catch (error) {
      message.error(t('common.failedToFetch'));
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCategories = () => {
    if (!searchTerm) {
      setFilteredCategories(categories);
      return;
    }

    const filtered = categories.filter(category =>
      category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredCategories(filtered);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    form.resetFields();
    form.setFieldsValue({
      is_active: true,
      sort_order: 0
    });
    setModalVisible(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    form.setFieldsValue({
      ...category,
      parent_id: category.parent_id || undefined
    });
    setModalVisible(true);
  };

  const handleDelete = async (category) => {
    try {
      await categoryService.deleteCategory(category.id);
      message.success(t('common.deleted'));
      fetchCategories();
    } catch (error) {
      message.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleSave = async (values) => {
    try {
      if (editingCategory) {
        await categoryService.updateCategory(editingCategory.id, values);
        message.success(t('common.updated'));
      } else {
        await categoryService.createCategory(values);
        message.success(t('common.created'));
      }
      setModalVisible(false);
      fetchCategories();
    } catch (error) {
      message.error(error.message || t('common.saveFailed'));
    }
  };

  const getParentOptions = () => {
    return categories
      .filter(cat => cat.level < 3) // Limit to 3 levels
      .map(cat => ({
        value: cat.id,
        label: `${cat.indent}${cat.name}`,
        disabled: editingCategory && cat.id === editingCategory.id
      }));
  };

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <span style={{ marginLeft: record.level * 25 }}>
            {record.level > 0 && <Text type="secondary">└─ </Text>}
            {record.children && record.children.length > 0 ? (
              <FolderOutlined  style={{ color: '#1890ff'  }} />
            ) : (
              <FileOutlined style={{ color: '#52c41a' }} />
            )}
            <Text strong={record.level === 0}>{text}</Text>
          </span>
        </Space>
      ),
      width: '30%',
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || <Text type="secondary">-</Text>,
    },
    {
      title: t('navigation.products'),
      dataIndex: 'products_count',
      key: 'products_count',
      width: 120,
      align: 'center',
      render: (count) => (
        <Tag color={count > 0 ? 'blue' : 'default'}>
          {count || 0}
        </Tag>
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
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space>
          {canEditCategories && (
            <Tooltip title={t('common.edit')}>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                size="small"
              />
            </Tooltip>
          )}
          {canDeleteCategories && (
            <Popconfirm
              title={t('common.confirmDelete')}
              onConfirm={() => handleDelete(record)}
              disabled={record.products_count > 0}
            >
              <Tooltip title={
                record.products_count > 0 
                  ? t('categories.cannotDeleteWithProducts')
                  : t('common.delete')
              }>
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  danger
                  size="small"
                  disabled={record.products_count > 0}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (!canViewCategories) {
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
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          {canEditCategories && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              {t('categories.createCategory')}
            </Button>
          )}
        </Col>
      </Row>

      <Card>
        <Row style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Search
              placeholder={t('common.search')}
              allowClear
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={16} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchCategories}
              loading={loading}
            >
              {t('common.refresh')}
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredCategories}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} ${t('common.of')} ${total} ${t('common.items')}`
          }}
          size="small"
        />
      </Card>

      <Modal
        title={editingCategory ? t('categories.editCategory') : t('categories.createCategory')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{ is_active: true, sort_order: 0 }}
        >
          <Form.Item
            name="name"
            label={t('common.name')}
            rules={[
              { required: true, message: t('validation.required') },
              { min: 2, message: t('validation.minLength', { min: 2 }) }
            ]}
          >
            <Input placeholder={t('categories.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('common.description')}
          >
            <Input.TextArea
              rows={3}
              placeholder={t('categories.descriptionPlaceholder')}
            />
          </Form.Item>

          <Form.Item
            name="parent_id"
            label={t('categories.parentCategory')}
          >
            <Select
              placeholder={t('categories.selectParent')}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {getParentOptions().map(option => (
                <Option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sort_order"
                label={t('categories.sortOrder')}
              >
                <InputNumber
                  min={0}
                  placeholder="0"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
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
            </Col>
          </Row>

          <Form.Item
            name="image_url"
            label={t('categories.imageUrl')}
          >
            <Input placeholder="https://example.com/image.jpg" />
          </Form.Item>

          <Divider />

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit">
                {editingCategory ? t('common.update') : t('common.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Categories;
