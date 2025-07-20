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
  ShoppingCartOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import stockService from '../../services/stockService'
import categoryService from '../../services/categoryService'
import orderProductService from '../../services/orderProductService'
import ProductVariants from '../../components/ProductVariants'
import './Products.css'

const { Search } = Input
const { Option } = Select

const Products = () => {
  const { t } = useTranslation()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [productsWithOrders, setProductsWithOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [variantsModalVisible, setVariantsModalVisible] = useState(false)
  const [orderDetailsModalVisible, setOrderDetailsModalVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedProductOrders, setSelectedProductOrders] = useState(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [totalProducts, setTotalProducts] = useState(0)
  const [activeProducts, setActiveProducts] = useState(0)
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchProductsWithOrders()
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

  const fetchProductsWithOrders = async () => {
    try {
      const response = await orderProductService.getProductsWithOrders()
      setProductsWithOrders(response.data || [])
    } catch (error) {
      console.error('Error fetching products with orders:', error)
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
      fetchProductsWithOrders() // Refresh order data too
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

  const handleShowOrderDetails = async (product) => {
    try {
      setSelectedProduct(product)
      
      // Get detailed order information for this product
      const response = await orderProductService.getProductOrders(product.id)
      setSelectedProductOrders(response.data)
      setOrderDetailsModalVisible(true)
    } catch (error) {
      console.error('Error fetching product orders:', error)
      message.error(t('common.error'))
    }
  }

  // Helper function to get order info for a product
  const getProductOrderInfo = (productId) => {
    const productOrderData = productsWithOrders.find(p => p.product_id === productId)
    return productOrderData || { total_orders: 0, total_quantity_sold: 0, total_revenue: 0 }
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
        const stockLevel = stock || 0;
        let color = 'green';
        let alertText = '';
        
        if (stockLevel === 0) {
          color = 'red';
          alertText = t('stock.outOfStock');
        } else if (stockLevel <= 5) {
          color = 'orange';
          alertText = t('stock.lowStock');
        } else if (stockLevel <= 10) {
          color = 'gold';
          alertText = t('stock.mediumStock');
        }
        
        return (
          <div>
            <Tag color={color}>
              {stockLevel}
            </Tag>
            {alertText && (
              <div style={{ fontSize: '11px', color: color === 'red' ? '#ff4d4f' : color === 'orange' ? '#fa8c16' : '#faad14' }}>
                {alertText}
              </div>
            )}
          </div>
        );
      },
      sorter: (a, b) => (a.current_stock || 0) - (b.current_stock || 0),
      filters: [
        { text: t('stock.outOfStock'), value: 'out_of_stock' },
        { text: t('stock.lowStock'), value: 'low_stock' },
        { text: t('stock.mediumStock'), value: 'medium_stock' },
        { text: t('stock.inStock'), value: 'in_stock' },
      ],
      onFilter: (value, record) => {
        const stock = record.current_stock || 0;
        switch (value) {
          case 'out_of_stock':
            return stock === 0;
          case 'low_stock':
            return stock > 0 && stock <= 5;
          case 'medium_stock':
            return stock > 5 && stock <= 10;
          case 'in_stock':
            return stock > 10;
          default:
            return true;
        }
      },
    },
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          <ShoppingCartOutlined style={{ marginRight: 4 }} />
          {t('stock.orderInfo')}
        </div>
      ),
      key: 'order_info',
      align: 'center',
      render: (_, record) => {
        const orderInfo = getProductOrderInfo(record.id)
        const hasOrders = orderInfo.total_orders > 0
        
        if (!hasOrders) {
          return (
            <div style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>
              <div style={{ marginBottom: 2 }}>
                <ShoppingCartOutlined style={{ opacity: 0.3 }} />
              </div>
              <div>{t('stock.noOrders')}</div>
            </div>
          )
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <Tooltip title={`${orderInfo.total_orders} ${t('stock.ordersPlaced')}`}>
              <Tag 
                color="blue" 
                style={{ 
                  margin: 0, 
                  fontSize: '11px', 
                  fontWeight: '500',
                  borderRadius: '8px',
                  padding: '2px 6px'
                }}
              >
                📦 {orderInfo.total_orders}
              </Tag>
            </Tooltip>
            
            <Tooltip title={`${orderInfo.total_quantity_sold} ${t('stock.unitsSold')}`}>
              <Tag 
                color="green" 
                style={{ 
                  margin: 0, 
                  fontSize: '11px', 
                  fontWeight: '500',
                  borderRadius: '8px',
                  padding: '2px 6px'
                }}
              >
                ✅ {orderInfo.total_quantity_sold}
              </Tag>
            </Tooltip>
            
            <Tooltip title={`${Number(orderInfo.total_revenue || 0).toFixed(2)} DA ${t('stock.totalRevenue')}`}>
              <Tag 
                color="gold" 
                style={{ 
                  margin: 0, 
                  fontSize: '11px', 
                  fontWeight: '500',
                  borderRadius: '8px',
                  padding: '2px 6px'
                }}
              >
                💰 {Number(orderInfo.total_revenue || 0) >= 1000 
                  ? `${(Number(orderInfo.total_revenue || 0) / 1000).toFixed(1)}K` 
                  : Number(orderInfo.total_revenue || 0).toFixed(0)} DA
              </Tag>
            </Tooltip>
          </div>
        );
      },
      width: 140,
      sorter: (a, b) => {
        const aInfo = getProductOrderInfo(a.id)
        const bInfo = getProductOrderInfo(b.id)
        return (aInfo.total_orders || 0) - (bInfo.total_orders || 0)
      },
      filters: [
        { text: t('stock.hasOrders'), value: 'has_orders' },
        { text: t('stock.noOrders'), value: 'no_orders' },
        { text: t('stock.topSellers'), value: 'top_sellers' },
      ],
      onFilter: (value, record) => {
        const orderInfo = getProductOrderInfo(record.id)
        switch (value) {
          case 'has_orders':
            return orderInfo.total_orders > 0
          case 'no_orders':
            return orderInfo.total_orders === 0
          case 'top_sellers':
            return orderInfo.total_quantity_sold >= 10
          default:
            return true
        }
      },
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
          <Tooltip title={t('stock.viewOrders')}>
            <Button
              type="default"
              size="small"
              icon={<ShoppingCartOutlined />}
              onClick={() => handleShowOrderDetails(record)}
            />
          </Tooltip>
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

          <Form.Item
            name="current_stock"
            label={t('stock.currentStock')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder={t('stock.currentStock')}
              min={0}
              precision={0}
            />
          </Form.Item>

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

      <Modal
        title={`${t('stock.orderDetails')} - ${selectedProduct?.name || ''}`}
        open={orderDetailsModalVisible}
        onCancel={() => setOrderDetailsModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedProductOrders && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic
                  title={t('stock.totalOrders')}
                  value={selectedProductOrders.total_orders}
                  prefix={<ShoppingCartOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t('stock.totalSold')}
                  value={selectedProductOrders.total_quantity_sold}
                  suffix={t('stock.units')}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t('stock.totalRevenue')}
                  value={selectedProductOrders.total_revenue}
                  suffix="DA"
                  precision={2}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title={t('stock.currentStock')}
                  value={selectedProductOrders.current_stock}
                  suffix={t('stock.units')}
                />
              </Col>
            </Row>

            <h4>{t('stock.recentOrders')}</h4>
            {selectedProductOrders.recent_orders && selectedProductOrders.recent_orders.length > 0 ? (
              <Table
                dataSource={selectedProductOrders.recent_orders}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: t('orders.orderNumber'),
                    dataIndex: 'order_number',
                    key: 'order_number',
                  },
                  {
                    title: t('stock.quantity'),
                    dataIndex: 'quantity',
                    key: 'quantity',
                    render: (quantity) => `${quantity} ${t('stock.units')}`,
                  },
                  {
                    title: t('orders.status'),
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => (
                      <Tag color={status === 'delivered' ? 'green' : status === 'cancelled' ? 'red' : 'orange'}>
                        {status}
                      </Tag>
                    ),
                  },
                  {
                    title: t('orders.orderDate'),
                    dataIndex: 'order_date',
                    key: 'order_date',
                    render: (date) => new Date(date).toLocaleDateString(),
                  },
                ]}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                {t('stock.noOrdersFound')}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Products
