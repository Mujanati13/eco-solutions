import React, { useState } from 'react'
import { Form, Input, Button, Card, Checkbox, Space, Typography, message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'

const { Title, Text } = Typography

const Login = () => {
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const result = await login(values)
      if (result.success) {
        navigate('/dashboard')
      }
    } catch (error) {
      message.error(t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <Card className="auth-card">
        <div className="auth-header">
          <Title level={2} className="auth-title">
            {t('auth.loginTitle')}
          </Title>
          <Text className="auth-subtitle">
            {t('auth.loginSubtitle')}
          </Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            label="Username"
            rules={[
              {
                required: true,
                message: t('validations.required'),
              },
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('common.password')}
            rules={[
              {
                required: true,
                message: t('validations.required'),
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('common.password')}
            />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>{t('auth.rememberMe')}</Checkbox>
              </Form.Item>
              <Link to="/forgot-password">
                {t('auth.forgotPassword')}
              </Link>
            </Space>
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              style={{ width: '100%' }}
            >
              {t('common.login')}
            </Button>
          </Form.Item>

      
        </Form>
      </Card>
    </div>
  )
}

export default Login
