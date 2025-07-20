import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Typography, 
  Spin, 
  Button, 
  Upload, 
  message,
  Modal,
  Progress,
  Tabs,
  Space,
  Select
} from 'antd'
import { useTranslation } from 'react-i18next'
import {
  ShoppingCartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  DeliveredProcedureOutlined,
  UserOutlined,
  UploadOutlined,
  ShareAltOutlined,
  BarChartOutlined,
  LineChartOutlined,
  TrophyOutlined,
  ShoppingOutlined,
  ReloadOutlined,
  DollarOutlined
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import ProductDashboard from './ProductDashboard'
import './EnhancedSimpleDashboard.css'

const { Title } = Typography
const { Option } = Select

const SimpleDashboard = React.memo(() => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [recentOrders, setRecentOrders] = useState([])
  const [orderDistribution, setOrderDistribution] = useState([])
  const [orderTrends, setOrderTrends] = useState([])
  const [performance, setPerformance] = useState([])
  const [chartsLoading, setChartsLoading] = useState(false)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [timeRange, setTimeRange] = useState(30)
  const [activeTab, setActiveTab] = useState('orders')
  const { user } = useAuth()
  const { 
    hasPermission, 
    isAdmin, 
    isSupervisor,
    loading: permissionsLoading 
  } = usePermissions()
  const { t } = useTranslation()

  const revenueData = useMemo(() => {
    return orderTrends?.slice(0, 10).reverse() || []
  }, [orderTrends])

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      
      const token = localStorage.getItem('token')
      if (!token) {
        message.error(t('auth.loginRequired'))
        return
      }
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
      
      // Fetch stats and recent orders
      const [statsResponse, ordersResponse] = await Promise.all([
        fetch('/api/dashboard/stats', { headers })
          .catch(err => ({ ok: false, error: err.message })),
        fetch('/api/dashboard/recent-orders?limit=10', { headers })
          .catch(err => ({ ok: false, error: err.message }))
      ])
      
      // Handle stats response
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData || {})
      } else {
        console.error('Stats fetch failed:', statsResponse.error)
        setStats({})
      }
      
      // Handle orders response
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        setRecentOrders(Array.isArray(ordersData) ? ordersData : [])
      } else {
        console.error('Orders fetch failed:', ordersResponse.error)
        setRecentOrders([])
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      message.error(t('dashboard.fetchError'))
      setStats({})
      setRecentOrders([])
    } finally {
      setLoading(false)
    }
  }, [t])

  const fetchChartsData = useCallback(async (selectedTimeRange = null) => {
    try {
      setChartsLoading(true)
      
      const token = localStorage.getItem('token')
      if (!token) return
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
      
      // Use the passed timeRange or default to current timeRange
      const effectiveTimeRange = selectedTimeRange || timeRange
      
      // Fetch charts data
      const [distributionResponse, trendsResponse, performanceResponse] = await Promise.all([
        fetch('/api/dashboard/order-distribution', { headers })
          .catch(err => ({ ok: false, error: err.message })),
        fetch(`/api/dashboard/trends?days=${effectiveTimeRange}`, { headers })
          .catch(err => ({ ok: false, error: err.message })),
        fetch(`/api/dashboard/performance?days=${effectiveTimeRange}`, { headers })
          .catch(err => ({ ok: false, error: err.message }))
      ])
      
      // Handle distribution response
      if (distributionResponse.ok) {
        const distributionData = await distributionResponse.json()
        setOrderDistribution(Array.isArray(distributionData) ? distributionData : [])
      } else {
        console.error('Distribution fetch failed:', distributionResponse.error)
        setOrderDistribution([])
      }
      
      // Handle trends response
      if (trendsResponse.ok) {
        const trendsData = await trendsResponse.json()
        setOrderTrends(Array.isArray(trendsData) ? trendsData : [])
      } else {
        console.error('Trends fetch failed:', trendsResponse.error)
        setOrderTrends([])
      }
      
      // Handle performance response
      if (performanceResponse.ok) {
        const performanceData = await performanceResponse.json()
        setPerformance(Array.isArray(performanceData) ? performanceData : [])
      } else {
        console.error('Performance fetch failed:', performanceResponse.error)
        setPerformance([])
      }
      
    } catch (error) {
      console.error('Error fetching charts data:', error)
    } finally {
      setChartsLoading(false)
    }
  }, []) // No dependencies to prevent auto-refresh

  useEffect(() => {
    // Only fetch data on initial load and when dependencies change
    if (!permissionsLoading && activeTab === 'orders') {
      fetchDashboardData()
    //   fetchChartsData(timeRange) // Pass initial timeRange explicitly
    }
  }, [permissionsLoading, activeTab]) // No timeRange dependency to prevent auto-refresh

  const handleFileUpload = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      setUploading(true)
      setUploadProgress(0)
      
      const response = await fetch('/api/orders/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        
        // Show detailed success message
        let successMessage = t('dashboard.importSuccess', { count: result.imported })
        if (result.total_rows) {
          successMessage += ` ${t('dashboard.outOf')} ${result.total_rows} ${t('dashboard.totalRows')}`
        }
        
        message.success(successMessage)
        
        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          Modal.warning({
            title: t('dashboard.importWarnings'),
            content: (
              <div>
                <p>{t('dashboard.missingFieldsWarning')}:</p>
                <ul style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {result.warnings.slice(0, 10).map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                  {result.warnings.length > 10 && (
                    <li>{t('dashboard.andMore', { count: result.warnings.length - 10 })}</li>
                  )}
                </ul>
              </div>
            ),
            width: 600
          })
        }
        
        // Show errors if any
        if (result.errors && result.errors.length > 0) {
          Modal.error({
            title: t('dashboard.importErrors'),
            content: (
              <div>
                <p>{t('dashboard.someRowsFailed')}:</p>
                <ul style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {result.errors.slice(0, 10).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>{t('dashboard.andMore', { count: result.errors.length - 10 })}</li>
                  )}
                </ul>
              </div>
            ),
            width: 600
          })
        }
        
        setUploadModalVisible(false)
        
      } else {
        const errorData = await response.json()
        message.error(errorData.error || t('dashboard.importError'))
      }
      
    } catch (error) {
      console.error('Error uploading file:', error)
      message.error(t('dashboard.importError'))
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
    
    return false // Prevent default upload behavior
  }, [t])

  const handleDistributeOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        message.error(t('auth.loginRequired'))
        return
      }
      
      const response = await fetch('/api/orders/distribute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        message.success(t('dashboard.distributeSuccess', { count: result.distributed || 0 }))
      } else {
        const error = await response.json()
        message.error(error.message || t('dashboard.distributeError'))
      }
    } catch (error) {
      console.error('Error distributing orders:', error)
      message.error(t('dashboard.distributeError'))
    }
  }, [t])

  const handleManualRefresh = useCallback(() => {
    fetchDashboardData()
    fetchChartsData(timeRange) // Pass current timeRange explicitly
  }, [fetchDashboardData, fetchChartsData])

  const columns = useMemo(() => [
    {
      title: t('orders.orderNumber'),
      dataIndex: 'order_number',
      key: 'order_number',
      responsive: ['md'],
      ellipsis: true,
    },
    {
      title: t('orders.customerName'),
      dataIndex: 'customer_name',
      key: 'customer_name',
      ellipsis: true,
    },
    {
      title: t('orders.totalAmount'),
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount) => {
        const numAmount = Number(amount);
        return `$${!isNaN(numAmount) ? numAmount.toFixed(2) : '0.00'}`;
      },
      responsive: ['sm'],
    },
    {
      title: t('orders.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <span className="status-badge" style={{
          background: getStatusColor(status).background,
          color: getStatusColor(status).color,
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {t(`orders.statusTypes.${status}`) || t(`orders.${status}`) || status}
        </span>
      ),
    },
    {
      title: t('orders.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString(),
      responsive: ['lg'],
    },
  ], [t])

  const getStatusColor = useCallback((status) => {
    const colors = {
      pending: { background: '#fff7e6', color: '#fa8c16' },
      confirmed: { background: '#e6f7ff', color: '#1890ff' }, // Blue primary
      processing: { background: '#e6f7ff', color: '#1890ff' },
      out_for_delivery: { background: '#f0f5ff', color: '#2f54eb' }, // Blue variant
      delivered: { background: '#f6ffed', color: '#52c41a' },
      cancelled: { background: '#fff2f0', color: '#ff4d4f' },
      returned: { background: '#fff7e6', color: '#fa8c16' },
      on_hold: { background: '#f5f5f5', color: '#666666' },
      inProgress: { background: '#e6f7ff', color: '#1890ff' },
    }
    return colors[status] || colors.pending
  }, [])

  // Chart configurations with blue as primary color
  const getStatusChartOption = () => ({
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    series: [{
      name: t('dashboard.orders'),
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '50%'],
      data: orderDistribution.map((item, index) => ({
        name: t(`orders.statusTypes.${item?.status}`) || t(`orders.${item?.status}`) || item?.status || '',
        value: item?.count || 0,
        itemStyle: {
          color: index === 0 ? '#1890ff' : ['#52c41a', '#fa8c16', '#722ed1', '#f5222d', '#fa541c'][index - 1] || '#d9d9d9'
        }
      })),
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  })

  const getTrendsChartOption = () => ({
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: [t('dashboard.totalOrders'), t('dashboard.confirmedOrders'), t('dashboard.deliveredOrders')],
      bottom: 10
    },
    xAxis: {
      type: 'category',
      data: orderTrends.map(item => item?.date || '')
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: t('dashboard.totalOrders'),
        type: 'line',
        data: orderTrends.map(item => item?.total_orders || 0),
        smooth: true,
        lineStyle: { color: '#1890ff' },
        areaStyle: { opacity: 0.1, color: '#1890ff' }
      },
      {
        name: t('dashboard.confirmedOrders'),
        type: 'line',
        data: orderTrends.map(item => item?.confirmed_orders || 0),
        smooth: true,
        lineStyle: { color: '#2f54eb' }
      },
      {
        name: t('dashboard.deliveredOrders'),
        type: 'line',
        data: orderTrends.map(item => item?.delivered_orders || 0),
        smooth: true,
        lineStyle: { color: '#52c41a' }
      }
    ]
  })

  const getRevenueChartOption = () => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    xAxis: {
      type: 'category',
      data: revenueData?.map(item => item?.date || '') || []
    },
    yAxis: {
      type: 'value',
      name: t('dashboard.revenue')
    },
    series: [
      {
        name: t('dashboard.revenue'),
        type: 'bar',
        data: revenueData?.map(item => Number(item?.total_revenue) || 0) || [],
        itemStyle: { color: '#1890ff' }
      }
    ]
  })

  const getPerformanceChartOption = () => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    xAxis: {
      type: 'category',
      data: performance.slice(0, 10).map(item => `${item?.first_name || ''} ${item?.last_name || ''}`),
      axisLabel: {
        rotate: 45,
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      name: t('dashboard.orders')
    },
    series: [
      {
        name: t('dashboard.confirmed'),
        type: 'bar',
        data: performance.slice(0, 10).map(item => item?.total_confirmed || 0),
        itemStyle: { color: '#1890ff' }
      },
      {
        name: t('dashboard.delivered'),
        type: 'bar',
        data: performance.slice(0, 10).map(item => item?.total_delivered || 0),
        itemStyle: { color: '#52c41a' }
      }
    ]
  })

  if (loading && activeTab === 'orders') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        width: '100%'
      }}>
        <Spin size="large" />
      </div>
    )
  }

  // Order Management Tab Content
  const OrderManagementContent = () => (
    <div>
      {/* Order Statistics Cards */}
      <Row gutter={[16, 16]} className="dashboard-stats" style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <Card className="dashboard-card" style={{ borderTop: '4px solid #fa8c16' }}>
            <Statistic
              title={isAdmin ? t('dashboard.pendingOrders') : t('dashboard.myPendingOrders')}
              value={isAdmin ? (stats.pendingOrders || stats.pending_orders || 0) : (stats.my_pending_orders || 0)}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16', fontSize: '1.5em', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <Card className="dashboard-card" style={{ borderTop: '4px solid #52c41a' }}>
            <Statistic
              title={isAdmin ? t('dashboard.confirmedOrders') : t('dashboard.myConfirmedOrders')}
              value={isAdmin ? (stats.confirmedOrders || stats.confirmed_orders || 0) : (stats.my_confirmed_orders || 0)}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: '1.5em', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12} lg={6} xl={6}>
          <Card className="dashboard-card" style={{ borderTop: '4px solid #722ed1' }}>
            <Statistic
              title={isAdmin ? t('dashboard.deliveredOrders') : t('dashboard.myDeliveredOrders')}
              value={isAdmin ? (stats.deliveredOrders || stats.delivered_orders || 0) : (stats.my_delivered_orders || 0)}
              prefix={<DeliveredProcedureOutlined />}
              valueStyle={{ color: '#722ed1', fontSize: '1.5em', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Time Range Selector */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card className="dashboard-card">
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                {t('dashboard.analyticsTitle')}
              </Title>
              <Space>
                <Button 
                  type="primary" 
                  icon={<ReloadOutlined />}
                  onClick={handleManualRefresh}
                  loading={chartsLoading || loading}
                  size="small"
                  style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
                >
                  {t('common.refresh') || 'Refresh'}
                </Button>
                <Select
                  value={timeRange}
                  onChange={setTimeRange}
                  style={{ width: 200 }}
                  loading={chartsLoading}
                  disabled={chartsLoading || loading}
                >
                  <Option value={7}>{t('dashboard.last7Days')}</Option>
                  <Option value={30}>{t('dashboard.last30Days')}</Option>
                  <Option value={90}>{t('dashboard.last90Days')}</Option>
                  <Option value={365}>{t('dashboard.lastYear')}</Option>
                </Select>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Admin Actions */}
      {(hasPermission('canImportOrders') || hasPermission('canDistributeOrders')) && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card 
              title={<span style={{ color: '#1890ff' }}>{t('dashboard.orderImportActions')}</span>}
              className="dashboard-card"
              extra={
                <div className="admin-actions-buttons">
                  {hasPermission('canImportOrders') && (
                    <Button 
                      type="primary" 
                      icon={<UploadOutlined />}
                      onClick={() => setUploadModalVisible(true)}
                      size="small"
                      style={{ marginRight: 8, backgroundColor: '#1890ff', borderColor: '#1890ff' }}
                    >
                      <span className="hidden-xs">{t('dashboard.importOrders')}</span>
                    </Button>
                  )}
                  {hasPermission('canDistributeOrders') && (
                    <Button 
                      type="default" 
                      icon={<ShareAltOutlined />}
                      onClick={handleDistributeOrders}
                      size="small"
                      style={{ borderColor: '#1890ff', color: '#1890ff' }}
                    >
                      <span className="hidden-xs">{t('dashboard.distributeOrders')}</span>
                    </Button>
                  )}
                </div>
              }
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8} md={8}>
                  <Statistic
                    title={t('dashboard.totalUsers')}
                    value={stats.totalUsers || stats.total_users || stats.activeEmployees || stats.active_employees || 0}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col xs={24} sm={8} md={8}>
                  <Statistic
                    title={t('dashboard.todayOrders')}
                    value={stats.todayOrders || stats.today_orders || stats.todaysOrders || 0}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col xs={24} sm={8} md={8}>
                  <Statistic
                    title={t('dashboard.totalRevenue')}
                    value={stats.totalRevenue || stats.total_revenue || 0}
                    prefix={<DollarOutlined />}
                    precision={2}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {/* Charts Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Order Distribution Chart */}
        <Col xs={24} md={12}>
          <Card 
            title={
              <Space>
                <BarChartOutlined style={{ color: '#1890ff' }} />
                <span style={{ color: '#1890ff' }}>{t('dashboard.orderDistribution')}</span>
              </Space>
            }
            className="dashboard-card"
            loading={chartsLoading}
          >
            {orderDistribution && orderDistribution.length > 0 ? (
              <ReactECharts 
                option={getStatusChartOption()} 
                style={{ height: '350px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>
                {t('common.noData')}
              </div>
            )}
          </Card>
        </Col>

        {/* Order Trends Chart */}
        <Col xs={24} md={12}>
          <Card 
            title={
              <Space>
                <LineChartOutlined style={{ color: '#1890ff' }} />
                <span style={{ color: '#1890ff' }}>{t('dashboard.orderTrends')}</span>
              </Space>
            }
            className="dashboard-card"
            loading={chartsLoading}
          >
            {orderTrends && orderTrends.length > 0 ? (
              <ReactECharts 
                option={getTrendsChartOption()} 
                style={{ height: '350px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>
                {t('common.noData')}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Revenue and Performance Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Revenue Trends */}
        <Col xs={24} md={12}>
          <Card 
            title={
              <Space>
                <BarChartOutlined style={{ color: '#1890ff' }} />
                <span style={{ color: '#1890ff' }}>{t('dashboard.revenueTrends')}</span>
              </Space>
            }
            className="dashboard-card"
            loading={chartsLoading}
          >
            {orderTrends && orderTrends.length > 0 ? (
              <ReactECharts 
                option={getRevenueChartOption()} 
                style={{ height: '350px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>
                {t('common.noData')}
              </div>
            )}
          </Card>
        </Col>

        {/* Performance Chart */}
        <Col xs={24} md={12}>
          <Card 
            title={
              <Space>
                <TrophyOutlined style={{ color: '#1890ff' }} />
                <span style={{ color: '#1890ff' }}>
                  {isAdmin ? t('dashboard.teamPerformance') : t('dashboard.myPerformance')}
                </span>
              </Space>
            }
            className="dashboard-card"
            loading={chartsLoading}
          >
            {performance && performance.length > 0 ? (
              <ReactECharts 
                option={getPerformanceChartOption()} 
                style={{ height: '350px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#999' }}>
                {t('common.noData')}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Orders Table */}
      <Card 
        title={<span style={{ color: '#1890ff' }}>{t('dashboard.recentOrders')}</span>}
        className="dashboard-card"
        hoverable
      >
        <Table
          columns={columns}
          dataSource={recentOrders}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: t('common.noData')
          }}
        />
      </Card>
    </div>
  )

  const tabItems = [
    {
      key: 'orders',
      label: (
        <span style={{ color: activeTab === 'orders' ? '#1890ff' : undefined }}>
          <ShoppingCartOutlined />
          {t('dashboard.orderManagement')}
        </span>
      ),
      children: <OrderManagementContent />
    }
  ]

  // Add Product Management tab if user has permission
  if (hasPermission('canViewProducts')) {
    tabItems.push({
      key: 'products',
      label: (
        <span style={{ color: activeTab === 'products' ? '#1890ff' : undefined }}>
          <ShoppingOutlined />
          {t('dashboard.productManagement')}
        </span>
      ),
      children: <ProductDashboard />
    })
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <Title level={2} className="dashboard-title" style={{ color: '#1890ff' }}>
          {t('dashboard.title')}
        </Title>
        <p className="dashboard-subtitle" style={{ color: '#666' }}>
          {t('dashboard.welcome')}, {user?.name || user?.username || t('common.user')}!
        </p>
      </div>

      {/* Tab Navigation */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={tabItems}
        style={{ marginBottom: 24 }}
        type="card"
      />

      {/* Upload Modal */}
      <Modal
        title={<span style={{ color: '#1890ff' }}>{t('dashboard.importOrders')}</span>}
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ color: '#1890ff' }}>{t('dashboard.expectedFormat')}</h4>
          <p>{t('dashboard.formatDescription')}</p>
          <ul style={{ fontSize: '12px', color: '#666' }}>
            <li><strong>Full name</strong> - {t('dashboard.customerName')}</li>
            <li><strong>Phone</strong> - {t('dashboard.customerPhone')}</li>
            <li><strong>العنوان</strong> - {t('dashboard.customerAddress')}</li>
            <li><strong>المدينة</strong> - {t('dashboard.customerCity')}</li>
            <li><strong>الولاية</strong> - {t('dashboard.customerState')} ({t('common.optional')})</li>
            <li><strong>Product name</strong> - {t('dashboard.productName')}</li>
            <li><strong>Product variant</strong> - {t('dashboard.productVariant')} ({t('common.optional')})</li>
            <li><strong>Variant price</strong> - {t('dashboard.productPrice')}</li>
            <li><strong>stop desk ou a domicile</strong> - {t('dashboard.deliveryType')} ({t('common.optional')})</li>
          </ul>
        </div>
        
        <Upload.Dragger
          name="file"
          accept=".csv,.xlsx,.xls"
          beforeUpload={handleFileUpload}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">
            {t('dashboard.uploadText')}
          </p>
          <p className="ant-upload-hint">
            {t('dashboard.uploadHint')}
          </p>
        </Upload.Dragger>
        
        {uploading && (
          <Progress 
            percent={uploadProgress} 
            style={{ marginTop: 16 }}
            strokeColor="#1890ff"
          />
        )}
      </Modal>
    </div>
  )
})

export default SimpleDashboard
