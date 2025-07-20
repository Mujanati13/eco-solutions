import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Typography,
  Spin,
  Alert,
  Tag,
  Space,
  Select,
  DatePicker,
  Button,
  Progress,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  ShoppingOutlined,
  WarningOutlined,
  StopOutlined,
  DollarOutlined,
  TagsOutlined,
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  AlertOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import { LineChart, BarChart, PieChart } from "@mui/x-charts";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import "./ProductDashboard.css";
import "./ChartOptimizations.css";

const { Title } = Typography;
const { Option } = Select;

const ProductDashboard = React.memo(() => {
  const [loading, setLoading] = useState(true);
  const [productStats, setProductStats] = useState({});
  const [productDistribution, setProductDistribution] = useState([]);
  const [stockTrends, setStockTrends] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState(30);
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();

  const canViewProducts = useMemo(
    () => hasPermission("canViewProducts"),
    [hasPermission]
  );

  // Format date function for charts
  const formatDateForChart = useCallback((dateString) => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid date

      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      return `${month}/${day}`;
    } catch (error) {
      console.error("Date formatting error:", error);
      return dateString; // Return original string if error
    }
  }, []);

  const fetchProductDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");
      if (!token) {
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Fetch product stats and recent activities
      const [statsResponse, alertsResponse, activitiesResponse] =
        await Promise.all([
          fetch("/api/dashboard/product-stats", { headers }).catch((err) => ({
            ok: false,
            error: err.message,
          })),
          fetch("/api/dashboard/low-stock-alerts", { headers }).catch(
            (err) => ({ ok: false, error: err.message })
          ),
          fetch("/api/dashboard/recent-product-activities?limit=10", {
            headers,
          }).catch((err) => ({ ok: false, error: err.message })),
        ]);

      // Handle stats response
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setProductStats(statsData || {});
      } else {
        console.error("Product stats fetch failed:", statsResponse.error);
        setProductStats({});
      }

      // Handle alerts response
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setLowStockAlerts(Array.isArray(alertsData) ? alertsData : []);
      } else {
        console.error("Low stock alerts fetch failed:", alertsResponse.error);
        setLowStockAlerts([]);
      }

      // Handle activities response
      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setRecentActivities(
          Array.isArray(activitiesData) ? activitiesData : []
        );
      } else {
        console.error(
          "Recent activities fetch failed:",
          activitiesResponse.error
        );
        setRecentActivities([]);
      }
    } catch (error) {
      console.error("Error fetching product dashboard data:", error);
      setProductStats({});
      setLowStockAlerts([]);
      setRecentActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChartsData = useCallback(async (selectedTimeRange = null) => {
    try {
      setChartsLoading(true);

      const token = localStorage.getItem("token");
      if (!token) return;

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Use the passed timeRange or default to current timeRange
      const effectiveTimeRange = selectedTimeRange || timeRange;

      // Fetch charts data
      const [distributionResponse, trendsResponse] = await Promise.all([
        fetch("/api/dashboard/product-distribution", { headers }).catch(
          (err) => ({ ok: false, error: err.message })
        ),
        fetch(`/api/dashboard/stock-trends?days=${effectiveTimeRange}`, {
          headers,
        }).catch((err) => ({ ok: false, error: err.message })),
      ]);

      // Handle distribution response
      if (distributionResponse.ok) {
        const distributionData = await distributionResponse.json();
        setProductDistribution(
          Array.isArray(distributionData) ? distributionData : []
        );
      } else {
        console.error(
          "Product distribution fetch failed:",
          distributionResponse.error
        );
        setProductDistribution([]);
      }

      // Handle trends response
      if (trendsResponse.ok) {
        const trendsData = await trendsResponse.json();
        setStockTrends(Array.isArray(trendsData) ? trendsData : []);
      } else {
        console.error("Stock trends fetch failed:", trendsResponse.error);
        setStockTrends([]);
      }
    } catch (error) {
      console.error("Error fetching product charts data:", error);
    } finally {
      setChartsLoading(false);
    }
  }, []); // Removed timeRange dependency to prevent auto-refresh on time range changes

  const handleManualRefresh = useCallback(() => {
    fetchProductDashboardData();
    fetchChartsData(timeRange); // Pass current timeRange explicitly
  }, [fetchProductDashboardData, fetchChartsData]);

  useEffect(() => {
    if (canViewProducts) {
      fetchProductDashboardData();
    }
  }, [canViewProducts]); // Removed function dependency to prevent unnecessary re-renders

  useEffect(() => {
    if (canViewProducts) {
      fetchChartsData(timeRange); // Pass initial timeRange explicitly
    }
  }, [canViewProducts]); // Removed function dependency to prevent unnecessary re-renders

  const alertsColumns = useMemo(
    () => [
      {
        title: t("product.name"),
        dataIndex: "name",
        key: "name",
        render: (name, record) => (
          <div>
            <div style={{ fontWeight: "bold" }}>{name}</div>
            <div style={{ fontSize: "12px", color: "#666" }}>{record.sku}</div>
          </div>
        ),
      },
      {
        title: t("product.category"),
        dataIndex: "category",
        key: "category",
        render: (category) => <Tag color="blue">{category}</Tag>,
      },
      {
        title: t("product.currentStock"),
        dataIndex: "current_stock",
        key: "current_stock",
        render: (stock) => (
          <span
            style={{
              color:
                stock === 0 ? "#ff4d4f" : stock < 10 ? "#fa8c16" : "#52c41a",
            }}
          >
            {stock}
          </span>
        ),
      },
      {
        title: t("product.reorderLevel"),
        dataIndex: "reorder_level",
        key: "reorder_level",
      },
      {
        title: t("product.shortage"),
        dataIndex: "shortage",
        key: "shortage",
        render: (shortage) => <Tag color="red">-{shortage}</Tag>,
      },
    ],
    [t]
  );

  const activitiesColumns = useMemo(
    () => [
      {
        title: t("product.product"),
        dataIndex: "product_name",
        key: "product_name",
        render: (name, record) => (
          <div>
            <div style={{ fontWeight: "bold" }}>{name}</div>
            <div style={{ fontSize: "12px", color: "#666" }}>{record.sku}</div>
          </div>
        ),
      },
      {
        title: t("product.movementType"),
        dataIndex: "movement_type",
        key: "movement_type",
        render: (type) => (
          <Tag
            color={type === "in" ? "green" : type === "out" ? "red" : "blue"}
          >
            {type === "in" ? (
              <>
                <ArrowUpOutlined /> {t("product.stockIn")}
              </>
            ) : type === "out" ? (
              <>
                <ArrowDownOutlined /> {t("product.stockOut")}
              </>
            ) : (
              <>
                <SwapOutlined /> {t("product.transfer")}
              </>
            )}
          </Tag>
        ),
      },
      {
        title: t("product.quantity"),
        dataIndex: "quantity",
        key: "quantity",
      },
      {
        title: t("product.reason"),
        dataIndex: "reason",
        key: "reason",
        ellipsis: true,
      },
      {
        title: t("common.date"),
        dataIndex: "created_at",
        key: "created_at",
        render: (date) => new Date(date).toLocaleDateString(),
      },
    ],
    [t]
  );

  if (!canViewProducts) {
    return (
      <Alert
        message={t("common.accessDenied")}
        description={t("common.noPermission")}
        type="warning"
        showIcon
      />
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="product-dashboard-container">
      {/* Controls Section */}
      <Card className="dashboard-controls" style={{ marginBottom: 24 }}>
      <div style={{display:"flex", justifyContent:"space-between" , flexDirection:"row"}}>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleManualRefresh}
            loading={chartsLoading || loading}
            size="large"
          >
            {t("common.refresh") || "Refresh"}
          </Button>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: "30%", minWidth: 150 }}
            loading={chartsLoading}
            disabled={chartsLoading || loading}
            size="large"
          >
            <Option value={7}>{t("dashboard.last7Days")}</Option>
            <Option value={30}>{t("dashboard.last30Days")}</Option>
            <Option value={90}>{t("dashboard.last90Days")}</Option>
          </Select>
        </div>
      </Card>

      {/* Key Metrics Section */}
      <Card
        title={
          <Space>
            <BarChartOutlined style={{ color: "#1890ff" }} />
            <span style={{ color: "#1890ff" }}>
              {t("productDashboard.keyMetrics") || "Key Metrics"}
            </span>
          </Space>
        }
        className="dashboard-card metrics-card"
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <Card
              className="metric-card"
              style={{
                borderTop: "4px solid #1890ff",
                textAlign: "center",
                height: "100%",
              }}
            >
              <Statistic
                title={t("productDashboard.totalProducts")}
                value={productStats.total_products || 0}
                prefix={<ShoppingOutlined />}
                valueStyle={{
                  color: "#1890ff",
                  fontSize: "2em",
                  fontWeight: "bold",
                }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <Card
              className="metric-card"
              style={{
                borderTop: "4px solid #fa8c16",
                textAlign: "center",
                height: "100%",
              }}
            >
              <Statistic
                title={t("productDashboard.lowStockProducts")}
                value={productStats.low_stock_products || 0}
                prefix={<WarningOutlined />}
                valueStyle={{
                  color: "#fa8c16",
                  fontSize: "2em",
                  fontWeight: "bold",
                }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <Card
              className="metric-card"
              style={{
                borderTop: "4px solid #ff4d4f",
                textAlign: "center",
                height: "100%",
              }}
            >
              <Statistic
                title={t("productDashboard.outOfStockProducts")}
                value={productStats.out_of_stock_products || 0}
                prefix={<StopOutlined />}
                valueStyle={{
                  color: "#ff4d4f",
                  fontSize: "2em",
                  fontWeight: "bold",
                }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} xl={6}>
            <Card
              className="metric-card"
              style={{
                borderTop: "4px solid #722ed1",
                textAlign: "center",
                height: "100%",
              }}
            >
              <Statistic
                title={t("productDashboard.categoriesCount")}
                value={productStats.categories_count || 0}
                prefix={<TagsOutlined />}
                valueStyle={{
                  color: "#722ed1",
                  fontSize: "2em",
                  fontWeight: "bold",
                }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} lg={12} xl={8}>
            <Card
              className="metric-card"
              style={{
                borderTop: "4px solid #52c41a",
                textAlign: "center",
                height: "100%",
              }}
            >
              <Statistic
                title={t("productDashboard.totalStockValue")}
                value={productStats.total_stock_value || 0}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{
                  color: "#52c41a",
                  fontSize: "2em",
                  fontWeight: "bold",
                }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={24} lg={24} xl={8}>
            <Card
              className="metric-card health-score-card"
              style={{
                borderTop: "4px solid #1890ff",
                textAlign: "center",
                height: "100%",
              }}
            >
              <div style={{ padding: "8px" }}>
                <Title level={5} style={{ margin: 0, marginBottom: 12 }}>
                  {t("productDashboard.stockHealth") || "Stock Health"}
                </Title>
                <Progress
                  type="circle"
                  percent={Math.round(
                    (((productStats.total_products || 0) -
                      (productStats.low_stock_products || 0) -
                      (productStats.out_of_stock_products || 0)) /
                      (productStats.total_products || 1)) *
                      100
                  )}
                  size={80}
                  strokeColor="#1890ff"
                />
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Analytics & Trends Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Product Distribution Chart */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <TagsOutlined style={{ color: "#722ed1" }} />
                <span style={{ color: "#722ed1" }}>
                  {t("productDashboard.categoryDistribution")}
                </span>
              </Space>
            }
            className="dashboard-card"
            loading={chartsLoading}
            style={{ height: "400px" }}
          >
            {productDistribution && productDistribution.length > 0 ? (
              <div
                style={{
                  height: "300px",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <PieChart
                  series={[
                    {
                      data: productDistribution.map((item, index) => ({
                        id: index,
                        value: item?.count || 0,
                        label: item?.category || "",
                      })),
                      highlightScope: { faded: "global", highlighted: "item" },
                      faded: {
                        innerRadius: 30,
                        additionalRadius: -30,
                        color: "gray",
                      },
                    },
                  ]}
                  height={300}
                  slotProps={{
                    legend: {
                      direction: "row",
                      position: { vertical: "bottom", horizontal: "middle" },
                      padding: 0,
                    },
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "50px 0",
                  color: "#999",
                  height: "250px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {t("common.noData")}
              </div>
            )}
          </Card>
        </Col>

        {/* Stock Summary */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <BarChartOutlined style={{ color: "#1890ff" }} />
                <span style={{ color: "#1890ff" }}>
                  {t("productDashboard.stockSummary") || "Stock Summary"}
                </span>
              </Space>
            }
            className="dashboard-card"
            style={{ height: "400px" }}
          >
            <div style={{ height: "300px", overflowY: "auto" }}>
              <Space
                direction="vertical"
                style={{ width: "100%" }}
                size="large"
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span>
                      {t("productDashboard.wellStocked") || "Well Stocked"}
                    </span>
                    <span style={{ color: "#52c41a", fontWeight: "bold" }}>
                      {(productStats.total_products || 0) -
                        (productStats.low_stock_products || 0) -
                        (productStats.out_of_stock_products || 0)}
                    </span>
                  </div>
                  <Progress
                    percent={
                      (((productStats.total_products || 0) -
                        (productStats.low_stock_products || 0) -
                        (productStats.out_of_stock_products || 0)) /
                        (productStats.total_products || 1)) *
                      100
                    }
                    strokeColor="#52c41a"
                    showInfo={false}
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span>{t("productDashboard.lowStock") || "Low Stock"}</span>
                    <span style={{ color: "#fa8c16", fontWeight: "bold" }}>
                      {productStats.low_stock_products || 0}
                    </span>
                  </div>
                  <Progress
                    percent={
                      ((productStats.low_stock_products || 0) /
                        (productStats.total_products || 1)) *
                      100
                    }
                    strokeColor="#fa8c16"
                    showInfo={false}
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span>
                      {t("productDashboard.outOfStock") || "Out of Stock"}
                    </span>
                    <span style={{ color: "#ff4d4f", fontWeight: "bold" }}>
                      {productStats.out_of_stock_products || 0}
                    </span>
                  </div>
                  <Progress
                    percent={
                      ((productStats.out_of_stock_products || 0) /
                        (productStats.total_products || 1)) *
                      100
                    }
                    strokeColor="#ff4d4f"
                    showInfo={false}
                  />
                </div>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Alerts & Management Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Low Stock Alerts */}
        <Col xs={24} xl={24}>
          <Card
            title={
              <Space>
                <AlertOutlined style={{ color: "#fa8c16" }} />
                <span style={{ color: "#fa8c16" }}>
                  {t("productDashboard.lowStockAlerts")}
                </span>
                {lowStockAlerts.length > 0 && (
                  <Tag color="orange" style={{ marginLeft: 8 }}>
                    {lowStockAlerts.length} {t("common.alerts") || "alerts"}
                  </Tag>
                )}
              </Space>
            }
            className="dashboard-card"
            extra={
              <Space>
                {lowStockAlerts.length > 0 && (
                  <Button 
                    type="primary" 
                    size="small" 
                    danger
                    onClick={() => {
                      message.info('Reorder All functionality would be implemented here');
                    }}
                  >
                    {t("productDashboard.reorderAll") || "Reorder All"}
                  </Button>
                )}
                <Button 
                  type="default" 
                  size="small"
                  onClick={() => {
                    message.info('View All Stock Alerts functionality would be implemented here');
                  }}
                >
                  {t("common.viewAll") || "View All"}
                </Button>
              </Space>
            }
            style={{ minHeight: "300px" }}
          >
            <Table
              columns={alertsColumns}
              dataSource={lowStockAlerts}
              rowKey="id"
              pagination={
                lowStockAlerts.length > 5
                  ? {
                      pageSize: 5,
                      showSizeChanger: false,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} items`,
                    }
                  : false
              }
              size="small"
              scroll={{ x: "max-content" }}
              locale={{
                emptyText: (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "50px 0",
                      color: "#52c41a",
                    }}
                  >
                    <CheckCircleOutlined
                      style={{
                        fontSize: "48px",
                        color: "#52c41a",
                        marginBottom: 16,
                      }}
                    />
                    <div>
                      {t("productDashboard.noLowStockAlerts") ||
                        "All products are well stocked!"}
                    </div>
                  </div>
                ),
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Activities Section */}
      <Card
        title={
          <Space>
            <SwapOutlined style={{ color: "#13c2c2" }} />
            <span style={{ color: "#13c2c2" }}>
              {t("productDashboard.recentActivities")}
            </span>
            <Tag color="cyan">{t("common.last24Hours") || "Last 24 Hours"}</Tag>
          </Space>
        }
        className="dashboard-card"
        extra={
          <Space>
            <Button 
              type="default" 
              size="small"
              onClick={() => {
                message.info('Export functionality would be implemented here');
              }}
            >
              {t("common.export") || "Export"}
            </Button>
            <Button 
              type="default" 
              size="small"
              onClick={() => {
                message.info('View All Activities functionality would be implemented here');
              }}
            >
              {t("common.viewAll") || "View All"}
            </Button>
          </Space>
        }
      >
        <Table
          columns={activitiesColumns}
          dataSource={recentActivities}
          rowKey="id"
          pagination={
            recentActivities.length > 10
              ? {
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) =>
                    `${range[0]}-${range[1]} of ${total} items`,
                }
              : false
          }
          size="small"
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: (
              <div
                style={{
                  textAlign: "center",
                  padding: "50px 0",
                  color: "#999",
                }}
              >
                <SwapOutlined
                  style={{
                    fontSize: "48px",
                    color: "#d9d9d9",
                    marginBottom: 16,
                  }}
                />
                <div>{t("common.noData") || "No recent activities"}</div>
              </div>
            ),
          }}
          rowClassName={(record) => {
            if (record.movement_type === "in") return "stock-in-row";
            if (record.movement_type === "out") return "stock-out-row";
            return "";
          }}
        />
      </Card>
    </div>
  );
});

export default ProductDashboard;
