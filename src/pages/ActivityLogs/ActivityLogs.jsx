import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  DatePicker,
  Select,
  Button,
  Row,
  Col,
  Tooltip,
  message,
  Spin,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  HistoryOutlined,
  LoginOutlined,
  LogoutOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  UserAddOutlined,
  FileExcelOutlined,
  EyeOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { authService } from "../../services/authService";
import "./ActivityLogs.css";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const ActivityLogs = () => {
  const [activities, setActivities] = useState([]);
  const [activityStats, setActivityStats] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [activityType, setActivityType] = useState(null);
  const [userId, setUserId] = useState(null);
  const [groupBy, setGroupBy] = useState('none'); // 'none', 'day', 'month', 'year'
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const { t } = useTranslation();

  const activityTypes = [
    {
      value: "login",
      label: t("activities.login"),
      icon: <LoginOutlined />,
      color: "green",
    },
    {
      value: "logout",
      label: t("activities.logout"),
      icon: <LogoutOutlined />,
      color: "blue",
    },
    {
      value: "order_create",
      label: t("activities.orderCreate"),
      icon: <ShoppingCartOutlined />,
      color: "cyan",
    },
    {
      value: "order_update",
      label: t("activities.orderUpdate"),
      icon: <ShoppingCartOutlined />,
      color: "orange",
    },
    {
      value: "order_delete",
      label: t("activities.orderDelete"),
      icon: <ShoppingCartOutlined />,
      color: "red",
    },
    {
      value: "order_assign",
      label: t("activities.orderAssign"),
      icon: <UserAddOutlined />,
      color: "purple",
    },
    {
      value: "order_import",
      label: t("activities.orderImport"),
      icon: <UploadOutlined />,
      color: "geekblue",
    },
    {
      value: "user_update",
      label: t("activities.userUpdate"),
      icon: <UserOutlined />,
      color: "purple",
    },
    {
      value: "export",
      label: t("activities.export"),
      icon: <FileExcelOutlined />,
      color: "gold",
    },
    {
      value: "view_page",
      label: t("activities.viewPage"),
      icon: <EyeOutlined />,
      color: "default",
    },
    {
      value: "search",
      label: t("activities.search"),
      icon: <SearchOutlined />,
      color: "lime",
    },
    {
      value: "filter",
      label: t("activities.filter"),
      icon: <FilterOutlined />,
      color: "magenta",
    },
  ];

  useEffect(() => {
    fetchActivities();
    fetchActivityStats();
    fetchUsers();
  }, [dateRange, activityType, userId, pagination.current, pagination.pageSize]);

  const fetchUsers = async () => {
    try {
      console.log('🔍 Fetching users for ActivityLogs dropdown...');
      const usersData = await authService.getUsers();
      console.log('👥 Users data received in ActivityLogs:', usersData);
      
      const usersArray = Array.isArray(usersData) ? usersData : [];
      console.log('👥 Users array set in ActivityLogs:', usersArray);
      console.log('👥 Users array length:', usersArray.length);
      setUsers(usersArray);
    } catch (error) {
      console.error("❌ Fetch users error in ActivityLogs:", error);
      setUsers([]); // Set empty array on error
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
      };

      if (dateRange) {
        params.start_date = dateRange[0].format("YYYY-MM-DD");
        params.end_date = dateRange[1].format("YYYY-MM-DD");
      }

      if (activityType) {
        params.activity_type = activityType;
      }

      if (userId) {
        params.user_id = userId;
      }

      console.log('Activities API params:', params); // Debug log

      const response = await authService.getActivities(params);
      
      console.log('Activities API response:', response); // Debug log
      
      const activitiesData = response.activities || [];
      setActivities(activitiesData);
      
      // Update pagination total if backend provides it
      if (response.total !== undefined) {
        setPagination(prev => ({
          ...prev,
          total: response.total
        }));
      } else {
        // If no total provided, estimate based on current data
        setPagination(prev => ({
          ...prev,
          total: activitiesData.length < pagination.pageSize ? 
            ((pagination.current - 1) * pagination.pageSize) + activitiesData.length :
            prev.total
        }));
      }
    } catch (error) {
      message.error(t("activities.fetchError"));
      console.error("Fetch activities error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityStats = async () => {
    try {
      const params = {};
      if (dateRange) {
        params.start_date = dateRange[0].format("YYYY-MM-DD");
        params.end_date = dateRange[1].format("YYYY-MM-DD");
      }

      const response = await authService.getActivityStats(params);
      setActivityStats(response.stats || []);
    } catch (error) {
      console.error("Fetch activity stats error:", error);
    }
  };

  const getActivityTypeInfo = (type) => {
    return (
      activityTypes.find((at) => at.value === type) || {
        label: type,
        icon: <HistoryOutlined />,
        color: "default",
      }
    );
  };

  const formatMetadata = (metadata) => {
    if (!metadata) return null;

    try {
      const parsed =
        typeof metadata === "string" ? JSON.parse(metadata) : metadata;
      return (
        <Tooltip title={JSON.stringify(parsed, null, 2)}>
          <Text type="secondary" style={{ cursor: "pointer" }}>
            {t("activities.viewDetails")}
          </Text>
        </Tooltip>
      );
    } catch (error) {
      return null;
    }
  };

  // Group activities by date period
  const groupActivitiesByDate = (activities, groupBy) => {
    if (groupBy === 'none') return activities;

    const grouped = activities.reduce((acc, activity) => {
      const date = new Date(activity.created_at);
      let key;
      
      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
          break;
        case 'year':
          key = date.getFullYear().toString(); // YYYY
          break;
        default:
          key = 'all';
      }

      if (!acc[key]) {
        acc[key] = {
          key,
          date: key,
          activities: [],
          count: 0
        };
      }
      
      acc[key].activities.push(activity);
      acc[key].count++;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  };

  const formatGroupDate = (dateStr, groupBy) => {
    switch (groupBy) {
      case 'day':
        return new Date(dateStr).toLocaleDateString();
      case 'month':
        const [year, month] = dateStr.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      case 'year':
        return dateStr;
      default:
        return dateStr;
    }
  };

  const columns = groupBy !== 'none' ? [
    {
      title: t("activities.date"),
      dataIndex: "date",
      key: "date",
      render: (date) => (
        <Text strong>{formatGroupDate(date, groupBy)}</Text>
      ),
      width: 180,
    },
    {
      title: t("activities.count"),
      dataIndex: "count",
      key: "count",
      render: (count) => (
        <Tag color="blue">{count} {t("activities.activities")}</Tag>
      ),
      width: 120,
    },
    {
      title: t("activities.details"),
      key: "details",
      render: (_, record) => (
        <Space wrap>
          {record.activities.slice(0, 3).map((activity, index) => {
            const typeInfo = getActivityTypeInfo(activity.activity_type);
            return (
              <Tag 
                key={index} 
                icon={typeInfo.icon} 
                color={typeInfo.color}
                size="small"
              >
                {typeInfo.label}
              </Tag>
            );
          })}
          {record.activities.length > 3 && (
            <Tag size="small">+{record.activities.length - 3} more</Tag>
          )}
        </Space>
      ),
    },
  ] : [
    {
      title: t("activities.time"),
      dataIndex: "created_at",
      key: "created_at",
      render: (time) => new Date(time).toLocaleString(),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      width: 180,
    },
    {
      title: t("activities.type"),
      dataIndex: "activity_type",
      key: "activity_type",
      render: (type) => {
        const typeInfo = getActivityTypeInfo(type);
        return (
          <Tag icon={typeInfo.icon} color={typeInfo.color}>
            {typeInfo.label}
          </Tag>
        );
      },
      filters: activityTypes.map((at) => ({ text: at.label, value: at.value })),
      onFilter: (value, record) => record.activity_type === value,
      width: 190,
    },
    {
      title: t("activities.user"),
      key: "user",
      render: (_, record) => {
        if (record.username || record.first_name || record.last_name) {
          const displayName = record.first_name && record.last_name 
            ? `${record.first_name} ${record.last_name}` 
            : record.username;
          return (
            <Space>
              <UserOutlined />
              <Text>{displayName}</Text>
            </Space>
          );
        }
        return null;
      },
      width: 190,
    },
    {
      title: t("activities.description"),
      dataIndex: "activity_description",
      key: "activity_description",
      ellipsis: {
        showTitle: false,
      },
      render: (description) => (
        <Tooltip title={description}>{description}</Tooltip>
      ),
    },
    {
      title: t("activities.entity"),
      key: "entity",
      render: (_, record) => {
        if (record.entity_type && record.entity_id) {
          return (
            <Space>
              <Text type="secondary">{record.entity_type}</Text>
              <Text code>#{record.entity_id}</Text>
            </Space>
          );
        }
        return null;
      },
      width: 120,
    },
    {
      title: t("activities.details"),
      dataIndex: "metadata",
      key: "metadata",
      render: formatMetadata,
      width: 100,
    },
    {
      title: t("activities.session"),
      dataIndex: "session_start",
      key: "session_start",
      render: (sessionStart) =>
        sessionStart ? new Date(sessionStart).toLocaleString() : null,
      width: 180,
    },
  ];

  // Group activity stats by type for display
  const groupedStats = activityStats.reduce((acc, stat) => {
    if (!acc[stat.activity_type]) {
      acc[stat.activity_type] = 0;
    }
    acc[stat.activity_type] += stat.count;
    return acc;
  }, {});

  // Prepare data for table based on grouping
  const tableData = groupActivitiesByDate(activities, groupBy);

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleFiltersChange = () => {
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  return (
    <div className="activity-logs-container">
      {/* Activity Type Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {activityTypes.slice(0, 6).map((type) => (
          <Col xs={12} sm={8} md={4} key={type.value}>
            <Card size="small">
              <div className="activity-stat">
                <div
                  className="activity-stat-icon"
                  style={{ color: getActivityTypeColor(type.color) }}
                >
                  {type.icon}
                </div>
                <div className="activity-stat-content">
                  <Text strong>{groupedStats[type.value] || 0}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {type.label}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <div>
              <Text strong>{t("activities.dateRange")}</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  setDateRange(dates);
                  handleFiltersChange();
                }}
                style={{ width: "100%", marginTop: 8 }}
                placeholder={[
                  t("activities.startDate"),
                  t("activities.endDate"),
                ]}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <div>
              <Text strong>{t("activities.activityType")}</Text>
              <Select
                value={activityType}
                onChange={(value) => {
                  setActivityType(value);
                  handleFiltersChange();
                }}
                style={{ width: "100%", marginTop: 8 }}
                placeholder={t("activities.allTypes")}
                allowClear
              >
                {activityTypes.map((type) => (
                  <Option key={type.value} value={type.value}>
                    <Space>
                      {type.icon}
                      {type.label}
                    </Space>
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <div>
              <Text strong>{t("activities.user")}</Text>
              <Select
                value={userId}
                onChange={(value) => {
                  setUserId(value);
                  handleFiltersChange();
                }}
                style={{ width: "100%", marginTop: 8 }}
                placeholder={t("activities.allUsers")}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
                onDropdownVisibleChange={(open) => {
                  if (open) {
                    console.log('👥 ActivityLogs user dropdown opened');
                    console.log('👥 Users state in ActivityLogs:', users);
                    console.log('👥 Users length in ActivityLogs:', users?.length);
                    console.log('👥 Is users array?', Array.isArray(users));
                  }
                }}
              >
                {Array.isArray(users) && users.map((user) => {
                  console.log('👤 Rendering user option in ActivityLogs:', user);
                  return (
                    <Option key={user.id} value={user.id}>
                      {user.first_name && user.last_name 
                        ? `${user.first_name} ${user.last_name}` 
                        : user.username}
                    </Option>
                  );
                })}
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <div>
              <Text strong>{t("activities.groupBy")}</Text>
              <Select
                value={groupBy}
                onChange={(value) => {
                  setGroupBy(value);
                  handleFiltersChange();
                }}
                style={{ width: "100%", marginTop: 8 }}
                placeholder={t("activities.noGrouping")}
              >
                <Option value="none">{t("activities.noGrouping")}</Option>
                <Option value="day">{t("activities.byDay")}</Option>
                <Option value="month">{t("activities.byMonth")}</Option>
                <Option value="year">{t("activities.byYear")}</Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchActivities();
                fetchActivityStats();
              }}
              style={{ marginTop: 24 }}
            >
              {t("common.refresh")}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Activities Table */}
      <Card title={t("activities.activityHistory")}>
        <Table
          columns={columns}
          dataSource={tableData}
          rowKey={groupBy !== 'none' ? 'key' : 'id'}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} ${t("common.of")} ${total} ${t(
                "common.items"
              )}`,
          }}
          onChange={handleTableChange}
          expandable={groupBy !== 'none' ? {
            expandedRowRender: (record) => (
              <Table
                size="small"
                dataSource={record.activities}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: t("activities.time"),
                    dataIndex: "created_at",
                    render: (time) => new Date(time).toLocaleString(),
                    width: 180,
                  },
                  {
                    title: t("activities.type"),
                    dataIndex: "activity_type",
                    render: (type) => {
                      const typeInfo = getActivityTypeInfo(type);
                      return (
                        <Tag icon={typeInfo.icon} color={typeInfo.color} size="small">
                          {typeInfo.label}
                        </Tag>
                      );
                    },
                    width: 150,
                  },
                  {
                    title: t("activities.description"),
                    dataIndex: "activity_description",
                    ellipsis: true,
                  },
                  {
                    title: t("activities.entity"),
                    render: (_, record) => {
                      if (record.entity_type && record.entity_id) {
                        return (
                          <Space>
                            <Text type="secondary">{record.entity_type}</Text>
                            <Text code>#{record.entity_id}</Text>
                          </Space>
                        );
                      }
                      return null;
                    },
                    width: 120,
                  },
                ]}
              />
            ),
            rowExpandable: (record) => record.activities && record.activities.length > 0,
          } : undefined}
        />
      </Card>
    </div>
  );
};

// Helper function to get color for activity type
const getActivityTypeColor = (colorName) => {
  const colorMap = {
    green: "#52c41a",
    blue: "#1890ff",
    cyan: "#13c2c2",
    orange: "#fa8c16",
    red: "#f5222d",
    purple: "#722ed1",
    gold: "#faad14",
    lime: "#a0d911",
    magenta: "#eb2f96",
    default: "#d9d9d9",
  };
  return colorMap[colorName] || colorMap.default;
};

export default ActivityLogs;
