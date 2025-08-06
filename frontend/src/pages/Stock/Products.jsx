import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  Divider,
  Collapse,
  List,
  Dropdown,
  Menu,
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
  MinusCircleOutlined,
  LinkOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import stockService from '../../services/stockService'
import categoryService from '../../services/categoryService'
import orderProductService from '../../services/orderProductService'
import ProductVariants from '../../components/ProductVariants'
import './Products.css'

const { Search } = Input
const { Option } = Select
const { Panel } = Collapse

const Products = () => {
  const { t } = useTranslation()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
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
  const [quickVariants, setQuickVariants] = useState([])

  useEffect(() => {
    fetchProducts()
    fetchCategories()
    fetchLocations()
    fetchProductsWithOrders()
  }, [])

  // Debug locations state
  useEffect(() => {
    console.log('Locations state updated:', locations)
  }, [locations])

  const fetchProducts = async (search = '') => {
    setLoading(true)
    try {
      const params = {}
      if (search) {
        params.search = search
      }
      
      const data = await stockService.getProducts(params)
      console.log('Fetched products data:', data.products?.slice(0, 2)) // Log first 2 products for debugging
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

  const fetchLocations = async () => {
    try {
      console.log('Fetching locations...')
      const data = await stockService.getLocations()
      console.log('Locations data received:', data)
      setLocations(data || [])
    } catch (error) {
      console.error('Error fetching locations:', error)
      message.error(t('stock.errorFetchingLocations'))
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
      // Find the location name from location_id
      let locationName = '';
      if (product.location_id && locations.length > 0) {
        const location = locations.find(loc => loc.id == product.location_id);
        locationName = location ? location.name : '';
      }
      
      form.setFieldsValue({
        ...product,
        is_active: product.is_active || false,
        location: locationName, // Set the location name for the select
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ is_active: true })
    }
  }

  const handleCancel = () => {
    setModalVisible(false)
    setEditingProduct(null)
    setQuickVariants([])
    form.resetFields()
  }

  const handleAddQuickVariant = () => {
    const productName = form.getFieldValue('name') || 'Product'
    const productSku = form.getFieldValue('sku') || 'SKU'
    const costPrice = form.getFieldValue('cost_price') || 0
    const sellingPrice = form.getFieldValue('selling_price') || 0
    
    const newVariant = {
      id: Date.now(), // temporary ID for the UI
      variant_name: '',
      sku: `${productSku}-VAR${quickVariants.length + 1}`,
      cost_price: costPrice,
      selling_price: sellingPrice,
      current_stock: 0,
      color: '',
      size: '',
      is_active: true
    }
    
    setQuickVariants([...quickVariants, newVariant])
  }

  const handleRemoveQuickVariant = (variantId) => {
    setQuickVariants(quickVariants.filter(v => v.id !== variantId))
  }

  const handleQuickVariantChange = (variantId, field, value) => {
    setQuickVariants(quickVariants.map(variant => 
      variant.id === variantId 
        ? { ...variant, [field]: value }
        : variant
    ))
  }

  const handleSubmit = async (values) => {
    try {
      let productId
      
      // Map location name to location_id
      if (values.location) {
        const selectedLocation = locations.find(loc => loc.name === values.location)
        if (selectedLocation) {
          values.location_id = selectedLocation.id
        }
        delete values.location // Remove the name field
      }
      
      if (editingProduct) {
        await stockService.updateProduct(editingProduct.id, values)
        productId = editingProduct.id
        message.success(t('common.success'))
      } else {
        const result = await stockService.createProduct(values)
        productId = result.id || result.data?.id || result.product?.id
        message.success(t('common.success'))
      }

      // Create quick variants if any were added
      if (quickVariants.length > 0 && productId) {
        try {
          const variantService = await import('../../services/variantService')
          for (const variant of quickVariants) {
            if (variant.variant_name && variant.variant_name.trim()) {
              const variantData = {
                product_id: parseInt(productId),
                variant_name: variant.variant_name.trim(),
                sku: variant.sku,
                cost_price: parseFloat(variant.cost_price) || null,
                selling_price: parseFloat(variant.selling_price) || null,
                color: variant.color || null,
                size: variant.size || null,
                weight: null, // Ensure weight is null for quick variants
                is_active: variant.is_active,
                current_stock: parseInt(variant.current_stock) || 0,
                location_id: 1 // Default to main location
              }
              
              console.log('Creating variant with data:', variantData)
              await variantService.default.createVariant(variantData)
            }
          }
          if (quickVariants.some(v => v.variant_name && v.variant_name.trim())) {
            message.success(t('variants.quickVariantsCreated'))
          }
        } catch (variantError) {
          console.error('Error creating variants:', variantError)
          
          // Better error handling for variant creation
          let errorMessage = t('variants.productCreatedVariantsFailed');
          if (variantError && typeof variantError === 'object') {
            if (variantError.details && Array.isArray(variantError.details)) {
              const errorDetails = variantError.details.map(detail => 
                `${detail.field}: ${detail.message}`
              ).join(', ');
              errorMessage += `: ${errorDetails}`;
            } else if (variantError.message) {
              errorMessage += `: ${variantError.message}`;
            } else if (variantError.error) {
              errorMessage += `: ${variantError.error}`;
            }
          } else if (typeof variantError === 'string') {
            errorMessage += `: ${variantError}`;
          }
          
          message.error(errorMessage)
        }
      }

      setModalVisible(false)
      setEditingProduct(null)
      setQuickVariants([])
      form.resetFields()
      fetchProducts(searchText)
      fetchProductsWithOrders() // Refresh order data too
    } catch (error) {
      console.error('Error saving product:', error)
      
      // Better error handling for product creation/update
      let errorMessage = t('common.error');
      if (error && typeof error === 'object') {
        if (error.details && Array.isArray(error.details)) {
          const errorDetails = error.details.map(detail => 
            `${detail.field}: ${detail.message}`
          ).join(', ');
          errorMessage = `Validation Error: ${errorDetails}`;
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.error) {
          errorMessage = error.error;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      message.error(errorMessage)
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
  const getProductOrderInfo = useCallback((productId) => {
    const productOrderData = productsWithOrders.find(p => p.product_id === productId)
    return productOrderData || { total_orders: 0, total_quantity_sold: 0, total_revenue: 0 }
  }, [productsWithOrders])

  const columns = useMemo(() => {
    // Generate category filters from current products data
    const categoryFilters = products && products.length > 0 
      ? [...new Set(products.map(p => {
          // Handle both category_name and category fields
          const cat = p.category_name || p.category;
          return cat && String(cat).trim();
        }).filter(Boolean))].map(cat => ({
          text: cat,
          value: cat,
        }))
      : [];

    // Generate location filters from current locations data  
    const locationFilters = locations && locations.length > 0 
      ? locations.map(location => ({
          text: location.name,
          value: location.id,
        }))
      : [];

    console.log('Generated filters:', { 
      categoryFilters: categoryFilters.length, 
      locationFilters: locationFilters.length,
      productsCount: products?.length || 0,
      locationsCount: locations?.length || 0 
    });

    return [
    {
      title: t('stock.productSKU'),
      dataIndex: 'sku',
      key: 'sku',
      sorter: (a, b) => a.sku.localeCompare(b.sku),
      ellipsis: true,
    },
    {
      title: t('stock.productName'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      ellipsis: true,
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder={t('stock.searchByName')}
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              size="small"
              style={{ width: 90 }}
            >
              {t('common.search')}
            </Button>
            <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
              {t('common.reset')}
            </Button>
          </Space>
        </div>
      ),
      onFilter: (value, record) => {
        if (!value) return true;
        const searchTerm = value.toLowerCase();
        const name = (record.name || '').toLowerCase();
        const description = (record.description || '').toLowerCase();
        const sku = (record.sku || '').toLowerCase();
        
        return name.includes(searchTerm) || 
               description.includes(searchTerm) || 
               sku.includes(searchTerm);
      },
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
      ellipsis: true,
      render: (categoryName, record) => {
        const category = categoryName || record.category;
        return category || '-';
      },
      filters: categoryFilters,
      onFilter: (value, record) => {
        // Handle both category_name and category fields
        const category = record.category_name || record.category;
        if (!category || !value) return false;
        return String(category).trim() === String(value).trim();
      },
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
        // Handle both current_stock and total_stock, convert to number
        const stockLevel = parseInt(stock) || parseInt(record.total_stock) || 0;
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
      sorter: (a, b) => {
        const stockA = parseInt(a.current_stock) || parseInt(a.total_stock) || 0;
        const stockB = parseInt(b.current_stock) || parseInt(b.total_stock) || 0;
        return stockA - stockB;
      },
      filters: [
        { text: t('stock.outOfStock'), value: 'out_of_stock' },
        { text: t('stock.lowStock'), value: 'low_stock' },
        { text: t('stock.mediumStock'), value: 'medium_stock' },
        { text: t('stock.inStock'), value: 'in_stock' },
      ],
      onFilter: (value, record) => {
        const stock = parseInt(record.current_stock) || parseInt(record.total_stock) || 0;
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
      onFilter: (value, record) => {
        // Handle database boolean values (1/0, true/false, "1"/"0")
        const isActive = record.is_active === 1 || record.is_active === true || record.is_active === "1" || record.is_active === "true";
        return isActive === value;
      },
    },
    {
      title: t('stock.productLocation'),
      dataIndex: 'location_id',
      key: 'location_id',
      ellipsis: true,
      render: (locationId) => {
        if (!locationId) return '-';
        const location = locations.find(loc => loc.id == locationId);
        return location ? location.name : `ID: ${locationId}`;
      },
      filters: locationFilters,
      onFilter: (value, record) => {
        if (!record.location_id || record.location_id === null) return false;
        // Handle both string and number comparison from database
        return String(record.location_id) === String(value);
      },
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'viewOrders',
            icon: <ShoppingCartOutlined />,
            label: t('stock.viewOrders'),
            onClick: () => handleShowOrderDetails(record),
          },
          {
            key: 'manageVariants',
            icon: <BranchesOutlined />,
            label: t('variants.manageVariants'),
            onClick: () => handleShowVariants(record),
          },
        ];

        // Add external link action if external_link exists
        if (record.external_link) {
          menuItems.push({
            key: 'openExternalLink',
            icon: <LinkOutlined />,
            label: t('stock.openExternalLink'),
            onClick: () => window.open(record.external_link, '_blank'),
          });
        }

        menuItems.push(
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: t('common.edit'),
            onClick: () => showModal(record),
          },
          {
            type: 'divider',
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: t('common.delete'),
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: t('common.confirmDelete'),
                content: t('common.confirmDeleteMessage'),
                onOk: () => handleDelete(record.id),
                okText: t('common.yes'),
                cancelText: t('common.no'),
              });
            },
          }
        );

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              style={{ transform: 'rotate(90deg)' }}
            />
          </Dropdown>
        );
      },
    }];
  }, [products, locations, productsWithOrders, t, getProductOrderInfo]);

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
            name="external_link"
            label={t('stock.externalLink')}
          >
            <Input
              placeholder={t('stock.externalLinkPlaceholder')}
              prefix={<LinkOutlined />}
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
            name="location"
            label={t('stock.productLocation')}
          >
            <Select
              placeholder={t('stock.productLocationPlaceholder')}
              allowClear
              showSearch
              optionFilterProp="children"
              loading={!locations.length}
            >
              {locations && locations.length > 0 ? (
                locations.map(location => (
                  <Option key={location.id} value={location.name}>
                    {location.name}
                  </Option>
                ))
              ) : (
                <Option disabled value="">
                  {t('stock.noLocationsAvailable')}
                </Option>
              )}
            </Select>
          </Form.Item>

          <Form.Item
            name="is_active"
            label={t('stock.productActive')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          {/* Quick Variants Section */}
          {!editingProduct && (
            <Divider orientation="left">
              <Space>
                <BranchesOutlined />
                {t('variants.quickVariants')}
              </Space>
            </Divider>
          )}
          
          {!editingProduct && (
            <Form.Item label={t('variants.quickVariantsDescription')}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  type="dashed" 
                  onClick={handleAddQuickVariant}
                  icon={<PlusOutlined />}
                  style={{ width: '100%' }}
                >
                  {t('variants.addQuickVariant')}
                </Button>
                
                {quickVariants.length > 0 && (
                  <List
                    size="small"
                    bordered  
                    dataSource={quickVariants}
                    renderItem={(variant) => (
                      <List.Item
                        actions={[
                          <Button
                            key="delete"
                            type="text"
                            danger
                            size="small"
                            icon={<MinusCircleOutlined />}
                            onClick={() => handleRemoveQuickVariant(variant.id)}
                          />
                        ]}
                      >
                        <Row gutter={8} style={{ width: '100%' }}>
                          <Col span={6}>
                            <Input
                              placeholder={t('variants.variantName')}
                              value={variant.variant_name}
                              onChange={(e) => handleQuickVariantChange(variant.id, 'variant_name', e.target.value)}
                              size="small"
                            />
                          </Col>
                          <Col span={4}>
                            <Input
                              placeholder={t('variants.color')}
                              value={variant.color}
                              onChange={(e) => handleQuickVariantChange(variant.id, 'color', e.target.value)}
                              size="small"
                            />
                          </Col>
                          <Col span={4}>
                            <Input
                              placeholder={t('variants.size')}
                              value={variant.size}
                              onChange={(e) => handleQuickVariantChange(variant.id, 'size', e.target.value)}
                              size="small"
                            />
                          </Col>
                          <Col span={4}>
                            <InputNumber
                              placeholder={t('variants.currentStock')}
                              value={variant.current_stock}
                              onChange={(value) => handleQuickVariantChange(variant.id, 'current_stock', value || 0)}
                              size="small"
                              min={0}
                              style={{ width: '100%' }}
                            />
                          </Col>
                          <Col span={3}>
                            <Switch
                              size="small"
                              checked={variant.is_active}
                              onChange={(checked) => handleQuickVariantChange(variant.id, 'is_active', checked)}
                            />
                          </Col>
                        </Row>
                      </List.Item>
                    )}
                  />
                )}
                
                {quickVariants.length > 0 && (
                  <Tag color="blue" style={{ marginTop: 8 }}>
                    {quickVariants.length} {t('variants.variantsWillBeCreated')}
                  </Tag>
                )}
              </Space>
            </Form.Item>
          )}

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
