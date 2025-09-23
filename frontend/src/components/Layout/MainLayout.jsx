import React from 'react'
import { Layout, Menu, Dropdown, Button, Space } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  GlobalOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  ShopOutlined,
  CloudOutlined,
  TruckOutlined,
} from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import './MainLayout.css'

const { Header, Sider, Content } = Layout

const MainLayout = () => {
  const [collapsed, setCollapsed] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)
  const { user, logout } = useAuth()
  const { 
    hasPermission, 
    isAdmin, 
    isSupervisor,
    loading: permissionsLoading 
  } = usePermissions()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // Handle responsive design
  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768)
      if (window.innerWidth <= 768) {
        setCollapsed(true)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Define menu items based on user permissions
  const getMenuItems = () => {
    if (permissionsLoading) return []
    
    const baseItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: t('navigation.dashboard'),
      },
    ]

    // Orders submenu - build dynamically based on permissions
    const orderSubmenuItems = []
    
    // Order management - only if user can view or edit orders
    if (hasPermission('canViewAllOrders') || hasPermission('canEditOrders') || hasPermission('canAssignOrders')) {
      orderSubmenuItems.push({
        key: '/order-management',
        label: t('nav.orderManagement'),
      })
      // Old interface (Ant Design) as v2
      orderSubmenuItems.push({
        key: '/order-management-v2',
        label: "GC V2",
      })
    }
    
    // Order tracking is available to all authenticated users
    orderSubmenuItems.push({
      key: '/order-tracking',
      label: t('nav.orderTracking'),
    })

    // Delivery Pricing Management - moved under orders menu
    if (hasPermission('canManageDelivery') || hasPermission('canViewUsers')) {
      orderSubmenuItems.push({
        key: '/delivery-pricing',
        label: t('navigation.deliveryPricing'),
      })
    }

    // Only show orders menu if there are items in it
    if (orderSubmenuItems.length > 0) {
      baseItems.push({
        key: 'orders-submenu',
        icon: <ShoppingCartOutlined />,
        label: t('navigation.orders'),
        children: orderSubmenuItems,
      })
    }

    const additionalItems = []

    // Stock management submenu - build dynamically based on permissions
    const stockSubmenuItems = []
    
    // Products - only if user can view products
    if (hasPermission('canViewProducts')) {
      stockSubmenuItems.push({
        key: '/stock/products',
        label: t('navigation.products'),
      })
    }
    
    // Categories - only if user can view products
    if (hasPermission('canViewProducts')) {
      stockSubmenuItems.push({
        key: '/stock/categories',
        label: t('navigation.categories'),
      })
    }
    
    // Stock locations - only if user can view stock
    if (hasPermission('canViewStock')) {
      stockSubmenuItems.push({
        key: '/stock/locations',
        label: t('navigation.stockLocations'),
      })
    }

    // Only show stock menu if there are items in it
    if (stockSubmenuItems.length > 0) {
      additionalItems.push({
        key: 'stock-submenu',
        icon: <ShopOutlined />,
        label: t('navigation.stock'),
        children: stockSubmenuItems,
      })
    }

    // Reports and analytics - ONLY show if user has the specific report permissions
    if (hasPermission('canViewReports')) {
      additionalItems.push({
        key: '/reports',
        icon: <BarChartOutlined />,
        label: t('navigation.reports'),
      })
    }

    // Session tracking - ONLY show if user has performance permission
    if (hasPermission('canViewPerformance')) {
      additionalItems.push({
        key: '/sessions',
        icon: <ClockCircleOutlined />,
        label: t('navigation.sessions'),
      })
    }

    // Activity logs - ONLY show if user can view users
    if (hasPermission('canViewUsers')) {
      additionalItems.push({
        key: '/activities',
        icon: <HistoryOutlined />,
        label: t('navigation.activities'),
      })
    }

    // Integrations submenu - build dynamically based on permissions
    const integrationsSubmenuItems = []
    
    // Google Sheets - only if user can view integrations
    if (hasPermission('canViewIntegrations')) {
      integrationsSubmenuItems.push({
        key: '/integrations/google-sheets',
        label: t('navigation.googleSheets'),
      })
    }

    // Ecotrack
    if (hasPermission('canViewIntegrations')) {
      integrationsSubmenuItems.push({
        key: '/integrations/ecotrack',
        label: t('navigation.ecotrack'),
      })
    }

    // Only show integrations menu if there are items in it
    if (integrationsSubmenuItems.length > 0) {
      additionalItems.push({
        key: 'integrations-submenu',
        icon: <CloudOutlined />,
        label: t('navigation.integrations'),
        children: integrationsSubmenuItems,
      })
    }

    // User management - ONLY show if user can view users
    if (hasPermission('canViewUsers')) {
      additionalItems.push({
        key: '/users',
        icon: <UserOutlined />,
        label: t('navigation.users'),
      })
    }

    return [...baseItems, ...additionalItems]
  }

  const menuItems = getMenuItems()

  const handleMenuClick = (e) => {
    navigate(e.key)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
    // Update document direction for RTL support
    document.dir = lng === 'ar' ? 'rtl' : 'ltr'
    // Reload to apply Ant Design locale changes
    window.location.reload()
  }

  const languageMenu = {
    items: [
      {
        key: 'en',
        label: 'English',
        onClick: () => changeLanguage('en'),
      },
      {
        key: 'fr',
        label: 'Français',
        onClick: () => changeLanguage('fr'),
      },
      {
        key: 'ar',
        label: 'العربية',
        onClick: () => changeLanguage('ar'),
      },
    ],
  }

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: t('navigation.profile'),
        onClick: () => navigate('/profile'),
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: t('navigation.settings'),
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('common.logout'),
        onClick: handleLogout,
      },
    ],
  }

  return (
    <Layout className="main-layout" style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 80}
        width={230}
        onBreakpoint={(broken) => {
          setCollapsed(broken)
        }}
        style={{
          background: '#fff',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: isMobile ? 1000 : 100,
          height: '100vh',
          overflow: 'auto',
          transition: 'all 0.2s',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{
          height: 64,
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 10,
        }}>
          <h2 style={{ 
            color: '#1890ff', 
            margin: 0,
            fontSize: collapsed ? '16px' : '20px',
            transition: 'all 0.2s'
          }}>
            {collapsed ? 'SPC' : 'Store Produit C'}
          </h2>
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        
          style={{ 
            marginTop: 0,
            border: 'none',
            height: 'calc(100vh - 64px)',
            overflow: 'auto',
          }}
        />
      </Sider>
      
      <Layout style={{ 
        marginLeft: collapsed ? (isMobile ? 0 : 80) : (isMobile ? 0 : 200),
        transition: 'margin-left 0.2s'
      }}>
        <Header style={{
          padding: isMobile ? '0 16px' : '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          position: 'fixed',
          top: 0,
          right: 0,
          left: collapsed ? (isMobile ? 0 : 80) : (isMobile ? 0 : 200),
          zIndex: 50,
          transition: 'left 0.2s',
          height: 64,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: isMobile ? 48 : 64,
              height: isMobile ? 48 : 64,
            }}
          />
          
          <Space size={isMobile ? "small" : "middle"}>
            <Dropdown menu={languageMenu} placement="bottomRight">
              <Button icon={<GlobalOutlined />} type="text" size={isMobile ? "small" : "middle"}>
                <span style={{ display: isMobile ? 'none' : 'inline' }}>
                  {i18n.language.toUpperCase()}
                </span>
              </Button>
            </Dropdown>
            
            <Dropdown menu={userMenu} placement="bottomRight">
              <Button type="text" size={isMobile ? "small" : "middle"}>
                <Space size="small">
                  <UserOutlined />
                  <span style={{ display: isMobile ? 'none' : 'inline' }}>
                    {user?.name || user?.username}
                  </span>
                </Space>
              </Button>
            </Dropdown>
          </Space>
        </Header>
        
        <Content style={{
          margin: isMobile ? '80px 8px 16px' : '88px 16px 24px',
          padding: isMobile ? 16 : 24,
          background: '#f0f2f5',
          minHeight: 'calc(100vh - 64px)',
          overflow: 'auto',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: isMobile ? 16 : 24,
            minHeight: 'calc(100vh - 160px)',
          }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
      
      {/* Overlay for mobile when sidebar is open */}
      {isMobile && !collapsed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 999,
          }}
          onClick={() => setCollapsed(true)}
        />
      )}
    </Layout>
  )
}

export default MainLayout
