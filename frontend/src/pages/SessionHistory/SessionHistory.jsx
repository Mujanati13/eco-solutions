import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  DatePicker,
  Button,
  Row,
  Col,
  Statistic,
  Tooltip,
  message,
  Spin,
  Alert,
  Modal,
  Radio,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  ClockCircleOutlined,
  LoginOutlined,
  LogoutOutlined,
  GlobalOutlined,
  DesktopOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { authService } from "../../services/authService";
import "./SessionHistory.css";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const SessionHistory = () => {
  const [sessions, setSessions] = useState([]);
  const [sessionStats, setSessionStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchSessions();
    fetchSessionStats();
  }, [dateRange]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const params = {
        limit: 50,
      };

      if (dateRange) {
        params.start_date = dateRange[0].format("YYYY-MM-DD");
        params.end_date = dateRange[1].format("YYYY-MM-DD");
      }

      const response = await authService.getSessions(params);
      setSessions(response.sessions || []);
    } catch (error) {
      message.error(t("sessions.fetchError"));
      console.error("Fetch sessions error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionStats = async () => {
    try {
      const params = {};
      if (dateRange) {
        params.start_date = dateRange[0].format("YYYY-MM-DD");
        params.end_date = dateRange[1].format("YYYY-MM-DD");
      }

      const response = await authService.getSessionStats(params);
      setSessionStats(response.stats || {});
    } catch (error) {
      console.error("Fetch session stats error:", error);
    }
  };

  const handleExportClick = () => {
    setExportModalVisible(true);
  };

  const handleExportConfirm = async () => {
    try {
      setExporting(true);
      const params = {};

      if (dateRange) {
        params.start_date = dateRange[0].format("YYYY-MM-DD");
        params.end_date = dateRange[1].format("YYYY-MM-DD");
      }

      params.format = selectedExportFormat;

      const response = await authService.exportSessions(params);
      
      // Get the filename from the response headers or create one
      const contentDisposition = response.headers['content-disposition'];
      let filename;
      if (contentDisposition) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      } else {
        // Fallback filename based on format
        switch (selectedExportFormat) {
          case 'excel':
            filename = `session_history_${new Date().toISOString().split("T")[0]}.xlsx`;
            break;
          case 'pdf':
            filename = `session_history_${new Date().toISOString().split("T")[0]}.pdf`;
            break;
          default:
            filename = `session_history_${new Date().toISOString().split("T")[0]}.csv`;
        }
      }

      // Create blob with appropriate content type
      let blob;
      if (selectedExportFormat === 'csv') {
        blob = new Blob([response.data], { type: 'text/csv' });
      } else if (selectedExportFormat === 'excel') {
        blob = new Blob([response.data], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      } else if (selectedExportFormat === 'pdf') {
        blob = new Blob([response.data], { type: 'application/pdf' });
      } else {
        blob = new Blob([response.data], { type: 'text/csv' });
      }

      // Create and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      message.success(t("common.exportSuccess"));
      setExportModalVisible(false);
    } catch (error) {
      message.error(t("common.exportError"));
      console.error("Export error:", error);
    } finally {
      setExporting(false);
      setSelectedExportFormat('csv');
    }
  };

  const handleExportCancel = () => {
    setExportModalVisible(false);
    setSelectedExportFormat('csv');
  };

  const formatDuration = (seconds) => {
    if (!seconds) return t("sessions.noData");

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const getSessionStatus = (session) => {
    if (session.is_active) {
      return (
        <Tag color="green" icon={<ClockCircleOutlined />}>
          {t("sessions.active")}
        </Tag>
      );
    } else if (session.logout_time) {
      return (
        <Tag color="blue" icon={<LogoutOutlined />}>
          {t("sessions.completed")}
        </Tag>
      );
    } else {
      return (
        <Tag color="orange" icon={<ClockCircleOutlined />}>
          {t("sessions.expired")}
        </Tag>
      );
    }
  };

  const getBrowserInfo = (userAgent) => {
    if (!userAgent) return t("sessions.unknown");

    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    return t("sessions.unknown");
  };

  const columns = [
    {
      title: t("sessions.loginTime"),
      dataIndex: "login_time",
      key: "login_time",
      width: 180,
      render: (time) => new Date(time).toLocaleString(),
      sorter: (a, b) => new Date(a.login_time) - new Date(b.login_time),
    },
    {
      title: t("sessions.logoutTime"),
      dataIndex: "logout_time",
      key: "logout_time",
      width: 180,
      render: (time) =>
        time ? new Date(time).toLocaleString() : (
          <Tag color="green" icon={<ClockCircleOutlined />}>
            {t("sessions.stillActive")}
          </Tag>
        ),
    },
    {
      title: t("sessions.duration"),
      dataIndex: "session_duration",
      key: "session_duration",
      width: 120,
      render: (duration) => (
        <Tag color="blue" icon={<ClockCircleOutlined />}>
          {formatDuration(duration)}
        </Tag>
      ),
      sorter: (a, b) => (a.session_duration || 0) - (b.session_duration || 0),
    },
    {
      title: t("sessions.status"),
      key: "status",
      width: 120,
      render: (_, record) => getSessionStatus(record),
    },
    {
      title: t("sessions.location"),
      dataIndex: "ip_address",
      key: "ip_address",
      width: 150,
      render: (ip) => (
        <Tooltip title={ip}>
          <Space>
            <GlobalOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontSize: '12px' }}>
              {ip || t("sessions.unknown")}
            </span>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: t("sessions.browser"),
      dataIndex: "user_agent",
      key: "user_agent",
      width: 120,
      render: (userAgent) => (
        <Space>
          <DesktopOutlined style={{ color: '#722ed1' }} />
          <span style={{ fontSize: '12px' }}>
            {getBrowserInfo(userAgent)}
          </span>
        </Space>
      ),
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
        <Typography.Text style={{ marginTop: 16 }}>{t("common.loading")}</Typography.Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '0px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={2} style={{ margin: 0, color: '#1890ff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <HistoryOutlined />
          {t("sessions.title")}
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
          {t("sessions.subtitle")}
        </Typography.Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={t("sessions.totalSessions")}
              value={sessionStats.total_sessions || 0}
              prefix={<LoginOutlined style={{ color: "#1890ff" }} />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={t("sessions.completedSessions")}
              value={sessionStats.completed_sessions || 0}
              prefix={<LogoutOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={t("sessions.avgDuration")}
              value={formatDuration(
                Math.round(sessionStats.avg_duration_seconds || 0)
              )}
              prefix={<ClockCircleOutlined style={{ color: "#faad14" }} />}
              valueStyle={{ color: "#faad14" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={t("sessions.totalTime")}
              value={formatDuration(
                Math.round(sessionStats.total_time_seconds || 0)
              )}
              prefix={<ClockCircleOutlined style={{ color: "#722ed1" }} />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Controls */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text strong>{t("sessions.dateRange")}</Typography.Text>
              <DatePicker.RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: "100%" }}
                placeholder={[t("sessions.startDate"), t("sessions.endDate")]}
              />
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text strong>{t("common.actions")}</Typography.Text>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    fetchSessions();
                    fetchSessionStats();
                  }}
                  loading={loading}
                >
                  {t("common.refresh")}
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExportClick}
                  disabled={sessions.length === 0}
                >
                  {t("common.export")}
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Sessions Table */}
      <Card title={t("sessions.sessionHistory")}>
        {sessions.length === 0 && !loading ? (
          <Alert
            message={t("common.noData")}
            description={t("sessions.noData")}
            type="info"
            showIcon
            style={{ margin: '40px 0' }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={sessions}
            rowKey="id"
            loading={loading}
            size="small"
            scroll={{ x: 1000 }}
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
        okText={t("common.export")}
        cancelText={t("common.cancel")}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text>{t("performance.exportFormat")}:</Typography.Text>
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
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    CSV (Comma-separated values)
                  </Typography.Text>
                </div>
              </Space>
            </Radio>
            <Radio value="excel">
              <Space>
                <FileExcelOutlined style={{ color: '#52c41a' }} />
                <div>
                  <div>{t("performance.excelFormat")}</div>
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    Excel spreadsheet format
                  </Typography.Text>
                </div>
              </Space>
            </Radio>
            <Radio value="pdf">
              <Space>
                <FilePdfOutlined style={{ color: '#f5222d' }} />
                <div>
                  <div>{t("performance.pdfFormat")}</div>
                  <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                    Portable Document Format
                  </Typography.Text>
                </div>
              </Space>
            </Radio>
          </Space>
        </Radio.Group>
      </Modal>
    </div>
  );
};

export default SessionHistory;
