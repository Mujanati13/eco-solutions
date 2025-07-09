import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Popconfirm,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  ShopOutlined,
  AppstoreOutlined,
  BranchesOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import stockService from '../../services/stockService'
import categoryService from '../../services/categoryService'
import ProductVariants from '../../components/ProductVariants'
import './Products.css'

const { Search } = Input
const { Option } = Select

const Products = () => {
  const { t } = useTranslation()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [variantsModalVisible, setVariantsModalVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [totalProducts, setTotalProducts] = useState(0)
  const [activeProducts, setActiveProducts] = useState(0)
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const fetchProducts = async (search = '') => {
    setLoading(true)
    try {
      const params = {}
      if (search) {
        params.search = search
      }
      
      const data = await stockService.getProducts(params)
      setProducts(data.products || [])
      
      // Calculate statistics
      const total = data.products?.length || 0
      const active = data.products?.filter(p => p.is_active)?.length || 0
      const value = data.products?.reduce((sum, p) => sum + ((Number(p.cost_price) || 0) * (Number(p.current_stock) || 0)), 0) || 0
      
      setTotalProducts(total)
      setActiveProducts(active)
      setTotalValue(value)
    } catch (error) {
      console.error('Error fetching products:', error)
      message.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const flatCategories = await categoryService.getFlatCategories()
      setCategories(flatCategories)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleSearch = (value) => {
    setSearchText(value)
    fetchProducts(value)
  }

  const showModal = (product = null) => {
    setEditingProduct(product)
    setModalVisible(true)
    if (product) {
      form.setFieldsValue({
        ...product,
        is_active: product.is_active || false,
        // Handle both old and new field names for backward compatibility
        minimum_stock_level: product.minimum_stock_level || product.minimum_stock,
        maximum_stock_level: product.maximum_stock_level || product.maximum_stock,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ is_active: true })
    }
  }

  const handleCancel = () => {
    setModalVisible(false)
    setEditingProduct(null)
    form.resetFields()
  }

  const handleSubmit = async (values) => {
    try {
      if (editingProduct) {
        await stockService.updateProduct(editingProduct.id, values)
        message.success(t('common.success'))
      } else {
        await stockService.createProduct(values)
        message.success(t('common.success'))
      }
      setModalVisible(false)
      setEditingProduct(null)
      form.resetFields()
      fetchProducts(searchText)
    } catch (error) {
      console.error('Error saving product:', error)
      message.error(error.message || t('common.error'))
    }
  }

  const handleDelete = async (id) => {
    try {
      await stockService.deleteProduct(id)
      message.success(t('common.success'))
      fetchProducts(searchText)
    } catch (error) {
      console.error('Error deleting product:', error)
      message.error(error.message || t('common.error'))
    }
  }

  const handleShowVariants = (product) => {
    setSelectedProduct(product)
    setVariantsModalVisible(true)
  }

  const columns = [
    {
      title: t('stock.productSKU'),
      dataIndex: 'sku',
      key: 'sku',
      sorter: (a, b) => a.sku.localeCompare(b.sku),
    },
    {
      title: t('stock.productName'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t('stock.productDescription'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('stock.productCategory'),
      dataIndex: 'category_name',
      key: 'category_name',
      render: (categoryName) => categoryName || '-',
      filters: [...new Set(products.map(p => p.category_name).filter(Boolean))].map(cat => ({
        text: cat,
        value: cat,
      })),
      onFilter: (value, record) => record.category_name === value,
    },
    {
      title: t('stock.productPrice'),
      dataIndex: 'selling_price',
      key: 'selling_price',
      render: (price) => price ? `${Number(price).toFixed(2)} DA` : '-',
      sorter: (a, b) => (a.selling_price || 0) - (b.selling_price || 0),
    },
    {
      title: t('stock.productCost'),
      dataIndex: 'cost_price',
      key: 'cost_price',
      render: (price) => price ? `${Number(price).toFixed(2)} DA` : '-',
      sorter: (a, b) => (a.cost_price || 0) - (b.cost_price || 0),
    },
    {
      title: t('stock.currentStock'),
      dataIndex: 'current_stock',
      key: 'current_stock',
      render: (stock, record) => {
        const isLow = stock <= (record.minimum_stock_level || 0)
        return (
          <Tag color={isLow ? 'red' : stock > 0 ? 'green' : 'orange'}>
            {stock || 0}
          </Tag>
        )
      },
      sorter: (a, b) => (a.current_stock || 0) - (b.current_stock || 0),
    },
    {
      title: t('stock.minimumStock'),
      dataIndex: 'minimum_stock_level',
      key: 'minimum_stock_level',
      render: (stock) => stock || '-',
      sorter: (a, b) => (a.minimum_stock_level || 0) - (b.minimum_stock_level || 0),
    },
    {
      title: t('stock.maximumStock'),
      dataIndex: 'maximum_stock_level',
      key: 'maximum_stock_level',
      render: (stock) => stock || '-',
      sorter: (a, b) => (a.maximum_stock_level || 0) - (b.maximum_stock_level || 0),
    },
    {
      title: t('stock.productActive'),
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? t('common.yes') : t('common.no')}
        </Tag>
      ),
      filters: [
        { text: t('common.yes'), value: true },
        { text: t('common.no'), value: false },
      ],
      onFilter: (value, record) => record.is_active === value,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title={t('variants.manageVariants')}>
            <Button
              type="default"
              size="small"
              icon={<BranchesOutlined />}
              onClick={() => handleShowVariants(record)}
            />
          </Tooltip>
          <Tooltip title={t('common.edit')}>
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => showModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t('common.confirmDelete')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Tooltip title={t('common.delete')}>
              <Button
                type="primary"
                danger
                size="small"
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="products-page">
      <Card>
        <Row justify="space-between" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <Search
                placeholder={t('common.search')}
                allowClear
                onSearch={handleSearch}
                style={{ width: 300 }}
                enterButton={<SearchOutlined />}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchProducts(searchText)}
                loading={loading}
              >
                {t('common.refresh')}
              </Button>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              {t('stock.addProduct')}
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={products}
          rowKey="id"
          loading={loading}
          size='small'
          pagination={{
            total: products.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} ${t('common.of')} ${total} ${t('common.items')}`,
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title={editingProduct ? t('stock.editProduct') : t('stock.addProduct')}
        open={modalVisible}
        onCancel={handleCancel}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ is_active: true }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sku"
                label={t('stock.productSKU')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Input placeholder={t('stock.productSKU')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="barcode"
                label={t('stock.productBarcode')}
              >
                <Input placeholder={t('stock.productBarcode')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="name"
            label={t('stock.productName')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input placeholder={t('stock.productName')} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('stock.productDescription')}
          >
            <Input.TextArea
              placeholder={t('stock.productDescription')}
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="category_id"
            label={t('stock.productCategory')}
          >
            <Select
              placeholder={t('stock.selectCategory')}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {categories.map(category => (
                <Option key={category.id} value={category.id}>
                  {category.indent}{category.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="cost_price"
                label={t('stock.productCost')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('stock.productCost')}
                  min={0}
                  precision={2}
                  addonAfter="DA"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="selling_price"
                label={t('stock.productPrice')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('stock.productPrice')}
                  min={0}
                  precision={2}
                  addonAfter="DA"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="minimum_stock_level"
                label={t('stock.minimumStock')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('stock.minimumStock')}
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maximum_stock_level"
                label={t('stock.maximumStock')}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('stock.maximumStock')}
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="is_active"
            label={t('stock.productActive')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingProduct ? t('common.save') : t('common.submit')}
              </Button>
              <Button onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <ProductVariants
        product={selectedProduct}
        visible={variantsModalVisible}
        onClose={() => setVariantsModalVisible(false)}
      />
    </div>
  )
}

export default Products
