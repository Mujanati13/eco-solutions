import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Spin, message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  ShoppingCartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  DollarOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import './SimpleDashboard.css';

const { Title, Text } = Typography;

const SimpleDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [orderStatus, setOrderStatus] = useState([]);
  const [trends, setTrends] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [performance, setPerformance] = useState([]);
  const { user } = useAuth();
  const { 
    hasPermission, 
    isAdmin, 
    isSupervisor,
    loading: permissionsLoading 
  } = usePermissions();
  const { t } = useTranslation();

  useEffect(() => {
    if (!permissionsLoading) {
      fetchDashboardData();
    }
  }, [permissionsLoading]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch all data in parallel
      const endpoints = [
        '/api/dashboard-simple/stats',
        '/api/dashboard-simple/order-status',
        '/api/dashboard-simple/trends?days=7',
        '/api/dashboard-simple/recent-orders?limit=5'
      ];

      if (isAdmin) {
        endpoints.push('/api/dashboard-simple/performance');
      }

      const responses = await Promise.all(
        endpoints.map(url => 
          fetch(url, { headers }).then(res => res.ok ? res.json() : [])
        )
      );

      setStats(responses[0] || {});
      setOrderStatus(responses[1] || []);
      setTrends(responses[2] || []);
      setRecentOrders(responses[3] || []);
      if (isAdmin && responses[4]) {
        setPerformance(responses[4] || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      message.error(t('common.dashboardLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Chart configurations
  const getStatusChartOption = () => ({
    title: {
      text: t('dashboard.orderDistribution'),
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    series: [{
      name: t('dashboard.orders'),
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '60%'],
      data: orderStatus.map(item => ({
        name: t(`orders.statusTypes.${item.status}`) || item.status,
        value: item.count
      })),
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  });

  const getTrendsChartOption = () => ({
    title: {
      text: t('dashboard.orderTrends'),
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: [t('dashboard.total'), t('dashboard.pending'), t('dashboard.delivered')],
      bottom: 10
    },
    xAxis: {
      type: 'category',
      data: trends.map(item => item.date)
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: t('dashboard.total'),
        type: 'line',
        data: trends.map(item => item.total),
        smooth: true,
        lineStyle: { color: '#1890ff' }
      },
      {
        name: t('dashboard.pending'),
        type: 'line',
        data: trends.map(item => item.pending),
        smooth: true,
        lineStyle: { color: '#fa8c16' }
      },
      {
        name: t('dashboard.delivered'),
        type: 'line',
        data: trends.map(item => item.delivered),
        smooth: true,
        lineStyle: { color: '#52c41a' }
      }
    ]
  });

  const getPerformanceChartOption = () => ({
    title: {
      text: t('dashboard.teamPerformance'),
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    xAxis: {
      type: 'category',
      data: performance.map(item => `${item.first_name} ${item.last_name}`),
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
        name: t('dashboard.totalOrders'),
        type: 'bar',
        data: performance.map(item => item.total_orders),
        itemStyle: { color: '#1890ff' }
      },
      {
        name: t('dashboard.deliveredOrders'),
        type: 'bar',
        data: performance.map(item => item.delivered_orders),
        itemStyle: { color: '#52c41a' }
      }
    ]
  });

  const tableColumns = [
    {
      title: t('orders.orderNumber'),
      dataIndex: 'order_number',
      key: 'order_number',
      render: text => text || '-'
    },
    {
      title: t('orders.customerName'),
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: text => text || '-'
    },
    {
      title: t('orders.status'),
      dataIndex: 'status',
      key: 'status',
      render: status => (
        <span style={{
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          backgroundColor: getStatusColor(status),
          color: '#fff'
        }}>
          {t(`orders.statusTypes.${status}`) || status}
        </span>
      )
    },
    {
      title: t('orders.totalAmount'),
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: amount => {
        const numAmount = Number(amount || 0);
        return `$${!isNaN(numAmount) ? numAmount.toFixed(2) : '0.00'}`;
      }
    }
  ];

  const getStatusColor = (status) => {
    const colors = {
      pending: '#fa8c16',
      confirmed: '#52c41a',
      processing: '#1890ff',
      delivered: '#722ed1',
      cancelled: '#f5222d',
      returned: '#fa541c'
    };
    return colors[status] || '#d9d9d9';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="simple-dashboard">
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {isAdmin ? (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('dashboard.totalOrders')}
                  value={stats.totalOrders || 0}
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('dashboard.pendingOrders')}
                  value={stats.pendingOrders || 0}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('dashboard.completedOrders')}
                  value={stats.completedOrders || 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('dashboard.totalRevenue')}
                  value={Number(stats.totalRevenue || 0)}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </>
        ) : (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('dashboard.myOrders')}
                  value={stats.myOrders || 0}
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('dashboard.myPending')}
                  value={stats.myPending || 0}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('dashboard.myCompleted')}
                  value={stats.myCompleted || 0}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title={t('dashboard.myToday')}
                  value={stats.myToday || 0}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* Charts Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card>
            {orderStatus.length > 0 ? (
              <ReactECharts 
                option={getStatusChartOption()} 
                style={{ height: '350px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <Text type="secondary">{t('common.noData')}</Text>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card>
            {trends.length > 0 ? (
              <ReactECharts 
                option={getTrendsChartOption()} 
                style={{ height: '350px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <Text type="secondary">{t('common.noData')}</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Performance Chart (Admin Only) */}
      {isAdmin && performance.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card>
              <ReactECharts 
                option={getPerformanceChartOption()} 
                style={{ height: '400px' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Recent Orders Table */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title={t('dashboard.recentOrders')}>
            <Table
              columns={tableColumns}
              dataSource={recentOrders}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: t('common.noData') }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SimpleDashboard;
