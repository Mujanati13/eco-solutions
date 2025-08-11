import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, ConfigProvider } from 'antd'
import AuthProvider from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PermissionRoute from './components/PermissionRoute'
import MainLayout from './components/Layout/MainLayout'
import Login from './pages/Auth/Login'
import Register from './pages/Auth/Register'
import Dashboard from './pages/Dashboard/Dashboard'
import './styles/theme.css'
import Orders from './pages/Orders/Orders'
import OrderManagement from './pages/OrderManagement/OrderManagement'
import OrderTracking from './pages/OrderTracking/OrderTracking'
import Users from './pages/Users/Users'
import Profile from './pages/Profile/Profile'
import PerformanceReports from './pages/PerformanceReports/PerformanceReports'
import SessionHistory from './pages/SessionHistory/SessionHistory'
import SessionTimeTracking from './pages/SessionTimeTracking/SessionTimeTracking'
import ActivityLogs from './pages/ActivityLogs/ActivityLogs'
import Products from './pages/Stock/Products'
import StockLevels from './pages/Stock/StockLevels'
import StockMovements from './pages/Stock/StockMovements'
import StockLocations from './pages/Stock/StockLocations'
import StockCategories from './pages/Stock/Categories'
import Categories from './pages/Categories/Categories'
import GoogleSheets from './pages/Integrations/GoogleSheets'
import EcotrackIntegration from './pages/Integrations/EcotrackIntegration'
import DeliveryPricing from './pages/DeliveryPricing'
import ProductDisplay from './pages/ProductDisplay/ProductDisplay'
// import ThemeShowcase from './components/ThemeShowcase'
import { ecoSTheme } from './styles/theme'
import './App.css'
import './styles/responsive.css'

const { Content } = Layout

function App() {
  return (
    <ConfigProvider theme={ecoSTheme}>
      <AuthProvider>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/product/:token" element={<ProductDisplay />} />
            
            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="order-management" element={<OrderManagement />} />
            <Route path="order-tracking" element={<OrderTracking />} />
            <Route path="users" element={
              <PermissionRoute permission="canViewUsers">
                <Users />
              </PermissionRoute>
            } />
            <Route path="reports" element={
              <PermissionRoute permission="canViewReports">
                <PerformanceReports />
              </PermissionRoute>
            } />
            <Route path="sessions" element={
              <PermissionRoute permission="canViewPerformance" fallbackPermission="canViewUsers">
                <SessionTimeTracking />
              </PermissionRoute>
            } />
            <Route path="activities" element={
              <PermissionRoute permission="canViewUsers">
                <ActivityLogs />
              </PermissionRoute>
            } />
            
            {/* Stock Management Routes */}
            <Route path="stock/products" element={
              <PermissionRoute permission="canViewProducts">
                <Products />
              </PermissionRoute>
            } />
            <Route path="stock/categories" element={
              <PermissionRoute permission="canViewProducts">
                <StockCategories />
              </PermissionRoute>
            } />
            <Route path="stock/levels" element={
              <PermissionRoute permission="canViewStock">
                <StockLevels />
              </PermissionRoute>
            } />
            <Route path="stock/movements" element={
              <PermissionRoute permission="canViewStock">
                <StockMovements />
              </PermissionRoute>
            } />
            <Route path="stock/locations" element={
              <PermissionRoute permission="canManageStock">
                <StockLocations />
              </PermissionRoute>
            } />
            
            {/* Integrations Routes */}
            <Route path="integrations/google-sheets" element={
              <PermissionRoute permission="canViewIntegrations">
                <GoogleSheets />
              </PermissionRoute>
            } />
            {/* Ecotrack Integration */}
            <Route path="integrations/ecotrack" element={
              <PermissionRoute permission="canViewIntegrations">
                <EcotrackIntegration />
              </PermissionRoute>
            } />
            
            {/* Delivery Pricing Management */}
            <Route path="delivery-pricing" element={
              <PermissionRoute permission="canManageDelivery">
                <DeliveryPricing />
              </PermissionRoute>
            } />
            
            {/* Theme Showcase */}
            {/* <Route path="theme-showcase" element={<ThemeShowcase />} /> */}
            
            <Route path="profile" element={<Profile />} />
          </Route>
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </div>
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
