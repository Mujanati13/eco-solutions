import React from 'react'
import { Navigate } from 'react-router-dom'
import { Result, Button } from 'antd'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from 'react-i18next'

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const { t } = useTranslation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'admin') {
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

export default AdminRoute
