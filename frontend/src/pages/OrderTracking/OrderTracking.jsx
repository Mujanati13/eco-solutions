import React, { useState, useEffect } from "react";
import {
  Table,
  Button,
  Space,
  Typography,
  Input,
  Select,
  Modal,
  message,
  Tag,
  Card,
  Row,
  Col,
  Timeline,
  Alert,
  Spin,
  Badge,
  Steps,
  Descriptions,
  Tooltip,
  Progress,
  Dropdown,
  Menu,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  SyncOutlined,
  EyeOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  TruckOutlined,
  HomeOutlined,
  GlobalOutlined,
  ReloadOutlined,
  SearchOutlined,
  EditOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { orderService } from "../../services/orderService";
import { useAuth } from "../../contexts/AuthContext";
import "./OrderTracking.css";

const { Title, Text, Link } = Typography;
const { Option } = Select;
const { Step } = Steps;

const OrderTracking = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [bulkSyncLoading, setBulkSyncLoading] = useState(false);
  const [ecotrackDetails, setEcotrackDetails] = useState(null);
  const [ecotrackLoading, setEcotrackLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor" || isAdmin;
  const canViewAllOrders = isAdmin || isSupervisor;

  useEffect(() => {
    fetchOrders();
  }, [pagination.current, pagination.pageSize, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        customer_name: searchText,
        status: statusFilter,
      };

      // Role-based filtering for employees
      if (!canViewAllOrders && user?.id) {
        // Employees only see their assigned orders
        params.assigned_to = user.id;
      }

      const response = await orderService.getOrders(params);
      setOrders(response.orders || []);
      setPagination({
        ...pagination,
        total: response.pagination?.total || 0,
      });
    } catch (error) {
      message.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchOrders();
  };

  const fetchTrackingInfo = async (orderId) => {
    try {
      setTrackingLoading(true);
      const response = await orderService.getTrackingInfo(orderId);
      setTrackingInfo(response);
    } catch (error) {
      console.error("Fetch tracking info error:", error);
      message.error(t("tracking.fetchError"));
    } finally {
      setTrackingLoading(false);
    }
  };

  const updateTrackingStatus = async (orderId) => {
    try {
      // Find the order to get its tracking ID
      const order = orders.find(o => o.id === orderId);
      if (!order || !order.ecotrack_tracking_id) {
        message.error(t("tracking.noTrackingId"));
        return;
      }

      // Call Ecotrack API to get latest status
      const response = await fetch('https://app.noest-dz.com/api/public/get/trackings/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_token: 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG',
          user_guid: '2QG0JDFP',
          trackings: [order.ecotrack_tracking_id]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data[order.ecotrack_tracking_id]) {
        const trackingData = data[order.ecotrack_tracking_id];
        // Get the latest status from the activity array (first item is the latest)
        const ecotrackStatus = trackingData.activity && trackingData.activity.length > 0 
          ? trackingData.activity[0].event 
          : 'unknown';
        
        const lastUpdate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        // Update the order in the database with the new Ecotrack status
        await orderService.updateOrder(orderId, {
          ecotrack_status: ecotrackStatus,
          ecotrack_last_update: lastUpdate
        });
        
        // Update the local state
        setOrders(prevOrders => 
          prevOrders.map(o => 
            o.id === orderId 
              ? { ...o, ecotrack_status: ecotrackStatus, ecotrack_last_update: lastUpdate }
              : o
          )
        );
        
        message.success(t("tracking.updateSuccess"));
      } else {
        message.warning(t("tracking.noTrackingData"));
      }
    } catch (error) {
      console.error("Update tracking error:", error);
      message.error(t("tracking.updateError"));
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await orderService.updateOrder(orderId, { status: newStatus });
      message.success(t("orders.updateSuccess"));
      fetchOrders();
    } catch (error) {
      console.error("Update order status error:", error);
      message.error(t("orders.updateError"));
    }
  };

  const bulkSyncTracking = async () => {
    try {
      setBulkSyncLoading(true);
      
      // Get all orders with tracking IDs (filtered by user's visibility)
      const ordersWithTracking = orders.filter(order => order.ecotrack_tracking_id);
      
      if (ordersWithTracking.length === 0) {
        message.warning(t("tracking.noOrdersWithTracking"));
        return;
      }
      
      // Get all tracking IDs
      const trackingIds = ordersWithTracking.map(order => order.ecotrack_tracking_id);
      
      // Call Ecotrack API for bulk tracking
      const response = await fetch('https://app.noest-dz.com/api/public/get/trackings/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_token: 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG',
          user_guid: '2QG0JDFP',
          trackings: trackingIds
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let updatedCount = 0;
      
      // Process each order
      for (const order of ordersWithTracking) {
        if (data[order.ecotrack_tracking_id]) {
          const trackingData = data[order.ecotrack_tracking_id];
          const ecotrackStatus = trackingData.activity && trackingData.activity.length > 0 
            ? trackingData.activity[0].event 
            : 'unknown';
          
          const lastUpdate = new Date().toISOString().slice(0, 19).replace('T', ' ');
          
          try {
            // Update the order in the database
            await orderService.updateOrder(order.id, {
              ecotrack_status: ecotrackStatus,
              ecotrack_last_update: lastUpdate
            });
            updatedCount++;
          } catch (error) {
            console.error(`Failed to update order ${order.id}:`, error);
          }
        }
      }
      
      message.success(t("tracking.bulkSyncSuccess", { count: updatedCount }));
      
      // Refresh orders to get updated data from database
      fetchOrders();
      
    } catch (error) {
      console.error("Bulk sync error:", error);
      message.error(t("tracking.bulkSyncError"));
    } finally {
      setBulkSyncLoading(false);
    }
  };

  const viewEcotrackDetails = async (trackingId) => {
    if (!trackingId) {
      message.error(t("tracking.noTrackingId"));
      return;
    }
    
    try {
      setEcotrackLoading(true);
      
      // Call the Ecotrack API directly using the same logic as ecotrackService
      const response = await fetch('https://app.noest-dz.com/api/public/get/trackings/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_token: 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG',
          user_guid: '2QG0JDFP',
          trackings: [trackingId]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Ecotrack API response:', data);
      console.log('Looking for tracking ID:', trackingId);
      
      // Process the response data
      if (data && data[trackingId]) {
        const trackingData = data[trackingId];
        console.log('Tracking data for', trackingId, ':', trackingData);
        console.log('OrderInfo:', trackingData.OrderInfo);
        console.log('Activity:', trackingData.activity);
        setEcotrackDetails(trackingData);
      } else {
        console.log('No tracking data found for', trackingId);
        console.log('Available keys in response:', Object.keys(data || {}));
        message.warning(t("tracking.noTrackingData"));
      }
    } catch (error) {
      console.error("Fetch Ecotrack details error:", error);
      message.error(t("tracking.fetchError"));
      // Fallback to opening external link if API fails
      const ecotrackUrl = `https://app.noest-dz.com/tracking/${trackingId}`;
      window.open(ecotrackUrl, '_blank');
    } finally {
      setEcotrackLoading(false);
    }
  };

  const showTrackingModal = (order) => {
    setSelectedOrder(order);
    setTrackingModalVisible(true);
    setEcotrackDetails(null); // Clear previous data
    
    if (order.ecotrack_tracking_id) {
      viewEcotrackDetails(order.ecotrack_tracking_id);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "orange",
      confirmed: "green",
      processing: "blue",
      out_for_delivery: "purple",
      delivered: "success",
      cancelled: "error",
      returned: "warning",
      on_hold: "default",
      "0_tent": "cyan",
      "1_tent": "geekblue",
      "2_tent": "magenta",
      "3_tent": "volcano",
      "4_tent": "gold",
      "5_tent": "lime",
      "6_tent": "red",
    };
    return colors[status] || "default";
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <ClockCircleOutlined />,
      confirmed: <CheckCircleOutlined />,
      processing: <GlobalOutlined />,
      out_for_delivery: <TruckOutlined />,
      delivered: <HomeOutlined />,
      cancelled: <ExclamationCircleOutlined />,
      returned: <ExclamationCircleOutlined />,
      on_hold: <ClockCircleOutlined />,
      "0_tent": <ShopOutlined />,
      "1_tent": <ShopOutlined />,
      "2_tent": <ShopOutlined />,
      "3_tent": <ShopOutlined />,
      "4_tent": <ShopOutlined />,
      "5_tent": <ShopOutlined />,
      "6_tent": <ShopOutlined />,
    };
    return icons[status] || <ClockCircleOutlined />;
  };

  const getStatusMenu = (record) => {
    const statusOptions = [
      { key: "pending", label: t("orders.statuses.pending") },
      { key: "confirmed", label: t("orders.statuses.confirmed") },
      { key: "processing", label: t("orders.statuses.processing") },
      { key: "out_for_delivery", label: t("orders.statuses.out_for_delivery") },
      { key: "delivered", label: t("orders.statuses.delivered") },
      { key: "cancelled", label: t("orders.statuses.cancelled") },
      { key: "returned", label: t("orders.statuses.returned") },
      { key: "on_hold", label: t("orders.statuses.on_hold") },
      { key: "0_tent", label: t("orders.statuses.0_tent") || "0 Tent" },
      { key: "1_tent", label: t("orders.statuses.1_tent") || "1 Tent" },
      { key: "2_tent", label: t("orders.statuses.2_tent") || "2 Tent" },
      { key: "3_tent", label: t("orders.statuses.3_tent") || "3 Tent" },
      { key: "4_tent", label: t("orders.statuses.4_tent") || "4 Tent" },
      { key: "5_tent", label: t("orders.statuses.5_tent") || "5 Tent" },
      { key: "6_tent", label: t("orders.statuses.6_tent") || "6 Tent" },
    ];

    return (
      <Menu onClick={({ key }) => updateOrderStatus(record.id, key)}>
        {statusOptions.map((option) => (
          <Menu.Item key={option.key} disabled={record.status === option.key}>
            <Space>
              {getStatusIcon(option.key)}
              <span>{option.label}</span>
              {record.status === option.key && (
                <Tag size="small" color="blue">
                  Current
                </Tag>
              )}
            </Space>
          </Menu.Item>
        ))}
      </Menu>
    );
  };

  const getTrackingStatusIcon = (status) => {
    const icons = {
      created: <ClockCircleOutlined />,
      confirmed: <CheckCircleOutlined />,
      picked_up: <TruckOutlined />,
      in_transit: <GlobalOutlined />,
      out_for_delivery: <TruckOutlined />,
      delivered: <HomeOutlined />,
      returned: <ExclamationCircleOutlined />,
      cancelled: <ExclamationCircleOutlined />,
    };
    return icons[status] || <ClockCircleOutlined />;
  };

  const getTrackingSteps = (history) => {
    if (!history || history.length === 0) return [];

    return history.map((item, index) => ({
      title: item.action
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      description: item.details,
      status: index === 0 ? "process" : "finish",
      icon: getTrackingStatusIcon(item.action),
    }));
  };

  const renderTrackingContent = () => {
    if (trackingLoading || ecotrackLoading) {
      return (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>{t("tracking.loadingEcotrack")}</Text>
          </div>
        </div>
      );
    }

    if (!selectedOrder?.ecotrack_tracking_id) {
      return (
        <Alert
          message={t("tracking.noTrackingId")}
          description={t("tracking.noTrackingIdDesc")}
          type="warning"
          showIcon
        />
      );
    }

    // Show Ecotrack details if available
    if (ecotrackDetails) {
      const latestActivity = ecotrackDetails.activity && ecotrackDetails.activity.length > 0 
        ? ecotrackDetails.activity[0] 
        : null;

      return (
        <div>
          {/* Current Status Summary */}
          {latestActivity && (
            <Card 
              style={{ 
                marginBottom: 16, 
                background: 'linear-gradient(45deg, #f0f9ff, #e0f2fe)',
                border: '1px solid #0ea5e9'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <Title level={4} style={{ margin: 0, color: '#0369a1' }}>
                  {t("tracking.currentStatus")}
                </Title>
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue" style={{ fontSize: '16px', padding: '8px 16px' }}>
                    {latestActivity.event}
                  </Tag>
                </div>
                <div style={{ marginTop: 8, color: '#64748b' }}>
                  <Text>
                    {t("tracking.lastUpdated")}: {new Date(latestActivity.date).toLocaleString()}
                  </Text>
                </div>
                <div style={{ marginTop: 4, color: '#64748b' }}>
                  <Text>
                    {latestActivity.causer} - {latestActivity.by}
                  </Text>
                </div>
              </div>
            </Card>
          )}

          <Title level={4}>{t("tracking.ecotrackDetails")}</Title>
          <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label={t("tracking.trackingId")}>
              <Text copyable>{selectedOrder.ecotrack_tracking_id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t("tracking.status")}>
              <Tag color="blue" style={{ fontSize: '14px', padding: '4px 8px' }}>
                {ecotrackDetails.activity && ecotrackDetails.activity.length > 0 
                  ? ecotrackDetails.activity[0].event 
                  : "Unknown"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t("tracking.recipient")}>
              {ecotrackDetails.recipientName || ecotrackDetails.OrderInfo?.client || t("tracking.unknown")}
            </Descriptions.Item>
            <Descriptions.Item label={t("tracking.phone")}>
              {ecotrackDetails.OrderInfo?.phone || t("tracking.unknown")}
            </Descriptions.Item>
            <Descriptions.Item label={t("tracking.amount")}>
              {ecotrackDetails.OrderInfo?.montant ? `${ecotrackDetails.OrderInfo.montant} DA` : t("tracking.unknown")}
            </Descriptions.Item>
            <Descriptions.Item label={t("tracking.location")}>
              {ecotrackDetails.OrderInfo?.commune || t("tracking.unknown")}
            </Descriptions.Item>
            <Descriptions.Item label={t("tracking.shippedBy")}>
              {ecotrackDetails.shippedBy || t("tracking.unknown")}
            </Descriptions.Item>
            <Descriptions.Item label={t("tracking.product")}>
              {ecotrackDetails.OrderInfo?.produit || t("tracking.unknown")}
            </Descriptions.Item>
            <Descriptions.Item label={t("tracking.remarks")} span={2}>
              {ecotrackDetails.OrderInfo?.remarque || t("tracking.unknown")}
            </Descriptions.Item>
          </Descriptions>

          {/* Ecotrack Activity Timeline */}
          {ecotrackDetails.activity && ecotrackDetails.activity.length > 0 && (
            <div>
              <Title level={4}>{t("tracking.ecotrackHistory")}</Title>
              <Timeline mode="left">
                {ecotrackDetails.activity.map((item, index) => (
                  <Timeline.Item
                    key={index}
                    color={index === 0 ? "blue" : "green"}
                    dot={index === 0 ? <CheckCircleOutlined style={{ fontSize: '16px' }} /> : undefined}
                  >
                    <div>
                      <Text strong style={{ fontSize: '14px' }}>{item.event}</Text>
                      {index === 0 && (
                        <Tag color="red" size="small" style={{ marginLeft: 8 }}>
                          Latest
                        </Tag>
                      )}
                      <div style={{ color: "#666", fontSize: "12px", marginTop: 2 }}>
                        {new Date(item.date).toLocaleString()}
                      </div>
                      <div style={{ marginTop: 4, fontSize: "12px" }}>
                        <Text type="secondary">
                          <strong>{item.causer}</strong> - {item.by}
                        </Text>
                      </div>
                      {item.content && (
                        <div style={{ marginTop: 4, fontSize: "12px" }}>
                          <Text type="secondary">{item.content}</Text>
                        </div>
                      )}
                      {item.driver && (
                        <div style={{ marginTop: 4, fontSize: "12px" }}>
                          <Text type="secondary">
                            <TruckOutlined style={{ marginRight: 4 }} />
                            Driver: {item.driver}
                          </Text>
                        </div>
                      )}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>
          )}
        </div>
      );
    }

    // Fallback message if no data is available
    return (
      <Alert
        message={t("tracking.noTrackingData") || "No tracking data available"}
        description={t("tracking.noTrackingDataDesc") || "Please click the button to load tracking data from Ecotrack API"}
        type="info"
        showIcon
        action={
          <Button
            type="primary"
            onClick={() => viewEcotrackDetails(selectedOrder.ecotrack_tracking_id)}
          >
            {t("tracking.loadEcotrackData") || "Load Ecotrack Data"}
          </Button>
        }
      />
    );
  };

  const columns = [
    {
      title: t("orders.customerName"),
      dataIndex: "customer_name",
      key: "customer_name",
      width: 200,
    },
    {
      title: t("orders.status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status, record) => (
        <Dropdown
          overlay={getStatusMenu(record)}
          trigger={["click"]}
          placement="bottomLeft"
        >
          <Button
            type="text"
            size="small"
            style={{
              padding: "2px 8px",
              border: `1px solid ${getStatusColor(status)}`,
              borderRadius: "4px",
              color: getStatusColor(status),
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <Space size="small">
              {getStatusIcon(status)}
              <span>{t(`orders.statuses.${status}`)}</span>
            </Space>
          </Button>
        </Dropdown>
      ),
    },
    {
      title: t("tracking.ecotrackId"),
      dataIndex: "ecotrack_tracking_id",
      key: "ecotrack_tracking_id",
      width: 150,
      render: (trackingId) =>
        trackingId ? (
          <Badge status="success" text={<Text copyable>{trackingId}</Text>} />
        ) : (
          <Badge status="default" text={t("tracking.noTrackingId")} />
        ),
    },
    {
      title: t("tracking.ecotrackStatus"),
      dataIndex: "ecotrack_status",
      key: "ecotrack_status",
      width: 200,
      render: (ecotrackStatus, record) =>
        ecotrackStatus ? (
          <Tooltip title={ecotrackStatus}>
            <Tag color="blue" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ecotrackStatus}
            </Tag>
          </Tooltip>
        ) : (
          <Text type="secondary">{t("tracking.notSynced")}</Text>
        ),
    },
    {
      title: t("tracking.lastUpdate"),
      dataIndex: "ecotrack_last_update",
      key: "ecotrack_last_update",
      width: 150,
      render: (lastUpdate) =>
        lastUpdate
          ? new Date(lastUpdate).toLocaleString()
          : t("tracking.never"),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 200,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Tooltip title={t("tracking.viewDetails")}>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => showTrackingModal(record)}
            />
          </Tooltip>
          {record.ecotrack_tracking_id && (
            <Tooltip title={t("tracking.syncStatus")}>
              <Button
                type="link"
                icon={<SyncOutlined />}
                onClick={() => updateTrackingStatus(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="order-tracking-page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        {canViewAllOrders && (
          <Button
            type="primary"
            loading={bulkSyncLoading}
            onClick={bulkSyncTracking}
            icon={<SyncOutlined />}
          >
            {t("tracking.syncAll")}
          </Button>
        )}
      </div>
      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        {!canViewAllOrders && (
          <Alert
            message={t("tracking.employeeView")}
            description={t("tracking.employeeViewDescription")}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder={t("orders.searchPlaceholder")}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder={t("orders.filterByStatus")}
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
            >
              <Option value="pending">{t("orders.statuses.pending")}</Option>
              <Option value="confirmed">
                {t("orders.statuses.confirmed")}
              </Option>
              <Option value="processing">
                {t("orders.statuses.processing")}
              </Option>
              <Option value="out_for_delivery">
                {t("orders.statuses.out_for_delivery")}
              </Option>
              <Option value="delivered">
                {t("orders.statuses.delivered")}
              </Option>
              <Option value="cancelled">
                {t("orders.statuses.cancelled")}
              </Option>
              <Option value="returned">{t("orders.statuses.returned")}</Option>
              <Option value="on_hold">{t("orders.statuses.on_hold")}</Option>
              <Option value="0_tent">
                {t("orders.statuses.0_tent") || "0 Tent"}
              </Option>
              <Option value="1_tent">
                {t("orders.statuses.1_tent") || "1 Tent"}
              </Option>
              <Option value="2_tent">
                {t("orders.statuses.2_tent") || "2 Tent"}
              </Option>
              <Option value="3_tent">
                {t("orders.statuses.3_tent") || "3 Tent"}
              </Option>
              <Option value="4_tent">
                {t("orders.statuses.4_tent") || "4 Tent"}
              </Option>
              <Option value="5_tent">
                {t("orders.statuses.5_tent") || "5 Tent"}
              </Option>
              <Option value="6_tent">
                {t("orders.statuses.6_tent") || "6 Tent"}
              </Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button
                type="primary"
                onClick={handleSearch}
                icon={<SearchOutlined />}
              >
                {t("common.search")}
              </Button>
              <Button onClick={fetchOrders} icon={<ReloadOutlined />}>
                {t("common.refresh")}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Orders Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Tracking Details Modal */}
      <Modal
        title={
          <Space>
            <TruckOutlined />
            {t("tracking.trackingDetails")}
            {selectedOrder && ` - ${selectedOrder.order_number}`}
          </Space>
        }
        open={trackingModalVisible}
        onCancel={() => {
          setTrackingModalVisible(false);
          setSelectedOrder(null);
          setTrackingInfo(null);
          setEcotrackDetails(null);
        }}
        footer={[
          <Button key="close" onClick={() => setTrackingModalVisible(false)}>
            {t("common.close")}
          </Button>,
          selectedOrder?.ecotrack_tracking_id && (
            <Button
              key="sync"
              type="primary"
              icon={<SyncOutlined />}
              onClick={() => {
                updateTrackingStatus(selectedOrder.id);
                // Refresh the modal data after sync
                if (selectedOrder.ecotrack_tracking_id) {
                  viewEcotrackDetails(selectedOrder.ecotrack_tracking_id);
                }
              }}
            >
              {t("tracking.syncNow")}
            </Button>
          ),
          selectedOrder?.ecotrack_tracking_id && (
            <Button
              key="viewDetails"
              type="default"
              icon={<GlobalOutlined />}
              onClick={() => viewEcotrackDetails(selectedOrder.ecotrack_tracking_id)}
            >
              {t("tracking.viewEcotrackDetails")}
            </Button>
          ),
        ]}
        width={800}
      >
        {renderTrackingContent()}
      </Modal>
    </div>
  );
};

export default OrderTracking;
