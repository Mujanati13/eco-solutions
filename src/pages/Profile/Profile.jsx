import React, { useState } from 'react'
import { Card, Form, Input, Button, Space, Typography, Row, Col, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { UserOutlined, MailOutlined, PhoneOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'
import { authService } from '../../services/authService'

const { Title } = Typography

const Profile = () => {
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const { user, updateUser } = useAuth()
  const { t } = useTranslation()
  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()

  const handleProfileUpdate = async (values) => {
    try {
      setLoading(true)
      const response = await authService.updateProfile(values)
      updateUser(response.data.user)
      message.success(t('profile.profileUpdated'))
    } catch (error) {
      message.error(t('common.failedToUpdate'))
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (values) => {
    try {
      setPasswordLoading(true)
      await authService.changePassword(values)
      message.success(t('common.passwordChangeSuccessful'))
      passwordForm.resetFields()
    } catch (error) {
      message.error(t('common.failedToUpdate'))
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div>
      <Title level={2}>{t('profile.title')}</Title>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title={t('profile.personalInfo')}>
            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleProfileUpdate}
              initialValues={user}
            >
              <Form.Item
                name="name"
                label={t('common.name')}
                rules={[{ required: true, message: t('validations.required') }]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder={t('common.name')}
                />
              </Form.Item>

              <Form.Item
                name="email"
                label={t('common.email')}
                rules={[
                  { required: true, message: t('validations.required') },
                  { type: 'email', message: t('validations.emailInvalid') }
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
                rules={[{ required: true, message: t('validations.required') }]}
              >
                <Input 
                  prefix={<PhoneOutlined />} 
                  placeholder={t('common.phone')}
                />
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  {t('profile.updateProfile')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={t('profile.changePassword')}>
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handlePasswordChange}
            >
              <Form.Item
                name="currentPassword"
                label={t('profile.currentPassword')}
                rules={[{ required: true, message: t('validations.required') }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('profile.currentPassword')}
                />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label={t('profile.newPassword')}
                rules={[
                  { required: true, message: t('validations.required') },
                  { min: 6, message: t('validations.passwordMin') }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('profile.newPassword')}
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label={t('common.confirmPassword')}
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: t('validations.required') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
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
                  loading={passwordLoading}
                  style={{ width: '100%' }}
                >
                  {t('profile.changePassword')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Profile
