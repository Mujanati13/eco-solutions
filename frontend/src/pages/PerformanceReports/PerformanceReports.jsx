import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Button,
  DatePicker,
  Select,
  Space,
  Typography,
  message,
  Spin,
  Tag,
  Alert,
  Modal,
  Radio,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  DownloadOutlined,
  BarChartOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { performanceService } from "../../services/performanceService";
import "./PerformanceReports.css";

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const PerformanceReports = () => {
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [reportData, setReportData] = useState({});
  const [userReports, setUserReports] = useState([]);
  const [dateRange, setDateRange] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();

  const canViewAllUsers = hasPermission('canViewUsers');
  const canExportReports = hasPermission('canExportReports');

  useEffect(() => {
    fetchReports();
    if (canViewAllUsers) {
      fetchUsers();
    }
  }, [dateRange, selectedUser, canViewAllUsers]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await performanceService.getUsers();
      // Handle the correct API response format: { users: [...], pagination: {...} }
      setUsers(response.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      message.error(t("performance.fetchUsersError"));
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = {
        user_id: canViewAllUsers ? selectedUser : user.id,
        start_date: dateRange?.[0]?.format("YYYY-MM-DD"),
        end_date: dateRange?.[1]?.format("YYYY-MM-DD"),
      };

      const response = await performanceService.getReports(params);
      
      if (response.success) {
        setReportData(response.data.summary || {});
        setUserReports(response.data.details || []);
      } else {
        message.error(t("performance.fetchError"));
      }
    } catch (error) {
      message.error(t("performance.fetchError"));
      console.error("Fetch reports error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportClick = () => {
    setExportModalVisible(true);
  };

  const handleExportConfirm = async () => {
    try {
      setExporting(true);
      const params = {
        user_id: canViewAllUsers ? selectedUser : user.id,
        start_date: dateRange?.[0]?.format("YYYY-MM-DD"),
        end_date: dateRange?.[1]?.format("YYYY-MM-DD"),
        format: selectedExportFormat,
      };

      let response;
      let filename;
      let mimeType;

      switch (selectedExportFormat) {
        case 'csv':
          response = await performanceService.exportReports(params);
          mimeType = "text/csv";
          filename = `performance_report_${new Date().toISOString().split("T")[0]}.csv`;
          break;
        case 'excel':
          response = await performanceService.exportReports({ ...params, format: 'excel' });
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename = `performance_report_${new Date().toISOString().split("T")[0]}.xlsx`;
          break;
        case 'pdf':
          response = await performanceService.exportReports({ ...params, format: 'pdf' });
          mimeType = "application/pdf";
          filename = `performance_report_${new Date().toISOString().split("T")[0]}.pdf`;
          break;
        default:
          response = await performanceService.exportReports(params);
          mimeType = "text/csv";
          filename = `performance_report_${new Date().toISOString().split("T")[0]}.csv`;
      }

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      message.success(t("performance.exportSuccess"));
      setExportModalVisible(false);
    } catch (error) {
      message.error(t("performance.exportError"));
      console.error("Export error:", error);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCancel = () => {
    setExportModalVisible(false);
    setSelectedExportFormat('csv');
  };

  const getSuccessRateColor = (rate) => {
    if (rate >= 80) return "success";
    if (rate >= 60) return "warning";
    return "error";
  };

  // Simple and clean table columns
  const columns = [
    {
      title: t("performance.date"),
      dataIndex: "date",
      key: "date",
      width: 120,
      render: (date) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
    },
    ...(canViewAllUsers ? [{
      title: t("performance.user"),
      key: "employee",
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong>{record.user_name}</Text>
            <Tag 
              size="small" 
              color={
                record.user_role === 'admin' ? 'red' : 
                record.user_role === 'employee' ? 'blue' : 
                'default'
              }
            >
              {t(`roles.${record.user_role || 'employee'}`)}
            </Tag>
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>@{record.username}</Text>
        </div>
      ),
    }] : []),
    {
      title: t("performance.ordersAssigned"),
      dataIndex: "orders_assigned",
      key: "orders_assigned",
      width: 120,
      align: "center",
      render: (count) => (
        <Tag color="purple" icon={<BarChartOutlined />}>
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.orders_assigned - b.orders_assigned,
    },
    {
      title: t("performance.ordersConfirmed"),
      dataIndex: "orders_confirmed",
      key: "orders_confirmed",
      width: 120,
      align: "center",
      render: (count) => (
        <Tag color="blue" icon={<CheckCircleOutlined />}>
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.orders_confirmed - b.orders_confirmed,
    },
    {
      title: t("performance.ordersDelivered"),
      dataIndex: "orders_delivered",
      key: "orders_delivered",
      width: 120,
      align: "center",
      render: (count) => (
        <Tag color="green" icon={<TrophyOutlined />}>
          {count}
        </Tag>
      ),
      sorter: (a, b) => a.orders_delivered - b.orders_delivered,
    },
    {
      title: t("performance.successRate"),
      dataIndex: "success_rate",
      key: "success_rate",
      width: 120,
      align: "center",
      render: (rate) => (
        <Tag color={getSuccessRateColor(rate)}>
          {rate.toFixed(1)}%
        </Tag>
      ),
      sorter: (a, b) => a.success_rate - b.success_rate,
    },
  ];

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px', 
        flexDirection: 'column' 
      }}>
        <Spin size="large" />
        <Text style={{ marginTop: 16 }}>{t("common.loading")}</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '0px' }}>
      {/* Controls */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>{t("performance.dateRange")}</Text>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: "100%" }}
                placeholder={[t("performance.startDate"), t("performance.endDate")]}
              />
            </Space>
          </Col>

          {canViewAllUsers && (
            <Col xs={24} sm={12} md={8}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>{t("performance.selectUser")}</Text>
                <Select
                  value={selectedUser}
                  onChange={setSelectedUser}
                  style={{ width: "100%" }}
                  placeholder={t("performance.allUsers")}
                  allowClear
                  showSearch
                  loading={loadingUsers}
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {users.map((u) => (
                    <Option key={u.id} value={u.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                      
                          <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>
                            (@{u.username})
                          </Text>
                        </span>
                        <Tag 
                          color={
                            u.role === 'admin' ? 'red' : 
                            u.role === 'employee' ? 'blue' : 
                            'default'
                          } 
                          size="small"
                        >
                          {t(`roles.${u.role}`)}
                        </Tag>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Space>
            </Col>
          )}

          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>{t("performance.actions")}</Text>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchReports}
                  loading={loading}
                >
                  {t("common.refresh")}
                </Button>
                {canExportReports && (
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleExportClick}
                  >
                    {t("performance.export")}
                  </Button>
                )}
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={t("performance.totalUsers")}
              value={reportData.total_users || 0}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={t("performance.totalAssigned")}
              value={reportData.total_assigned || 0}
              prefix={<BarChartOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={t("performance.totalConfirmed")}
              value={reportData.total_confirmed || 0}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={t("performance.totalDelivered")}
              value={reportData.total_delivered || 0}
              prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>   

      {/* Data Table */}
      <Card title={t("performance.detailedReports")}>
        {userReports.length === 0 && !loading ? (
          <Alert
            message={t("common.noData")}
            description={t("performance.noDataDescription")}
            type="info"
            showIcon
            style={{ margin: '40px 0' }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={userReports}
            rowKey={(record) => `${record.user_id}_${record.date}`}
            loading={loading}
            size="small"
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} ${t("common.of")} ${total} ${t("common.items")}`,
            }}
          />
        )}
      </Card>

      {/* Export Format Modal */}
      <Modal
        title={t("performance.selectExportFormat")}
        open={exportModalVisible}
        onOk={handleExportConfirm}
        onCancel={handleExportCancel}
        confirmLoading={exporting}
        okText={t("performance.export")}
        cancelText={t("common.cancel")}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>{t("performance.exportFormat")}:</Text>
        </div>
        <Radio.Group
          value={selectedExportFormat}
          onChange={(e) => setSelectedExportFormat(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Radio value="csv">
              <Space>
                <FileTextOutlined style={{ color: '#52c41a' }} />
                <div>
                  <div>{t("performance.csvFormat")}</div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    CSV (Comma-separated values)
                  </Text>
                </div>
              </Space>
            </Radio>
            <Radio value="excel">
              <Space>
                <FileExcelOutlined style={{ color: '#52c41a' }} />
                <div>
                  <div>{t("performance.excelFormat")}</div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Excel spreadsheet format
                  </Text>
                </div>
              </Space>
            </Radio>
            <Radio value="pdf">
              <Space>
                <FilePdfOutlined style={{ color: '#f5222d' }} />
                <div>
                  <div>{t("performance.pdfFormat")}</div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Portable Document Format
                  </Text>
                </div>
              </Space>
            </Radio>
          </Space>
        </Radio.Group>
      </Modal>
    </div>
  );
};

export default PerformanceReports;
