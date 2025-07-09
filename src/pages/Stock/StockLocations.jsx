import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
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
  EnvironmentOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import stockService from '../../services/stockService'
import './StockLocations.css'

const { Search } = Input
const { TextArea } = Input

const StockLocations = () => {
  const { t } = useTranslation()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const [totalLocations, setTotalLocations] = useState(0)
  const [activeLocations, setActiveLocations] = useState(0)

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async (search = '') => {
    setLoading(true)
    try {
      const params = {}
      if (search) {
        params.search = search
      }
      
      const data = await stockService.getLocations(params)
      // API returns array directly, not wrapped in object
      const locationsArray = Array.isArray(data) ? data : data.locations || []
      setLocations(locationsArray)
      
      // Calculate statistics
      const total = locationsArray.length || 0
      const active = locationsArray.filter(l => l.is_active)?.length || 0
      
      setTotalLocations(total)
      setActiveLocations(active)
    } catch (error) {
      console.error('Error fetching locations:', error)
      message.error(t('common.failedToFetch'))
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value) => {
    setSearchText(value)
    fetchLocations(value)
  }

  const showModal = (location = null) => {
    setEditingLocation(location)
    setModalVisible(true)
    if (location) {
      form.setFieldsValue({
        ...location,
        is_active: location.is_active || false,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ is_active: true })
    }
  }

  const handleCancel = () => {
    setModalVisible(false)
    setEditingLocation(null)
    form.resetFields()
  }

  const handleSubmit = async (values) => {
    try {
      if (editingLocation) {
        await stockService.updateLocation(editingLocation.id, values)
        message.success(t('common.updated'))
      } else {
        await stockService.createLocation(values)
        message.success(t('common.created'))
      }
      setModalVisible(false)
      setEditingLocation(null)
      form.resetFields()
      fetchLocations(searchText)
    } catch (error) {
      console.error('Error saving location:', error)
      message.error(error.message || t('common.saveFailed'))
    }
  }

  const handleDelete = async (id) => {
    try {
      await stockService.deleteLocation(id)
      message.success(t('common.deleted'))
      fetchLocations(searchText)
    } catch (error) {
      console.error('Error deleting location:', error)
      message.error(error.message || t('common.deleteFailed'))
    }
  }

  const columns = [
    {
      title: t('stock.locationName'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t('stock.locationAddress'),
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
      render: (address) => address || '-',
    },
    {
      title: t('stock.locationType'),
      dataIndex: 'type',
      key: 'type',
      render: (type) => type || '-',
    },
    {
      title: t('stock.contactPerson'),
      dataIndex: 'contact_person',
      key: 'contact_person',
      render: (contact) => contact || '-',
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (description) => description || '-',
    },
    {
      title: t('stock.locationActive'),
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
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_, record) => (
        <Space>
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
    <div className="stock-locations-page">
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
                onClick={() => fetchLocations(searchText)}
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
              {t('stock.addLocation')}
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={locations}
          rowKey="id"
          loading={loading}
          size='small'
          pagination={{
            total: locations.length,
            pageSize: 5,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} ${t('common.of')} ${total} ${t('common.items')}`,
          }}
        />
      </Card>

      <Modal
        title={editingLocation ? t('stock.editLocation') : t('stock.addLocation')}
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
          <Form.Item
            name="name"
            label={t('stock.locationName')}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input placeholder={t('stock.locationName')} />
          </Form.Item>

          <Form.Item
            name="address"
            label={t('stock.locationAddress')}
          >
            <TextArea
              placeholder={t('stock.locationAddress')}
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="type"
            label={t('stock.locationType')}
          >
            <Input placeholder={t('stock.locationType')} />
          </Form.Item>

          <Form.Item
            name="contact_person"
            label={t('stock.contactPerson')}
          >
            <Input placeholder={t('stock.contactPerson')} />
          </Form.Item>

          <Form.Item
            name="phone"
            label={t('common.phone')}
          >
            <Input placeholder={t('common.phone')} />
          </Form.Item>

          <Form.Item
            name="email"
            label={t('common.email')}
          >
            <Input placeholder={t('common.email')} type="email" />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('common.description')}
          >
            <TextArea
              placeholder={t('common.description')}
              rows={3}
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label={t('stock.locationActive')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingLocation ? t('common.save') : t('common.submit')}
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

export default StockLocations
