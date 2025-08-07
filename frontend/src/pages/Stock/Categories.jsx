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
  
  // Multi-select states
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [bulkActionVisible, setBulkActionVisible] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      console.log('🏷️ Fetching categories...')
      
      // Use stockService like in Products.jsx
      const result = await stockService.getProductCountByCategory()
      console.log('✅ Categories API response:', result)
      
      const categories = result?.success ? result.data : (result?.data || result || [])
      console.log('📊 Categories data:', categories?.length, 'categories')
      
      // Filter categories based on search text
      const filteredCategories = searchText 
        ? categories.filter(cat => 
            cat.category_name?.toLowerCase().includes(searchText.toLowerCase()) ||
            cat.category_description?.toLowerCase().includes(searchText.toLowerCase())
          )
        : categories
      
      setCategories(filteredCategories)
      
      // Calculate statistics
      const totalCats = categories.length
      const activeCats = categories.filter(cat => cat.product_count > 0).length
      const totalProds = categories.reduce((sum, cat) => sum + (cat.product_count || 0), 0)
      const totalValue = categories.reduce((sum, cat) => sum + (parseFloat(cat.total_stock_value) || 0), 0)
      
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
      render: (name, record) => {
        const getTreeIndent = (level) => {
          if (level === 1) return ''
          let indent = ''
          for (let i = 1; i < level; i++) {
            indent += '│   '
          }
          return indent + '├─ '
        }

        const treeIndent = getTreeIndent(record.level)
        
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
            {record.level > 1 && (
              <span style={{ 
                color: '#bbb', 
                fontSize: '12px', 
                fontFamily: 'Consolas, Monaco, Courier New, monospace',
                whiteSpace: 'pre',
                lineHeight: '1',
                marginRight: '4px'
              }}>
                {treeIndent}
              </span>
            )}
            <Tag 
              color={record.level === 1 ? 'blue' : record.level === 2 ? 'cyan' : 'geekblue'} 
              icon={<TagOutlined />}
              size={record.level > 1 ? 'small' : 'default'}
              style={{ 
                borderRadius: '4px',
                fontWeight: record.level === 1 ? 'bold' : 'normal',
                fontSize: record.level > 2 ? '11px' : '12px',
                margin: 0
              }}
            >
              {name}
            </Tag>
            {record.level > 1 && (
              <Tag 
                color={record.level === 2 ? 'orange' : 'purple'} 
                size="small"
                style={{ 
                  fontSize: '9px',
                  lineHeight: '14px',
                  padding: '0 4px',
                  marginLeft: '4px'
                }}
              >
                L{record.level}
              </Tag>
            )}
          </div>
        )
      },
      minWidth: 150,
      ellipsis: true,
    },
    {
      title: t('categories.description') || 'Description',
      dataIndex: 'category_description',
      key: 'category_description',
      render: (description, record) => (
        <div style={{ 
          paddingLeft: record.level > 1 ? `${(record.level - 1) * 12}px` : '0px',
          color: record.level === 1 ? '#333' : record.level === 2 ? '#666' : '#999',
          fontStyle: record.level > 2 ? 'italic' : 'normal',
          fontSize: record.level > 2 ? '11px' : '13px'
        }}>
          {description || (record.level > 1 ? '—' : '—')}
        </div>
      ),
      ellipsis: true,
      minWidth: 120,
    },
    {
      title: t('categories.totalProducts') || 'Total Products',
      dataIndex: 'product_count',
      key: 'product_count',
      sorter: (a, b) => (a.product_count || 0) - (b.product_count || 0),
      render: (count) => (
        <Tag color={count > 0 ? 'green' : 'gray'} icon={<ShopOutlined />} size="small">
          {count || 0}
        </Tag>
      ),
      align: 'center',
      minWidth: 80,
      responsive: ['md'],
    },
    {
      title: t('categories.stockQuantity') || 'Stock Quantity',
      dataIndex: 'total_stock_quantity',
      key: 'total_stock_quantity',
      sorter: (a, b) => (parseFloat(a.total_stock_quantity) || 0) - (parseFloat(b.total_stock_quantity) || 0),
      render: (quantity) => (
        <Tag color={quantity > 0 ? 'blue' : 'default'} icon={<BarChartOutlined />} size="small">
          {quantity || 0}
        </Tag>
      ),
      align: 'center',
      minWidth: 90,
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
          size="small"
        >
          {parseFloat(value || 0).toFixed(2)}
        </Tag>
      ),
      align: 'right',
      minWidth: 100,
      responsive: ['lg'],
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-start', 
          alignItems: 'center',
          gap: '4px',
          paddingLeft: record.level > 1 ? `${(record.level - 1) * 20}px` : '0px',
          minHeight: '32px'
        }}>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditCategory(record)}
            style={{ minWidth: '28px' }}
          />
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
              style={{ minWidth: '28px' }}
            />
          </Popconfirm>
        </div>
      ),
      width: 140,
      align: 'left',
      fixed: 'right',
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

  // Multi-select handlers
  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys)
    setBulkActionVisible(newSelectedRowKeys.length > 0)
  }

  const handleBulkDelete = async () => {
    try {
      setModalLoading(true)
      
      // Check if any selected categories have products
      const categoriesWithProducts = selectedRowKeys.filter(id => {
        const category = categories.find(cat => cat.id === id)
        return category && category.product_count > 0
      })
      
      if (categoriesWithProducts.length > 0) {
        message.error(`${categoriesWithProducts.length} categories cannot be deleted because they contain products`)
        return
      }
      
      // Delete categories one by one
      for (const categoryId of selectedRowKeys) {
        await stockService.deleteCategory(categoryId)
      }
      
      message.success(`${selectedRowKeys.length} categories deleted successfully!`)
      setSelectedRowKeys([])
      setBulkActionVisible(false)
      fetchCategories()
    } catch (error) {
      console.error('Bulk delete error:', error)
      message.error(error.error || 'Error deleting categories')
    } finally {
      setModalLoading(false)
    }
  }

  const clearSelection = () => {
    setSelectedRowKeys([])
    setBulkActionVisible(false)
  }

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    getCheckboxProps: (record) => ({
      disabled: record.product_count > 0, // Disable selection for categories with products
    }),
  }

  return (
    <div className="categories-page">
      <Card>

        {/* Search and Actions */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={14} md={12} lg={10} xl={8}>
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
          <Col xs={24} sm={10} md={8} lg={6} xl={4} style={{ 
            textAlign: 'right', 
            marginTop: { xs: 8, sm: 0 },
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px'
          }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
              size="small"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddCategory}
              size="small"
              style={{ 
                minWidth: 'auto',
                whiteSpace: 'nowrap'
              }}
            >
              <span className="add-button-text">
                {t('categories.addCategory') || 'Add Category'}
              </span>
            </Button>
          </Col>
        </Row>

        {/* Bulk Actions Bar */}
        {bulkActionVisible && (
          <Row style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f0f2f5', borderRadius: '8px' }}>
            <Col flex="auto">
              <Space>
                <Tag color="blue">{selectedRowKeys.length} selected</Tag>
                <span style={{ color: '#666' }}>
                  {t('categories.bulkActionsAvailable') || 'Bulk actions available'}
                </span>
              </Space>
            </Col>
            <Col>
              <Space>
                <Popconfirm
                  title={t('categories.bulkDeleteConfirm') || `Delete ${selectedRowKeys.length} categories?`}
                  description={t('categories.bulkDeleteWarning') || 'This action cannot be undone.'}
                  onConfirm={handleBulkDelete}
                  okText={t('common.yes') || 'Yes'}
                  cancelText={t('common.no') || 'No'}
                  okButtonProps={{ loading: modalLoading }}
                >
                  <Button 
                    danger 
                    icon={<DeleteOutlined />}
                    disabled={modalLoading}
                  >
                    {t('categories.bulkDelete') || 'Delete Selected'}
                  </Button>
                </Popconfirm>
                <Button onClick={clearSelection}>
                  {t('common.clear') || 'Clear'}
                </Button>
              </Space>
            </Col>
          </Row>
        )}

        {/* Categories Table */}
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={categories}
            rowKey="id"
            loading={loading}
            rowSelection={rowSelection}
            pagination={{
              total: categories.length,
              pageSize: 15,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} ${t('common.of') || 'of'} ${total} ${t('categories.items') || 'categories'}`,
            }}
            scroll={{ x: 'max-content' }}
            size="small"
            rowClassName={(record) => {
              let className = ''
              if (record.product_count === 0) className += 'empty-category-row '
              if (record.product_count > 10) className += 'high-product-category-row '
              if (record.level === 1) className += 'parent-category-row '
              if (record.level > 1) className += 'sub-category-row '
              return className.trim()
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
