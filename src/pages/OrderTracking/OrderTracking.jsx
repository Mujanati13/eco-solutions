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
      const response = await orderService.updateTrackingStatus(orderId);
      message.success(t("tracking.updateSuccess"));
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        await fetchTrackingInfo(orderId);
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
      const response = await orderService.bulkSyncTracking();
      message.success(
        t("tracking.bulkSyncSuccess", { count: response.updated })
      );
      fetchOrders();
    } catch (error) {
      console.error("Bulk sync error:", error);
      message.error(t("tracking.bulkSyncError"));
    } finally {
      setBulkSyncLoading(false);
    }
  };

  const showTrackingModal = (order) => {
    setSelectedOrder(order);
    setTrackingModalVisible(true);
    if (order.ecotrack_tracking_id) {
      fetchTrackingInfo(order.id);
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
    if (trackingLoading) {
      return (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>{t("tracking.loading")}</Text>
          </div>
        </div>
      );
    }

    if (!trackingInfo) {
      return (
        <Alert
          message={t("tracking.noTrackingInfo")}
          description={t("tracking.noTrackingInfoDesc")}
          type="info"
          showIcon
        />
      );
    }

    if (!trackingInfo.has_tracking) {
      return (
        <Alert
          message={t("tracking.noTrackingId")}
          description={t("tracking.noTrackingIdDesc")}
          type="warning"
          showIcon
        />
      );
    }

    const { tracking } = trackingInfo;

    return (
      <div>
        <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
          <Descriptions.Item label={t("tracking.trackingId")}>
            <Text copyable>{tracking.tracking_id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t("tracking.currentStatus")}>
            <Tag color={getStatusColor(tracking.status)}>{tracking.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t("tracking.location")}>
            {tracking.location || t("tracking.unknown")}
          </Descriptions.Item>
          <Descriptions.Item label={t("tracking.lastUpdate")}>
            {tracking.last_update
              ? new Date(tracking.last_update).toLocaleString()
              : t("tracking.unknown")}
          </Descriptions.Item>
          {tracking.tracking_url && (
            <Descriptions.Item label={t("tracking.trackingUrl")} span={2}>
              <Link href={tracking.tracking_url} target="_blank">
                <LinkOutlined /> {t("tracking.viewOnEcotrack")}
              </Link>
            </Descriptions.Item>
          )}
        </Descriptions>

        {tracking.history && tracking.history.length > 0 && (
          <div>
            <Title level={4}>{t("tracking.history")}</Title>
            <Timeline mode="left">
              {tracking.history.map((item, index) => (
                <Timeline.Item
                  key={index}
                  dot={getTrackingStatusIcon(item.action)}
                  color={index === 0 ? "blue" : "green"}
                >
                  <div>
                    <Text strong>
                      {item.action
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Text>
                    <div style={{ color: "#666", fontSize: "12px" }}>
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                    {item.details && (
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary">{item.details}</Text>
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
  };

  const columns = [
    {
      title: t("orders.orderNumber"),
      dataIndex: "order_number",
      key: "order_number",
      width: 220,
    },
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
      width: 150,
      render: (ecotrackStatus, record) =>
        ecotrackStatus ? (
          <Tag color="blue">{ecotrackStatus}</Tag>
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
        {isAdmin && (
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
              onClick={() => updateTrackingStatus(selectedOrder.id)}
            >
              {t("tracking.syncNow")}
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
