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
  Upload,
  Spin,
  Dropdown,
  Menu,
  Progress,
  Alert,
  Tooltip,
  Radio,
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
  UploadOutlined,
  NodeIndexOutlined,
  FileExcelOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { orderService } from "../../services/orderService";
import { userService } from "../../services/userService";
import { useAuth } from "../../contexts/AuthContext";
import "./OrderManagement.css";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [distributionModalVisible, setDistributionModalVisible] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("");
  const [distributionSettings, setDistributionSettings] = useState({
    algorithm: 'round_robin',
    maxOrdersPerUser: 10,
    considerWorkload: true,
    considerPerformance: true,
    priorityRules: [],
  });

  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor" || isAdmin;
  const canAssignOrders = isAdmin || isSupervisor;
  const canViewAllOrders = isAdmin || isSupervisor;
  const canDeleteOrders = isAdmin;
  const canImportOrders = isAdmin;
  const canDistributeOrders = isAdmin;

  useEffect(() => {
    fetchOrders();
    if (canAssignOrders) {
      fetchUsers();
    }
  }, [pagination.current, pagination.pageSize, statusFilter, assignedToFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        customer_name: searchText,
        status: statusFilter,
        assigned_to: assignedToFilter,
      };

      // Role-based filtering
      if (!canViewAllOrders && user?.id) {
        // Employees only see their assigned orders
        params.assigned_to = user.id;
      } else if (isSupervisor && !isAdmin) {
        // Supervisors see orders from their team (you can customize this logic)
        params.supervisor_id = user.id;
      }

      const response = await orderService.getOrders(params);

      // Based on the API format, response should have { orders: [...], pagination: {...} }
      const ordersData = response.orders || [];

      setOrders(ordersData);
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

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await userService.getUsers();

      // Based on your API format, the response should have { users: [...], pagination: {...} }
      const usersData = response.users || [];

      // Ensure usersData is an array
      const finalUsers = Array.isArray(usersData) ? usersData : [];
      setUsers(finalUsers);
    } catch (error) {
      message.error(t("users.fetchFailed"));
      setUsers([]); // Set empty array on error
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchOrders();
  };

  const handleCreateOrder = async (values) => {
    try {
      await orderService.createOrder(values);
      message.success(t("orders.createSuccess"));
      setModalVisible(false);
      form.resetFields();
      fetchOrders();
    } catch (error) {
      message.error(t("orders.createError"));
    }
  };

  const handleUpdateOrder = async (values) => {
    try {
      await orderService.updateOrder(editingOrder.id, values);
      message.success(t("orders.updateSuccess"));
      setModalVisible(false);
      setEditingOrder(null);
      form.resetFields();
      fetchOrders();
    } catch (error) {
      message.error(t("orders.updateError"));
    }
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await orderService.deleteOrder(orderId);
      message.success(t("orders.deleteSuccess"));
      fetchOrders();
    } catch (error) {
      message.error(t("orders.deleteError"));
    }
  };

  const handleAssignOrder = async (orderId, assignedTo) => {
    try {
      if (assignedTo === "" || assignedTo === null || assignedTo === "null") {
        // Handle unassign case - use the regular update endpoint to set assigned_to to null
        await orderService.updateOrder(orderId, { assigned_to: null });
        message.success(t("orders.unassignSuccess"));
      } else {
        await orderService.assignOrder(orderId, assignedTo);
        message.success(t("orders.assignSuccess"));
      }
      fetchOrders();
    } catch (error) {
      message.error(t("orders.assignError"));
    }
  };

  const handleDistributeOrders = async (algorithm = null) => {
    try {
      setDistributionLoading(true);
      
      // If algorithm is provided (from modal), use it with default settings
      let settings;
      if (algorithm) {
        settings = {
          algorithm: algorithm,
          maxOrdersPerUser: 10,
          considerWorkload: true,
          considerPerformance: algorithm === 'performance_based',
          priorityRules: [],
        };
      } else {
        // Use existing distribution settings for other cases
        settings = distributionSettings;
      }
      
      const response = await orderService.distributeOrders(settings);
      message.success(
        t("orders.distributeSuccess", { count: response.distributed })
      );
      fetchOrders();
      
      // Reset algorithm selection after successful distribution
      setSelectedAlgorithm("");
    } catch (error) {
      message.error(t("orders.distributeError"));
    } finally {
      setDistributionLoading(false);
    }
  };

  const handleQuickDistribute = () => {
    // Open distribution settings modal instead of immediate distribution
    setDistributionModalVisible(true);
  };

  const handleAdvancedDistribute = () => {
    setDistributionModalVisible(true);
  };

  const handleDistributionSubmit = (values) => {
    setDistributionSettings(values);
    handleDistributeOrders(values);
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
        message.success(
          t("dashboard.importSuccess", { count: result.imported })
        );

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
      message.error(error.message || t("dashboard.importError"));
    } finally {
      setUploading(false);
    }

    return false; // Prevent auto upload
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        format: "csv",
        ...(statusFilter && { status: statusFilter }),
        ...(assignedToFilter && { assigned_to: assignedToFilter }),
      });

      const response = await fetch(`/api/orders/export?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `orders_export_${
          new Date().toISOString().split("T")[0]
        }.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        message.success(t("orders.exportSuccess"));
      } else {
        throw new Error("Export failed");
      }
    } catch (error) {
      message.error(t("orders.exportError"));
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

  const getAssignmentMenu = (record) => {
    return (
      <Menu onClick={({ key }) => handleAssignOrder(record.id, key)}>
        <Menu.Item key="null">
          <Text type="secondary">{t("orders.unassigned")}</Text>
        </Menu.Item>
        <Menu.Divider />
        {usersLoading ? (
          <Menu.Item key="loading" disabled>
            <Space>
              <Spin size="small" />
              <Text type="secondary">{t("common.loading")}</Text>
            </Space>
          </Menu.Item>
        ) : Array.isArray(users) && users.length > 0 ? (
          users.map((user) => {
            const userName = `${user.first_name} ${user.last_name}`;
            return (
              <Menu.Item key={user.id}>
                <Tooltip title={userName}>
                  <div 
                    className="assignment-user-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      maxWidth: "180px",
                    }}
                  >
                    <UserOutlined style={{ marginRight: "8px", flexShrink: 0 }} />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {userName}
                    </span>
                  </div>
                </Tooltip>
              </Menu.Item>
            );
          })
        ) : (
          <Menu.Item key="no-users" disabled>
            <Text type="secondary">{t("users.noUsers")}</Text>
          </Menu.Item>
        )}
      </Menu>
    );
  };

  const columns = [
    {
      title: t("orders.orderNumber"),
      dataIndex: "order_number",
      key: "order_number",
      width: 180,
      responsive: ["md"],
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: t("orders.customerName"),
      dataIndex: "customer_name",
      key: "customer_name",
      width: 150,
      ellipsis: true,
      render: (name) => {
        const displayName = name || t("orders.noCustomerName");
        return (
          <Tooltip title={displayName}>
            {name ? (
              <Text>{name}</Text>
            ) : (
              <Text type="secondary">{t("orders.noCustomerName")}</Text>
            )}
          </Tooltip>
        );
      },
    },
    {
      title: t("orders.customerPhone"),
      dataIndex: "customer_phone",
      key: "customer_phone",
      width: 120,
      responsive: ["lg"],
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: t("orders.customerCity"),
      dataIndex: "customer_city",
      key: "customer_city",
      width: 100,
      responsive: ["xl"],
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: t("orders.customerAddress"),
      dataIndex: "customer_address",
      key: "customer_address",
      width: 150,
      responsive: ["xxl"],
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: t("orders.status"),
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)} size="small">
          {t(`orders.statuses.${status}`)}
        </Tag>
      ),
    },
    {
      title: t("orders.totalAmount"),
      dataIndex: "total_amount",
      key: "total_amount",
      width: 100,
      responsive: ["sm"],
      render: (amount) => (
        <Text strong>{`${amount || 0} DA`}</Text>
      ),
    },
    ...(canAssignOrders
      ? [
          {
            title: t("orders.assignedTo"),
            key: "assigned_to",
            width: 150,
            responsive: ["md"],
            ellipsis: true,
            render: (_, record) => {
              const isAssigned =
                record.assigned_first_name && record.assigned_last_name;
              const assignedName = isAssigned 
                ? `${record.assigned_first_name} ${record.assigned_last_name}`
                : t("orders.unassigned");

              return (
                <Dropdown
                  overlay={getAssignmentMenu(record)}
                  trigger={["click"]}
                >
                  <Button
                    type="text"
                    size="small"
                    className={`assignment-status ${
                      isAssigned ? "assigned" : "unassigned"
                    }`}
                    style={{
                      padding: "2px 6px",
                      border: isAssigned
                        ? "1px solid #52c41a"
                        : "1px solid #d9d9d9",
                      borderRadius: "4px",
                      color: isAssigned ? "#52c41a" : "#999",
                      fontSize: "12px",
                      maxWidth: "100%",
                    }}
                  >
                    <Tooltip title={assignedName}>
                      <Space size="small">
                        <UserOutlined style={{ fontSize: "10px" }} />
                        <span 
                          className="assignment-text"
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "90px",
                            display: "inline-block",
                          }}
                        >
                          {assignedName}
                        </span>
                      </Space>
                    </Tooltip>
                  </Button>
                </Dropdown>
              );
            },
          },
        ]
      : []),
    {
      title: t("orders.createdAt"),
      dataIndex: "created_at",
      key: "created_at",
      width: 100,
      responsive: ["lg"],
      render: (date) => (
        <Text>{new Date(date).toLocaleDateString()}</Text>
      ),
    },
    {
      title: t("orders.notes"),
      dataIndex: "notes",
      key: "notes",
      width: 120,
      responsive: ["xxl"],
      ellipsis: true,
      render: (text) => {
        if (!text) return <Text type="secondary">-</Text>;
        return (
          <Tooltip title={text}>
            <Text>{text}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: canAssignOrders ? 180 : 80,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingOrder(record);
              form.setFieldsValue({
                ...record,
                product_details: JSON.stringify(
                  record.product_details,
                  null,
                  2
                ),
              });
              setModalVisible(true);
            }}
          />
          {canAssignOrders && (
            <Dropdown overlay={getAssignmentMenu(record)} trigger={["click"]}>
              <Tooltip title={t("orders.assignTooltip")}>
                <Button
                  type="primary"
                  size="small"
                  icon={<UserAddOutlined />}
                  className="assignment-button"
                  style={{ fontSize: "10px", padding: "0 4px" }}
                >
                  <span className="btn-text-xs">{t("orders.assign")}</span>
                </Button>
              </Tooltip>
            </Dropdown>
          )}
          {canDeleteOrders && (
            <Popconfirm
              title={t("orders.deleteConfirm")}
              onConfirm={() => handleDeleteOrder(record.id)}
              okText={t("common.yes")}
              cancelText={t("common.no")}
            >
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="orders-page">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {isAdmin && (
          <>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  block
                  size="small"
                  onClick={() => setImportModalVisible(true)}
                  icon={<UploadOutlined />}
                >
                  <span className="btn-text">{t("common.import")}</span>
                </Button>
              </Space>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  block
                  size="small"
                  loading={distributionLoading}
                  onClick={() => setDistributionModalVisible(true)}
                  icon={<ShareAltOutlined />}
                >
                  <span className="btn-text">{t("orders.distribute")}</span>
                </Button>
              </Space>
            </Col>
          </>
        )}
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder={t("orders.searchPlaceholder")}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
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
              <Option value="0_tent">{t("orders.statuses.0_tent") || "0 Tent"}</Option>
              <Option value="1_tent">{t("orders.statuses.1_tent") || "1 Tent"}</Option>
              <Option value="2_tent">{t("orders.statuses.2_tent") || "2 Tent"}</Option>
            </Select>
          </Col>
          {isAdmin && (
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder={t("orders.filterByAssignee")}
                style={{ width: "100%" }}
                value={assignedToFilter}
                onChange={setAssignedToFilter}
                allowClear
              >
                <Option value="null">{t("orders.unassigned")}</Option>
                {Array.isArray(users) &&
                  users.map((user) => (
                    <Option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </Option>
                  ))}
              </Select>
            </Col>
          )}
          <Col xs={24} sm={12} md={6}>
            <Space wrap>
              <Button
                type="primary"
                size="small"
                onClick={handleSearch}
                icon={<SearchOutlined />}
              ></Button>

              {isAdmin && (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    setEditingOrder(null);
                    form.resetFields();
                    setModalVisible(true);
                  }}
                  icon={<PlusOutlined />}
                ></Button>
              )}
              <Button
                size="small"
                onClick={fetchOrders}
                icon={<ReloadOutlined />}
              >
                <span className="btn-text-sm">{t("common.refresh")}</span>
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
            responsive: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} ${t("dashboard.outOf")} ${total}`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Create/Edit Order Modal */}
      <Modal
        title={editingOrder ? t("orders.editOrder") : t("orders.createOrder")}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingOrder(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingOrder ? handleUpdateOrder : handleCreateOrder}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customer_name"
                label={t("orders.customerName")}
                rules={[
                  { required: true, message: t("orders.customerNameRequired") },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customer_phone"
                label={t("orders.customerPhone")}
                rules={[
                  {
                    required: true,
                    message: t("orders.customerPhoneRequired"),
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="customer_address"
            label={t("orders.customerAddress")}
            rules={[
              { required: true, message: t("orders.customerAddressRequired") },
            ]}
          >
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customer_city"
                label={t("orders.customerCity")}
                rules={[
                  { required: true, message: t("orders.customerCityRequired") },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="total_amount"
                label={t("orders.totalAmount")}
                rules={[
                  { required: true, message: t("orders.totalAmountRequired") },
                ]}
              >
                <Input type="number" suffix="DA" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="product_details"
            label={t("orders.productDetails")}
            rules={[
              { required: true, message: t("orders.productDetailsRequired") },
            ]}
          >
            <TextArea
              rows={4}
              placeholder={t("orders.productDetailsPlaceholder")}
            />
          </Form.Item>
          {editingOrder && (
            <Form.Item name="status" label={t("orders.status")}>
              <Select>
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
                <Option value="returned">
                  {t("orders.statuses.returned")}
                </Option>
                <Option value="on_hold">
                  {t("orders.statuses.on_hold")}
                </Option>
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
            </Form.Item>
          )}
          <Form.Item name="notes" label={t("orders.notes")}>
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingOrder ? t("common.save") : t("common.submit")}
              </Button>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  setEditingOrder(null);
                  form.resetFields();
                }}
              >
                {t("common.cancel")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title={t("orders.importOrders")}
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <Alert
          message={t("orders.importInstructions")}
          description={t("dashboard.uploadHint")}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Upload.Dragger
          accept=".xlsx,.xls,.csv"
          multiple={false}
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
          <div style={{ marginTop: 16 }}>
            <Spin />
            <Text style={{ marginLeft: 8 }}>{t("dashboard.uploading")}</Text>
          </div>
        )}
      </Modal>

      {/* Distribution Modal */}
      <Modal
        title={t("orders.distribution.title")}
        open={distributionModalVisible}
        onCancel={() => {
          setDistributionModalVisible(false);
          setSelectedAlgorithm("");
        }}
        onOk={async () => {
          if (!selectedAlgorithm) {
            message.error(t("orders.distribution.selectAlgorithm"));
            return;
          }
          
          setDistributionModalVisible(false);
          await handleDistributeOrders(selectedAlgorithm);
        }}
        confirmLoading={distributionLoading}
        okText={t("orders.distribution.distribute")}
        cancelText={t("common.cancel")}
        width={600}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text>{t("orders.distribution.selectAlgorithmDescription")}</Text>
          <Radio.Group
            value={selectedAlgorithm}
            onChange={(e) => setSelectedAlgorithm(e.target.value)}
            style={{ width: "100%" }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Radio value="round_robin">
                <Space direction="vertical" size={0}>
                  <Text strong>{t("orders.distribution.algorithms.roundRobin")}</Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {t("orders.distribution.algorithms.roundRobinDesc")}
                  </Text>
                </Space>
              </Radio>
              <Radio value="balanced_workload">
                <Space direction="vertical" size={0}>
                  <Text strong>{t("orders.distribution.algorithms.balancedWorkload")}</Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {t("orders.distribution.algorithms.balancedWorkloadDesc")}
                  </Text>
                </Space>
              </Radio>
              <Radio value="performance_based">
                <Space direction="vertical" size={0}>
                  <Text strong>{t("orders.distribution.algorithms.performanceBased")}</Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {t("orders.distribution.algorithms.performanceBasedDesc")}
                  </Text>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </Space>
      </Modal>
    </div>
  );
};

export default OrderManagement;
