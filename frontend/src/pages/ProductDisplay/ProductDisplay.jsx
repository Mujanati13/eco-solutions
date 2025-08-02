import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Card,
  Button,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Divider,
  message,
  Spin,
  Alert,
  InputNumber,
  Layout,
  Image,
  Badge,
  Statistic,
  Steps,
  Tooltip,
  Rate
} from 'antd';
import {
  ShopOutlined,
  ShoppingCartOutlined,
  PhoneOutlined,
  WhatsAppOutlined,
  MailOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
  HeartOutlined,
  ShareAltOutlined,
  SafetyCertificateOutlined,
  TruckOutlined,
  CustomerServiceOutlined,
  TagOutlined,
  BarChartOutlined,
  HomeOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import './ProductDisplayModern.css';

const { Title, Text, Paragraph } = Typography;
const { Header, Content, Footer } = Layout;
const { Step } = Steps;

const ProductDisplay = () => {
  const { t } = useTranslation();
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    fetchProductData();
  }, [token]);

  const fetchProductData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Extract product ID from token (format: prod_123_timestamp)
      const tokenParts = token.split('_');
      if (tokenParts.length >= 2 && tokenParts[0] === 'prod') {
        const productId = tokenParts[1];
        
        // Fetch product data from API
        const response = await axios.get(`/api/stock/products/${productId}/public`);
        
        if (response.data && response.data.success) {
          // Ensure numeric fields are properly converted
          const productData = {
            ...response.data.product,
            selling_price: parseFloat(response.data.product.selling_price) || 0,
            cost_price: response.data.product.cost_price ? parseFloat(response.data.product.cost_price) : null,
            current_stock: parseInt(response.data.product.current_stock) || 0,
            variants: response.data.product.variants || [],
            images: response.data.product.images || []
          };
          setProduct(productData);
          console.log('Product data loaded:', productData);
        } else {
          setError('Product not found or inactive');
        }
      } else {
        setError('Invalid product link format');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      if (error.response?.status === 404) {
        setError('Product not found');
      } else if (error.response?.status === 403) {
        setError('Product is not available for public viewing');
      } else {
        setError('Failed to load product information. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (stock) => {
    if (stock <= 0) return { status: 'out-of-stock', text: 'Out of Stock', color: 'red' };
    if (stock <= 10) return { status: 'low-stock', text: 'Low Stock', color: 'orange' };
    return { status: 'in-stock', text: 'In Stock', color: 'green' };
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out this product: ${product.name}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      message.success('Product link copied to clipboard!');
    }
  };

  const handleQuantityChange = (value) => {
    setQuantity(value || 1);
  };

  const formatPrice = (price) => {
    const numPrice = parseFloat(price) || 0;
    return new Intl.NumberFormat('fr-DZ', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(numPrice).replace('DZD', 'DA');
  };

  const handleOrderRequest = () => {
    if (!product) return;

    const totalPrice = formatPrice(product.selling_price * quantity);
    const orderDetails = `
🛍️ *ORDER REQUEST*

📦 Product: ${product.name}
🏷️ SKU: ${product.sku}
💰 Unit Price: ${formatPrice(product.selling_price)} DA
📊 Quantity: ${quantity}
💵 Total: ${totalPrice} DA
${product.category_name ? `📂 Category: ${product.category_name}` : ''}
${product.description ? `📝 Description: ${product.description}` : ''}

I would like to order this product. Please contact me for more details.

Thank you! 🙏
    `;

    // Create WhatsApp link (you can replace this with your business WhatsApp number)
    const phoneNumber = '+213XXXXXXXXX'; // Replace with actual phone number
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(orderDetails)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const handleContactCall = () => {
    // Replace with actual phone number
    const phoneNumber = 'tel:+213XXXXXXXXX';
    window.open(phoneNumber);
  };

  const handleContactEmail = () => {
    if (!product) return;

    const subject = `Order Request - ${product.name}`;
    const totalPrice = formatPrice(product.selling_price * quantity);
    const body = `
Product: ${product.name}
SKU: ${product.sku}
Unit Price: ${formatPrice(product.selling_price)} DA
Quantity: ${quantity}
Total: ${totalPrice} DA
${product.category_name ? `Category: ${product.category_name}` : ''}
${product.description ? `Description: ${product.description}` : ''}

I would like to order this product. Please contact me for more details.

Thank you!
    `;

    const emailUrl = `mailto:orders@yourcompany.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(emailUrl);
  };

  if (loading) {
    return (
      <Layout className="product-display-layout">
        <div className="loading-container">
          <Spin size="large" />
          <Text style={{ marginTop: 16, color: '#666' }}>Loading product details...</Text>
        </div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout className="product-display-layout">
        <div className="error-container">
          <Alert
            message="Product Not Available"
            description={error || "The product you're looking for is not available."}
            type="error"
            showIcon
            action={
              <Button type="primary" onClick={() => window.history.back()}>
                Go Back
              </Button>
            }
          />
        </div>
      </Layout>
    );
  }

  const stockStatus = getStockStatus(product.current_stock);

  return (
    <Layout className="product-display-layout">
      {/* Modern Header */}
      <Header className="modern-header">
        <div className="header-content">
          <div className="header-left">
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />}
              onClick={() => window.history.back()}
              className="back-button"
            >
              Back
            </Button>
            <div className="breadcrumb">
              <HomeOutlined /> / Products / {product.name}
            </div>
          </div>
          <div className="header-right">
            <Space size="middle">
              <Tooltip title="Add to favorites">
                <Button 
                  type="text" 
                  icon={<HeartOutlined />}
                  className={`favorite-btn ${favorited ? 'favorited' : ''}`}
                  onClick={() => setFavorited(!favorited)}
                />
              </Tooltip>
              <Tooltip title="Share product">
                <Button 
                  type="text" 
                  icon={<ShareAltOutlined />}
                  onClick={handleShare}
                />
              </Tooltip>
            </Space>
          </div>
        </div>
      </Header>

      <Content className="modern-content">
        <div className="product-container">
          {/* Hero Section */}
          <Card className="hero-card" bodyStyle={{ padding: 0 }}>
            <Row gutter={0}>
              {/* Product Image Section */}
              <Col xs={24} lg={12}>
                <div className="image-section">
                  <Badge.Ribbon 
                    text={stockStatus.text} 
                    color={stockStatus.color}
                    className="stock-ribbon"
                  >
                    <div className="product-image-container">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          className="product-main-image"
                          placeholder={
                            <div className="image-placeholder">
                              <Spin />
                            </div>
                          }
                          onLoad={() => setImageLoading(false)}
                        />
                      ) : (
                        <div className="no-image-placeholder">
                          <ShopOutlined className="placeholder-icon" />
                          <Text type="secondary">No Image Available</Text>
                        </div>
                      )}
                    </div>
                  </Badge.Ribbon>
                </div>
              </Col>

              {/* Product Details Section */}
              <Col xs={24} lg={12}>
                <div className="details-section">
                  <div className="product-header">
                    {/* Product Tags */}
                    <Space wrap className="product-tags">
                      <Tag color="blue" icon={<TagOutlined />}>
                        SKU: {product.sku}
                      </Tag>
                      {product.category_name && (
                        <Tag color="green">
                          {product.category_name}
                        </Tag>
                      )}
                      <Tag 
                        color={product.is_active ? "success" : "error"} 
                        icon={product.is_active ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </Tag>
                    </Space>

                    {/* Product Title */}
                    <Title level={1} className="product-title">
                      {product.name}
                    </Title>

                    {/* Product Rating */}
                    <div className="rating-section">
                      <Rate disabled defaultValue={4.5} style={{ fontSize: 16 }} />
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        (4.5/5) - 127 reviews
                      </Text>
                    </div>
                  </div>

                  {/* Price Section */}
                  <Card className="price-card" size="small">
                    <Row align="middle" justify="space-between">
                      <Col>
                        <Statistic
                          title="Price"
                          value={product.selling_price}
                          precision={2}
                          suffix="DA"
                          valueStyle={{ color: '#52c41a', fontSize: 32, fontWeight: 700 }}
                        />
                        {product.cost_price && (
                          <Text type="secondary" delete style={{ fontSize: 14 }}>
                            {formatPrice(product.cost_price * 1.2)}
                          </Text>
                        )}
                      </Col>
                      <Col>
                        <div className="stock-info">
                          <Text strong>Stock: </Text>
                          <Tag color={stockStatus.color} className="stock-tag">
                            {product.current_stock} units
                          </Tag>
                        </div>
                      </Col>
                    </Row>
                  </Card>

                  {/* Description */}
                  {product.description && (
                    <Card className="description-card" size="small" title="Description">
                      <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'more' }}>
                        {product.description}
                      </Paragraph>
                    </Card>
                  )}

                  {/* Quantity & Actions */}
                  <Card className="action-card" size="small">
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                      {/* Quantity Selector */}
                      <div className="quantity-selector-modern">
                        <Text strong>Quantity:</Text>
                        <InputNumber
                          min={1}
                          max={product.current_stock || 100}
                          value={quantity}
                          onChange={handleQuantityChange}
                          size="large"
                          style={{ width: 120, marginLeft: 16 }}
                        />
                      </div>

                      {/* Total Price */}
                      <div className="total-display">
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Text strong style={{ fontSize: 16 }}>Total:</Text>
                          </Col>
                          <Col>
                            <Text strong style={{ fontSize: 24, color: '#1890ff' }}>
                              {formatPrice(product.selling_price * quantity)}
                            </Text>
                          </Col>
                        </Row>
                      </div>

                      {/* Action Buttons */}
                      <div className="action-buttons-modern">
                        <Button
                          type="primary"
                          size="large"
                          icon={<WhatsAppOutlined />}
                          onClick={handleOrderRequest}
                          className="whatsapp-button"
                          block
                        >
                          Order via WhatsApp
                        </Button>
                        
                        <Row gutter={8} style={{ marginTop: 8 }}>
                          <Col span={12}>
                            <Button
                              size="large"
                              icon={<PhoneOutlined />}
                              onClick={handleContactCall}
                              block
                            >
                              Call
                            </Button>
                          </Col>
                          <Col span={12}>
                            <Button
                              size="large"
                              icon={<MailOutlined />}
                              onClick={handleContactEmail}
                              block
                            >
                              Email
                            </Button>
                          </Col>
                        </Row>
                      </div>
                    </Space>
                  </Card>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Features Section */}
          <Row gutter={24} style={{ marginTop: 24 }}>
            <Col xs={24} md={8}>
              <Card className="feature-card" size="small">
                <div className="feature-content">
                  <TruckOutlined className="feature-icon" />
                  <div>
                    <Text strong>Fast Delivery</Text>
                    <br />
                    <Text type="secondary">Free shipping on orders over 5000 DA</Text>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="feature-card" size="small">
                <div className="feature-content">
                  <SafetyCertificateOutlined className="feature-icon" />
                  <div>
                    <Text strong>Quality Guarantee</Text>
                    <br />
                    <Text type="secondary">30-day return policy</Text>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="feature-card" size="small">
                <div className="feature-content">
                  <CustomerServiceOutlined className="feature-icon" />
                  <div>
                    <Text strong>24/7 Support</Text>
                    <br />
                    <Text type="secondary">Always here to help</Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Product Information */}
          <Card title="Product Information" className="info-card" style={{ marginTop: 24 }}>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <div className="info-section">
                  <Title level={4}>Specifications</Title>
                  <div className="spec-list">
                    <div className="spec-item">
                      <Text strong>SKU:</Text>
                      <Text code>{product.sku}</Text>
                    </div>
                    {product.barcode && (
                      <div className="spec-item">
                        <Text strong>Barcode:</Text>
                        <Text code>{product.barcode}</Text>
                      </div>
                    )}
                    {product.category_name && (
                      <div className="spec-item">
                        <Text strong>Category:</Text>
                        <Tag color="blue">{product.category_name}</Tag>
                      </div>
                    )}
                    {product.emplacement && (
                      <div className="spec-item">
                        <Text strong>Location:</Text>
                        <Text>{product.emplacement}</Text>
                      </div>
                    )}
                    <div className="spec-item">
                      <Text strong>Availability:</Text>
                      <Tag color={stockStatus.color}>{stockStatus.text}</Tag>
                    </div>
                  </div>
                </div>
              </Col>
              
              <Col xs={24} md={12}>
                <div className="order-process">
                  <Title level={4}>How to Order</Title>
                  <Steps direction="vertical" size="small" current={-1}>
                    <Step 
                      title="Select Quantity" 
                      description="Choose how many items you need"
                      icon={<BarChartOutlined />}
                    />
                    <Step 
                      title="Contact Us" 
                      description="Via WhatsApp, phone, or email"
                      icon={<WhatsAppOutlined />}
                    />
                    <Step 
                      title="Confirm Order" 
                      description="We'll confirm details and pricing"
                      icon={<CheckCircleOutlined />}
                    />
                    <Step 
                      title="Fast Delivery" 
                      description="Receive your order quickly"
                      icon={<TruckOutlined />}
                    />
                  </Steps>
                </div>
              </Col>
            </Row>
          </Card>
        </div>
      </Content>

      {/* Modern Footer */}
      <Footer className="modern-footer">
        <div className="footer-content">
          <Row justify="center">
            <Col>
              <Text type="secondary">
                © 2024 Your Company Name. All rights reserved. | Quality products, exceptional service.
              </Text>
            </Col>
          </Row>
        </div>
      </Footer>
    </Layout>
  );
};

export default ProductDisplay;
