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
  Timeline,
  Descriptions,
  Switch,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  DownOutlined ,
  ReloadOutlined,
  UserAddOutlined,
  ShareAltOutlined,
  UploadOutlined,
  NodeIndexOutlined,
  FileExcelOutlined,
  UserOutlined,
  EyeOutlined,
  GlobalOutlined,
  SyncOutlined,
  TruckOutlined,
  LinkOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { orderService } from "../../services/orderService";
import { userService } from "../../services/userService";
import orderProductService from "../../services/orderProductService";
import { useAuth } from "../../contexts/AuthContext";
import "./OrderManagement.css";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [ordersWithProducts, setOrdersWithProducts] = useState([]);
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
  const [distributionModalVisible, setDistributionModalVisible] =
    useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("");
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [ecotrackDetails, setEcotrackDetails] = useState(null);
  const [ecotrackLoading, setEcotrackLoading] = useState(false);
  const [distributionSettings, setDistributionSettings] = useState({
    algorithm: "round_robin",
    maxOrdersPerUser: 10,
    considerWorkload: true,
    considerPerformance: true,
    priorityRules: [],
  });
  const [ecotrackEnabled, setEcotrackEnabled] = useState(false);

  // Delivery management state
  const [wilayas, setWilayas] = useState([]);
  const [baladias, setBaladias] = useState([]);
  const [selectedWilaya, setSelectedWilaya] = useState(null);
  const [pricingLevel, setPricingLevel] = useState("wilaya");
  const [loadingWilayas, setLoadingWilayas] = useState(false);
  const [loadingBaladias, setLoadingBaladias] = useState(false);
  const [loadingDeliveryPrice, setLoadingDeliveryPrice] = useState(false);

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
    fetchOrdersWithProducts();
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

  const fetchOrdersWithProducts = async () => {
    try {
      const response = await orderProductService.getOrdersWithProducts();
      setOrdersWithProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching orders with products:', error);
      // Don't show error message as this is supplementary data
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

  // Delivery management functions
  const fetchWilayas = async () => {
    try {
      setLoadingWilayas(true);
      const response = await orderService.getWilayas();
      if (response.success) {
        setWilayas(response.data);
      }
    } catch (error) {
      console.error("Error fetching wilayas:", error);
      message.error(t("delivery.errorFetchingWilayas"));
    } finally {
      setLoadingWilayas(false);
    }
  };

  const fetchBaladias = async (wilayaId) => {
    try {
      setLoadingBaladias(true);
      const response = await orderService.getBaladiasByWilaya(wilayaId);
      if (response.success) {
        setBaladias(response.data);
      }
    } catch (error) {
      console.error("Error fetching baladias:", error);
      message.error(t("delivery.errorFetchingBaladias"));
    } finally {
      setLoadingBaladias(false);
    }
  };

  const handleWilayaChange = (wilayaId) => {
    setSelectedWilaya(wilayaId);

    if (wilayaId) {
      // Delay calculation to allow form to update first
      setTimeout(() => {
        calculateDeliveryPrice();
      }, 100);
    }
  };

  const handlePricingLevelChange = (level) => {
    setPricingLevel(level);
    calculateDeliveryPrice();
  };

  const calculateDeliveryPrice = async () => {
    try {
      const formValues = form.getFieldsValue();
      const { wilaya_id, delivery_type, weight, volume, pricing_level } =
        formValues;

      if (!wilaya_id) return;

      setLoadingDeliveryPrice(true);

      const pricingData = {
        wilaya_id,
        delivery_type: delivery_type || "domicile",
        weight: weight || 1,
        volume: volume || 1,
        pricing_level: pricing_level || pricingLevel,
      };

      const response = await orderService.calculateDeliveryPrice(pricingData);

      if (response.success && response.data) {
        // Handle different response formats from the API
        const deliveryPrice =
          response.data.delivery_price || response.data.price || 0;
        form.setFieldsValue({ delivery_price: deliveryPrice });
      }
    } catch (error) {
      console.error("Error calculating delivery price:", error);
      message.error(t("delivery.errorCalculatingPrice"));
    } finally {
      setLoadingDeliveryPrice(false);
    }
  };

  const handleDeliveryFieldChange = () => {
    // Debounce the calculation
    setTimeout(() => {
      calculateDeliveryPrice();
    }, 500);
  };

  // Load wilayas when component mounts
  useEffect(() => {
    fetchWilayas();
  }, []);

  const handleCreateOrder = async (values) => {
    try {
      // Calculate final total
      const totalAmount = parseFloat(values.total_amount || 0);
      const deliveryPrice = parseFloat(values.delivery_price || 0);
      const finalTotal = totalAmount + deliveryPrice;

      // Add final total to the values
      const orderData = {
        ...values,
        final_total: finalTotal,
      };

      await orderService.createOrder(orderData);
      message.success(t("orders.createSuccess"));
      setModalVisible(false);
      form.resetFields();
      fetchOrders();
      fetchOrdersWithProducts(); // Refresh product data too
    } catch (error) {
      message.error(t("orders.createError"));
    }
  };

  const handleUpdateOrder = async (values) => {
    try {
      // Calculate final total
      const totalAmount = parseFloat(values.total_amount || 0);
      const deliveryPrice = parseFloat(values.delivery_price || 0);
      const finalTotal = totalAmount + deliveryPrice;

      // Add final total to the values
      const orderData = {
        ...values,
        final_total: finalTotal,
      };

      await orderService.updateOrder(editingOrder.id, orderData);
      message.success(t("orders.updateSuccess"));
      setModalVisible(false);
      setEditingOrder(null);
      form.resetFields();
      fetchOrders();
      fetchOrdersWithProducts(); // Refresh product data too
    } catch (error) {
      message.error(t("orders.updateError"));
    }
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await orderService.deleteOrder(orderId);
      message.success(t("orders.deleteSuccess"));
      fetchOrders();
      fetchOrdersWithProducts(); // Refresh product data too
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

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await orderService.updateOrder(orderId, { status: newStatus });
      message.success(t("orders.statusUpdateSuccess"));
      fetchOrders();
    } catch (error) {
      message.error(t("orders.statusUpdateError"));
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
          considerPerformance: algorithm === "performance_based",
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

  const viewEcotrackDetails = async (trackingId) => {
    if (!trackingId) {
      message.error(t("tracking.noTrackingId"));
      return;
    }

    try {
      setEcotrackLoading(true);

      // Call the Ecotrack API directly using the same logic as ecotrackService
      const response = await fetch(
        "https://app.noest-dz.com/api/public/get/trackings/info",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_token: "PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG",
            user_guid: "2QG0JDFP",
            trackings: [trackingId],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Ecotrack API response:", data);

      // Process the response data
      if (data && data[trackingId]) {
        const trackingData = data[trackingId];
        setEcotrackDetails(trackingData);
      } else {
        message.warning(t("tracking.noTrackingData"));
      }
    } catch (error) {
      console.error("Fetch Ecotrack details error:", error);
      message.error(t("tracking.fetchError"));
      // Fallback to opening external link if API fails
      const ecotrackUrl = `https://app.noest-dz.com/tracking/${trackingId}`;
      window.open(ecotrackUrl, "_blank");
    } finally {
      setEcotrackLoading(false);
    }
  };

  const showTrackingModal = (order) => {
    setSelectedOrder(order);
    setTrackingModalVisible(true);
    if (order.ecotrack_tracking_id) {
      viewEcotrackDetails(order.ecotrack_tracking_id);
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
        const formatMessage = result.format_detected
          ? ` (${result.format_detected} format detected)`
          : "";
        message.success(
          t("dashboard.importSuccess", { count: result.imported }) +
            formatMessage
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
      "3_tent": "volcano",
      "4_tent": "gold",
      "5_tent": "lime",
      "6_tent": "red",
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
                    <UserOutlined
                      style={{ marginRight: "8px", flexShrink: 0 }}
                    />
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

  // Helper function to get product info for an order
  const getOrderProductInfo = (orderId) => {
    const orderData = ordersWithProducts.find(o => o.order_id === orderId);
    return orderData || { products: [], total_products: 0 };
  };

  const columns = [
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
      title: (
        <div style={{ textAlign: 'center' }}>
          <NodeIndexOutlined style={{ marginRight: 4 }} />
          {t('orders.products')}
        </div>
      ),
      key: 'products',
      width: 140,
      align: 'center',
      render: (_, record) => {
        const productInfo = getOrderProductInfo(record.id);
        const hasProducts = productInfo.products && productInfo.products.length > 0;
        
        if (!hasProducts) {
          return (
            <div style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>
              <div style={{ marginBottom: 2 }}>
                <NodeIndexOutlined style={{ opacity: 0.3 }} />
              </div>
              <div>{t('orders.noProducts')}</div>
            </div>
          );
        }

        const firstProduct = productInfo.products[0];
        const moreCount = productInfo.products.length - 1;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <Tooltip title={`${productInfo.total_products} ${t('orders.productsLinked')}`}>
              <Tag 
                color="blue" 
                style={{ 
                  margin: 0, 
                  fontSize: '11px', 
                  fontWeight: '500',
                  borderRadius: '8px',
                  padding: '2px 6px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  Modal.info({
                    title: `${t('orders.productsInOrder')} ${record.order_number || record.id}`,
                    content: (
                      <div>
                        {productInfo.products.map((product, index) => (
                          <div key={index} style={{ marginBottom: '8px', padding: '8px', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
                            <div><strong>{product.name || product.product_name}</strong></div>
                            <div>SKU: {product.sku}</div>
                            <div>{t('orders.quantity')}: {product.quantity}</div>
                            <div>{t('orders.price')}: {product.unit_price} DA</div>
                          </div>
                        ))}
                      </div>
                    ),
                    width: 600
                  });
                }}
              >
                📦 {productInfo.total_products}
              </Tag>
            </Tooltip>
            
            {firstProduct && (
              <Tooltip title={`${firstProduct.name || firstProduct.product_name} (${firstProduct.sku})`}>
                <div style={{ 
                  fontSize: '10px', 
                  color: '#666',
                  textAlign: 'center',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {firstProduct.name || firstProduct.product_name}
                  {moreCount > 0 && ` +${moreCount}`}
                </div>
              </Tooltip>
            )}
          </div>
        );
      },
      sorter: (a, b) => {
        const aInfo = getOrderProductInfo(a.id);
        const bInfo = getOrderProductInfo(b.id);
        return (aInfo.total_products || 0) - (bInfo.total_products || 0);
      },
      filters: [
        { text: t('orders.hasProducts'), value: 'has_products' },
        { text: t('orders.noProducts'), value: 'no_products' },
      ],
      onFilter: (value, record) => {
        const productInfo = getOrderProductInfo(record.id);
        switch (value) {
          case 'has_products':
            return productInfo.total_products > 0;
          case 'no_products':
            return productInfo.total_products === 0;
          default:
            return true;
        }
      },
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
      width: 120,
      render: (status, record) => {
        const statusText = t(`orders.statuses.${status}`);
        const truncatedText = statusText.length > 12 ? statusText.substring(0, 12) + "..." : statusText;
        
        const statusMenu = (
          <Menu onClick={({ key }) => handleStatusChange(record.id, key)}>
            <Menu.Item key="pending">{t("orders.statuses.pending")}</Menu.Item>
            <Menu.Item key="confirmed">{t("orders.statuses.confirmed")}</Menu.Item>
            <Menu.Item key="processing">{t("orders.statuses.processing")}</Menu.Item>
            <Menu.Item key="out_for_delivery">{t("orders.statuses.out_for_delivery")}</Menu.Item>
            <Menu.Item key="delivered">{t("orders.statuses.delivered")}</Menu.Item>
            <Menu.Item key="cancelled">{t("orders.statuses.cancelled")}</Menu.Item>
            <Menu.Item key="returned">{t("orders.statuses.returned")}</Menu.Item>
            <Menu.Item key="on_hold">{t("orders.statuses.on_hold")}</Menu.Item>
            <Menu.Divider />
            <Menu.SubMenu title="Tent Status">
              <Menu.Item key="0_tent">{t("orders.statuses.0_tent") || "0 Tent"}</Menu.Item>
              <Menu.Item key="1_tent">{t("orders.statuses.1_tent") || "1 Tent"}</Menu.Item>
              <Menu.Item key="2_tent">{t("orders.statuses.2_tent") || "2 Tent"}</Menu.Item>
              <Menu.Item key="3_tent">{t("orders.statuses.3_tent") || "3 Tent"}</Menu.Item>
              <Menu.Item key="4_tent">{t("orders.statuses.4_tent") || "4 Tent"}</Menu.Item>
              <Menu.Item key="5_tent">{t("orders.statuses.5_tent") || "5 Tent"}</Menu.Item>
              <Menu.Item key="6_tent">{t("orders.statuses.6_tent") || "6 Tent"}</Menu.Item>
            </Menu.SubMenu>
          </Menu>
        );

        return (
          <Dropdown overlay={statusMenu} trigger={["click"]}>
            <Tag 
              color={getStatusColor(status)} 
              size="small" 
              style={{ cursor: "pointer", maxWidth: "100px" }}
            >
              <Tooltip title={statusText}>
                {truncatedText}
              </Tooltip>
            </Tag>
          </Dropdown>
        );
      },
    },
    {
      title: t("orders.totalAmount"),
      dataIndex: "total_amount",
      key: "total_amount",
      width: 100,
      responsive: ["sm"],
      render: (amount) => <Text strong>{`${amount || 0} DA`}</Text>,
    },
    ...(ecotrackEnabled
      ? [
          {
            title: t("tracking.ecotrackId"),
            dataIndex: "ecotrack_tracking_id",
            key: "ecotrack_tracking_id",
            width: 120,
            responsive: ["lg"],
            render: (trackingId) =>
              trackingId ? (
                <Text copyable style={{ fontSize: "12px" }}>
                  {trackingId}
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  {t("tracking.noTrackingId")}
                </Text>
              ),
          },
        ]
      : []),
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
      render: (date) => <Text>{new Date(date).toLocaleDateString()}</Text>,
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
          {ecotrackEnabled && record.ecotrack_tracking_id && (
            <Tooltip title={t("tracking.viewEcotrackDetails")}>
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => showTrackingModal(record)}
              />
            </Tooltip>
          )}
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
        <Col xs={24} style={{ marginBottom: 16 }}>
          <Card>
            <Space>
              <SettingOutlined />
              <Text strong>{t("tracking.ecotrackSettings")}</Text>
              <Switch
                checked={ecotrackEnabled}
                onChange={setEcotrackEnabled}
                checkedChildren={t("common.enabled")}
                unCheckedChildren={t("common.disabled")}
              />
              <Text type="secondary">
                {ecotrackEnabled
                  ? t("tracking.ecotrackEnabledDesc")
                  : t("tracking.ecotrackDisabledDesc")}
              </Text>
            </Space>
          </Card>
        </Col>
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

          {/* Delivery Management Section */}
          <Card
            title={t("delivery.deliveryManagement")}
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item
                  name="pricing_level"
                  label={t("delivery.pricingLevel")}
                  initialValue="wilaya"
                >
                  <Select
                    value={pricingLevel}
                    onChange={handlePricingLevelChange}
                  >
                    <Option value="wilaya">{t("delivery.wilaya")}</Option>
                    <Option value="baladia">{t("delivery.baladia")}</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="wilaya_id"
                  label={t("delivery.wilaya")}
                  rules={[
                    { required: true, message: t("delivery.wilayaRequired") },
                  ]}
                >
                  <Select
                    placeholder={t("delivery.selectWilaya")}
                    showSearch
                    optionFilterProp="children"
                    onChange={handleWilayaChange}
                    loading={loadingWilayas}
                  >
                    {wilayas.map((wilaya) => (
                      <Option key={wilaya.id} value={wilaya.id}>
                        {wilaya.code} - {wilaya.name_fr}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="delivery_type"
                  label={t("delivery.deliveryType")}
                  initialValue="domicile"
                >
                  <Select>
                    <Option value="domicile">
                      {t("delivery.types.domicile")}
                    </Option>
                    <Option value="desk">{t("delivery.types.desk")}</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="delivery_price"
                  label={t("delivery.deliveryPrice")}
                >
                  <Input
                    type="number"
                    suffix="DA"
                    placeholder="0"
                    min={0}
                    onChange={handleDeliveryFieldChange}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

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
                <Input
                  type="number"
                  suffix="DA"
                  onChange={handleDeliveryFieldChange}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Final Total Display */}
          <Row gutter={16}>
            <Col span={24}>
              <Card
                size="small"
                style={{
                  backgroundColor: "#f0f8ff",
                  border: "1px solid #1890ff",
                  marginBottom: 16,
                }}
              >
                <Form.Item dependencies={["total_amount", "delivery_price"]}>
                  {({ getFieldValue }) => {
                    const totalAmount = parseFloat(
                      getFieldValue("total_amount") || 0
                    );
                    const deliveryPrice = parseFloat(
                      getFieldValue("delivery_price") || 0
                    );
                    const finalTotal = totalAmount + deliveryPrice;

                    return (
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Text strong style={{ fontSize: "16px" }}>
                            {t("orders.finalTotal")}:
                          </Text>
                        </Col>
                        <Col>
                          <Text
                            strong
                            style={{
                              fontSize: "18px",
                              color: "#1890ff",
                            }}
                          >
                            {finalTotal.toFixed(2)} DA
                          </Text>
                        </Col>
                      </Row>
                    );
                  }}
                </Form.Item>
              </Card>
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
        width={700}
      >
        <Alert
          message={t("orders.importInstructions")}
          description={
            <div>
              <p>{t("dashboard.uploadHint")}</p>
              <div style={{ marginTop: 12 }}>
                <Text strong>Supported formats:</Text>
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  <li>
                    <Text strong>NOEST EXPRESS Format:</Text> ID, Réf, Client,
                    Tel 1, Tel 2, Adresse, Commune, Wilaya, Total, Remarque,
                    Produits
                  </li>
                  <li>
                    <Text strong>Legacy Format:</Text> FULL_NAME, PHONE,
                    COMMUNE, WILAYA, PRODUCT, PRIX total, etc.
                  </li>
                </ul>
              </div>
            </div>
          }
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
          <p className="ant-upload-hint">
            Excel (.xlsx, .xls) or CSV files. Format will be auto-detected.
          </p>
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
                  <Text strong>
                    {t("orders.distribution.algorithms.roundRobin")}
                  </Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {t("orders.distribution.algorithms.roundRobinDesc")}
                  </Text>
                </Space>
              </Radio>
              <Radio value="balanced_workload">
                <Space direction="vertical" size={0}>
                  <Text strong>
                    {t("orders.distribution.algorithms.balancedWorkload")}
                  </Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {t("orders.distribution.algorithms.balancedWorkloadDesc")}
                  </Text>
                </Space>
              </Radio>
              <Radio value="performance_based">
                <Space direction="vertical" size={0}>
                  <Text strong>
                    {t("orders.distribution.algorithms.performanceBased")}
                  </Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {t("orders.distribution.algorithms.performanceBasedDesc")}
                  </Text>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </Space>
      </Modal>

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
          setEcotrackDetails(null);
        }}
        footer={[
          <Button key="close" onClick={() => setTrackingModalVisible(false)}>
            {t("common.close")}
          </Button>,
        ]}
        width={800}
      >
        {ecotrackLoading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text>{t("tracking.loadingEcotrack")}</Text>
            </div>
          </div>
        ) : ecotrackDetails ? (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label={t("tracking.trackingId")}>
                <Text copyable>{selectedOrder?.ecotrack_tracking_id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.status")}>
                <Tag color="blue">
                  {ecotrackDetails.OrderInfo?.status || "Unknown"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.recipient")}>
                {ecotrackDetails.recipientName || t("tracking.unknown")}
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.phone")}>
                {ecotrackDetails.OrderInfo?.phone || t("tracking.unknown")}
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.location")}>
                {ecotrackDetails.OrderInfo?.commune || t("tracking.unknown")}
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.amount")}>
                {ecotrackDetails.OrderInfo?.prix || t("tracking.unknown")}
              </Descriptions.Item>
            </Descriptions>

            {ecotrackDetails.activity &&
              ecotrackDetails.activity.length > 0 && (
                <div>
                  <h4>{t("tracking.ecotrackHistory")}</h4>
                  <Timeline mode="left">
                    {ecotrackDetails.activity.map((item, index) => (
                      <Timeline.Item
                        key={index}
                        color={index === 0 ? "blue" : "green"}
                      >
                        <div>
                          <Text strong>{item.event}</Text>
                          <div style={{ color: "#666", fontSize: "12px" }}>
                            {new Date(item.date).toLocaleString()}
                          </div>
                          {item.event_key && (
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary">
                                Status: {item.event_key}
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
        ) : (
          <Alert
            message={t("tracking.noTrackingData")}
            description={t("tracking.noTrackingDataDesc")}
            type="info"
            showIcon
          />
        )}
      </Modal>
    </div>
  );
};

export default OrderManagement;
