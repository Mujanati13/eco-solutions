import React from 'react'
import { Navigate } from 'react-router-dom'
import { Result, Button } from 'antd'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { usePermissions } from '../hooks/usePermissions'

const PermissionRoute = ({ children, permission, fallbackPermission = null }) => {
  const { user, isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const { hasPermission, loading } = usePermissions()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return <div className="loading-container">Loading...</div>
  }

  // Check if user has the required permission
  const hasRequiredPermission = hasPermission(permission) || 
    (fallbackPermission && hasPermission(fallbackPermission))

  if (!hasRequiredPermission) {
    return (
      <Result
        status="403"
        title="403"
        subTitle={t('errors.accessDenied')}
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            {t('common.goBack')}
          </Button>
        }
      />
    )
  }

  return children
}

export default PermissionRoute
