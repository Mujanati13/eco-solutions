import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Input,
  message,
  Spin,
  Modal,
  Form,
  Select,
  InputNumber,
  Popconfirm,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  ShopOutlined,
  TagOutlined,
  BarChartOutlined,
  DollarOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import stockService from '../../services/stockService'
import './Categories.css'

const { Search } = Input
const { Option } = Select

const Categories = () => {
  const { t } = useTranslation()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [totalCategories, setTotalCategories] = useState(0)
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalStockValue, setTotalStockValue] = useState(0)
  const [activeCategories, setActiveCategories] = useState(0)
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [form] = Form.useForm()
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      console.log('🏷️ Fetching categories...')
      
      // Use direct fetch to bypass authentication for now
      const response = await fetch('http://localhost:5000/api/stock/categories/product-count-test')
      console.log('🏷️ Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('✅ Categories API response:', result)
      
      const data = result.success ? result.data : []
      console.log('📊 Categories data:', data?.length, 'categories')
      
      // Filter categories based on search text
      const filteredCategories = searchText 
        ? data.filter(cat => 
            cat.category_name?.toLowerCase().includes(searchText.toLowerCase()) ||
            cat.category_description?.toLowerCase().includes(searchText.toLowerCase())
          )
        : data
      
      setCategories(filteredCategories)
      
      // Calculate statistics
      const totalCats = data.length
      const activeCats = data.filter(cat => cat.product_count > 0).length
      const totalProds = data.reduce((sum, cat) => sum + (cat.product_count || 0), 0)
      const totalValue = data.reduce((sum, cat) => sum + (parseFloat(cat.total_stock_value) || 0), 0)
      
      setTotalCategories(totalCats)
      setActiveCategories(activeCats)
      setTotalProducts(totalProds)
      setTotalStockValue(totalValue)
      
      console.log('📈 Statistics:', { totalCats, activeCats, totalProds, totalValue })
      
    } catch (error) {
      console.error('❌ Error fetching categories:', error)
      message.error(`Error loading categories: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value) => {
    setSearchText(value)
    // Re-filter the categories
    fetchCategories()
  }

  const handleRefresh = () => {
    setSearchText('')
    fetchCategories()
  }

  const columns = [
    {
      title: t('categories.categoryName') || 'Category Name',
      dataIndex: 'category_name',
      key: 'category_name',
      sorter: (a, b) => (a.category_name || '').localeCompare(b.category_name || ''),
      render: (name, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {record.level > 1 && (
            <span style={{ 
              color: '#999', 
              fontSize: '14px', 
              marginRight: '4px',
              fontFamily: 'monospace' 
            }}>
              {'├─'.repeat(record.level - 1)}
            </span>
          )}
          <Tag color={record.level === 1 ? 'blue' : 'cyan'} icon={<TagOutlined />}>
            {name}
          </Tag>
          {record.level > 1 && (
            <Tag color="orange" size="small">
              Sub
            </Tag>
          )}
        </div>
      ),
      width: 250,
    },
    {
      title: t('categories.description') || 'Description',
      dataIndex: 'category_description',
      key: 'category_description',
      render: (description, record) => (
        <div style={{ 
          paddingLeft: record.level > 1 ? `${(record.level - 1) * 16}px` : '0px',
          color: record.level > 1 ? '#666' : '#333'
        }}>
          {description || '-'}
        </div>
      ),
      ellipsis: true,
      width: 200,
    },
    {
      title: t('categories.totalProducts') || 'Total Products',
      dataIndex: 'product_count',
      key: 'product_count',
      sorter: (a, b) => (a.product_count || 0) - (b.product_count || 0),
      render: (count) => (
        <Tag color={count > 0 ? 'green' : 'gray'} icon={<ShopOutlined />}>
          {count || 0}
        </Tag>
      ),
      align: 'center',
      responsive: ['md'],
    },
    {
      title: t('categories.stockQuantity') || 'Stock Quantity',
      dataIndex: 'total_stock_quantity',
      key: 'total_stock_quantity',
      sorter: (a, b) => (parseFloat(a.total_stock_quantity) || 0) - (parseFloat(b.total_stock_quantity) || 0),
      render: (quantity) => (
        <Tag color={quantity > 0 ? 'blue' : 'default'} icon={<BarChartOutlined />}>
          {quantity || 0}
        </Tag>
      ),
      align: 'center',
      responsive: ['lg'],
    },
    {
      title: t('categories.stockValue') || 'Stock Value (DA)',
      dataIndex: 'total_stock_value',
      key: 'total_stock_value',
      sorter: (a, b) => (parseFloat(a.total_stock_value) || 0) - (parseFloat(b.total_stock_value) || 0),
      render: (value) => (
        <Tag 
          color={parseFloat(value) > 0 ? 'gold' : 'default'} 
          icon={<DollarOutlined />}
        >
          {parseFloat(value || 0).toFixed(2)} DA
        </Tag>
      ),
      align: 'right',
      responsive: ['lg'],
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditCategory(record)}
          >
          </Button>
          <Popconfirm
            title={t('categories.deleteCategoryConfirm') || 'Are you sure you want to delete this category?'}
            description={t('categories.deleteCategoryWarning') || 'This action cannot be undone.'}
            onConfirm={() => handleDeleteCategory(record.id)}
            okText={t('common.yes') || 'Yes'}
            cancelText={t('common.no') || 'No'}
            disabled={record.product_count > 0}
          >
            <Button
              type="primary"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.product_count > 0}
              title={record.product_count > 0 ? 
                t('categories.categoryHasProducts', { count: record.product_count }) : 
                t('categories.deleteCategory')
              }
            >
            </Button>
          </Popconfirm>
        </Space>
      ),
      width: 200,
      align: 'center',
    },
  ]

  // CRUD Handler Functions
  const handleAddCategory = () => {
    setEditingCategory(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditCategory = (category) => {
    console.log('📝 Editing category:', category)
    setEditingCategory(category)
    
    const formValues = {
      name: category.category_name,
      description: category.category_description,
      parent_id: category.parent_id,
      sort_order: category.sort_order || 0
    }
    
    console.log('📋 Setting form values:', formValues)
    
    form.setFieldsValue(formValues)
    setModalVisible(true)
  }

  const handleDeleteCategory = async (categoryId) => {
    try {
      await stockService.deleteCategory(categoryId)
      message.success(t('categories.categoryDeleted') || 'Category deleted successfully!')
      fetchCategories()
    } catch (error) {
      console.error('Delete category error:', error)
      message.error(error.error || t('common.error') || 'An error occurred')
    }
  }

  const handleModalOk = async () => {
    try {
      await form.validateFields()
      const values = form.getFieldsValue()
      
      console.log('📝 Form values:', values)
      console.log('📤 Sending values to API:', values)
      
      setModalLoading(true)
      
      if (editingCategory) {
        // Update category
        console.log('🔄 Updating category ID:', editingCategory.id)
        const result = await stockService.updateCategory(editingCategory.id, values)
        console.log('✅ Update result:', result)
        message.success(t('categories.categoryUpdated') || 'Category updated successfully!')
      } else {
        // Create category
        console.log('➕ Creating new category')
        const result = await stockService.createCategory(values)
        console.log('✅ Create result:', result)
        message.success(t('categories.categoryCreated') || 'Category created successfully!')
      }
      
      setModalVisible(false)
      form.resetFields()
      setEditingCategory(null)
      fetchCategories()
    } catch (error) {
      console.error('❌ Save category error:', error)
      if (error.error) {
        message.error(error.error)
      } else {
        message.error(t('common.error') || 'An error occurred')
      }
    } finally {
      setModalLoading(false)
    }
  }

  const handleModalCancel = () => {
    setModalVisible(false)
    form.resetFields()
    setEditingCategory(null)
  }

  // Get parent categories for the select dropdown
  const getParentCategories = () => {
    return categories.filter(cat => {
      // Exclude the current editing category and its children to prevent circular references
      if (editingCategory) {
        return cat.id !== editingCategory.id && cat.parent_id !== editingCategory.id
      }
      return true
    })
  }

  return (
    <div className="categories-page">
      <Card>

        {/* Search and Actions */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={16} md={12} lg={8}>
            <Search
              placeholder={t('categories.searchPlaceholder') || 'Search categories...'}
              allowClear
              onSearch={handleSearch}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%' }}
              enterButton={<SearchOutlined />}
            />
          </Col>
          <Row xs={24} sm={8} md={6} lg={4} style={{ textAlign: 'right', marginTop: { xs: 8, sm: 0 } }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
              style={{marginRight:'5px'}}
            >
            </Button>
             <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddCategory}
              >
                {t('categories.addCategory') || 'Add Category'}
              </Button>
          </Row>
        </Row>

        {/* Categories Table */}
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={categories}
            rowKey="id"
            loading={loading}
            pagination={{
              total: categories.length,
              pageSize: 15,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} ${t('common.of') || 'of'} ${total} ${t('categories.items') || 'categories'}`,
            }}
            scroll={{ x: 800, y: 600 }}
            size="small"
            rowClassName={(record) => {
              if (record.product_count === 0) return 'empty-category-row'
              if (record.product_count > 10) return 'high-product-category-row'
              return ''
            }}
          />
        </Spin>
      </Card>

      {/* Category Create/Edit Modal */}
      <Modal
        title={editingCategory ? 
          (t('categories.editCategory') || 'Edit Category') : 
          (t('categories.createCategory') || 'Create Category')
        }
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={modalLoading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          name="categoryForm"
        >
          <Form.Item
            name="name"
            label={t('categories.categoryName') || 'Category Name'}
            rules={[
              { 
                required: true, 
                message: t('categories.categoryNameRequired') || 'Please enter category name' 
              },
              {
                min: 2,
                message: t('validation.minLength', { min: 2 }) || 'Minimum 2 characters required'
              }
            ]}
          >
            <Input 
              placeholder={t('categories.categoryNamePlaceholder') || 'Enter category name'} 
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('categories.description') || 'Description'}
          >
            <Input.TextArea
              rows={3}
              placeholder={t('categories.categoryDescriptionPlaceholder') || 'Enter category description'}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="parent_id"
                label={t('categories.parentCategory') || 'Parent Category'}
              >
                <Select
                  placeholder={t('categories.selectParentCategory') || 'Select parent category'}
                  allowClear
                >
                  {getParentCategories().map(category => (
                    <Option key={category.id} value={category.id}>
                      {category.category_name}
                      {category.level > 1 && ` (Level ${category.level})`}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sort_order"
                label={t('categories.sortOrder') || 'Sort Order'}
              >
                <InputNumber
                  min={0}
                  max={999}
                  placeholder={t('categories.sortOrderPlaceholder') || 'Enter sort order'}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default Categories
