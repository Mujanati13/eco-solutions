import React, { useState, useEffect } from "react";
import {
  Table,
  Button,
  Space,
  Typography,
  Input,
  Select,
  Modal,
  Form,
  message,
  Tag,
  Popconfirm,
  Card,
  Row,
  Col,
  Tabs,
  Dropdown,
  Menu,
  Upload,
  Spin,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ExportOutlined,
  ReloadOutlined,
  UserAddOutlined,
  ShareAltOutlined,
  SyncOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { orderService } from "../../services/orderService";
import { userService } from "../../services/userService";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import "./Orders.css";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const { user } = useAuth();
  const { t } = useTranslation();
  const { 
    hasPermission, 
    hasAnyPermission, 
    isAdmin, 
    isSupervisor,
    loading: permissionsLoading 
  } = usePermissions();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!permissionsLoading) {
      fetchOrders();
      if (hasPermission('canViewUsers') || isAdmin()) {
        fetchUsers();
      }
    }
  }, [
    pagination.current,
    pagination.pageSize,
    searchText,
    statusFilter,
    activeTab,
    permissionsLoading,
  ]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchText,
        status: statusFilter,
      };

      // Add filters based on active tab
      if (hasPermission('canViewAllOrders') || isAdmin()) {
        switch (activeTab) {
          case "unassigned":
            params.assigned_to = "null";
            break;
          case "assigned":
            params.assigned_to = "not_null";
            break;
          case "delayed":
            // Filter orders older than 7 days and not yet delivered
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            params.created_before = sevenDaysAgo.toISOString().split("T")[0];
            params.exclude_status = "delivered,cancelled,returned";
            break;
          // 'all' tab shows everything
        }
      } else {
        // Employees only see their assigned orders
        params.assigned_to = user.id;

        // For delayed tab, employees see only their delayed orders
        if (activeTab === "delayed") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          params.created_before = sevenDaysAgo.toISOString().split("T")[0];
          params.exclude_status = "delivered,cancelled,returned";
        }
      }

      const response = await orderService.getAllOrders(params);
      
      console.log('Orders API response:', response); // Debug log
      
      // Handle different response structures
      const ordersData = response.data?.orders || response.orders || [];
      const paginationData = response.data?.pagination || response.pagination || {};
      
      setOrders(ordersData);
      setPagination((prev) => ({
        ...prev,
        total: paginationData.total || response.data?.total || ordersData.length,
        current: paginationData.page || params.page || prev.current,
        pageSize: paginationData.limit || params.limit || prev.pageSize,
      }));
    } catch (error) {
      message.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await userService.getAllUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleAddOrder = () => {
    setEditingOrder(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    form.setFieldsValue(order);
    setModalVisible(true);
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await orderService.deleteOrder(orderId);
      message.success("Order deleted successfully");
      fetchOrders();
    } catch (error) {
      message.error("Failed to delete order");
    }
  };

  const handleModalSubmit = async (values) => {
    try {
      if (editingOrder) {
        await orderService.updateOrder(editingOrder.id, values);
        message.success("Order updated successfully");
      } else {
        await orderService.createOrder(values);
        message.success("Order created successfully");
      }
      setModalVisible(false);
      fetchOrders();
    } catch (error) {
      message.error("Failed to save order");
    }
  };

  const handleAssignOrder = async (orderId, userId) => {
    try {
      await orderService.assignOrder(orderId, userId);
      message.success("Order assigned successfully");
      fetchOrders();
    } catch (error) {
      message.error("Failed to assign order");
    }
  };

  const handleDistributeOrders = async () => {
    try {
      const response = await fetch("/api/orders/distribute", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        message.success(
          `${result.distributed} orders distributed successfully`
        );
        fetchOrders();
      } else {
        throw new Error("Distribution failed");
      }
    } catch (error) {
      message.error("Failed to distribute orders");
    }
  };

  const handleUpdateStatus = async (orderId, status, notes = "") => {
    try {
      await orderService.updateOrder(orderId, { status, notes });
      message.success("Order status updated successfully");
      fetchOrders();
    } catch (error) {
      message.error("Failed to update order status");
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      message.success("Order status updated successfully");
      fetchOrders();
    } catch (error) {
      message.error("Failed to update order status");
    }
  };

  const handleUpdateTracking = async (orderId) => {
    try {
      const response = await orderService.updateOrderTracking(orderId);
      message.success("Tracking status updated successfully");
      fetchOrders();
    } catch (error) {
      message.error("Failed to update tracking status");
    }
  };

  const handleBulkTrackingSync = async () => {
    try {
      setLoading(true);
      const response = await orderService.syncAllTracking();
      message.success(response.data.message);
      fetchOrders();
    } catch (error) {
      message.error("Failed to sync tracking statuses");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);

      const response = await fetch("/api/orders/import", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        message.success(t("dashboard.importSuccess", { count: result.imported }));

        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          Modal.warning({
            title: t("dashboard.importWarnings"),
            content: (
              <div>
                <p>{t("dashboard.missingFieldsWarning")}:</p>
                <ul style={{ maxHeight: "200px", overflow: "auto" }}>
                  {result.warnings.slice(0, 10).map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                  {result.warnings.length > 10 && (
                    <li>
                      {t("dashboard.andMore", {
                        count: result.warnings.length - 10,
                      })}
                    </li>
                  )}
                </ul>
              </div>
            ),
            width: 600,
          });
        }

        // Show errors if any
        if (result.errors && result.errors.length > 0) {
          Modal.error({
            title: t("dashboard.importErrors"),
            content: (
              <div>
                <p>{t("dashboard.someRowsFailed")}:</p>
                <ul style={{ maxHeight: "200px", overflow: "auto" }}>
                  {result.errors.slice(0, 10).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>
                      {t("dashboard.andMore", {
                        count: result.errors.length - 10,
                      })}
                    </li>
                  )}
                </ul>
              </div>
            ),
            width: 600,
          });
        }

        fetchOrders();
        setImportModalVisible(false);
      } else {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || t("dashboard.importError")
        );
      }
    } catch (error) {
      console.error("Import error:", error);
      message.error(error.message || t("dashboard.importError"));
    } finally {
      setUploading(false);
    }

    return false; // Prevent auto upload
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

  const getTrackingStatusColor = (status) => {
    const colors = {
      pending: "orange",
      confirmed: "blue",
      in_transit: "purple",
      out_for_delivery: "purple",
      delivered: "success",
      cancelled: "error",
      returned: "warning",
      failed: "error",
    };
    return colors[status] || "default";
  };

  const getAllowedStatusTransitions = (currentStatus, userRole) => {
    const transitions = {
      pending: ["confirmed", "cancelled", "on_hold", "0_tent", "1_tent", "2_tent"],
      confirmed: ["processing", "cancelled", "on_hold", "0_tent", "1_tent", "2_tent"],
      processing: ["out_for_delivery", "cancelled", "on_hold", "0_tent", "1_tent", "2_tent"],
      out_for_delivery: ["delivered", "returned", "cancelled", "0_tent", "1_tent", "2_tent"],
      on_hold: ["pending", "confirmed", "cancelled", "0_tent", "1_tent", "2_tent"],
      delivered: userRole === "admin" ? ["returned"] : [],
      cancelled: userRole === "admin" ? ["pending"] : [],
      returned: userRole === "admin" ? ["pending", "cancelled"] : [],
      "0_tent": ["1_tent", "2_tent", "pending", "confirmed", "processing", "cancelled"],
      "1_tent": ["0_tent", "2_tent", "pending", "confirmed", "processing", "cancelled"],
      "2_tent": ["0_tent", "1_tent", "pending", "confirmed", "processing", "cancelled"],
    };
    return transitions[currentStatus] || [];
  };

  const canEditOrder = (order) => {
    // Check if user has permission to edit orders
    if (!hasPermission('canEditOrders')) return false;
    
    // Admins can edit any order
    if (isAdmin()) return true;
    
    // Supervisors can edit orders but with some restrictions
    if (isSupervisor()) {
      const restrictedStatuses = ["delivered", "cancelled", "returned"];
      return !restrictedStatuses.includes(order.status);
    }
    
    // Employees can only edit their assigned orders and only if not finalized
    const restrictedStatuses = ["delivered", "cancelled", "returned"];
    return order.assigned_to === user.id && !restrictedStatuses.includes(order.status);
  };

  // Helper function to check if an order is delayed (older than 7 days)
  const isOrderDelayed = (createdAt) => {
    const orderDate = new Date(createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return orderDate < sevenDaysAgo;
  };

  // Helper function to get row class name for delayed orders
  const getRowClassName = (record) => {
    const isDelayed = isOrderDelayed(record.created_at);
    const isFinalized = ["delivered", "cancelled", "returned"].includes(
      record.status
    );

    if (isDelayed && !isFinalized) {
      return "delayed-order-row";
    }
    return "";
  };

  // Helper function to calculate order age in days
  const getOrderAge = (createdAt) => {
    const orderDate = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - orderDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const columns = [
    {
      title: t("orders.orderNumber"),
      dataIndex: "orderNumber",
      key: "orderNumber",
      width: 120,
      render: (orderNumber) => orderNumber || "-",
    },
    {
      title: t("orders.customerName"),
      dataIndex: "customerName",
      key: "customerName",
      width: 150,
      render: (customerName) => customerName || "-",
    },
    {
      title: t("orders.customerPhone"),
      dataIndex: "customerPhone",
      key: "customerPhone",
      width: 130,
      render: (customerPhone) => customerPhone || "-",
    },
    {
      title: t("orders.totalAmount"),
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 120,
      render: (amount) => {
        if (!amount && amount !== 0) return "-";
        const numAmount = Number(amount);
        return `$${!isNaN(numAmount) ? numAmount.toFixed(2) : "-"}`;
      },
    },
    {
      title: t("orders.status"),
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status, record) => {
        const allowedTransitions = getAllowedStatusTransitions(
          status,
          user?.role
        );

        if (canEditOrder(record) && allowedTransitions.length > 0) {
          return (
            <Select
              size="small"
              style={{ width: "100%" }}
              value={status}
              onChange={(newStatus) => handleStatusUpdate(record.id, newStatus)}
            >
              <Option value={status}>
                <Tag color={getStatusColor(status)}>
                  {t(`orders.statusTypes.${status}`) ||
                    t(`orders.${status}`) ||
                    status}
                </Tag>
              </Option>
              {allowedTransitions.map((newStatus) => (
                <Option key={newStatus} value={newStatus}>
                  <Tag color={getStatusColor(newStatus)}>
                    {t(`orders.statusTypes.${newStatus}`) ||
                      t(`orders.${newStatus}`) ||
                      newStatus}
                  </Tag>
                </Option>
              ))}
            </Select>
          );
        }

        return (
          <Tag color={getStatusColor(status)}>
            {t(`orders.statusTypes.${status}`) ||
              t(`orders.${status}`) ||
              status}
          </Tag>
        );
      },
    },
    {
      title: t("orders.wilayaCode"),
      dataIndex: "wilaya_code",
      key: "wilaya_code",
      width: 100,
      render: (wilayaCode) => wilayaCode || "-",
    },
    {
      title: t("orders.assignedTo"),
      dataIndex: "assigned_to",
      key: "assigned_to",
      width: 150,
      render: (assignedTo, record) => {
        if (isAdmin) {
          return (
            <Select
              size="small"
              style={{ width: "100%" }}
              placeholder="Assign to..."
              value={assignedTo || undefined}
              onChange={(userId) => handleAssignOrder(record.id, userId)}
            >
              <Option value={null}>Unassigned</Option>
              {users.map((user) => (
                <Option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                </Option>
              ))}
            </Select>
          );
        }
        return assignedTo
          ? `${record.assigned_first_name} ${record.assigned_last_name}`
          : "-";
      },
    },
    {
      title: t("orders.createdAt"),
      dataIndex: "created_at",
      key: "createdAt",
      width: 120,
      render: (date) => date ? new Date(date).toLocaleDateString() : "-",
    },
    {
      title: t("orders.age"),
      dataIndex: "created_at",
      key: "age",
      width: 100,
      render: (createdAt, record) => {
        const age = getOrderAge(createdAt);
        const isDelayed = isOrderDelayed(createdAt);
        const isFinalized = ["delivered", "cancelled", "returned"].includes(
          record.status
        );

        return (
          <span className={isDelayed && !isFinalized ? "delayed-age" : ""}>
            {age}d
          </span>
        );
      },
    },
    {
      title: t("orders.tracking"),
      dataIndex: "ecotrack_tracking_id",
      key: "tracking",
      width: 180,
      render: (trackingId, record) => {
        if (!trackingId) {
          return <span className="text-muted">-</span>;
        }

        return (
          <div>
            <div style={{ fontSize: "12px", marginBottom: "4px" }}>
              <Text code copyable={{ text: trackingId }}>
                {trackingId.substring(0, 12)}...
              </Text>
            </div>
            {record.ecotrack_status && (
              <Tag
                size="small"
                color={getTrackingStatusColor(record.ecotrack_status)}
              >
                {record.ecotrack_status}
              </Tag>
            )}
            {record.ecotrack_last_update && (
              <div style={{ fontSize: "10px", color: "#666" }}>
                {new Date(record.ecotrack_last_update).toLocaleDateString()}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: t("orders.actions"),
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditOrder(record)}
            disabled={!canEditOrder(record)}
            title={!canEditOrder(record) ? t("orders.editRestricted") : ""}
          />

          {record.ecotrack_tracking_id && (
            <Button
              icon={<SyncOutlined />}
              size="small"
              onClick={() => handleUpdateTracking(record.id)}
              title={t("orders.updateTracking")}
            />
          )}

          {hasPermission('canDeleteOrders') && (
            <Popconfirm
              title={t("orders.deleteConfirm")}
              onConfirm={() => handleDeleteOrder(record.id)}
              okText={t("common.yes")}
              cancelText={t("common.no")}
            >
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="orders-container">
      <Card style={{ marginBottom: 24 }} className="orders-header-card">
        <div className="orders-header">
          <div className="orders-controls">
            {/* Search and Filter Row */}
            <Row gutter={[16, 12]} className="search-filter-row">
              {/* <Col xs={24} sm={24} md={12} lg={8} xl={8}>
                <Input.Search
                  placeholder={t('common.search')}
                  allowClear
                  onSearch={handleSearch}
                  size="middle"
                  style={{ width: '100%' }}
                />
              </Col>
               */}
              <Col xs={24} sm={24} md={12} lg={8} xl={8}>
                <Select
                  placeholder={t("orders.filterByStatus")}
                  allowClear
                  style={{ width: "100%" }}
                  onChange={handleStatusFilter}
                  size="middle"
                >
                  <Option value="pending">
                    {t("orders.statusTypes.pending")}
                  </Option>
                  <Option value="confirmed">
                    {t("orders.statusTypes.confirmed")}
                  </Option>
                  <Option value="processing">
                    {t("orders.statusTypes.processing")}
                  </Option>
                  <Option value="out_for_delivery">
                    {t("orders.statusTypes.out_for_delivery")}
                  </Option>
                  <Option value="delivered">
                    {t("orders.statusTypes.delivered")}
                  </Option>
                  <Option value="cancelled">
                    {t("orders.statusTypes.cancelled")}
                  </Option>
                  <Option value="returned">
                    {t("orders.statusTypes.returned")}
                  </Option>
                  <Option value="on_hold">
                    {t("orders.statusTypes.on_hold")}
                  </Option>
                </Select>
              </Col>
            </Row>

            {/* Action Buttons Row */}
            <Row gutter={[12, 12]} className="action-buttons-row">
              <Col xs={24} sm={24} md={24} lg={24} xl={24}>
                <div className="button-container">
                  {/* Primary Actions */}
                  <div className="primary-actions">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleAddOrder}
                      size="middle"
                      className="primary-btn"
                    >
                      <span className="btn-text">{t("orders.addOrder")}</span>
                    </Button>
                  </div>

                  {/* Secondary Actions */}
                  <div className="secondary-actions">
                    {hasPermission('canImportOrders') && (
                      <Button
                        icon={<UploadOutlined />}
                        onClick={() => setImportModalVisible(true)}
                        size="middle"
                        className="secondary-btn"
                      >
                        <span className="btn-text">
                          {t("dashboard.importOrders")}
                        </span>
                      </Button>
                    )}

                    {hasPermission('canDistributeOrders') && (
                      <Button
                        icon={<ShareAltOutlined />}
                        onClick={handleDistributeOrders}
                        size="middle"
                        className="secondary-btn"
                      >
                        <span className="btn-text">
                          {t("orders.distribute")}
                        </span>
                      </Button>
                    )}

                    {hasPermission('canViewAllOrders') && (
                      <Button
                        icon={<SyncOutlined />}
                        onClick={handleBulkTrackingSync}
                        size="middle"
                        loading={loading}
                        className="secondary-btn"
                      >
                        <span className="btn-text">
                          {t("orders.syncTracking")}
                        </span>
                      </Button>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="quick-actions">
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={fetchOrders}
                      size="middle"
                      className="icon-btn"
                      title={t("common.reload")}
                    />

                    <Button
                      icon={<ExportOutlined />}
                      onClick={() => message.info("Export feature coming soon")}
                      size="middle"
                      className="icon-btn"
                      title={t("common.export")}
                    />
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </Card>

      {hasPermission('canViewAllOrders') ? (
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={t("orders.allOrders")} key="all">
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ x: 1200 }}
              rowClassName={getRowClassName}
            />
          </TabPane>
          {hasPermission('canAssignOrders') && (
            <TabPane tab={t("orders.unassigned")} key="unassigned">
              <Table
                columns={columns}
                dataSource={orders}
                rowKey="id"
                loading={loading}
                pagination={pagination}
                onChange={handleTableChange}
                scroll={{ x: 1200 }}
                rowClassName={getRowClassName}
              />
            </TabPane>
          )}
          <TabPane tab={t("orders.assigned")} key="assigned">
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ x: 1200 }}
              rowClassName={getRowClassName}
            />
          </TabPane>
          <TabPane tab={t("orders.delayed")} key="delayed">
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ x: 1200 }}
              rowClassName={getRowClassName}
            />
          </TabPane>
        </Tabs>
      ) : (
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={t("orders.myOrders")} key="all">
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ x: 1200 }}
              rowClassName={getRowClassName}
            />
          </TabPane>
          <TabPane tab={t("orders.myDelayed")} key="delayed">
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ x: 1200 }}
              rowClassName={getRowClassName}
            />
          </TabPane>
        </Tabs>
      )}

      <Modal
        title={editingOrder ? t("orders.editOrder") : t("orders.addOrder")}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleModalSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="orderNumber"
                label={t("orders.orderNumber")}
                rules={[{ required: true, message: t("validations.required") }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerName"
                label={t("orders.customerName")}
                rules={[{ required: true, message: t("validations.required") }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customerPhone"
                label={t("orders.customerPhone")}
                rules={[{ required: true, message: t("validations.required") }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="totalAmount"
                label={t("orders.totalAmount")}
                rules={[{ required: true, message: t("validations.required") }]}
              >
                <Input type="number" step="0.01" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="customerAddress"
            label={t("orders.customerAddress")}
            rules={[{ required: true, message: t("validations.required") }]}
          >
            <TextArea rows={3} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label={t("orders.status")}
                rules={[{ required: true, message: t("validations.required") }]}
              >
                <Select>
                  <Option value="pending">{t("orders.pending")}</Option>
                  <Option value="confirmed">{t("orders.confirmed")}</Option>
                  <Option value="processing">{t("orders.inProgress")}</Option>
                  <Option value="out_for_delivery">{t("orders.outForDelivery")}</Option>
                  <Option value="delivered">{t("orders.delivered")}</Option>
                  <Option value="cancelled">{t("orders.cancelled")}</Option>
                  <Option value="returned">{t("orders.returned")}</Option>
                  <Option value="on_hold">{t("orders.onHold")}</Option>
                  <Option value="0_tent">{t("orders.0_tent") || "0 Tent"}</Option>
                  <Option value="1_tent">{t("orders.1_tent") || "1 Tent"}</Option>
                  <Option value="2_tent">{t("orders.2_tent") || "2 Tent"}</Option>
                </Select>
              </Form.Item>
            </Col>
            {user?.role === "admin" && (
              <Col span={12}>
                <Form.Item name="assignedTo" label={t("orders.assignedTo")}>
                  <Select allowClear>
                    {users.map((u) => (
                      <Option key={u.id} value={u.id}>
                        {u.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            )}
          </Row>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t("common.save")}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                {t("common.cancel")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title={t("dashboard.importOrders")}
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <h4>{t("dashboard.expectedFormat")}</h4>
          <p>{t("dashboard.formatDescription")}</p>
          <ul style={{ fontSize: "12px", color: "#666" }}>
            <li>
              <strong>Full name</strong> - {t("dashboard.customerName")}
            </li>
            <li>
              <strong>Phone</strong> - {t("dashboard.customerPhone")}
            </li>
            <li>
              <strong>العنوان</strong> - {t("dashboard.customerAddress")}
            </li>
            <li>
              <strong>المدينة</strong> - {t("dashboard.customerCity")}
            </li>
            <li>
              <strong>الولاية</strong> - {t("dashboard.customerState")} (
              {t("common.optional")})
            </li>
            <li>
              <strong>Product name</strong> - {t("dashboard.productName")}
            </li>
            <li>
              <strong>Product variant</strong> - {t("dashboard.productVariant")} (
              {t("common.optional")})
            </li>
            <li>
              <strong>Variant price</strong> - {t("dashboard.productPrice")}
            </li>
            <li>
              <strong>stop desk ou a domicile</strong> -{" "}
              {t("dashboard.deliveryType")} ({t("common.optional")})
            </li>
          </ul>
        </div>

        <Upload.Dragger
          name="file"
          accept=".csv,.xlsx,.xls"
          beforeUpload={handleFileUpload}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">{t("dashboard.uploadText")}</p>
          <p className="ant-upload-hint">{t("dashboard.uploadHint")}</p>
        </Upload.Dragger>

        {uploading && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <Spin />
            <p>{t("common.loading")}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Orders;
