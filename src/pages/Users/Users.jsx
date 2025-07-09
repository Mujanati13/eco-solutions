import React, { useState, useEffect } from 'react'
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
  Checkbox,
  Divider,
  Collapse,
  Switch,
  Tooltip,
  Alert,
} from 'antd'
import { useTranslation } from 'react-i18next'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  SafetyOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  ShopOutlined,
  BarChartOutlined,
  CloudOutlined,
} from '@ant-design/icons'
import { userService } from '../../services/userService'
import { useAuth } from '../../contexts/AuthContext'
import './Users.css'

const { Title } = Typography
const { Option } = Select
const { Panel } = Collapse

const Users = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [availableRoles, setAvailableRoles] = useState([])
  const [availablePermissions, setAvailablePermissions] = useState({})
  
  const { user: currentUser } = useAuth()
  const { t } = useTranslation()
  const [form] = Form.useForm()

  // Default permissions for each role - will be populated dynamically
  const getRoleDefaultPermissions = () => {
    if (!availablePermissions || Object.keys(availablePermissions).length === 0) {
      return { admin: [], supervisor: [], employee: [], custom: [] }
    }
    
    return {
      admin: Object.values(availablePermissions).flatMap(group => 
        group.permissions.map(p => p.key)
      ),
      supervisor: [
        'canViewAllOrders', 'canAssignOrders', 'canEditOrders', 'canDistributeOrders',
        'canImportOrders', 'canExportOrders', 'canViewUsers', 'canViewReports',
        'canExportReports', 'canViewPerformance',
        'canViewProducts', 'canCreateProducts', 'canEditProducts',
        'canViewStock', 'canManageStock', 'canTransferStock', 'canViewStockReports',
        'canViewPurchaseOrders', 'canCreatePurchaseOrders',
        'canImportFromGoogleSheets', 'canExportToGoogleSheets', 'canViewIntegrations'
      ],
      employee: [
        'canEditOrders', 'canExportOrders', 'canViewReports',
        'canViewProducts', 'canViewStock', 'canViewStockReports',
        'canViewIntegrations'
      ],
      custom: []
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchRolesAndPermissions()
  }, [pagination.current, pagination.pageSize, searchText, roleFilter])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchText,
        role: roleFilter,
      }
      
      const response = await userService.getAllUsers(params)
      // Fix: The API returns users directly, not nested in response.data
      setUsers(response.users || [])
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
      }))
    } catch (error) {
      message.error(t('common.failedToFetch'))
    } finally {
      setLoading(false)
    }
  }

  // Fetch roles and permissions from backend
  const fetchRolesAndPermissions = async () => {
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        userService.getRoles(),
        userService.getPermissions()
      ])
      
      // Format roles with colors
      const formattedRoles = rolesResponse.data.map(role => ({
        value: role.name,
        label: t(`auth.${role.name}`),
        color: role.name === 'admin' ? 'red' : 
               role.name === 'supervisor' ? 'orange' : 
               role.name === 'employee' ? 'blue' : 'purple'
      }))
      
      setAvailableRoles(formattedRoles)
      
      // Format permissions by category with icons
      const formattedPermissions = {}
      Object.entries(permissionsResponse.data).forEach(([category, permissions]) => {
        formattedPermissions[category] = {
          label: t(`users.permissions.${category}`),
          icon: category === 'orders' ? <UserOutlined /> :
                category === 'users' ? <SafetyOutlined /> :
                category === 'stock' ? <ShopOutlined /> :
                category === 'reports' ? <BarChartOutlined /> :
                category === 'integrations' ? <CloudOutlined /> :
                <SettingOutlined />,
          permissions: permissions.map(perm => ({
            key: perm.key,
            label: perm.label
          }))
        }
      })
      
      setAvailablePermissions(formattedPermissions)
    } catch (error) {
      console.error('Failed to fetch roles and permissions:', error)
      // Fallback to hardcoded values
      setAvailableRoles([
        { value: 'admin', label: t('auth.admin'), color: 'red' },
        { value: 'supervisor', label: t('auth.supervisor'), color: 'orange' },
        { value: 'employee', label: t('auth.employee'), color: 'blue' },
        { value: 'custom', label: t('users.customRole'), color: 'purple' },
      ])
      
      // Fallback permissions
      setAvailablePermissions({
        orders: {
          label: t('users.permissions.orders'),
          icon: <UserOutlined />,
          permissions: [
            { key: 'canViewAllOrders', label: t('users.permissions.canViewAllOrders') },
            { key: 'canAssignOrders', label: t('users.permissions.canAssignOrders') },
            { key: 'canEditOrders', label: t('users.permissions.canEditOrders') },
            { key: 'canDeleteOrders', label: t('users.permissions.canDeleteOrders') },
            { key: 'canDistributeOrders', label: t('users.permissions.canDistributeOrders') },
            { key: 'canImportOrders', label: t('users.permissions.canImportOrders') },
            { key: 'canExportOrders', label: t('users.permissions.canExportOrders') },
          ]
        },
        users: {
          label: t('users.permissions.users'),
          icon: <SafetyOutlined />,
          permissions: [
            { key: 'canViewUsers', label: t('users.permissions.canViewUsers') },
            { key: 'canCreateUsers', label: t('users.permissions.canCreateUsers') },
            { key: 'canEditUsers', label: t('users.permissions.canEditUsers') },
            { key: 'canDeleteUsers', label: t('users.permissions.canDeleteUsers') },
            { key: 'canManageRoles', label: t('users.permissions.canManageRoles') },
          ]
        },
        stock: {
          label: t('users.permissions.stock'),
          icon: <ShopOutlined />,
          permissions: [
            { key: 'canViewProducts', label: t('users.permissions.canViewProducts') },
            { key: 'canCreateProducts', label: t('users.permissions.canCreateProducts') },
            { key: 'canEditProducts', label: t('users.permissions.canEditProducts') },
            { key: 'canDeleteProducts', label: t('users.permissions.canDeleteProducts') },
            { key: 'canViewStock', label: t('users.permissions.canViewStock') },
            { key: 'canManageStock', label: t('users.permissions.canManageStock') },
            { key: 'canTransferStock', label: t('users.permissions.canTransferStock') },
            { key: 'canViewStockReports', label: t('users.permissions.canViewStockReports') },
            { key: 'canViewPurchaseOrders', label: t('users.permissions.canViewPurchaseOrders') },
            { key: 'canCreatePurchaseOrders', label: t('users.permissions.canCreatePurchaseOrders') },
            { key: 'canApprovePurchaseOrders', label: t('users.permissions.canApprovePurchaseOrders') },
            { key: 'canReceiveStock', label: t('users.permissions.canReceiveStock') },
          ]
        },
        reports: {
          label: t('users.permissions.reports'),
          icon: <BarChartOutlined />,
          permissions: [
            { key: 'canViewReports', label: t('users.permissions.canViewReports') },
            { key: 'canExportReports', label: t('users.permissions.canExportReports') },
            { key: 'canViewPerformance', label: t('users.permissions.canViewPerformance') },
            { key: 'canManageSettings', label: t('users.permissions.canManageSettings') },
          ]
        },
        integrations: {
          label: t('users.permissions.integrations'),
          icon: <CloudOutlined />,
          permissions: [
            { key: 'canImportFromGoogleSheets', label: t('users.permissions.canImportFromGoogleSheets') },
            { key: 'canExportToGoogleSheets', label: t('users.permissions.canExportToGoogleSheets') },
            { key: 'canManageGoogleSheets', label: t('users.permissions.canManageGoogleSheets') },
            { key: 'canViewIntegrations', label: t('users.permissions.canViewIntegrations') },
          ]
        }
      })
    }
  }

  const handleTableChange = (newPagination) => {
    setPagination(newPagination)
  }

  const handleSearch = (value) => {
    setSearchText(value)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleRoleFilter = (value) => {
    setRoleFilter(value)
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleAddUser = () => {
    setEditingUser(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEditUser = (user) => {
    setEditingUser(user)
    
    // Transform user data for form - handle both legacy single role and new multi-role format
    const formData = {
      ...user,
      roles: user.roles && Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : ['employee']),
      permissions: user.permissions || [],
      // Convert is_active to boolean in case it comes as 1/0 from database
      is_active: Boolean(user.is_active),
    }
    
    form.setFieldsValue(formData)
    setModalVisible(true)
  }

  const handleDeleteUser = async (userId) => {
    try {
      // Protect main admin account from deletion
      const userToDelete = users.find(u => u.id === userId)
      if (userToDelete && (userToDelete.id === 1 || userToDelete.username === 'admin')) {
        message.error(t('users.adminProtected'))
        return
      }
      
      await userService.deleteUser(userId)
      message.success(t('users.deleteSuccess'))
      fetchUsers()
    } catch (error) {
      const errorMessage = error.response?.data?.error || t('common.failedToDelete')
      message.error(errorMessage)
    }
  }

  const handleModalSubmit = async (values) => {
    try {
      // Transform form values to match backend expectations
      const userData = {
        username: values.username,
        email: values.email,
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
        is_active: values.is_active,
      }

      // Handle roles and permissions - now with full backend support
      if (values.roles && values.roles.length > 0) {
        userData.roles = values.roles
        userData.permissions = values.permissions || []
        
        // Protect admin account from role changes
        if (editingUser && (editingUser.id === 1 || editingUser.username === 'admin')) {
          userData.roles = ['admin'] // Force admin role for main admin account
          message.warning(t('users.adminProtected'))
        }
      } else {
        userData.roles = ['employee'] // default role
        userData.permissions = []
      }

      // Only include password for new users
      if (!editingUser && values.password) {
        userData.password = values.password
      }

      if (editingUser) {
        await userService.updateUser(editingUser.id, userData)
        message.success(t('users.updateSuccess'))
      } else {
        await userService.createUser(userData)
        message.success(t('users.createSuccess'))
      }
      setModalVisible(false)
      fetchUsers()
    } catch (error) {
      const errorMessage = error.response?.data?.error || t('common.failedToSave')
      message.error(errorMessage)
    }
  }

  const getRoleColor = (role) => {
    const colors = {
      admin: 'red',
      supervisor: 'orange',
      employee: 'blue',
      custom: 'purple',
    }
    return colors[role] || 'default'
  }

  const getRoleColors = (roles) => {
    if (!roles || !Array.isArray(roles)) return ['default']
    return roles.map(role => getRoleColor(role))
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'green',
      inactive: 'red',
    }
    return colors[status] || 'default'
  }

  const columns = [
    {
      title: t('users.userName'),
      dataIndex: 'username',
      key: 'username',
      width: 150,
      ellipsis: true,
    },
    {
      title: t('users.userEmail'),
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: t('users.userPhone'),
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: t('users.userRole'),
      dataIndex: 'role',
      key: 'role',
      width: 150,
      render: (role, record) => {
        // Check if user has new roles array format
        if (record.roles && Array.isArray(record.roles) && record.roles.length > 0) {
          return (
            <Space wrap className="roles-tags-container">
              {record.roles.map((roleItem, index) => (
                <Tag key={index} color={getRoleColor(roleItem)} className="role-tag-multiple">
                  {t(`auth.${roleItem}`)}
                </Tag>
              ))}
            </Space>
          )
        }
        
        // Fallback for legacy single role format (current API format)
        const displayRole = role || 'employee'
        return (
          <Tag color={getRoleColor(displayRole)}>
            {t(`auth.${displayRole}`)}
          </Tag>
        )
      },
    },
    {
      title: t('users.userStatus'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (is_active) => (
        <Tag color={is_active ? 'green' : 'red'}>
          {t(`users.${is_active ? 'active' : 'inactive'}`)}
        </Tag>
      ),
    },
    {
      title: t('orders.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: t('orders.actions'),
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditUser(record)}
          />
          
          {currentUser?.id !== record.id && (
            <Popconfirm
              title={t('users.deleteConfirm')}
              onConfirm={() => handleDeleteUser(record.id)}
              okText={t('common.yes')}
              cancelText={t('common.no')}
            >
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // Check if user is admin
  if (currentUser?.role !== 'admin') {
    return (
      <div className="access-denied">
        <Title level={3}>{t('common.error')}: {t('users.accessDenied') || 'Access Denied'}</Title>
        <p>{t('users.noPermission') || "You don't have permission to access this page."}</p>
      </div>
    )
  }

  return (
    <div className="users-container">      
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle" className="users-header-row">
          <Col xs={24} sm={12} md={8} lg={8}>
            <Input.Search
              placeholder={t('common.search')}
              allowClear
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={6}>
            <Select
              placeholder={t('users.userRole')}
              allowClear
              style={{ width: '100%' }}
              onChange={handleRoleFilter}
            >
              <Option value="admin">{t('auth.admin')}</Option>
              <Option value="supervisor">{t('auth.supervisor')}</Option>
              <Option value="employee">{t('auth.employee')}</Option>
              <Option value="custom">{t('users.customRole')}</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={10} lg={10}>
            <div className="users-button-group">
              <Space wrap size="small" className="responsive-button-group">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAddUser}
                  size="small"
                >
                  <span className="hidden-xs">{t('users.addUser')}</span>
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchUsers}
                  size="small"
                >
                  <span className="hidden-xs">{t('common.reload')}</span>
                </Button>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 800 }}
      />

      <Modal
        title={editingUser ? t('users.editUser') : t('users.addUser')}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        style={{ overflowY: 'hidden' }}
        // className="users-form-modal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleModalSubmit}
          onValuesChange={(changedFields, allFields) => {
            // Auto-assign permissions when roles change
            if (changedFields.roles) {
              const selectedRoles = changedFields.roles || []
              const autoPermissions = new Set()
              const rolePermissions = getRoleDefaultPermissions()
              
              selectedRoles.forEach(role => {
                const defaultPerms = rolePermissions[role] || []
                defaultPerms.forEach(perm => autoPermissions.add(perm))
              })
              
              form.setFieldsValue({
                permissions: Array.from(autoPermissions)
              })
            }
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="username"
                label={t('users.userName')}
                rules={[{ required: true, message: t('validations.required') }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="email"
                label={t('users.userEmail')}
                rules={[
                  { required: true, message: t('validations.required') },
                  { type: 'email', message: t('validations.emailInvalid') }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="first_name"
                label={t('users.firstName')}
                rules={[{ required: true, message: t('validations.required') }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="last_name"
                label={t('users.lastName')}
                rules={[{ required: true, message: t('validations.required') }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label={t('users.userPhone')}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="is_active"
                label={t('users.userStatus')}
                rules={[{ required: true, message: t('validations.required') }]}
              >
                <Select>
                  <Option value={true}>{t('users.active')}</Option>
                  <Option value={false}>{t('users.inactive')}</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {!editingUser && (
            <Form.Item
              name="password"
              label={t('common.password')}
              rules={[
                { required: true, message: t('validations.required') },
                { min: 6, message: t('validations.passwordMin') }
              ]}
            >
              <Input.Password />
            </Form.Item>
          )}

          <Divider>{t('users.rolesAndPermissions')}</Divider>

          <Form.Item
            name="roles"
            label={
              <Space>
                <SafetyOutlined />
                {t('users.assignedRoles')}
                <Tooltip title={t('users.rolesHelp')}>
                  <InfoCircleOutlined className="users-help-tooltip" />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: t('validations.required') }]}
          >
            <Select
              mode="multiple"
              placeholder={t('users.selectRoles')}
              allowClear
              className="users-role-select"
            >
              {availableRoles.map(role => (
                <Option key={role.value} value={role.value}>
                  <Tag color={role.color}>{role.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="permissions"
            label={
              <Space>
                <SettingOutlined />
                {t('users.granularPermissions')}
                <Tooltip title={t('users.permissionsHelp')}>
                  <InfoCircleOutlined className="users-help-tooltip" />
                </Tooltip>
              </Space>
            }
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Collapse ghost className="users-permissions-collapse">
                {Object.entries(availablePermissions).map(([groupKey, group]) => (
                  <Panel
                    header={
                      <Space className="users-form-section-header">
                        {group.icon}
                        <strong>{group.label}</strong>
                      </Space>
                    }
                    key={groupKey}
                  >
                    <Row gutter={[8, 8]}>
                      {group.permissions.map(permission => (
                        <Col xs={24} sm={12} md={8} key={permission.key}>
                          <div className="users-permission-checkbox">
                            <Checkbox value={permission.key}>
                              {permission.label}
                            </Checkbox>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </Panel>
                ))}
              </Collapse>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {t('common.save')}
              </Button>
              <Button onClick={() => setModalVisible(false)}>
                {t('common.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Users
