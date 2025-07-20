import React, { useState, useEffect } from 'react';
import { Select, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { deliveryPricingService } from '../services/deliveryPricingService';

const { Option } = Select;

const WilayaSelector = ({ 
  value, 
  onChange, 
  placeholder,
  showSearch = true,
  allowClear = true,
  size = 'default',
  disabled = false,
  style = {}
}) => {
  const { t } = useTranslation();
  const [wilayas, setWilayas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWilayas();
  }, []);

  const fetchWilayas = async () => {
    try {
      setLoading(true);
      const response = await deliveryPricingService.getActiveWilayas();
      // Ensure we always have an array
      const data = Array.isArray(response?.data) ? response.data : 
                   Array.isArray(response) ? response : [];
      setWilayas(data);
    } catch (error) {
      console.error('Error fetching wilayas:', error);
      setWilayas([]); // Ensure we set an empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (wilayaId, option) => {
    if (onChange) {
      const selectedWilaya = Array.isArray(wilayas) ? 
        wilayas.find(w => w.id === wilayaId) : null;
      onChange(wilayaId, selectedWilaya);
    }
  };

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder={placeholder || t('delivery.selectWilaya')}
      showSearch={showSearch}
      allowClear={allowClear}
      size={size}
      disabled={disabled}
      loading={loading}
      style={style}
      optionFilterProp="children"
      filterOption={(input, option) => {
        const children = option.children;
        if (typeof children === 'string') {
          return children.toLowerCase().indexOf(input.toLowerCase()) >= 0;
        }
        return false;
      }}
      notFoundContent={loading ? <Spin size="small" /> : t('common.noData')}
    >
      {Array.isArray(wilayas) && wilayas.map(wilaya => (
        <Option key={wilaya.id} value={wilaya.id}>
          {wilaya.code} - {wilaya.name_en}
        </Option>
      ))}
    </Select>
  );
};

export default WilayaSelector;
