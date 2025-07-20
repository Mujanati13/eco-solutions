import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  InputNumber,
  Select,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Alert,
  Input,
  Tooltip,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  WarningOutlined,
  ShopOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import stockService from '../../services/stockService'
import './StockLevels.css'

const { Search } = Input
const { Option } = Select

const StockLevels = () => {
  const { t } = useTranslation()
  const [stockLevels, setStockLevels] = useState([])
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingStock, setEditingStock] = useState(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [outOfStockCount, setOutOfStockCount] = useState(0)
  const [totalValue, setTotalValue] = useState(0)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchStockLevels()
  }, [selectedLocation, searchText])

  const fetchInitialData = async () => {
    try {
      const [productsData, locationsData] = await Promise.all([
        stockService.getProducts(),
        stockService.getLocations()
      ])
      setProducts(productsData.products || [])
      setLocations(locationsData.locations || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
      message.error(t('common.error'))
    }
  }

  const fetchStockLevels = async () => {
    setLoading(true)
    try {
      const params = {}
      if (searchText) params.search = searchText
      if (selectedLocation) params.location_id = selectedLocation

      const data = await stockService.getStockLevels(params)
      setStockLevels(data.stockLevels || [])

      // Calculate statistics
      const lowStock = data.stockLevels?.filter(stock => 
        stock.current_quantity <= (stock.minimum_stock || 0)
      )?.length || 0
      
      const outOfStock = data.stockLevels?.filter(stock => 
        stock.current_quantity === 0
      )?.length || 0
      
      const value = data.stockLevels?.reduce((sum, stock) => 
        sum + ((Number(stock.cost_price) || 0) * (Number(stock.current_quantity) || 0)), 0
      ) || 0

      setLowStockCount(lowStock)
      setOutOfStockCount(outOfStock)
      setTotalValue(value)
    } catch (error) {
      console.error('Error fetching stock levels:', error)
      message.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value) => {
    setSearchText(value)
  }

  const showModal = (stock) => {
    setEditingStock(stock)
    setModalVisible(true)
    form.setFieldsValue({
      quantity: stock.current_quantity,
    })
  }

  const handleCancel = () => {
    setModalVisible(false)
    setEditingStock(null)
    form.resetFields()
  }

  const handleSubmit = async (values) => {
    try {
      await stockService.updateStockLevel(
        editingStock.product_id,
        editingStock.location_id,
        values.quantity
      )
      message.success(t('common.success'))
      setModalVisible(false)
      setEditingStock(null)
      form.resetFields()
      fetchStockLevels()
    } catch (error) {
      console.error('Error updating stock level:', error)
      message.error(error.message || t('common.error'))
    }
  }

  const getStockStatus = (quantity, minStock) => {
    if (quantity === 0) {
      return { color: 'red', text: t('stock.outOfStock') }
    } else if (quantity <= (minStock || 0)) {
      return { color: 'orange', text: t('stock.lowStockAlert') }
    } else {
      return { color: 'green', text: t('stock.currentStock') }
    }
  }

  const columns = [
    {
      title: t('stock.productName'),
      dataIndex: 'product_name',
      key: 'product_name',
      sorter: (a, b) => a.product_name.localeCompare(b.product_name),
    },
    {
      title: t('stock.productSKU'),
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: t('stock.location'),
      dataIndex: 'location_name',
      key: 'location_name',
      sorter: (a, b) => a.location_name.localeCompare(b.location_name),
    },
    {
      title: t('stock.currentStock'),
      dataIndex: 'current_quantity',
      key: 'current_quantity',
      render: (quantity, record) => {
        const status = getStockStatus(quantity, record.minimum_stock)
        return (
          <Tag color={status.color} icon={quantity === 0 ? <InboxOutlined /> : null}>
            {quantity}
          </Tag>
        )
      },
      sorter: (a, b) => a.current_quantity - b.current_quantity,
    },
    {
      title: t('stock.minimumStock'),
      dataIndex: 'minimum_stock',
      key: 'minimum_stock',
      render: (minStock) => minStock || '-',
    },
    {
      title: t('stock.maximumStock'),
      dataIndex: 'maximum_stock',
      key: 'maximum_stock',
      render: (maxStock) => maxStock || '-',
    },
    {
      title: t('stock.unitPrice'),
      dataIndex: 'cost_price',
      key: 'cost_price',
      render: (price) => price ? `${Number(price).toFixed(2)} DA` : '-',
    },
    {
      title: t('stock.totalValue'),
      key: 'total_value',
      render: (_, record) => {
        const value = (Number(record.cost_price) || 0) * (Number(record.current_quantity) || 0)
        return `${value.toFixed(2)} DA`
      },
      sorter: (a, b) => ((Number(a.cost_price) || 0) * (Number(a.current_quantity) || 0)) - ((Number(b.cost_price) || 0) * (Number(b.current_quantity) || 0)),
    },
    {
      title: t('stock.lastUpdated'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => (
        <Tooltip title={t('common.edit')}>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="stock-levels-page">
      <Card>
        {(lowStockCount > 0 || outOfStockCount > 0) && (
          <Alert
            message={t('stock.lowStockAlert')}
            description={`${outOfStockCount} ${t('stock.outOfStock')}, ${lowStockCount} ${t('stock.lowStockAlert')}`}
            type="warning"
            icon={<WarningOutlined />}
            style={{ marginBottom: 24 }}
            showIcon
          />
        )}

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic
              title={t('stock.totalValue')}
              value={totalValue}
              precision={2}
              suffix="DA"
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('stock.lowStockAlert')}
              value={lowStockCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('stock.outOfStock')}
              value={outOfStockCount}
              valueStyle={{ color: '#f5222d' }}
              prefix={<InboxOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('common.total')}
              value={stockLevels.length}
              prefix={<ShopOutlined />}
            />
          </Col>
        </Row>

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
              <Select
                placeholder={t('stock.location')}
                allowClear
                style={{ width: 200 }}
                onChange={setSelectedLocation}
                value={selectedLocation}
              >
                {locations.map(location => (
                  <Option key={location.id} value={location.id}>
                    {location.name}
                  </Option>
                ))}
              </Select>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchStockLevels}
                loading={loading}
              >
                {t('common.refresh')}
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={stockLevels}
          rowKey={(record) => `${record.product_id}-${record.location_id}`}
          loading={loading}
          rowClassName={(record) => {
            if (record.current_quantity === 0) return 'out-of-stock-row'
            if (record.current_quantity <= (record.minimum_stock || 0)) return 'low-stock-row'
            return ''
          }}
          pagination={{
            total: stockLevels.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} ${t('common.of')} ${total} ${t('common.items')}`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={`${t('common.edit')} ${editingStock?.product_name}`}
        open={modalVisible}
        onCancel={handleCancel}
        footer={null}
        width={400}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label={t('stock.location')}
          >
            <Input
              value={editingStock?.location_name}
              disabled
            />
          </Form.Item>

          <Form.Item
            label={t('stock.currentStock')}
          >
            <Input
              value={editingStock?.current_quantity}
              disabled
            />
          </Form.Item>

          <Form.Item
            name="quantity"
            label={t('stock.quantity')}
            rules={[
              { required: true, message: t('common.required') },
              { type: 'number', min: 0, message: t('validation.positiveNumber') }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder={t('stock.quantity')}
              min={0}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('common.save')}
              </Button>
              <Button onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default StockLevels
