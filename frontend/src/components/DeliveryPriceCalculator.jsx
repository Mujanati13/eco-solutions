import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Select,
  Button,
  Space,
  Typography,
  Divider,
  Alert,
  Spin,
  Row,
  Col,
  Statistic
} from 'antd';
import { CalculatorOutlined, TruckOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import WilayaSelector from './WilayaSelector';
import { deliveryPricingService } from '../services/deliveryPricingService';

const { Title, Text } = Typography;
const { Option } = Select;

const DeliveryPriceCalculator = ({ 
  onPriceCalculated, 
  initialValues = {},
  showTitle = true,
  size = 'default',
  embedded = false
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
      if (initialValues.wilaya_id && initialValues.delivery_type && initialValues.product_weight) {
        calculatePrice();
      }
    }
  }, [initialValues]);

  const calculatePrice = async (values = null) => {
    try {
      setCalculating(true);
      setError(null);
      
      const formValues = values || form.getFieldsValue();
      const { wilaya_id, delivery_type, product_weight } = formValues;

      if (!wilaya_id) {
        setError(t('delivery.selectWilaya'));
        return;
      }

      const response = await deliveryPricingService.calculateDeliveryPrice({
        wilaya_id,
        delivery_type: delivery_type || 'home',
        weight: product_weight || 1.0
      });

      const pricing = response.data;
      setResult(pricing);
      
      if (onPriceCalculated) {
        onPriceCalculated({
          ...formValues,
          pricing
        });
      }
    } catch (error) {
      console.error('Error calculating delivery price:', error);
      setError(t('delivery.calculationFailed'));
    } finally {
      setCalculating(false);
    }
  };

  const handleFormChange = (changedFields, allFields) => {
    // Auto-calculate when all required fields are filled
    const values = form.getFieldsValue();
    if (values.wilaya_id && values.delivery_type && values.product_weight) {
      const timer = setTimeout(() => {
        calculatePrice(values);
      }, 500); // Debounce for 500ms
      
      return () => clearTimeout(timer);
    }
  };

  const CardContent = () => (
    <>
      {showTitle && (
        <Title level={embedded ? 5 : 4}>
          <CalculatorOutlined /> {t('delivery.priceCalculator')}
        </Title>
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={calculatePrice}
        onFieldsChange={handleFormChange}
        size={size}
      >
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="wilaya_id"
              label={t('delivery.wilaya')}
              rules={[{ required: true, message: t('validation.required') }]}
            >
              <WilayaSelector
                placeholder={t('delivery.selectWilaya')}
                size={size}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="delivery_type"
              label={t('delivery.type')}
              initialValue="home"
            >
              <Select size={size}>
                <Option value="home">
                  🏠 {t('delivery.types.home')}
                </Option>
                <Option value="office">
                  🏢 {t('delivery.types.office')}
                </Option>
                <Option value="pickup_point">
                  📦 {t('delivery.types.pickup_point')}
                </Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="product_weight"
              label={t('delivery.productWeight')}
              help={t('delivery.weightHelp')}
              initialValue={1.0}
              rules={[
                { required: true, message: t('validation.required') },
                { type: 'number', min: 0.1, message: t('validation.minWeight') }
              ]}
            >
              <InputNumber
                min={0.1}
                step={0.1}
                style={{ width: '100%' }}
                addonAfter="kg"
                size={size}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label=" ">
              <Button
                type="primary"
                icon={<CalculatorOutlined />}
                onClick={() => calculatePrice()}
                loading={calculating}
                size={size}
                style={{ width: '100%' }}
              >
                {calculating ? t('delivery.calculating') : t('delivery.calculatePrice')}
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>

      {error && (
        <Alert
          message={error}
          type="error"
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError(null)}
        />
      )}

      {calculating && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">{t('delivery.calculating')}</Text>
          </div>
        </div>
      )}

      {result && !calculating && (
        <>
          <Divider>{t('delivery.pricingDetails')}</Divider>
          
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title={t('delivery.totalPrice')}
                  value={result.price}
                  suffix="DA"
                  precision={2}
                  prefix={<TruckOutlined />}
                  valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title={t('delivery.estimatedTime')}
                  value={`${result.delivery_time_min}-${result.delivery_time_max}`}
                  suffix="hours"
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic
                  title={t('delivery.basePrice')}
                  value={result.breakdown.base_price}
                  suffix="DA"
                  precision={2}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {(result.breakdown.weight_additional > 0 || result.breakdown.volume_additional > 0) && (
            <div style={{ marginTop: 16 }}>
              <Title level={5}>{t('delivery.priceBreakdown')}</Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row justify="space-between">
                  <Text>Base Price:</Text>
                  <Text strong>{result.breakdown.base_price} DA</Text>
                </Row>
                {result.breakdown.weight_additional > 0 && (
                  <Row justify="space-between">
                    <Text>{t('delivery.additionalWeight')}:</Text>
                    <Text strong>+{result.breakdown.weight_additional} DA</Text>
                  </Row>
                )}
                {result.breakdown.volume_additional > 0 && (
                  <Row justify="space-between">
                    <Text>{t('delivery.additionalVolume')}:</Text>
                    <Text strong>+{result.breakdown.volume_additional} DA</Text>
                  </Row>
                )}
                <Divider style={{ margin: '8px 0' }} />
                <Row justify="space-between">
                  <Text strong style={{ fontSize: '16px' }}>Total:</Text>
                  <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                    {result.price} DA
                  </Text>
                </Row>
              </Space>
            </div>
          )}
        </>
      )}
    </>
  );

  return embedded ? (
    <CardContent />
  ) : (
    <Card>
      <CardContent />
    </Card>
  );
};

export default DeliveryPriceCalculator;
