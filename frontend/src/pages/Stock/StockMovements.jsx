import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  InputNumber,
  Select,
  Input,
  DatePicker,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import stockService from '../../services/stockService'
import './StockMovements.css'

const { Search } = Input
const { Option } = Select
const { TextArea } = Input
const { RangePicker } = DatePicker

const StockMovements = () => {
  const { t } = useTranslation()
  const [movements, setMovements] = useState([])
  const [products, setProducts] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState([])
  const [selectedType, setSelectedType] = useState(null)
  const [totalMovements, setTotalMovements] = useState(0)
  const [totalIn, setTotalIn] = useState(0)
  const [totalOut, setTotalOut] = useState(0)

  const movementTypes = [
    { value: 'purchase', label: t('stock.purchase'), color: 'green' },
    { value: 'sale', label: t('stock.sale'), color: 'red' },
    { value: 'adjustment', label: t('stock.adjustment'), color: 'blue' },
    { value: 'transfer', label: t('stock.transfer'), color: 'orange' },
    { value: 'damage', label: t('stock.damage'), color: 'red' },
    { value: 'theft', label: t('stock.theft'), color: 'red' },
    { value: 'correction', label: t('stock.correction'), color: 'purple' },
  ]

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchMovements()
  }, [searchText, dateRange, selectedType])

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

  const fetchMovements = async () => {
    setLoading(true)
    try {
      const params = {}
      if (searchText) params.search = searchText
      if (selectedType) params.type = selectedType
      if (dateRange.length === 2) {
        params.start_date = dateRange[0].format('YYYY-MM-DD')
        params.end_date = dateRange[1].format('YYYY-MM-DD')
      }

      const data = await stockService.getStockMovements(params)
      setMovements(data.movements || [])

      // Calculate statistics
      const total = data.movements?.length || 0
      const inMovements = data.movements?.filter(m => 
        ['purchase', 'adjustment'].includes(m.movement_type) && m.quantity > 0
      )?.reduce((sum, m) => sum + Math.abs(m.quantity), 0) || 0
      
      const outMovements = data.movements?.filter(m => 
        ['sale', 'damage', 'theft'].includes(m.movement_type) || m.quantity < 0
      )?.reduce((sum, m) => sum + Math.abs(m.quantity), 0) || 0

      setTotalMovements(total)
      setTotalIn(inMovements)
      setTotalOut(outMovements)
    } catch (error) {
      console.error('Error fetching movements:', error)
      message.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value) => {
    setSearchText(value)
  }

  const handleDateRangeChange = (dates) => {
    setDateRange(dates || [])
  }

  const showModal = () => {
    setModalVisible(true)
    form.resetFields()
  }

  const handleCancel = () => {
    setModalVisible(false)
    form.resetFields()
  }

  const handleSubmit = async (values) => {
    try {
      const movementData = {
        ...values,
        movement_date: values.movement_date?.format('YYYY-MM-DD HH:mm:ss') || dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      
      await stockService.createStockMovement(movementData)
      message.success(t('common.success'))
      setModalVisible(false)
      form.resetFields()
      fetchMovements()
    } catch (error) {
      console.error('Error creating movement:', error)
      message.error(error.message || t('common.error'))
    }
  }

  const getMovementTypeInfo = (type) => {
    return movementTypes.find(mt => mt.value === type) || { label: type, color: 'default' }
  }

  const columns = [
    {
      title: t('stock.movementDate'),
      dataIndex: 'movement_date',
      key: 'movement_date',
      render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm'),
      sorter: (a, b) => dayjs(a.movement_date).unix() - dayjs(b.movement_date).unix(),
      defaultSortOrder: 'descend',
    },
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
    },
    {
      title: t('stock.movementType'),
      dataIndex: 'movement_type',
      key: 'movement_type',
      render: (type) => {
        const typeInfo = getMovementTypeInfo(type)
        return <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
      },
      filters: movementTypes.map(type => ({
        text: type.label,
        value: type.value,
      })),
      onFilter: (value, record) => record.movement_type === value,
    },
    {
      title: t('stock.quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity, record) => {
        const isPositive = quantity > 0
        return (
          <Tag 
            color={isPositive ? 'green' : 'red'}
            icon={isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          >
            {isPositive ? '+' : ''}{quantity}
          </Tag>
        )
      },
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: t('stock.movementReference'),
      dataIndex: 'reference_number',
      key: 'reference_number',
      render: (ref) => ref || '-',
    },
    {
      title: t('stock.movementReason'),
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (reason) => reason || '-',
    },
    {
      title: t('common.user'),
      dataIndex: 'created_by_name',
      key: 'created_by_name',
    },
  ]

  return (
    <div className="stock-movements-page">
      <Card>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Statistic
              title={t('stock.movement')}
              value={totalMovements}
              prefix={<SwapOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={t('stock.stockIn')}
              value={totalIn}
              valueStyle={{ color: '#3f8600' }}
              prefix={<ArrowUpOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={t('stock.stockOut')}
              value={totalOut}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ArrowDownOutlined />}
            />
          </Col>
        </Row>

        <Row justify="space-between" style={{ marginBottom: 16 }}>
          <Col>
            <Space wrap>
              <Search
                placeholder={t('common.search')}
                allowClear
                onSearch={handleSearch}
                style={{ width: 250 }}
                enterButton={<SearchOutlined />}
              />
              <RangePicker
                onChange={handleDateRangeChange}
                format="DD/MM/YYYY"
                placeholder={[t('common.startDate'), t('common.endDate')]}
              />
              <Select
                placeholder={t('stock.movementType')}
                allowClear
                style={{ width: 150 }}
                onChange={setSelectedType}
                value={selectedType}
              >
                {movementTypes.map(type => (
                  <Option key={type.value} value={type.value}>
                    {type.label}
                  </Option>
                ))}
              </Select>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchMovements}
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
              onClick={showModal}
            >
              {t('stock.addMovement')}
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={movements}
          rowKey="id"
          loading={loading}
          pagination={{
            total: movements.length,
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
        title={t('stock.addMovement')}
        open={modalVisible}
        onCancel={handleCancel}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="product_id"
                label={t('stock.products')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select
                  showSearch
                  placeholder={t('stock.products')}
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {products.map(product => (
                    <Option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="location_id"
                label={t('stock.location')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select placeholder={t('stock.location')}>
                  {locations.map(location => (
                    <Option key={location.id} value={location.id}>
                      {location.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="movement_type"
                label={t('stock.movementType')}
                rules={[{ required: true, message: t('common.required') }]}
              >
                <Select placeholder={t('stock.movementType')}>
                  {movementTypes.map(type => (
                    <Option key={type.value} value={type.value}>
                      {type.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label={t('stock.quantity')}
                rules={[
                  { required: true, message: t('common.required') },
                  { type: 'number', message: t('validation.number') }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('stock.quantity')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="movement_date"
                label={t('stock.movementDate')}
              >
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  style={{ width: '100%' }}
                  placeholder={t('stock.movementDate')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reference_number"
                label={t('stock.movementReference')}
              >
                <Input placeholder={t('stock.movementReference')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="reason"
            label={t('stock.movementReason')}
          >
            <TextArea
              placeholder={t('stock.movementReason')}
              rows={3}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('common.submit')}
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

export default StockMovements
