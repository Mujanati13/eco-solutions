import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  DatePicker,
  Select,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  message,
  Tooltip,
  Progress,
  Spin,
  Empty,
} from "antd";
import {
  DownloadOutlined,
  ReloadOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  EyeOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import sessionTimeService from "../../services/sessionTimeService";
import socketService from "../../services/socketService";
import "./SessionTimeTracking.css";

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const SessionTimeTracking = () => {
  const [sessionData, setSessionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dateRange, setDateRange] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [viewType, setViewType] = useState("summary"); // 'summary', 'detailed', 'active'
  const [groupBy, setGroupBy] = useState("none"); // 'none', 'day', 'month', 'year'
  // Local state for current session duration (only for this component)
  const [localSessionDuration, setLocalSessionDuration] = useState(0);

  const { user, activeUsers } = useAuth();
  const {
    hasPermission,
    isAdmin,
    isSupervisor,
    loading: permissionsLoading,
  } = usePermissions();
  const { t } = useTranslation();

  useEffect(() => {
    if (!permissionsLoading) {
      fetchTodayData();
      if (
        hasPermission("canViewUsers") ||
        hasPermission("canViewPerformance")
      ) {
        fetchActiveSessions();
      }
    }
  }, []);

  // Local session duration timer (only for this component)
  useEffect(() => {
    const sessionTimer = setInterval(() => {
      if (socketService.isSocketConnected()) {
        const duration = socketService.getSessionDuration();
        setLocalSessionDuration(duration);
      }
    }, 1000);

    return () => {
      clearInterval(sessionTimer);
    };
  }, []);

  const fetchTodayData = async () => {
    try {
      setLoading(true);
      const today = sessionTimeService.getTodayDate();

      if (isAdmin && !selectedUser) {
        // Admin: Get all users' data for today
        const response = await sessionTimeService.getAllUsersSessionTime(today);
        setSessionData(response.data || []);
      } else {
        // Employee: Get only their own data, Admin: Get specific user's data
        const userId = isAdmin ? selectedUser : user.id;
        const response = await sessionTimeService.getTodaySessionTime(userId);
        setSessionData(response.data ? [response.data] : []);
      }
    } catch (error) {
      console.error("Error fetching today session data:", error);
      message.error("Failed to fetch session data");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const response = await sessionTimeService.getActiveSessions();
      setActiveSessions(response.data?.activeSessions || []);
    } catch (error) {
      console.error("Error fetching active sessions:", error);
    }
  };

  const handleDateRangeChange = async (dates) => {
    if (!dates || dates.length === 0) {
      setDateRange([]);
      setSessionData([]);
      return;
    }

    try {
      setLoading(true);
      const startDate = dates[0].format("YYYY-MM-DD");
      const endDate = dates[1].format("YYYY-MM-DD");
      setDateRange([startDate, endDate]);

      // Employee can only see their own data, Admin can select user
      const userId = isAdmin ? selectedUser : user.id;
      const response = await sessionTimeService.getSessionTimeRange(
        startDate,
        endDate,
        userId
      );
      setSessionData(response.data || []);

      // Get summary stats
      const statsResponse = await sessionTimeService.getSessionStats(
        startDate,
        endDate,
        userId
      );
      setSummary(statsResponse.data);
    } catch (error) {
      console.error("Error fetching session range data:", error);
      message.error(t("common.failedToFetch"));
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = async (userId) => {
    // Only admin can change user selection
    if (!isAdmin) return;

    setSelectedUser(userId);
    if (dateRange.length > 0) {
      // Fetch data for the existing date range with the new user
      try {
        setLoading(true);
        const startDate = dateRange[0];
        const endDate = dateRange[1];

        const response = await sessionTimeService.getSessionTimeRange(
          startDate,
          endDate,
          userId
        );
        setSessionData(response.data || []);

        // Get summary stats
        const statsResponse = await sessionTimeService.getSessionStats(
          startDate,
          endDate,
          userId
        );
        setSummary(statsResponse.data);
      } catch (error) {
        console.error("Error fetching session range data:", error);
        message.error(t("common.failedToFetch"));
      } finally {
        setLoading(false);
      }
    } else {
      fetchTodayData();
    }
  };

  const handleExport = async () => {
    try {
      const startDate = dateRange[0] || sessionTimeService.getTodayDate();
      const endDate = dateRange[1] || sessionTimeService.getTodayDate();
      // Employee can only export their own data, Admin can export selected user or all
      const userId = isAdmin ? selectedUser : user.id;

      await sessionTimeService.exportSessionData(startDate, endDate, userId);
      message.success(t("common.sessionDataExported"));
    } catch (error) {
      console.error("Error exporting session data:", error);
      message.error(t("common.failedToFetch"));
    }
  };

  const handleRefresh = () => {
    if (dateRange.length > 0) {
      // Since dateRange contains strings, we need to handle the refresh differently
      const startDate = dateRange[0];
      const endDate = dateRange[1];

      // Refresh data for the existing date range
      const refreshDateRange = async () => {
        try {
          setLoading(true);
          const userId = isAdmin ? selectedUser : user.id;
          const response = await sessionTimeService.getSessionTimeRange(
            startDate,
            endDate,
            userId
          );
          setSessionData(response.data || []);

          // Get summary stats
          const statsResponse = await sessionTimeService.getSessionStats(
            startDate,
            endDate,
            userId
          );
          setSummary(statsResponse.data);
        } catch (error) {
          console.error("Error fetching session range data:", error);
          message.error(t("common.failedToFetch"));
        } finally {
          setLoading(false);
        }
      };

      refreshDateRange();
    } else {
      fetchTodayData();
    }
    if (isAdmin) {
      fetchActiveSessions();
    }
  };

  const getCurrentSessionInfo = () => {
    if (socketService.isSocketConnected()) {
      return {
        duration: localSessionDuration,
        formattedDuration:
          sessionTimeService.formatSessionTime(localSessionDuration),
        status: "Active",
        color: "success",
      };
    }
    return {
      duration: 0,
      formattedDuration: "0m",
      status: "Disconnected",
      color: "error",
    };
  };

  // Group session data by date period
  const groupSessionsByDate = (sessions, groupBy) => {
    if (groupBy === "none") return sessions;

    const grouped = sessions.reduce((acc, session) => {
      const date = new Date(session.date || session.created_at);
      let key;

      switch (groupBy) {
        case "day":
          key = date.toISOString().split("T")[0]; // YYYY-MM-DD
          break;
        case "month":
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
            2,
            "0"
          )}`; // YYYY-MM
          break;
        case "year":
          key = date.getFullYear().toString(); // YYYY
          break;
        default:
          key = "all";
      }

      if (!acc[key]) {
        acc[key] = {
          key,
          date: key,
          sessions: [],
          totalTime: 0,
          totalSessions: 0,
          totalPageViews: 0,
          userInfo: session.first_name
            ? {
                first_name: session.first_name,
                last_name: session.last_name,
                username: session.username,
              }
            : null,
        };
      }

      acc[key].sessions.push(session);
      acc[key].totalTime += session.total_session_time || 0;
      acc[key].totalSessions += session.session_count || 1;
      acc[key].totalPageViews += session.page_views || 0;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  };

  const formatGroupDate = (dateStr, groupBy) => {
    switch (groupBy) {
      case "day":
        return new Date(dateStr).toLocaleDateString();
      case "month":
        const [year, month] = dateStr.split("-");
        return new Date(year, month - 1).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        });
      case "year":
        return dateStr;
      default:
        return dateStr;
    }
  };

  const columns =
    groupBy !== "none"
      ? [
          {
            title: t("sessionTime.date"),
            dataIndex: "date",
            key: "date",
            width: 150,
            fixed: "left",
            render: (date) => (
              <Text style={{fontSize:"14px"}} strong>{formatGroupDate(date, groupBy)}</Text>
            ),
            responsive: ["xs", "sm", "md", "lg", "xl"],
          },
          // Only show user column for admin when viewing all users and not grouped
          ...(isAdmin && !selectedUser
            ? [
                {
                  title: t("sessionTime.user"),
                  key: "user",
                  width: 200,
                  render: (_, record) => {
                    if (record.userInfo) {
                      return (
                        <Space direction="vertical" size="small">
                          <Space size="small">
                            <UserOutlined />
                            <span style={{ fontSize: "14px" }}>
                              {record.userInfo.first_name}{" "}
                              {record.userInfo.last_name}
                            </span>
                          </Space>
                      
                        </Space>
                      );
                    }
                    return <Text type="secondary">Multiple Users</Text>;
                  },
                  responsive: ["sm", "md", "lg", "xl"],
                },
              ]
            : []),
          {
            title: t("sessionTime.totalTime"),
            dataIndex: "totalTime",
            key: "totalTime",
            width: 130,
            render: (time) => (
              <Space direction="vertical" size={0} align="center">
                <ClockCircleOutlined style={{ color: "#1890ff" }} />
                <Text strong style={{ fontSize: "12px" }}>
                  {sessionTimeService.formatSessionTime(time)}
                </Text>
              </Space>
            ),
            responsive: ["xs", "sm", "md", "lg", "xl"],
          },
          {
            title: t("sessionTime.sessions"),
            dataIndex: "totalSessions",
            key: "sessions",
            width: 100,
            render: (count) => (
              <Tag color="blue" style={{ fontSize: "11px" }}>
                {count}
              </Tag>
            ),
            responsive: ["md", "lg", "xl"],
          },

          {
            title: t("sessionTime.productivity"),
            dataIndex: "totalTime",
            key: "productivity",
            width: 120,
            render: (time) => {
              const productivity =
                sessionTimeService.calculateProductivity(time);
              const color = sessionTimeService.getSessionStatusColor(time);
              return (
                <Progress
                  percent={productivity}
                  size="small"
                  status={
                    color === "error"
                      ? "exception"
                      : color === "warning"
                      ? "active"
                      : "success"
                  }
                  format={(percent) => `${percent.toFixed(0)}%`}
                  style={{ width: "100%", minWidth: 80 }}
                />
              );
            },
            responsive: ["sm", "md", "lg", "xl"],
          },
        ]
      : [
          {
            title: t("sessionTime.date"),
            dataIndex: "date",
            key: "date",
            width: 120,
            fixed: "left",
            render: (date) => (
              <Text style={{ fontSize: "14px" }}>
                {new Date(date).toLocaleDateString()}
              </Text>
            ),
            responsive: ["xs", "sm", "md", "lg", "xl"],
          },
          // Only show user column for admin when viewing all users
          ...(isAdmin && !selectedUser
            ? [
                {
                  title: t("sessionTime.user"),
                  key: "user",
                  width: 180,
                  render: (_, record) => (
                    <Space direction="vertical" size="small">
                      <Space size="small">
                        <UserOutlined />
                        <span style={{ fontSize: "14px" }}>
                          {record.first_name} {record.last_name}
                        </span>
                      </Space>
                   
                    </Space>
                  ),
                  responsive: ["sm", "md", "lg", "xl"],
                },
              ]
            : []),
          {
            title: t("sessionTime.totalTime"),
            dataIndex: "total_session_time",
            key: "totalTime",
            width: 130,
            render: (time) => (
              <Space direction="vertical" size={0} align="center">
                {/* <ClockCircleOutlined style={{ color: "#1890ff" }} /> */}
                <Text strong style={{ fontSize: "12px" }}>
                  {sessionTimeService.formatSessionTime(time)}
                </Text>
              </Space>
            ),
            responsive: ["xs", "sm", "md", "lg", "xl"],
          },
          {
            title: t("sessionTime.sessions"),
            dataIndex: "session_count",
            key: "sessions",
            width: 100,
            render: (count) => (
              <Tag color="blue" style={{ fontSize: "11px" }}>
                {count}
              </Tag>
            ),
            responsive: ["md", "lg", "xl"],
          },

          {
            title: t("sessionTime.firstLogin"),
            dataIndex: "first_login",
            key: "firstLogin",
            width: 120,
            render: (time) => (
              <Text style={{ fontSize: "11px" }}>
                {sessionTimeService.formatTime(time)}
              </Text>
            ),
            responsive: ["xl"],
          },
          {
            title: t("sessionTime.lastLogout"),
            dataIndex: "last_logout",
            key: "lastLogout",
            width: 120,
            render: (time) => (
              <Text style={{ fontSize: "11px" }}>
                {sessionTimeService.formatTime(time)}
              </Text>
            ),
            responsive: ["xl"],
          },
          {
            title: t("sessionTime.productivity"),
            dataIndex: "total_session_time",
            key: "productivity",
            width: 120,
            render: (time) => {
              const productivity =
                sessionTimeService.calculateProductivity(time);
              const color = sessionTimeService.getSessionStatusColor(time);
              return (
                <Progress
                  percent={productivity}
                  size="small"
                  status={
                    color === "error"
                      ? "exception"
                      : color === "warning"
                      ? "active"
                      : "success"
                  }
                  format={(percent) => `${percent.toFixed(0)}%`}
                  style={{ width: "100%", minWidth: 80 }}
                />
              );
            },
            responsive: ["sm", "md", "lg", "xl"],
          },
        ];

  const activeSessionColumns = [
    {
      title: t("sessionTime.user"),
      key: "user",
      width: 180,
      fixed: "left",
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Space size="small">
            <UserOutlined />
            <span style={{ fontSize: "14px" }}>
              {record.first_name} {record.last_name}
            </span>
          </Space>
         
        </Space>
      ),
      responsive: ["xs", "sm", "md", "lg", "xl"],
    },
    {
      title: t("sessionTime.currentDuration"),
      dataIndex: "current_duration",
      key: "currentDuration",
      width: 140,
      render: (duration) => (
        <Space direction="vertical" size={0} align="center">
          <ClockCircleOutlined style={{ color: "#1890ff" }} />
          <Text strong style={{ fontSize: "12px" }}>
            {sessionTimeService.formatSessionTime(duration)}
          </Text>
        </Space>
      ),
      responsive: ["xs", "sm", "md", "lg", "xl"],
    },
    {
      title: t("sessionTime.startTime"),
      dataIndex: "start_time",
      key: "startTime",
      width: 120,
      render: (time) => (
        <Text style={{ fontSize: "12px" }}>
          {new Date(time).toLocaleTimeString()}
        </Text>
      ),
      responsive: ["sm", "md", "lg", "xl"],
    },

    {
      title: t("sessionTime.status"),
      dataIndex: "is_active",
      key: "status",
      width: 100,
      render: (isActive) => (
        <Tag
          color={isActive ? "success" : "error"}
          style={{ fontSize: "11px" }}
        >
          {isActive ? t("sessionTime.active") : t("sessionTime.inactive")}
        </Tag>
      ),
      responsive: ["lg", "xl"],
    },
  ];

  const currentSession = getCurrentSessionInfo();

  return (
    <div className="session-time-tracking">
      {/* Current Session Card */}
      <Card className="current-session-card" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Statistic
              title={t("sessionTime.currentSession")}
              value={currentSession.formattedDuration}
              prefix={<ClockCircleOutlined />}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Statistic
              title={t("sessionTime.status")}
              value={currentSession.status}
              valueStyle={{
                color:
                  currentSession.color === "success" ? "#52c41a" : "#ff4d4f",
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Statistic
              title={t("sessionTime.activeUsers")}
              value={activeUsers.length}
              prefix={<UserOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* Controls */}
      <Card style={{ marginBottom: 24 }} className="session-controls">
        <Row gutter={[16, 16]} align="middle">
          {/* View Type Selection - Only show for Admin */}
          {isAdmin && (
            <Col xs={24} sm={12} md={6}>
              <Select
                style={{ width: "100%" }}
                placeholder={t("sessionTime.selectView")}
                value={viewType}
                onChange={setViewType}
              >
                <Option value="summary">{t("sessionTime.summary")}</Option>
                <Option value="detailed">{t("sessionTime.detailed")}</Option>
                <Option value="active">
                  {t("sessionTime.activeSessions")}
                </Option>
              </Select>
            </Col>
          )}

          {/* User Selection - Only for Admin */}
          {isAdmin && (
            <Col xs={24} sm={12} md={6}>
              <Select
                style={{ width: "100%" }}
                placeholder={t("sessionTime.selectUser")}
                allowClear
                value={selectedUser}
                onChange={handleUserChange}
              >
                {activeUsers.map((user) => (
                  <Option key={user.userId} value={user.userId}>
                    {user.userInfo.first_name} {user.userInfo.last_name}
                  </Option>
                ))}
              </Select>
            </Col>
          )}

          <Col xs={24} sm={12} md={isAdmin ? 6 : 8}>
            <RangePicker
              style={{ width: "100%" }}
              onChange={handleDateRangeChange}
              format="YYYY-MM-DD"
            />
          </Col>

          {/* Group By Selection */}
          <Col xs={24} sm={12} md={isAdmin ? 4 : 6}>
            <Select
              style={{ width: "100%" }}
              placeholder={t("sessionTime.groupBy")}
              value={groupBy}
              onChange={setGroupBy}
            >
              <Option value="none">{t("sessionTime.noGrouping")}</Option>
              <Option value="day">{t("sessionTime.byDay")}</Option>
              <Option value="month">{t("sessionTime.byMonth")}</Option>
              <Option value="year">{t("sessionTime.byYear")}</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={isAdmin ? 4 : 8}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                {t("common.refresh")}
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={sessionData.length === 0}
              >
                {t("common.export")}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Summary Statistics */}
      {summary && (
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic
                title={t("sessionTime.totalDays")}
                value={summary.total_days_active}
                prefix={<CalendarOutlined />}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title={t("sessionTime.totalTime")}
                value={sessionTimeService.formatSessionTime(
                  summary.total_time_seconds
                )}
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title={t("sessionTime.avgDaily")}
                value={
                  parseInt(
                    sessionTimeService.formatSessionTime(summary.avg_daily_time)
                  ).toFixed(2) || 0
                }
                prefix={<TrophyOutlined />}
              />
            </Col>
            {/* <Col xs={12} sm={6}>
              <Statistic
                title={t('sessionTime.totalPageViews')}
                value={summary.total_page_views}
                prefix={<EyeOutlined />}
              />
            </Col> */}
          </Row>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <Spin spinning={loading}>
          {viewType === "active" && isAdmin ? (
            <Table
              columns={activeSessionColumns}
              dataSource={activeSessions}
              rowKey="id"
              size="small"
              scroll={{ x: "max-content" }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} ${t(
                    "sessionTime.records"
                  )}`,
                responsive: true,
              }}
              locale={{
                emptyText: (
                  <Empty description={t("sessionTime.noActiveSessions")} />
                ),
              }}
            />
          ) : (
            <Table
              columns={columns}
              dataSource={groupSessionsByDate(sessionData, groupBy)}
              rowKey={groupBy !== "none" ? "key" : "id"}
              size="small"
              scroll={{ x: "max-content" }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} ${t(
                    "sessionTime.records"
                  )}`,
                responsive: true,
              }}
              locale={{
                emptyText: <Empty description={t("sessionTime.noData")} />,
              }}
              expandable={
                groupBy !== "none"
                  ? {
                      expandedRowRender: (record) => (
                        <Table
                          size="small"
                          dataSource={record.sessions}
                          rowKey="id"
                          pagination={false}
                          scroll={{ x: "max-content" }}
                          columns={[
                            {
                              title: t("sessionTime.date"),
                              dataIndex: "date",
                              render: (date) => (
                                <Text style={{ fontSize: "14px" }}>
                                  {new Date(date).toLocaleDateString()}
                                </Text>
                              ),
                              width: 100,
                            },
                            {
                              title: t("sessionTime.totalTime"),
                              dataIndex: "total_session_time",
                              render: (time) => (
                                <Text style={{ fontSize: "11px" }}>
                                  {sessionTimeService.formatSessionTime(time)}
                                </Text>
                              ),
                              width: 100,
                            },
                            {
                              title: t("sessionTime.sessions"),
                              dataIndex: "session_count",
                              render: (count) => (
                                <Tag color="blue" size="small">
                                  {count}
                                </Tag>
                              ),
                              width: 80,
                            },

                            {
                              title: t("sessionTime.firstLogin"),
                              dataIndex: "first_login",
                              render: (time) => (
                                <Text style={{ fontSize: "11px" }}>
                                  {sessionTimeService.formatTime(time)}
                                </Text>
                              ),
                              width: 120,
                            },
                            {
                              title: t("sessionTime.lastLogout"),
                              dataIndex: "last_logout",
                              render: (time) => (
                                <Text style={{ fontSize: "11px" }}>
                                  {sessionTimeService.formatTime(time)}
                                </Text>
                              ),
                              width: 120,
                            },
                          ]}
                        />
                      ),
                      rowExpandable: (record) =>
                        record.sessions && record.sessions.length > 0,
                    }
                  : undefined
              }
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default SessionTimeTracking;
