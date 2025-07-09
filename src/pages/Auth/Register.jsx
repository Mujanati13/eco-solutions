import React, { useState } from 'react'
import { Form, Input, Button, Card, Select, Typography, message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'

const { Title, Text } = Typography
const { Option } = Select

const Register = () => {
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const result = await register(values)
      if (result.success) {
        message.success(t('auth.registerSuccess'))
        navigate('/login')
      }
    } catch (error) {
      message.error(t('auth.registerError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <Card className="auth-card">
        <div className="auth-header">
          <Title level={2} className="auth-title">
            {t('auth.registerTitle')}
          </Title>
          <Text className="auth-subtitle">
            {t('auth.registerSubtitle')}
          </Text>
        </div>

        <Form
          name="register"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="first_name"
            label={t('common.name')}
            rules={[
              {
                required: true,
                message: t('validations.required'),
              },
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="First Name"
            />
          </Form.Item>

          <Form.Item
            name="last_name"
            label="Last Name"
            rules={[
              {
                required: true,
                message: t('validations.required'),
              },
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Last Name"
            />
          </Form.Item>

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
            name="email"
            label={t('common.email')}
            rules={[
              {
                required: true,
                message: t('validations.required'),
              },
              {
                type: 'email',
                message: t('validations.emailInvalid'),
              },
            ]}
          >
            <Input 
              prefix={<MailOutlined />} 
              placeholder={t('common.email')}
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label={t('common.phone')}
            rules={[
              {
                required: true,
                message: t('validations.required'),
              },
            ]}
          >
            <Input 
              prefix={<PhoneOutlined />} 
              placeholder={t('common.phone')}
            />
          </Form.Item>

          <Form.Item
            name="role"
            label={t('auth.role')}
            rules={[
              {
                required: true,
                message: t('validations.required'),
              },
            ]}
          >
            <Select placeholder={t('auth.role')}>
              <Option value="employee">{t('auth.employee')}</Option>
              <Option value="admin">{t('auth.admin')}</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="password"
            label={t('common.password')}
            rules={[
              {
                required: true,
                message: t('validations.required'),
              },
              {
                min: 6,
                message: t('validations.passwordMin'),
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('common.password')}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label={t('common.confirmPassword')}
            dependencies={['password']}
            rules={[
              {
                required: true,
                message: t('validations.required'),
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error(t('validations.passwordMatch')))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('common.confirmPassword')}
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              style={{ width: '100%' }}
            >
              {t('common.register')}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text>
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login">{t('common.login')}</Link>
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Register
