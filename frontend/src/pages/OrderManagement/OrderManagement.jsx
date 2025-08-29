import React, { useState, useEffect } from "react";
import VirtualList from 'rc-virtual-list';
import {
  Table,
  Button,
  Space,
  Typography,
  Input,
  Select,
  Modal,
  Form,
  message,
  Tag,
  Popconfirm,
  Card,
  Row,
  Col,
  Upload,
  Spin,
  Dropdown,
  Menu,
  Progress,
  Alert,
  Tooltip,
  Radio,
  Timeline,
  Descriptions,
  Switch,
  Statistic,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  DownOutlined ,
  ReloadOutlined,
  UserAddOutlined,
  ShareAltOutlined,
  UploadOutlined,
  FileExcelOutlined,
  UserOutlined,
  EyeOutlined,
  GlobalOutlined,
  SyncOutlined,
  TruckOutlined,
  LinkOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CalculatorOutlined,
} from "@ant-design/icons";
import { orderService } from "../../services/orderService";
import { userService } from "../../services/userService";
import orderProductService from "../../services/orderProductService";
import stockService from "../../services/stockService";
import variantService from "../../services/variantService";
import googleAuthService from "../../services/googleAuthService";
import ecoTrackFeesService from "../../services/ecoTrackFeesService";
import { useAuth } from "../../contexts/AuthContext";
import "./OrderManagement.css";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [ordersWithProducts, setOrdersWithProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  // Debounced search text to avoid heavy re-filtering on each keystroke
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [allOrders, setAllOrders] = useState([]); // Store all orders for frontend filtering
  // removed: filteredOrders state (now using derivedFilteredOrders useMemo)
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState("");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [distributionModalVisible, setDistributionModalVisible] =
    useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("");
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [ecotrackDetails, setEcotrackDetails] = useState(null);
  const [ecotrackLoading, setEcotrackLoading] = useState(false);
  const [distributionSettings, setDistributionSettings] = useState({
    algorithm: "round_robin",
    maxOrdersPerUser: 10,
    considerWorkload: true,
    considerPerformance: true,
    priorityRules: [],
  });
  const [ecotrackEnabled, setEcotrackEnabled] = useState(false);

  // Delivery management state
  const [wilayas, setWilayas] = useState([]);
  const [baladias, setBaladias] = useState([]);
  const [selectedWilaya, setSelectedWilaya] = useState(null);
  const [pricingLevel, setPricingLevel] = useState("wilaya");
  const [loadingWilayas, setLoadingWilayas] = useState(false);
  const [loadingBaladias, setLoadingBaladias] = useState(false);
  const [loadingDeliveryPrice, setLoadingDeliveryPrice] = useState(false);
  const [ecotrackStations, setEcotrackStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(false);
  
  // Delivery type state for conditional rendering
  const [currentDeliveryType, setCurrentDeliveryType] = useState('home');
  
  // Final total calculation state
  const [finalTotal, setFinalTotal] = useState(0);
  
  // Multi-selection and bulk operations state
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  // Removed separate selectedOrders state; compute from selectedRowKeys via memo below for performance
  const [bulkSendToDeliveryLoading, setBulkSendToDeliveryLoading] = useState(false);
  const [bulkDeliveryModalVisible, setBulkDeliveryModalVisible] = useState(false);
  const [bulkAssignedTo, setBulkAssignedTo] = useState(null);
  // Optimistic status update state
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  

  // Lightweight cache helpers for static/slow-changing lists
  const getCache = React.useCallback((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (obj && obj.e && Date.now() < obj.e) return obj.v;
      return null;
    } catch {
      return null;
    }
  }, []);

  const setCache = React.useCallback((key, value, ttlMs) => {
    try {
      localStorage.setItem(key, JSON.stringify({ v: value, e: Date.now() + ttlMs }));
    } catch {}
  }, []);

  // Product and stock tracking state
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productStock, setProductStock] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Boutique filtering state
  const [locations, setLocations] = useState([]);
  const [boutiqueFilter, setBoutiqueFilter] = useState("");
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Google Sheets synchronization state
  const [googleSheetsEnabled, setGoogleSheetsEnabled] = useState(false);
  const [googleSheetsConfig, setGoogleSheetsConfig] = useState({
    spreadsheetId: '',
    sheetName: 'Sheet1'
  });
  const [googleAuthStatus, setGoogleAuthStatus] = useState(null);
  const [googleSheetsModalVisible, setGoogleSheetsModalVisible] = useState(false);

  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor" || isAdmin;
  const canAssignOrders = isAdmin || isSupervisor;
  const canViewAllOrders = isAdmin || isSupervisor;
  const canDeleteOrders = isAdmin;
  const canImportOrders = isAdmin;
  const canDistributeOrders = isAdmin;

  // Env-aware logging (noisy logs disabled in production)
  const isDev = (
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE !== 'production') ||
    (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production')
  );
  const devLog = (...args) => { if (isDev) console.log(...args); };

  // Ensure users are loaded only when needed
  const ensureUsers = React.useCallback(() => {
    if (!canAssignOrders) return;
    if (!usersLoading && (!Array.isArray(users) || users.length === 0)) {
      fetchUsers();
    }
  }, [canAssignOrders, usersLoading, users]);

  // Derived filtered orders (useMemo instead of extra state to avoid re-renders and double work)
  const derivedFilteredOrders = React.useMemo(() => {
    let filtered = Array.isArray(allOrders) ? [...allOrders] : [];

    // Apply phone/name search
    if (debouncedSearchText && debouncedSearchText.trim()) {
      const searchTerm = debouncedSearchText.trim().toLowerCase();
      filtered = filtered.filter(order =>
        (order.customer_phone && order.customer_phone.toLowerCase().includes(searchTerm)) ||
        (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm))
      );
      if (isDev) {
        console.log('📱 Frontend filtering by phone/name:', searchTerm);
        console.log('📊 Filtered results:', filtered.length);
      }
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Assigned filter
    if (assignedToFilter) {
      if (assignedToFilter === 'null') {
        filtered = filtered.filter(order => !order.assigned_to);
      } else {
        filtered = filtered.filter(order => order.assigned_to == assignedToFilter);
      }
    }

    // Boutique filter (inline logic to avoid dependency on later-defined helper)
    if (boutiqueFilter) {
      const productsList = Array.isArray(products) ? products : [];
      const locationsList = Array.isArray(locations) ? locations : [];

      filtered = filtered.filter(order => {
        // Parse product details
        let productName = null;
        try {
          const pd = typeof order.product_details === 'string' ? JSON.parse(order.product_details) : order.product_details;
          productName = pd?.name ? String(pd.name) : null;
        } catch (_) {}

        if (!productName) {
          // No product details available
          return boutiqueFilter === 'no_match' ? true : boutiqueFilter === 'has_match' ? false : false;
        }

        const orderProductName = productName.toLowerCase().trim();
        const normalizedOrderName = orderProductName.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ');

        // Find matched product in our products list
        let matchedProduct = null;
        for (const p of productsList) {
          if (!p?.name) continue;
          const dbName = p.name.toLowerCase().trim();
          const normalizedDbName = dbName.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ');
          if (
            dbName === orderProductName ||
            dbName.includes(orderProductName) ||
            orderProductName.includes(dbName) ||
            normalizedDbName === normalizedOrderName ||
            normalizedDbName.includes(normalizedOrderName) ||
            normalizedOrderName.includes(normalizedDbName)
          ) {
            matchedProduct = p;
            break;
          }
        }

        if (!matchedProduct) {
          // No DB product match found
          return boutiqueFilter === 'no_match';
        }

        if (boutiqueFilter === 'has_match') return true;
        // Specific boutique (location id)
        const locId = matchedProduct.location_id;
        if (!locId) return false;
        return String(locId) == String(boutiqueFilter);
      });
      if (isDev) {
        console.log('🏪 Frontend filtering by boutique:', boutiqueFilter);
        console.log('📊 Boutique filtered results:', filtered.length);
      }
    }

    return filtered;
  }, [allOrders, debouncedSearchText, statusFilter, assignedToFilter, boutiqueFilter, products, locations, isDev]);

  // Reset to first page when filters change (keep user experience consistent)
  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [debouncedSearchText, statusFilter, assignedToFilter, boutiqueFilter]);

  // Memoize parsed product details for table rendering (avoids repeated JSON.parse)
  const parsedProductDetailsById = React.useMemo(() => {
    const map = new Map();
    const source = Array.isArray(derivedFilteredOrders) ? derivedFilteredOrders : Array.isArray(allOrders) ? allOrders : [];
    for (const o of source) {
      let parsed = null;
      try {
        if (o?.product_details) {
          parsed = typeof o.product_details === 'string' ? JSON.parse(o.product_details) : o.product_details;
        }
      } catch (e) {
        // ignore parse errors
      }
      map.set(o?.id, parsed);
    }
    return map;
  }, [derivedFilteredOrders, allOrders]);

  // Calculate statistics from orders
  const calculateStatistics = () => {
    const stats = {
      total: derivedFilteredOrders.length,
      pending: 0,
      confirmed: 0,
      processing: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
      totalAmount: 0,
      averageAmount: 0,
    };

    derivedFilteredOrders.forEach(order => {
      stats.totalAmount += parseFloat(order.total_amount || 0);
      
      switch(order.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'confirmed':
          stats.confirmed++;
          break;
        case 'processing':
          stats.processing++;
          break;
        case 'out_for_delivery':
          stats.out_for_delivery++;
          break;
        case 'delivered':
          stats.delivered++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
        default:
          break;
      }
    });

    stats.averageAmount = stats.total > 0 ? stats.totalAmount / stats.total : 0;

    return stats;
  };

  const orderStats = calculateStatistics();

  useEffect(() => {
    fetchOrders();
    fetchOrdersWithProducts();
    // Lazy-load users now; fetch only when user opens assignment UI
    
    // Debug function for checking tracking IDs
    if (!isDev) return; // Register debug helpers only in dev
    window.debugTrackingIds = () => {
      devLog('🔍 Debug: All orders with EcoTrack tracking IDs:');
      const ordersWithTracking = allOrders.filter(order => order.ecotrack_tracking_id);
      
      if (ordersWithTracking.length === 0) {
        devLog('❌ No orders found with EcoTrack tracking IDs');
        devLog('Available orders:', allOrders.length);
        return;
      }
      
      ordersWithTracking.forEach(order => {
        devLog(`Order ${order.id} (${order.order_number}):`, {
          tracking_id: order.ecotrack_tracking_id,
          type: typeof order.ecotrack_tracking_id,
          length: order.ecotrack_tracking_id?.toString().length,
          trimmed: order.ecotrack_tracking_id?.toString().trim(),
          status: order.status,
          ecotrack_synced: order.ecotrack_synced
        });
      });
      
      devLog(`📊 Total orders with tracking: ${ordersWithTracking.length}`);
    };
    
    // Debug function to test delete API with specific tracking ID
    window.testEcotrackDelete = async (trackingId, orderId = null) => {
      try {
        devLog(`🧪 Testing EcoTrack delete API via backend:`, {
          trackingId: trackingId,
          orderId: orderId,
          length: trackingId?.length
        });
        
        const response = await fetch('/api/ecotrack/delete-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            trackingId: trackingId,
            orderId: orderId,
            reason: 'Test deletion'
          })
        });
        
        const responseData = await response.json();
        console.log(`📤 Backend Response:`, {
          status: response.status,
          statusText: response.statusText,
          success: responseData.success,
          message: responseData.message,
          data: responseData.data
        });
        
        if (response.ok) {
          console.log('✅ Delete test successful');
        } else {
          console.log('❌ Delete test failed');
        }
        
        return { success: response.ok, status: response.status, body: responseText };
      } catch (error) {
        console.error('❌ Delete test error:', error);
        return { success: false, error: error.message };
      }
    };
    
    console.log('💡 Debug functions available:');
    console.log('- window.debugTrackingIds() - Check all tracking IDs');
    console.log('- window.testEcotrackDelete(trackingId, orderId) - Test delete API (orderId optional)');
    
    // Debug function to test Total Final calculation
    window.testTotalFinalCalculation = async (orderId) => {
      const order = allOrders.find(o => o.id == orderId);
      if (!order) {
        console.error('Order not found:', orderId);
        return;
      }
      
      const productAmount = parseFloat(order.total_amount) || 0;
      const deliveryPrice = parseFloat(order.delivery_price) || 0;
      const originalTotal = productAmount + deliveryPrice;
      const isCorrupted = deliveryPrice === productAmount && deliveryPrice > 0;
      
      let correctedTotal = originalTotal;
      let apiDeliveryPrice = null;
      
      if (isCorrupted) {
        console.log('🔧 Testing corruption correction with EcoTrack API...');
        
        // Test the EcoTrack fees API
        try {
          const response = await fetch('/api/ecotrack/get-fees', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              wilaya_id: order.wilaya_id
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('📡 EcoTrack API response:', data);
            
            if (data.success && data.fees) {
              const wilayaKey = order.wilaya_id.toString();
              const wilayaFees = data.fees[wilayaKey];
              
              if (wilayaFees) {
                // Use the correct tarif based on current form delivery type
                const currentFormValues = form.getFieldsValue();
                const deliveryType = currentFormValues.delivery_type || currentDeliveryType || order.delivery_type || 'home';
                
                apiDeliveryPrice = deliveryType === 'stop_desk' 
                  ? (wilayaFees.tarif_stopdesk || wilayaFees.tarif)
                  : wilayaFees.tarif;
                  
                correctedTotal = productAmount + apiDeliveryPrice;
                console.log(`✅ Found API delivery price for ${deliveryType}: ${apiDeliveryPrice} DA (regular: ${wilayaFees.tarif}, stop_desk: ${wilayaFees.tarif_stopdesk})`);
              }
            }
          }
        } catch (error) {
          console.error('❌ Error testing EcoTrack API:', error);
        }
        
        // Fallback - if API failed, don't use hardcoded prices
        if (!apiDeliveryPrice) {
          console.log('⚠️ EcoTrack API unavailable - no fallback pricing used (EcoTrack API only)');
          correctedTotal = productAmount; // No delivery price if API fails
        }
      }
      
      console.log(`📊 Total Final Calculation Test for Order ${orderId}:`, {
        order_id: order.id,
        product_amount: productAmount,
        original_delivery_price: deliveryPrice,
        original_total: originalTotal,
        corruption_detected: isCorrupted,
        api_delivery_price: apiDeliveryPrice,
        corrected_total_for_ecotrack: correctedTotal,
        wilaya_info: `${order.wilaya_id} (${wilayas.find(w => w.id == order.wilaya_id)?.code})`,
        customer: order.customer_name,
        savings: isCorrupted ? `Saved ${originalTotal - correctedTotal} DA from corruption` : 'No correction needed'
      });
      
      return { orderId, productAmount, deliveryPrice, originalTotal, correctedTotal, isCorrupted, apiDeliveryPrice };
    };
    
    console.log('- window.testTotalFinalCalculation(orderId) - Test Total Final calculation with EcoTrack API for specific order');
    console.log('- window.debugTrackingStorage() - Analyze tracking ID storage');
    console.log('- window.testDeliveryPriceCalculation(wilayaId) - Test delivery price calculation');
    console.log('- window.testDeliveryTypeSwitching(wilayaId) - Test switching between regular and stop desk delivery types');

    // Test delivery price calculation
    window.testDeliveryPriceCalculation = async (wilayaId) => {
      console.log('🧪 [DEBUG] Testing delivery price calculation for wilaya:', wilayaId);
      try {
        const pricingData = {
          wilaya_id: wilayaId,
          delivery_type: "home",
          weight: 1,
          pricing_level: "wilaya"
        };
        console.log('📡 [DEBUG] Sending request:', pricingData);
        const response = await orderService.calculateDeliveryPrice(pricingData);
        console.log('🚚 [DEBUG] Response:', response);
        
        if (response.success && response.data) {
          const price = response.data.price || response.data.delivery_price || 0;
          console.log('💰 [DEBUG] Extracted price:', price);
          return price;
        } else {
          console.log('❌ [DEBUG] Response not successful');
          return null;
        }
      } catch (error) {
        console.error('❌ [DEBUG] Error:', error);
        return null;
      }
    };

    // Test delivery type switching
    window.testDeliveryTypeSwitching = async (wilayaId = 16) => {
      console.log('🧪 [TEST] Testing delivery type switching for wilaya:', wilayaId);
      
      // First set the wilaya
      form.setFieldsValue({ wilaya_id: wilayaId });
      handleWilayaChange(wilayaId);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Test regular delivery
      console.log('📦 [TEST] Testing regular delivery (home)...');
      handleDeliveryFieldChange('home', 'delivery_type');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      const regularPrice = form.getFieldValue('delivery_price');
      console.log('💰 [TEST] Regular delivery price:', regularPrice);
      
      // Test stop desk delivery
      console.log('🚉 [TEST] Testing stop desk delivery...');
      handleDeliveryFieldChange('stop_desk', 'delivery_type');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      const stopDeskPrice = form.getFieldValue('delivery_price');
      console.log('💰 [TEST] Stop desk delivery price:', stopDeskPrice);
      
      // Compare results
      console.log('📊 [TEST] Price comparison:', {
        wilaya_id: wilayaId,
        regular_price: regularPrice,
        stop_desk_price: stopDeskPrice,
        savings: regularPrice - stopDeskPrice,
        working_correctly: stopDeskPrice < regularPrice
      });
      
      return {
        wilayaId,
        regularPrice,
        stopDeskPrice,
        savings: regularPrice - stopDeskPrice,
        workingCorrectly: stopDeskPrice < regularPrice
      };
    };

    // Enhanced debug function for tracking ID storage analysis
    window.debugTrackingStorage = () => {
      const ordersWithTracking = allOrders.filter(order => order.ecotrack_tracking_id);
      console.log('🔍 DETAILED TRACKING ID STORAGE ANALYSIS:');
      console.log(`Found ${ordersWithTracking.length} orders with tracking IDs`);
      
      ordersWithTracking.forEach(order => {
        const trackingId = order.ecotrack_tracking_id;
        const originalString = String(trackingId);
        let cleanedId = originalString.trim();
        
        // Remove quotes if present
        if (cleanedId.startsWith('"') && cleanedId.endsWith('"')) {
          cleanedId = cleanedId.slice(1, -1);
        }
        
        console.log(`📋 Order ${order.id} (${order.order_number}):`, {
          original: trackingId,
          originalType: typeof trackingId,
          originalLength: originalString.length,
          firstChar: originalString.charAt(0),
          lastChar: originalString.charAt(originalString.length - 1),
          hasQuotes: originalString.includes('"'),
          trimmed: originalString.trim(),
          cleaned: cleanedId,
          cleanedLength: cleanedId.length,
          isValidForDelete: cleanedId && cleanedId !== '""' && cleanedId !== 'null' && cleanedId.length > 0,
          charCodes: originalString.split('').map(char => `${char}(${char.charCodeAt(0)})`).join(' ')
        });
      });
      
      return ordersWithTracking;
    };
  }, []); // Remove filters from dependency array since we're doing frontend filtering

  // Initialize Google Sheets configuration
  useEffect(() => {
    initializeGoogleSheets();
  }, []);

  // Debounce search text updates
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearchText(searchText), 250);
    return () => clearTimeout(id);
  }, [searchText]);

  // removed: applyFrontendFilters and its effect; filtering handled by derivedFilteredOrders

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {
        page: 1, // Always fetch from first page to get all data
        limit: 1000, // Fetch more orders for frontend filtering
        status: '', // Remove status filter from backend, handle in frontend
        assigned_to: '', // Remove assigned_to filter from backend, handle in frontend
      };

      // Role-based filtering
      if (!canViewAllOrders && user?.id) {
        // Employees only see their assigned orders
        params.assigned_to = user.id;
      } else if (isSupervisor && !isAdmin) {
        // Supervisors see orders from their team (you can customize this logic)
        params.supervisor_id = user.id;
      }

      console.log('🔍 Fetching all orders for frontend filtering:', params);

      const response = await orderService.getOrders(params);

      // Based on the API format, response should have { orders: [...], pagination: {...} }
      const ordersData = response.orders || [];

      setAllOrders(ordersData);
      
      // Initial pagination setup
      setPagination(prev => ({
        ...prev,
        total: ordersData.length,
      }));
    } catch (error) {
      message.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  // Debounced refresh guard to avoid double fetches (defined after fetchOrders)
  const lastRefreshAtRef = React.useRef(0);
  const refreshOrdersOnce = React.useCallback((reason = 'unknown') => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < 400) {
      if (isDev) console.log('⏭️ Skipping duplicate refresh within 400ms:', reason);
      return;
    }
    lastRefreshAtRef.current = now;
    if (isDev) console.log('🔄 Refreshing orders:', reason);
    fetchOrders();
  }, [isDev]);

  const fetchOrdersWithProducts = async () => {
    try {
      const response = await orderProductService.getOrdersWithProducts();
      setOrdersWithProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching orders with products:', error);
      // Handle permission error gracefully - this is supplementary data
      if (error.error === 'Permission denied' || error.status === 403) {
        console.warn('User lacks canViewOrders permission - orders with products data unavailable');
        setOrdersWithProducts([]); // Set empty array so app continues to work
      }
      // Don't show error message as this is supplementary data
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      // Try cache first (10 minutes TTL)
      const cached = getCache('users_v1');
      if (cached && Array.isArray(cached)) {
        setUsers(cached);
        setUsersLoading(false);
        return;
      }

      const response = await userService.getUsers();

      // Based on your API format, the response should have { users: [...], pagination: {...} }
      const usersData = response.users || [];

      // Ensure usersData is an array
      const finalUsers = Array.isArray(usersData) ? usersData : [];
  setUsers(finalUsers);
  setCache('users_v1', finalUsers, 10 * 60 * 1000);
    } catch (error) {
      message.error(t("users.fetchFailed"));
      setUsers([]); // Set empty array on error
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSearch = () => {
    console.log('🔍 Manual search triggered with text:', searchText);
    // Frontend filtering will be triggered by useEffect
  };

  const handleClearSearch = () => {
    setSearchText("");
    setStatusFilter("");
    setAssignedToFilter("");
    setBoutiqueFilter("");
    // This will trigger the filtering effect and show all orders
  };

  // Delivery management functions
  const fetchWilayas = async () => {
    try {
      setLoadingWilayas(true);
      const cached = getCache('wilayas_v1');
      if (cached) {
        setWilayas(cached);
        return;
      }
      const response = await orderService.getWilayas();
      if (response.success) {
        setWilayas(response.data);
        setCache('wilayas_v1', response.data, 24 * 60 * 60 * 1000);
      }
    } catch (error) {
      console.error("Error fetching wilayas:", error);
      message.error(t("delivery.errorFetchingWilayas"));
    } finally {
      setLoadingWilayas(false);
    }
  };

  const fetchBaladias = async (wilayaId) => {
    try {
      setLoadingBaladias(true);
      console.log('Fetching baladias for wilaya:', wilayaId);
      const cacheKey = `baladias_${wilayaId}_v1`;
      const cached = getCache(cacheKey);
      if (cached) {
        setBaladias(cached);
        console.log('Set baladias from cache:', cached.length, 'items');
        return;
      }
      const response = await orderService.getBaladiasByWilaya(wilayaId);
      console.log('Baladias response:', response);
      if (response.success) {
        setBaladias(response.data);
        setCache(cacheKey, response.data, 24 * 60 * 60 * 1000);
        console.log('Set baladias:', response.data.length, 'items');
      }
    } catch (error) {
      console.error("Error fetching baladias:", error);
      message.error(t("delivery.errorFetchingBaladias"));
    } finally {
      setLoadingBaladias(false);
    }
  };

  const fetchEcotrackStations = async () => {
    console.log('🚉 Starting to fetch EcoTrack stations...');
    setLoadingStations(true);
    try {
      const cached = getCache('ecotrack_stations_v1');
      if (cached) {
        setEcotrackStations(cached);
        setLoadingStations(false);
        return;
      }
      const response = await fetch('/api/ecotrack/stations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log('🌐 EcoTrack stations API response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('📋 EcoTrack stations API result:', result);
        
        if (result.success && result.data) {
          setEcotrackStations(result.data);
          setCache('ecotrack_stations_v1', result.data, 24 * 60 * 60 * 1000);
          console.log(`✅ Successfully loaded ${result.data.length} EcoTrack stations`);
          console.log('📊 Sample stations:', result.data.slice(0, 3));
        } else {
          console.warn('❌ EcoTrack stations API returned failure:', result);
          setEcotrackStations([]);
          message.warning(`Failed to load EcoTrack stations: ${result.message || 'Unknown error'}`);
        }
      } else {
        const errorText = await response.text();
        console.warn(`❌ EcoTrack stations API HTTP error ${response.status}:`, errorText);
        setEcotrackStations([]);
        
        if (response.status === 401) {
          message.error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          message.error('You do not have permission to access EcoTrack stations.');
        } else {
          message.error(`Failed to fetch EcoTrack stations (${response.status}). Please check your connection.`);
        }
      }
    } catch (error) {
      console.error('💥 Error fetching EcoTrack stations:', error);
      setEcotrackStations([]);
      message.error(`Network error while fetching EcoTrack stations: ${error.message}`);
    } finally {
      setLoadingStations(false);
      console.log('🏁 EcoTrack stations fetch completed');
    }
  };

  const handleWilayaChange = (wilayaId) => {
    console.log('🏙️ [DEBUG] handleWilayaChange called with wilayaId:', wilayaId);
    setSelectedWilaya(wilayaId);

    if (wilayaId) {
      console.log('🏙️ [DEBUG] Valid wilaya selected, processing...');
      // Fetch baladias for the selected wilaya
      fetchBaladias(wilayaId);
      
      // Clear the baladia selection when wilaya changes
      form.setFieldsValue({ baladia_id: undefined, baladia_name: '' });
      console.log('🧹 [DEBUG] Cleared baladia fields');
      
      // Calculate delivery price based on wilaya selection only
      console.log('⏰ [DEBUG] Scheduling delivery price calculation in 100ms...');
      setTimeout(() => {
        console.log('🚀 [DEBUG] Triggering calculateDeliveryPrice from handleWilayaChange');
        calculateDeliveryPrice();
      }, 100);
      
      console.log('🚚 [DEBUG] Wilaya selected for delivery pricing:', wilayaId);
    } else {
      console.log('❌ [DEBUG] No wilaya selected, clearing related fields');
      // Clear baladias when no wilaya is selected
      setBaladias([]);
      form.setFieldsValue({ baladia_id: undefined, baladia_name: '' });
    }
  };

  // Handle auto-selection of wilaya (from Excel import or other automated processes)
  const handleAutoWilayaSelection = (wilayaId) => {
    console.log('🔄 Auto-selecting wilaya:', wilayaId);
    
    // Set the wilaya in form
    form.setFieldsValue({ wilaya_id: wilayaId });
    
    // Trigger the same logic as manual selection
    handleWilayaChange(wilayaId);
    
    console.log('✅ Auto-selected wilaya will trigger Prix de Livraison calculation');
  };

  // Handle baladia selection
  const handleBaladiaChange = (baladiaId) => {
    if (baladiaId) {
      // Find the selected baladia and set its name
      const selectedBaladia = baladias.find(b => b.id === baladiaId);
      if (selectedBaladia) {
        const baladiaName = selectedBaladia.name_en || selectedBaladia.name_fr || selectedBaladia.name_ar;
        form.setFieldsValue({ 
          baladia_id: baladiaId,
          baladia_name: baladiaName 
        });
        
        // Recalculate delivery price with baladia
        setTimeout(() => {
          calculateDeliveryPrice();
        }, 100);
        
        console.log('🏘️ Baladia selected:', baladiaName, 'ID:', baladiaId);
      }
    } else {
      form.setFieldsValue({ baladia_id: undefined, baladia_name: '' });
    }
  };

  const calculateDeliveryPrice = async () => {
    try {
      const formValues = form.getFieldsValue();
      const { wilaya_id, delivery_type, weight } = formValues;

      console.log('🚀 [DEBUG] Starting delivery price calculation...');
      console.log('🚀 [DEBUG] Form values:', formValues);
      console.log('🚀 [DEBUG] Wilaya ID:', wilaya_id);
      console.log('🚀 [DEBUG] Delivery type:', delivery_type);
      console.log('🚀 [DEBUG] Weight:', weight);

      if (!wilaya_id) {
        console.log('❌ [DEBUG] No wilaya_id found, aborting calculation');
        return;
      }

      setLoadingDeliveryPrice(true);
      console.log('📦 [DEBUG] Calculating delivery price for:', {
        wilaya_id,
        delivery_type: delivery_type || "home",
        weight: weight || 1
      });

      // Auto-calculate Prix de Livraison based on selected wilaya using proper API
      // Skip auto-calculation for "les_changes" delivery type to allow manual entry
      if (delivery_type === 'les_changes') {
        console.log('🔄 Les Changes delivery type selected - skipping auto-calculation, allowing manual price entry');
        return; // Exit early, don't auto-calculate price
      }

      const pricingData = {
        wilaya_id,
        delivery_type: delivery_type || "home",
        weight: weight || 1,
        pricing_level: "wilaya" // Always use wilaya-based pricing
      };

      console.log('📡 [DEBUG] Sending API request with data:', pricingData);
      const response = await orderService.calculateDeliveryPrice(pricingData);
      console.log('🚚 [DEBUG] Delivery price API response:', response);
      console.log('🚚 [DEBUG] Response success:', response.success);
      console.log('🚚 [DEBUG] Response data:', response.data);

      if (response.success && response.data) {
        // Handle different response formats from the API
        const deliveryPrice = response.data.price || response.data.delivery_price || 0;
        const source = response.data.source || 'unknown';
        const tarifInfo = response.data.tarif_info || {};
        
        console.log('💰 [DEBUG] Extracted delivery price:', deliveryPrice);
        console.log('🏷️ [DEBUG] Price source:', source);
        console.log('📦 [DEBUG] Delivery type:', delivery_type);
        console.log('💡 [DEBUG] Available tariffs:', tarifInfo);
        
        if (source === 'ecotrack_official_api') {
          console.log('📡 [ECOTRACK] Using OFFICIAL EcoTrack API pricing (POST method)');
          console.log(`🎯 [ECOTRACK] ${delivery_type === 'stop_desk' ? 'Stop Desk' : 'Home Delivery'} price: ${deliveryPrice} DA`);
          
          if (tarifInfo.regular && tarifInfo.stop_desk) {
            console.log(`📊 [ECOTRACK] Tariff comparison for wilaya ${wilaya_id}:`);
            console.log(`  - Regular (tarif): ${tarifInfo.regular} DA`);
            console.log(`  - Stop Desk (tarif_stopdesk): ${tarifInfo.stop_desk} DA`);
            console.log(`  - Selected: ${deliveryPrice} DA (${delivery_type === 'stop_desk' ? 'stop_desk' : 'regular'})`);
            
            const savings = delivery_type === 'stop_desk' ? (parseFloat(tarifInfo.regular) - parseFloat(tarifInfo.stop_desk)) : 0;
            if (savings > 0) {
              console.log(`💰 [ECOTRACK] Stop desk savings: ${savings} DA`);
            }
          }
        } else {
          console.log('🏠 [LOCAL] Using local pricing system');
        }
        
        // Use delivery price as received from API without validation
        console.log('✅ [DEBUG] Using original API delivery price:', deliveryPrice);
        console.log('📝 [DEBUG] Setting form field delivery_price to:', deliveryPrice);
        form.setFieldsValue({ delivery_price: deliveryPrice });
        
        // Verify field was actually set and trigger UI update
        setTimeout(() => {
          const currentValue = form.getFieldValue('delivery_price');
          console.log('🔍 [DEBUG] Form field value after setting:', currentValue);
          if (currentValue != deliveryPrice) {
            console.warn('⚠️ [DEBUG] Form field value mismatch! Retrying...');
            form.setFieldsValue({ delivery_price: deliveryPrice });
          }
        }, 25);
        
        // Update final total after delivery price is set
        setTimeout(() => {
          console.log('📊 [DEBUG] Updating final total...');
          updateFinalTotal();
        }, 100);
        
        console.log('✅ Prix de Livraison auto-calculated from API:', {
          wilaya_id,
          delivery_price: deliveryPrice
        });
      } else {
        console.warn('⚠️ API response invalid, using fallback pricing');
        // Fallback to default pricing if API fails
        const wilayaCode = wilayas.find(w => w.id == wilaya_id)?.code;
        const majorCities = ['16', '31', '25', '19', '06', '21', '23'];
        const fallbackPrice = majorCities.includes(wilayaCode) ? 400 : 600;
        form.setFieldsValue({ delivery_price: fallbackPrice });
        setTimeout(() => {
          updateFinalTotal();
        }, 100);
      }
    } catch (error) {
      console.error("Error calculating delivery price:", error);
      // Fallback pricing on error
      const formValues = form.getFieldsValue();
      const wilayaCode = wilayas.find(w => w.id == formValues.wilaya_id)?.code;
      const majorCities = ['16', '31', '25', '19', '06', '21', '23'];
      const fallbackPrice = majorCities.includes(wilayaCode) ? 400 : 600;
      form.setFieldsValue({ delivery_price: fallbackPrice });
      message.warning(t("delivery.errorCalculatingPrice") + " - Using default pricing");
    } finally {
      setLoadingDeliveryPrice(false);
    }
  };

  const handleDeliveryFieldChange = (value, fieldName) => {
    // If this is a delivery_type change, explicitly log and ensure it's set
    if (fieldName === 'delivery_type' && value) {
      console.log('🚚 Delivery type explicitly changed to:', value);
      console.log('🎯 Expected prices for delivery type change: tarif (regular) vs tarif_stopdesk (stop_desk)');
      
      setCurrentDeliveryType(value); // Update state for conditional rendering
      form.setFieldsValue({ delivery_type: value });
      
      // Clear station code if switching away from stop_desk
      if (value !== 'stop_desk') {
        form.setFieldsValue({ ecotrack_station_code: undefined });
        console.log('🧹 Cleared station code since delivery type is not stop_desk');
      } else {
        console.log('🚉 Stop desk selected - station code field will be available');
      }
      
      // For delivery type changes, recalculate immediately with priority
      console.log('🔄 Triggering immediate delivery price recalculation for type change...');
      setTimeout(() => {
        console.log(`� Recalculating delivery price for new type: ${value}`);
        console.log(`💡 Expected: ${value === 'stop_desk' ? 'tarif_stopdesk (lower price)' : 'tarif (regular price)'}`);
        calculateDeliveryPrice();
        updateFinalTotal();
      }, 50); // Reduced timeout for faster response
    } else {
      // For other fields, use normal debounce
      setTimeout(() => {
        calculateDeliveryPrice();
        updateFinalTotal();
      }, 500);
    }
  };

  // Debug function to test EcoTrack fees API integration
  const testEcoTrackFeesAPI = async () => {
    try {
      console.log('🧪 Testing EcoTrack Fees API integration via backend...');
      message.info('🧪 Testing EcoTrack Fees API...');
      
      // Test getting fees data
      const feesData = await ecoTrackFeesService.getDeliveryFees();
      console.log('✅ EcoTrack fees data received:', feesData);
      
      if (feesData && feesData.tarifs && feesData.tarifs.return) {
        // Test specific pricing using backend endpoint
        const algiersRegular = await ecoTrackFeesService.getCachedDeliveryPrice(16, 'home');
        const algiersStopDesk = await ecoTrackFeesService.getCachedDeliveryPrice(16, 'stop_desk');
        
        console.log(`📍 Algiers (16): Regular: ${algiersRegular} DA, Stop Desk: ${algiersStopDesk} DA`);
        
        message.success(`✅ EcoTrack API test successful! Algiers: Regular ${algiersRegular} DA, Stop Desk ${algiersStopDesk} DA`);
      } else {
        message.error('❌ Invalid EcoTrack API response structure');
      }
      
    } catch (error) {
      console.error('❌ EcoTrack API test failed:', error);
      message.error(`❌ EcoTrack API test failed: ${error.message}`);
    }
  };

  // Function to recalculate delivery prices for orders with suspicious pricing
  const handleBulkRecalculateDeliveryPrices = async () => {
    try {
      setLoading(true);
      message.info('🔄 Starting bulk delivery price recalculation using EcoTrack fees API...');

      // Find orders with suspicious delivery prices (delivery price = product price)
      const suspiciousOrders = allOrders.filter(order => {
        const productAmount = parseFloat(order.total_amount || 0);
        const deliveryPrice = parseFloat(order.delivery_price || 0);
        return Math.abs(deliveryPrice - productAmount) < 0.01 && order.wilaya_id;
      });

      console.log(`🔍 Found ${suspiciousOrders.length} orders with suspicious delivery prices`);

      if (suspiciousOrders.length === 0) {
        message.success('✅ No orders found with suspicious delivery prices');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const order of suspiciousOrders) {
        try {
          // Get delivery type (convert from our format to EcoTrack format)
          const deliveryType = order.delivery_type === 'stop_desk' ? 'stop_desk' : 'home';
          
          // Calculate correct delivery price using EcoTrack fees API directly
          const correctDeliveryPrice = await ecoTrackFeesService.getCachedDeliveryPrice(
            order.wilaya_id, 
            deliveryType
          );

          if (correctDeliveryPrice !== null) {
            // Update the order with correct delivery price
            await orderService.updateOrder(order.id, {
              delivery_price: correctDeliveryPrice
            });

            console.log(`✅ Updated order ${order.order_number}: ${order.delivery_price} DA → ${correctDeliveryPrice} DA`);
            successCount++;
          } else {
            console.warn(`⚠️ No delivery price found for order ${order.order_number} (wilaya ${order.wilaya_id})`);
            errorCount++;
          }

        } catch (error) {
          console.error(`❌ Failed to update order ${order.order_number}:`, error);
          errorCount++;
        }
      }

      // Refresh orders after bulk update
      await fetchOrders();

      message.success(`🎉 Bulk recalculation complete using EcoTrack fees API! ✅ ${successCount} orders updated, ❌ ${errorCount} errors`);

    } catch (error) {
      console.error('Bulk recalculation error:', error);
      message.error('❌ Failed to perform bulk recalculation');
    } finally {
      setLoading(false);
    }
  };

  // Load wilayas when component mounts
  useEffect(() => {
    fetchWilayas();
    fetchProducts();
    fetchLocations();
    fetchEcotrackStations(); // Load EcoTrack stations
  }, []);

  // Update final total when form values change
  useEffect(() => {
    updateFinalTotal();
  }, [form]);

  // Watch for wilaya_id changes and auto-calculate delivery price
  useEffect(() => {
    const wilaya_id = form.getFieldValue('wilaya_id');
    console.log('🔄 [DEBUG] useEffect triggered for wilaya_id changes');
    console.log('🔄 [DEBUG] Current wilaya_id from form:', wilaya_id);
    if (wilaya_id) {
      console.log('🔄 [DEBUG] Wilaya detected in form, auto-calculating Prix de Livraison...');
      setTimeout(() => {
        console.log('🚀 [DEBUG] Triggering calculateDeliveryPrice from useEffect');
        calculateDeliveryPrice();
      }, 200);
    } else {
      console.log('❌ [DEBUG] No wilaya_id in useEffect, skipping calculation');
    }
  }, [form.getFieldValue('wilaya_id')]);

  // Watch for delivery_type changes and auto-calculate delivery price
  useEffect(() => {
    const delivery_type = form.getFieldValue('delivery_type');
    const wilaya_id = form.getFieldValue('wilaya_id');
    console.log('🔄 [DEBUG] useEffect triggered for delivery_type changes');
    console.log('🔄 [DEBUG] Current delivery_type from form:', delivery_type);
    console.log('🔄 [DEBUG] Current wilaya_id from form:', wilaya_id);
    
    if (wilaya_id && delivery_type) {
      console.log('🔄 [DEBUG] Both wilaya and delivery type detected, recalculating price...');
      setTimeout(() => {
        console.log('🚀 [DEBUG] Triggering calculateDeliveryPrice from delivery_type useEffect');
        calculateDeliveryPrice();
      }, 200);
    }
  }, [form.getFieldValue('delivery_type')]);

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      console.log('🔄 Fetching products from API...');
      const response = await stockService.getProducts();
      console.log('✅ Products fetched from API:', response.products?.length || 0, 'products');
      setProducts(response.products || []);
    } catch (error) {
      console.error("❌ Error fetching products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchLocations = async () => {
    try {
      setLoadingLocations(true);
      console.log('🔄 Fetching locations/boutiques from API...');
      const response = await stockService.getLocations();
      console.log('✅ Locations fetched from API:', response?.length || 0, 'locations');
      setLocations(response || []);
    } catch (error) {
      console.error("❌ Error fetching locations:", error);
    } finally {
      setLoadingLocations(false);
    }
  };

  // Helper function to generate Excel variant notes
  const generateExcelVariantNotes = (productInfo, matchedProduct = null) => {
    console.log('🔍 generateExcelVariantNotes called with:', { productInfo, matchedProduct });
    
    if (!productInfo) {
      console.log('❌ No productInfo provided');
      return '';
    }
    
    // Enhanced variant extraction - check multiple possible field names
    const getVariantValue = (fieldNames) => {
      for (const fieldName of fieldNames) {
        if (productInfo[fieldName] && productInfo[fieldName].trim() !== '') {
          return productInfo[fieldName].trim();
        }
      }
      return null;
    };

    // Get the primary variant value - prioritize the 'variant' field first
    const primaryVariant = getVariantValue(['variant', 'variante']);
    
    // Return just the primary variant value, clean and simple
    if (primaryVariant) {
      console.log('✅ Found primary variant to add to notes:', primaryVariant);
      return primaryVariant;
    }
    
    // If no primary variant, check other specific fields in order of preference
    const color = getVariantValue(['color', 'couleur', 'Color', 'Couleur']);
    const size = getVariantValue(['size', 'taille', 'Size', 'Taille']);
    const model = getVariantValue(['model', 'modele', 'modèle', 'Model', 'Modèle']);
    const style = getVariantValue(['style', 'Style', 'type', 'Type']);
    
    // Return the first available specific attribute
    if (color) {
      console.log('✅ Found color variant to add to notes:', color);
      return color;
    }
    if (size) {
      console.log('✅ Found size variant to add to notes:', size);
      return size;
    }
    if (model) {
      console.log('✅ Found model variant to add to notes:', model);
      return model;
    }
    if (style) {
      console.log('✅ Found style variant to add to notes:', style);
      return style;
    }
    
    // Last fallback: check name/description
    const nameVariant = getVariantValue(['name', 'description']);
    if (nameVariant) {
      console.log('✅ Found name variant to add to notes:', nameVariant);
      return nameVariant;
    }
    
    console.log('❌ No variant information found');
    return '';
  };

  // Helper function to get the boutique of a product in an order
  const getOrderProductBoutique = (order) => {
    if (!order.product_details || !products.length) return null;
    
    try {
      // Parse product details from order
      const productDetails = typeof order.product_details === 'string' 
        ? JSON.parse(order.product_details) 
        : order.product_details;
      
      if (!productDetails || !productDetails.name) return null;
      
      // Find matching product in our database
      const matchedProduct = products.find(p => {
        if (!p.name) return false;
        
        const orderProductName = productDetails.name.toLowerCase().trim();
        const dbProductName = p.name.toLowerCase().trim();
        
        // Try exact match first
        if (dbProductName === orderProductName) return true;
        
        // Try partial matches
        if (dbProductName.includes(orderProductName) || orderProductName.includes(dbProductName)) return true;
        
        // Try normalized matching (remove special characters)
        const normalizedOrderName = orderProductName.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ');
        const normalizedDbName = dbProductName.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ');
        
        return normalizedDbName === normalizedOrderName || 
               normalizedDbName.includes(normalizedOrderName) ||
               normalizedOrderName.includes(normalizedDbName);
      });
      
      if (matchedProduct && matchedProduct.location_id) {
        // Find the location/boutique details
        const location = locations.find(loc => loc.id == matchedProduct.location_id);
        return {
          productId: matchedProduct.id,
          productName: matchedProduct.name,
          locationId: matchedProduct.location_id,
          locationName: location ? location.name : `Location ${matchedProduct.location_id}`,
          location: location
        };
      }
      
      return null;
    } catch (error) {
      console.warn('Error parsing product details for order:', order.id, error);
      return null;
    }
  };

  // Function to automatically match product by name
  const autoSelectProductByName = async (productName) => {
    if (!productName) {
      console.log('❌ No product name provided for auto-selection');
      return null;
    }

    // If products are still loading, wait a bit and retry
    if (loadingProducts || !products.length) {
      console.log('⏳ Products not loaded yet, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to reload products if they're still not available
      if (!products.length && fetchProducts) {
        console.log('🔄 Attempting to reload products from API...');
        try {
          await fetchProducts();
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error('❌ Failed to reload products:', error);
        }
      }
      
      // If still no products after waiting and reloading, return null
      if (!products.length) {
        console.log('❌ No products available for matching after API retry');
        return null;
      }
    }

    const cleanProductName = productName.trim();
    console.log(`🔍 Attempting to auto-select product via API: "${cleanProductName}"`);
    console.log(`📦 Available products from API: ${products.length}`);

    let matchedProduct = null;

    // Step 1: Try exact match (case insensitive)
    matchedProduct = products.find(p => 
      p.name && p.name.toLowerCase().trim() === cleanProductName.toLowerCase()
    );
    
    if (matchedProduct) {
      console.log('✅ Found exact match via API:', matchedProduct.name);
    } else {
      console.log('❌ No exact match found via API');
    }

    // Step 2: If no exact match, try partial match (product name contains search term)
    if (!matchedProduct) {
      matchedProduct = products.find(p => 
        p.name && p.name.toLowerCase().includes(cleanProductName.toLowerCase())
      );
      
      if (matchedProduct) {
        console.log('✅ Found partial match via API (product contains search):', matchedProduct.name);
      }
    }

    // Step 3: If still no match, try reverse partial match (search term contains product name)
    if (!matchedProduct) {
      matchedProduct = products.find(p => 
        p.name && cleanProductName.toLowerCase().includes(p.name.toLowerCase())
      );
      
      if (matchedProduct) {
        console.log('✅ Found reverse partial match via API (search contains product):', matchedProduct.name);
      }
    }

    // Step 4: Try matching without special characters and extra spaces
    if (!matchedProduct) {
      const normalizedSearchName = cleanProductName.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ');
      matchedProduct = products.find(p => {
        if (!p.name) return false;
        const normalizedProductName = p.name.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ');
        return normalizedProductName === normalizedSearchName || 
               normalizedProductName.includes(normalizedSearchName) ||
               normalizedSearchName.includes(normalizedProductName);
      });
      
      if (matchedProduct) {
        console.log('✅ Found normalized match via API:', matchedProduct.name);
      }
    }

    // Step 5: If still no match, try to search variants via API
    if (!matchedProduct) {
      console.log('🔍 No direct product match found, checking variants via API...');
      try {
        // Check if any product has variants that match
        for (const product of products) {
          if (product.id) {
            try {
              const variantResponse = await variantService.getVariantsByProduct(product.id);
              const variants = variantResponse.variants || [];
              
              const matchingVariant = variants.find(v => 
                v.variant_name && (
                  v.variant_name.toLowerCase().includes(cleanProductName.toLowerCase()) ||
                  cleanProductName.toLowerCase().includes(v.variant_name.toLowerCase())
                )
              );
              
              if (matchingVariant) {
                console.log('✅ Found matching variant via API:', matchingVariant.variant_name, 'for product:', product.name);
                matchedProduct = product;
                break;
              }
            } catch (variantError) {
              console.log('⚠️ Could not fetch variants for product:', product.name);
            }
          }
        }
      } catch (error) {
        console.warn('❌ Error checking variants via API:', error);
      }
    }

    if (matchedProduct) {
      console.log(`🎯 Auto-selecting product via API: "${matchedProduct.name}" (SKU: ${matchedProduct.sku})`);
      
      try {
        // Automatically select the matched product
        await handleProductSelection(matchedProduct.sku);
        console.log('✅ Product auto-selection via API completed successfully');
        return matchedProduct;
      } catch (error) {
        console.error('❌ Error during product auto-selection via API:', error);
        return null;
      }
    } else {
      console.log('❌ Product not found in database:', cleanProductName);
      console.log('💡 Product does not exist in our product database - skipping auto-selection');
      console.log('🔍 Available products in database:');
      products.slice(0, 10).forEach((p, index) => {
        console.log(`  ${index + 1}. "${p.name}" (SKU: ${p.sku})`);
      });
      if (products.length > 10) {
        console.log(`  ... and ${products.length - 10} more products in database`);
      }
      
      // Show a user-friendly message that the product is not in the database
      message.warning(`Product "${cleanProductName}" not found in database. Please select an existing product manually.`, 4);
    }

    return null;
  };

  // Debug function to test auto-selection (can be called from browser console)
  const testAutoSelection = async (productName) => {
    console.log('🧪 Testing auto-selection via API for:', productName);
    console.log('📡 Current products in state:', products.length);
    console.log('🔄 Loading status:', loadingProducts);
    
    const result = await autoSelectProductByName(productName);
    if (result) {
      console.log('✅ Test successful via API:', result.name, 'SKU:', result.sku);
    } else {
      console.log('❌ Test failed: No match found via API');
      console.log('💡 Suggestion: Try refreshing products via API first');
    }
    return result;
  };

  // Make test function available globally for debugging
  React.useEffect(() => {
    window.testAutoSelection = testAutoSelection;
    window.refreshProducts = fetchProducts; // Also make refresh function available
    return () => {
      delete window.testAutoSelection;
      delete window.refreshProducts;
    };
  }, [products]);

  // Function to auto-select variant from Excel import
  const autoSelectVariantFromExcel = async (productInfo) => {
    if (!productInfo) return;

    console.log('🔄 Auto-selecting variant from Excel import:', productInfo);

    const currentProductInfo = form.getFieldValue('product_info') || {};
    let variantInfo = {};
    let matchedVariant = null;

    // Extract variant information from Excel product data
    // Support both English and French/Arabic field names
    const variantMappings = {
      // Size variants
      size: productInfo.size || productInfo.taille || productInfo.variant,
      // Color variants  
      color: productInfo.color || productInfo.couleur,
      // Model variants
      model: productInfo.model || productInfo.modele || productInfo.modèle,
      // Style variants
      style: productInfo.style || productInfo.type,
      // General variant field from Excel
      variant: productInfo.variant || productInfo.variante || productInfo.product_variant
    };

    // Build variant info from available fields
    Object.keys(variantMappings).forEach(key => {
      if (variantMappings[key] && variantMappings[key].trim()) {
        variantInfo[key] = variantMappings[key].trim();
      }
    });

    // If we have a selected product, try to match variants via API
    if (selectedProduct && Object.keys(variantInfo).length > 0) {
      try {
        console.log('🔍 Searching for matching variants in store for product:', selectedProduct.sku);
        
        // Get all variants for the selected product
        const variantsResponse = await variantService.getVariantsByProduct(selectedProduct.id);
        const availableVariants = variantsResponse.data || variantsResponse.variants || [];

        if (availableVariants.length > 0) {
          // Try to match Excel variant with existing store variants
          matchedVariant = findBestVariantMatch(variantInfo, availableVariants);
          
          if (matchedVariant) {
            console.log('✅ Found matching variant in store:', matchedVariant.variant_name);
            
            // Update form with matched variant info
            variantInfo = {
              ...variantInfo,
              matched_variant_id: matchedVariant.id,
              matched_variant_name: matchedVariant.variant_name,
              matched_variant_sku: matchedVariant.sku,
              variant_price: matchedVariant.selling_price || matchedVariant.cost_price
            };
          } else {
            console.log('⚠️ No exact variant match found in store, using Excel data as-is');
          }
        } else {
          console.log('ℹ️ No variants available for this product in store');
        }
      } catch (error) {
        console.warn('Error fetching variants from API:', error);
      }
    }

    // Update form with variant information
    if (Object.keys(variantInfo).length > 0) {
      const updatedProductInfo = {
        ...currentProductInfo,
        ...variantInfo
      };

      form.setFieldsValue({
        product_info: updatedProductInfo
      });

      console.log('✅ Auto-selected variant info:', variantInfo);
      return variantInfo;
    } else {
      console.log('⚠️ No variant information found in Excel data');
      return null;
    }
  };

  // Helper function to find best variant match
  const findBestVariantMatch = (excelVariantInfo, storeVariants) => {
    const excelVariantText = Object.values(excelVariantInfo)
      .filter(val => val && typeof val === 'string')
      .join(' ')
      .toLowerCase()
      .trim();

    if (!excelVariantText) return null;

    console.log('🔍 Matching Excel variant text:', excelVariantText);
    console.log('📦 Available store variants:', storeVariants.map(v => v.variant_name));

    // Try exact match first
    let bestMatch = storeVariants.find(variant => 
      variant.variant_name && 
      variant.variant_name.toLowerCase().trim() === excelVariantText
    );

    // Try partial match if no exact match
    if (!bestMatch) {
      bestMatch = storeVariants.find(variant => 
        variant.variant_name && 
        (variant.variant_name.toLowerCase().includes(excelVariantText) ||
         excelVariantText.includes(variant.variant_name.toLowerCase()))
      );
    }

    // Try word-by-word matching
    if (!bestMatch) {
      const excelWords = excelVariantText.split(/\s+/);
      bestMatch = storeVariants.find(variant => {
        if (!variant.variant_name) return false;
        const variantWords = variant.variant_name.toLowerCase().split(/\s+/);
        return excelWords.some(excelWord => 
          variantWords.some(variantWord => 
            excelWord.includes(variantWord) || variantWord.includes(excelWord)
          )
        );
      });
    }

    return bestMatch;
  };

  const handleProductSelection = async (productSku) => {
    console.log('🔄 handleProductSelection called with SKU:', productSku);
    
    if (!productSku) {
      console.log('⚠️ No SKU provided, clearing selection');
      setSelectedProduct(null);
      setProductStock(null);
      return;
    }

    try {
      // Find product by SKU
      const product = products.find(p => p.sku === productSku);
      console.log('🔍 Looking for product with SKU:', productSku);
      console.log('📦 Total products available:', products.length);
      
      if (product) {
        console.log('✅ Found product:', product.name, 'Price:', product.selling_price);
        setSelectedProduct(product);
        setProductStock(product.current_stock);
        
        // Auto-fill product information
        const newFormValues = {
          product_info: {
            ...form.getFieldValue('product_info'),
            name: product.name,
            unit_price: product.selling_price,
            category: product.category_name || '',
            external_link: product.external_link || ''
          },
          total_amount: parseFloat(product.selling_price || 0).toFixed(2) // Set total_amount to unit price (this is now the main price field)
        };
        
        console.log('📝 Setting form values:', newFormValues);
        form.setFieldsValue(newFormValues);
        
        // Force form to re-render to update dependencies
        setTimeout(() => {
          form.setFieldsValue({
            product_info: {
              ...form.getFieldValue('product_info'),
              external_link: product.external_link || ''
            }
          });
        }, 50);
        
        // Update calculations
        setTimeout(() => updateProductTotal(), 100);
        
        console.log('✅ Product selection completed successfully');
        
        // Show stock warning if low
        if (product.current_stock <= 5) {
          message.warning(
            `${t("stock.lowStockWarning")}: ${product.current_stock} ${t("stock.units")} ${t("stock.remaining")}`
          );
        }
      } else {
        console.log('❌ Product not found with SKU:', productSku);
        console.log('🔍 Available product SKUs:', products.map(p => p.sku).slice(0, 10).join(', '));
        setSelectedProduct(null);
        setProductStock(null);
      }
    } catch (error) {
      console.error("❌ Error handling product selection:", error);
    }
  };

  const updateProductTotal = () => {
    // Get the unit price from total_amount field (which now represents unit price)
    const formValues = form.getFieldsValue();
    const quantity = parseFloat(formValues.product_info?.quantity || 0);
    const unitPrice = parseFloat(formValues.total_amount || 0);
    const productTotal = quantity * unitPrice;
    
    // Update the total_price field for internal calculations and ensure unit_price is synced
    form.setFieldsValue({
      product_info: {
        ...formValues.product_info,
        total_price: productTotal.toFixed(2),
        unit_price: unitPrice // Keep unit_price synced for backend compatibility
      }
    });

    // Update final total calculation
    updateFinalTotal();
  };

  const updateFinalTotal = () => {
    console.log('📊 [DEBUG] updateFinalTotal called');
    // Get current form values
    const formValues = form.getFieldsValue();
    console.log('📊 [DEBUG] Form values for final total:', formValues);
    const quantity = parseFloat(formValues.product_info?.quantity || 0);
    const unitPrice = parseFloat(formValues.total_amount || 0); // total_amount now represents unit price
    const productTotal = quantity * unitPrice;
    const deliveryPrice = parseFloat(formValues.delivery_price || 0);
    const calculatedFinalTotal = productTotal + deliveryPrice;
    
    console.log('📊 [DEBUG] Final total calculation:');
    console.log('  - Quantity:', quantity);
    console.log('  - Unit Price (total_amount):', unitPrice);
    console.log('  - Product Total:', productTotal);
    console.log('  - Delivery Price:', deliveryPrice);
    console.log('  - Final Total:', calculatedFinalTotal);
    
    // Update final total state
    setFinalTotal(calculatedFinalTotal);
    console.log('📊 [DEBUG] Final total state updated to:', calculatedFinalTotal);
  };

  // Initialize Google Sheets configuration
  const initializeGoogleSheets = async () => {
    try {
      // Check Google authentication status
      const authStatus = await googleAuthService.getAuthStatus();
      setGoogleAuthStatus(authStatus);
      
      if (authStatus.isAuthenticated) {
        // Load Google Sheets configuration from localStorage or API
        const savedConfig = localStorage.getItem('googleSheetsConfig');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);
          setGoogleSheetsConfig(config);
          setGoogleSheetsEnabled(config.enabled || false);
        }
      }
    } catch (error) {
      console.error('Failed to initialize Google Sheets:', error);
      setGoogleAuthStatus({ isAuthenticated: false });
    }
  };

  // Update order status in Google Sheets
  const updateOrderStatusInGoogleSheets = async (orderNumber, newStatus) => {
    console.log('🔍 Google Sheets Update Check:', {
      orderNumber,
      newStatus
    });

    try {
      // Find the order to get its source spreadsheet information
      const order = allOrders.find(o => o.order_number === orderNumber);
      
      if (!order) {
        console.log('⚠️ Order not found for Google Sheets update');
        return { success: false, message: 'Order not found' };
      }

      // Check if this order has source Google Sheets information
      if (!order.source_spreadsheet_id) {
        console.log('⚠️ Order has no source Google Sheets information - skipping update');
        return { success: false, message: 'Order not from Google Sheets' };
      }

      console.log(`📊 Automatically updating order ${orderNumber} status to ${newStatus} in source Google Sheet...`);
      console.log(`🎯 Target: Spreadsheet ${order.source_spreadsheet_id}, Sheet: ${order.source_sheet_name}`);
      
      const result = await googleAuthService.updateOrderStatusInSheet(
        order.source_spreadsheet_id,
        orderNumber,
        newStatus,
        order.source_sheet_name || 'Sheet1'
      );

      if (result.success) {
        console.log(`✅ Successfully updated Google Sheets for order ${orderNumber}`);
        message.success(`Order status updated in source Google Sheet: ${order.source_file_name}`);
      } else {
        console.warn(`⚠️ Failed to update Google Sheets: ${result.message}`);
        message.warning(`Could not update Google Sheets: ${result.message}`);
      }

      return result;
    } catch (error) {
      console.error('Error updating Google Sheets:', error);
      message.warning('Failed to update Google Sheets');
      return { success: false, message: error.message };
    }
  };

  // Manual sync all orders with Google Sheets
  const handleManualSyncAllOrders = async () => {
    try {
      setLoading(true);
      
      console.log(`🔍 Manual sync: Checking ${allOrders.length} total orders for source tracking`);
      
      // Debug: Log orders structure to see what data we have
      if (allOrders.length > 0) {
        const sampleOrder = allOrders[0];
        console.log('📋 Sample order structure:', {
          id: sampleOrder.id,
          order_number: sampleOrder.order_number,
          status: sampleOrder.status,
          status_type: typeof sampleOrder.status,
          all_status_fields: Object.keys(sampleOrder).filter(key => key.toLowerCase().includes('status')),
          has_source_spreadsheet_id: !!sampleOrder.source_spreadsheet_id,
          has_source_sheet_name: !!sampleOrder.source_sheet_name,
          has_source_file_name: !!sampleOrder.source_file_name,
          source_info: {
            spreadsheet_id: sampleOrder.source_spreadsheet_id,
            sheet_name: sampleOrder.source_sheet_name,
            file_name: sampleOrder.source_file_name
          }
        });
      }
      
      // Get all orders that have source tracking information
      const ordersWithSource = allOrders.filter(order => 
        order.source_spreadsheet_id && 
        order.source_sheet_name && 
        order.order_number
      );

      // Enhanced debugging information
      const ordersWithPartialSource = allOrders.filter(order => 
        order.source_spreadsheet_id || 
        order.source_sheet_name || 
        order.source_file_name
      );

      console.log(`📊 Source tracking analysis:`, {
        total_orders: allOrders.length,
        orders_with_complete_source: ordersWithSource.length,
        orders_with_partial_source: ordersWithPartialSource.length,
        orders_without_source: allOrders.length - ordersWithPartialSource.length
      });

      if (ordersWithSource.length === 0) {
        // Show more helpful message with details
        if (ordersWithPartialSource.length > 0) {
          message.warning(t("orders.partialSourceTracking", { 
            partial: ordersWithPartialSource.length,
            total: allOrders.length
          }));
        } else {
          message.info(t("orders.noOrdersToSync"));
        }
        
        // Show suggestion for testing
        message.info(t("orders.syncSuggestion"), 6);
        return;
      }

      console.log(`🔄 Manual sync: Found ${ordersWithSource.length} orders with complete source tracking`);
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Process orders in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < ordersWithSource.length; i += batchSize) {
        const batch = ordersWithSource.slice(i, i + batchSize);
        
        console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(ordersWithSource.length/batchSize)}: ${batch.length} orders`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (order) => {
          try {
            console.log(`🔄 Syncing order: ${order.order_number} -> ${order.status} (type: ${typeof order.status})`);
            console.log(`📝 Order status field debug:`, {
              status: order.status,
              order_status: order.order_status,
              delivery_status: order.delivery_status,
              payment_status: order.payment_status,
              available_fields: Object.keys(order).filter(key => key.toLowerCase().includes('status'))
            });
            const result = await updateOrderStatusInGoogleSheets(order.order_number, order.status);
            if (result.success) {
              successCount++;
              console.log(`✅ Success: ${order.order_number}`);
            } else {
              errorCount++;
              errors.push(`${order.order_number}: ${result.message}`);
              console.warn(`❌ Failed: ${order.order_number} - ${result.message}`);
            }
          } catch (error) {
            errorCount++;
            errors.push(`${order.order_number}: ${error.message}`);
            console.error(`💥 Error: ${order.order_number} - ${error.message}`);
          }
        });

        await Promise.all(batchPromises);
        
        // Add a small delay between batches to be respectful to the API
        if (i + batchSize < ordersWithSource.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Show results
      if (successCount > 0 && errorCount === 0) {
        message.success(t("orders.manualSyncSuccess", { count: successCount }));
      } else if (successCount > 0 && errorCount > 0) {
        message.warning(t("orders.manualSyncPartial", { success: successCount, errors: errorCount }));
      } else {
        message.error(t("orders.manualSyncFailed", { errors: errorCount }));
      }

      // Log errors for debugging
      if (errors.length > 0) {
        console.warn('Manual sync errors:', errors);
      }

    } catch (error) {
      console.error('Manual sync error:', error);
      message.error(t("orders.manualSyncError"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (values) => {
    try {
      console.log('🆕 [DEBUG] handleCreateOrder called with values:', values);
      
      // Use delivery price as provided from API/database, no validation
      let deliveryPrice = parseFloat(values.delivery_price || 0);
      const totalAmount = parseFloat(values.total_amount || 0);
      
      console.log('💰 [DEBUG] Using original delivery price from API:', deliveryPrice);
      console.log('💰 [DEBUG] Total amount:', totalAmount);
      
      // Extract quantity from product_info
      const quantity = values.product_info?.quantity ? parseInt(values.product_info.quantity) : 1;
      
      // Calculate final total with quantity
      const unitPrice = parseFloat(values.total_amount || 0);
      const productTotal = unitPrice * quantity;
      const calculatedFinalTotal = productTotal + deliveryPrice;
      
      console.log(`🧮 [CREATE] Calculating final_total with quantity: ${unitPrice} × ${quantity} + ${deliveryPrice} = ${calculatedFinalTotal}`);
      
      // Transform product_info to product_details JSON string
      const orderData = {
        ...values,
        delivery_price: deliveryPrice, // Use auto-calculated delivery price
        final_total: calculatedFinalTotal,
        product_details: values.product_info ? JSON.stringify(values.product_info) : "",
        quantity: quantity, // Add quantity as separate field
        quantity_ordered: quantity // Also add as quantity_ordered for backward compatibility
      };

      // Remove the nested product_info since we've converted it to product_details
      delete orderData.product_info;
      
      console.log('📊 [DEBUG] Order data with quantity:', {
        quantity: quantity,
        quantity_ordered: quantity,
        product_info: values.product_info
      });
      
      console.log('📝 Creating order with validated data:', {
        total_amount: totalAmount,
        delivery_price: deliveryPrice,
        final_total: calculatedFinalTotal,
        quantity: quantity,
        wilaya_id: values.wilaya_id
      });

      await orderService.createOrder(orderData);
      message.success(t("orders.createSuccess"));
      setModalVisible(false);
      setCurrentDeliveryType('home'); // Reset delivery type state
      form.resetFields();
      fetchOrders();
      fetchOrdersWithProducts(); // Refresh product data too
    } catch (error) {
      console.error('Order creation error:', error);
      message.error(t("orders.createError"));
    }
  };

  const handleUpdateOrder = async (values) => {
    try {
      // Use delivery price as provided from API/database, no validation  
      let deliveryPrice = parseFloat(values.delivery_price || 0);
      const totalAmount = parseFloat(values.total_amount || 0);
      
      console.log('� [DEBUG] Using original delivery price from API:', deliveryPrice);
      
      const finalTotal = totalAmount + deliveryPrice;
      
      // Extract quantity from product_info
      const quantity = values.product_info?.quantity ? parseInt(values.product_info.quantity) : 1;
      console.log('📊 [DEBUG] Update order - extracted quantity:', quantity, 'from product_info:', values.product_info);
      
      // Recalculate final_total with new quantity
      const unitPrice = parseFloat(values.total_amount || 0);
      const productTotal = unitPrice * quantity;
      const recalculatedFinalTotal = productTotal + deliveryPrice;
      
      console.log(`🧮 [UPDATE] Recalculating final_total with quantity: ${unitPrice} × ${quantity} + ${deliveryPrice} = ${recalculatedFinalTotal}`);

      // Transform product_info to product_details JSON string
      const orderData = {
        ...values,
        delivery_price: deliveryPrice, // Use auto-calculated delivery price
        notes: values.notes || '', // Keep notes as is without adding variant info
        final_total: recalculatedFinalTotal, // Use recalculated final_total with quantity
        product_details: values.product_info ? JSON.stringify(values.product_info) : "",
        quantity: quantity, // Add quantity as separate field
        quantity_ordered: quantity // Also add as quantity_ordered for backward compatibility
      };

      // Remove the nested product_info since we've converted it to product_details
      delete orderData.product_info;
      
      console.log('📝 Updating order with validated data:', {
        total_amount: totalAmount,
        delivery_price: deliveryPrice,
        final_total: finalTotal,
        wilaya_id: values.wilaya_id
      });

      await orderService.updateOrder(editingOrder.id, orderData);
      message.success(t("orders.updateSuccess"));
      setModalVisible(false);
      setEditingOrder(null);
      setCurrentDeliveryType('home'); // Reset delivery type state
      form.resetFields();
      fetchOrders();
      fetchOrdersWithProducts(); // Refresh product data too
    } catch (error) {
      console.error('Order update error:', error);
      message.error(t("orders.updateError"));
    }
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await orderService.deleteOrder(orderId);
      message.success(t("orders.deleteSuccess"));
      fetchOrders();
      fetchOrdersWithProducts(); // Refresh product data too
    } catch (error) {
      message.error(t("orders.deleteError"));
    }
  };

  const handleAssignOrder = async (orderId, assignedTo) => {
    try {
      if (assignedTo === "" || assignedTo === null || assignedTo === "null") {
        // Handle unassign case - use the regular update endpoint to set assigned_to to null
        await orderService.updateOrder(orderId, { assigned_to: null });
        message.success(t("orders.unassignSuccess"));
      } else {
        await orderService.assignOrder(orderId, assignedTo);
        message.success(t("orders.assignSuccess"));
      }
      fetchOrders();
    } catch (error) {
      message.error(t("orders.assignError"));
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      console.log(`🔄 Status change initiated: Order ${orderId} -> ${newStatus}`);
      // Optimistic UI: update local state immediately
      setUpdatingStatusId(orderId);
      const prevOrders = allOrders;
      setAllOrders(allOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      
      // Special handling for cancelled orders with EcoTrack tracking
      if (newStatus === 'cancelled') {
        const order = allOrders.find(o => o.id === orderId);
        
        console.log(`🔍 Checking order for Ecotrack deletion before cancellation:`, {
          orderId,
          order: order ? 'Found' : 'Not found',
          ecotrack_tracking_id: order?.ecotrack_tracking_id,
          hasEcotrackId: !!order?.ecotrack_tracking_id
        });
        
        // If order has EcoTrack tracking ID, try to delete from EcoTrack first
        if (order && order.ecotrack_tracking_id) {
          console.log(`🗑️ Order has EcoTrack tracking - attempting delete before status change`);
          
          try {
            // Call backend EcoTrack delete API
            const deleteResponse = await fetch('/api/ecotrack/delete-order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                trackingId: order.ecotrack_tracking_id,
                orderId: order.id,
                reason: 'Order cancelled by user'
              })
            });

            if (!deleteResponse.ok) {
              const errorData = await deleteResponse.json();
              console.error(`❌ EcoTrack deletion failed (${deleteResponse.status}):`, errorData);
              
              // For 422 errors, show specific message and don't change status
              if (deleteResponse.status === 422) {
                message.error(`Cannot cancel order: ${errorData.message || 'EcoTrack validation error'}`);
                return; // Don't change status if EcoTrack deletion fails
              } else {
                message.error(`Cannot cancel order: EcoTrack API error (${deleteResponse.status}). Please try again later.`);
                return; // Don't change status if EcoTrack deletion fails
              }
            } else {
              const deleteResult = await deleteResponse.json();
              console.log(`✅ Successfully deleted from EcoTrack and status updated automatically:`, deleteResult);
              message.success('Order cancelled and removed from EcoTrack tracking system');
              
              // Backend has already updated the status, so we don't need to do it manually
              // Just refresh the data once and return early
              refreshOrdersOnce('cancelled-after-ecotrack-delete');
              return;
            }
          } catch (ecotrackError) {
            console.error('Error during EcoTrack deletion:', ecotrackError);
            message.error(`Cannot cancel order: EcoTrack deletion failed - ${ecotrackError.message}`);
            return; // Don't change status if EcoTrack deletion fails
          }
        }
      }
      
      // Now update the order status (either for non-cancelled orders, or for cancelled orders after successful EcoTrack deletion)
  const response = await orderService.updateOrder(orderId, { status: newStatus });
      console.log(`✅ Status change response:`, response);
      
      // Show success message
      if (newStatus === 'cancelled') {
        message.success(`${t("orders.statusUpdateSuccess")} - Order cancelled successfully`);
      } else {
        message.success(t("orders.statusUpdateSuccess"));
      }
      
      // Get order details for Google Sheets update
      const order = allOrders.find(o => o.id === orderId);
      const orderNumber = order?.order_number;
      
      // Update status in Google Sheets (async, don't block the main flow)
      if (orderNumber) {
        updateOrderStatusInGoogleSheets(orderNumber, newStatus).catch(error => {
          console.error('Google Sheets update failed:', error);
          // Don't show error to user, just log it
        });
      }
      
  // Handle stock deduction for delivered orders
      if (newStatus === 'delivered') {
        const order = allOrders.find(o => o.id === orderId);
        if (order && order.product_details) {
          try {
            const productDetails = typeof order.product_details === 'string' 
              ? JSON.parse(order.product_details) 
              : order.product_details;
            
            if (productDetails.sku && productDetails.quantity) {
              // Find the product by SKU
              const product = products.find(p => p.sku === productDetails.sku);
              if (product) {
                const quantityToDeduct = parseInt(productDetails.quantity) || 1;
                
                // Check if stock was already deducted (when order was confirmed)
                // We'll check if the order was previously in a "processing" state
                // If it was already confirmed/processing, stock might have been deducted
                const wasAlreadyProcessed = order.status === 'confirmed' || 
                                          order.status === 'processing' || 
                                          order.status === 'out_for_delivery';
                
                if (!wasAlreadyProcessed) {
                  const newStock = Math.max(0, product.current_stock - quantityToDeduct);
                  
                  // Update product stock
                  await stockService.updateProduct(product.id, {
                    current_stock: newStock
                  });
                  
                  message.success(
                    `${t("orders.statusUpdateSuccess")} - ${t("stock.stockUpdated")}: ${product.name} (${quantityToDeduct} ${t("stock.units")} ${t("stock.deducted")})`
                  );
                  
                  // Refresh products list
                  fetchProducts();
                } else {
                  // Stock was already deducted during confirmation/processing
                  message.success(
                    `${t("orders.statusUpdateSuccess")} - ${t("stock.stockAlreadyDeducted")}`
                  );
                }
              }
            }
          } catch (error) {
            console.error("Error updating stock:", error);
            message.warning(t("stock.stockUpdateError"));
          }
        }
      } 
      // Handle stock deduction for confirmed orders (when they enter processing pipeline)
      else if (newStatus === 'confirmed') {
        console.log(`📦 Processing confirmed status for order ${orderId}`);
        const order = allOrders.find(o => o.id === orderId);
        console.log(`📋 Found order:`, order);
        
        if (order && order.product_details) {
          try {
            const productDetails = typeof order.product_details === 'string' 
              ? JSON.parse(order.product_details) 
              : order.product_details;
            
            if (productDetails.sku && productDetails.quantity) {
              // Find the product by SKU
              const product = products.find(p => p.sku === productDetails.sku);
              if (product) {
                const quantityToDeduct = parseInt(productDetails.quantity) || 1;
                
                // Only deduct if order was previously in pending status
                if (order.status === 'pending') {
                  const newStock = Math.max(0, product.current_stock - quantityToDeduct);
                  
                  // Update product stock
                  await stockService.updateProduct(product.id, {
                    current_stock: newStock
                  });
                  
                  message.success(
                    `📦 ${t("orders.confirmedAndStockDeducted")}: ${product.name} (${quantityToDeduct} ${t("stock.units")} ${t("stock.reserved")})`
                  );
                  
                  // Refresh products list
                  fetchProducts();
                }
              }
            }
          } catch (error) {
            console.error("Error updating stock on confirmation:", error);
            message.warning(t("stock.stockUpdateError"));
          }
        }
        
        // Show Ecotrack info
        // console.log(`🚚 Showing Ecotrack confirmation message for order ${orderId}`);
        // message.info('📦 Order confirmed! Ecotrack shipment will be created automatically.', 4);
        
        // Refresh orders after a short delay to get updated tracking info
        console.log(`🔄 Scheduling order refresh in 2 seconds...`);
        setTimeout(() => {
          console.log(`🔄 Refreshing orders to get Ecotrack data...`);
          refreshOrdersOnce('confirmed-delayed-refresh');
        }, 2000);
      } else {
        // Show success message for other status changes
        message.success(t("orders.statusUpdateSuccess"));
        // Light refresh in background; UI already optimistic
        refreshOrdersOnce('status-change-success');
      }
    } catch (error) {
      message.error(t("orders.statusUpdateError"));
      // Rollback optimistic change
      refreshOrdersOnce('status-change-error-rollback');
    }
    finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDistributeOrders = async (algorithm = null) => {
    try {
      setDistributionLoading(true);

      // If algorithm is provided (from modal), use it with default settings
      let settings;
      if (algorithm) {
        settings = {
          algorithm: algorithm,
          maxOrdersPerUser: 10,
          considerWorkload: true,
          considerPerformance: algorithm === "performance_based",
          priorityRules: [],
        };
      } else {
        // Use existing distribution settings for other cases
        settings = distributionSettings;
      }

      const response = await orderService.distributeOrders(settings);
      message.success(
        t("orders.distributeSuccess", { count: response.distributed })
      );
      fetchOrders();

      // Reset algorithm selection after successful distribution
      setSelectedAlgorithm("");
    } catch (error) {
      message.error(t("orders.distributeError"));
    } finally {
      setDistributionLoading(false);
    }
  };

  const handleQuickDistribute = () => {
    // Open distribution settings modal instead of immediate distribution
    setDistributionModalVisible(true);
  };

  const handleAdvancedDistribute = () => {
    setDistributionModalVisible(true);
  };

  const handleDistributionSubmit = (values) => {
    setDistributionSettings(values);
    handleDistributeOrders(values);
  };

  // Multi-selection handlers
  const handleRowSelectionChange = React.useCallback((keys /* selectedRowKeys */) => {
    if (isDev) console.log('🔲 Selected rows changed:', { selectedRowKeys: keys });
    setSelectedRowKeys(keys);
  }, [isDev]);

  // Compute selected orders lazily from keys to avoid heavy state writes
  const selectedOrdersMemo = React.useMemo(() => {
    if (!Array.isArray(selectedRowKeys) || selectedRowKeys.length === 0) return [];
    const map = new Map((derivedFilteredOrders || []).map(o => [o.id, o]));
    return selectedRowKeys.map(id => map.get(id)).filter(Boolean);
  }, [selectedRowKeys, derivedFilteredOrders]);

  // Replace old state usage
  const selectedOrders = selectedOrdersMemo;

  const handleSelectAll = () => {
    const allRowKeys = derivedFilteredOrders.map(order => order.id);
    setSelectedRowKeys(allRowKeys);
    message.info(t('orders.selectedAllOrders', { count: derivedFilteredOrders.length }));
  };

  const handleClearSelection = () => {
    setSelectedRowKeys([]);
    // message.info(t('orders.selectionCleared'));
  };

  // Bulk assignment function
  const handleBulkAssign = async () => {
    if (!bulkAssignedTo || selectedRowKeys.length === 0) {
      message.warning(t('orders.selectOrdersAndAssignee') || 'Please select orders and an assignee');
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;

      // Process assignments in batches
      for (const orderId of selectedRowKeys) {
        try {
          await orderService.assignOrder(orderId, bulkAssignedTo);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to assign order ${orderId}:`, error);
        }
      }

      // Show results
      if (successCount > 0) {
        message.success(`Successfully assigned ${successCount} orders`);
      }
      if (errorCount > 0) {
        message.error(`Failed to assign ${errorCount} orders`);
      }

      // Refresh orders and clear selection
      await fetchOrders();
      setSelectedRowKeys([]);
      setBulkAssignedTo(null);
    } catch (error) {
      message.error('Failed to perform bulk assignment');
    } finally {
      setLoading(false);
    }
  };

  // Bulk unassign function
  const handleBulkUnassign = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('orders.selectOrdersToUnassign') || 'Please select orders to unassign');
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;

      // Process unassignments in batches
      for (const orderId of selectedRowKeys) {
        try {
          await orderService.updateOrder(orderId, { assigned_to: null });
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to unassign order ${orderId}:`, error);
        }
      }

      // Show results
      if (successCount > 0) {
        message.success(`Successfully unassigned ${successCount} orders`);
      }
      if (errorCount > 0) {
        message.error(`Failed to unassign ${errorCount} orders`);
      }

      // Refresh orders and clear selection
      await fetchOrders();
      setSelectedRowKeys([]);
    } catch (error) {
      message.error('Failed to perform bulk unassignment');
    } finally {
      setLoading(false);
    }
  };

  // Bulk send to delivery function
  const handleBulkSendToDelivery = () => {
    if (selectedOrders.length === 0) {
      message.warning(t('orders.noOrdersSelected'));
      return;
    }

    // Filter orders that can be sent to delivery (confirmed status)
    const eligibleOrders = selectedOrders.filter(order => order.status === 'confirmed');
    
    if (eligibleOrders.length === 0) {
      message.warning(t('orders.noEligibleOrdersForDelivery'));
      return;
    }

    if (eligibleOrders.length !== selectedOrders.length) {
      message.warning(t('orders.someOrdersNotEligible', { 
        eligible: eligibleOrders.length, 
        total: selectedOrders.length 
      }));
    }

    setBulkDeliveryModalVisible(true);
  };

  const executeBulkSendToDelivery = async () => {
    try {
      setBulkSendToDeliveryLoading(true);

      const eligibleOrders = selectedOrders.filter(order => order.status === 'confirmed');
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const order of eligibleOrders) {
        try {
          console.log(`🚚 Processing order ${order.id} for delivery...`);
          console.log(`📋 Order data available:`, {
            id: order.id,
            order_number: order.order_number,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            customer_address: order.customer_address,
            address: order.address,
            customer_city: order.customer_city,
            city: order.city,
            baladia_name: order.baladia_name,
            wilaya_id: order.wilaya_id,
            total_amount: order.total_amount,
            notes: order.notes,
            remarks: order.remarks
          });
          
          // Prepare order data for EcoTrack
          const ecotrackData = {
            reference: order.order_number || `ORDER-${order.id}`,
            client: order.customer_name || 'Client',
            phone: order.customer_phone?.replace(/\D/g, '').substring(0, 10) || '0000000000',
            adresse: order.customer_address || order.address || 'Adresse non spécifiée',
            wilaya_id: order.wilaya_id || 16, // Default to Algiers if not set
            commune: validateCommuneForEcotrack(order.baladia_name || order.customer_city || ''),
            montant: (() => {
              console.log(`💰 [BULK] Calculating montant for order ${order.id}...`);
              
              // Try the main calculation first
              let calculatedMontant;
              try {
                calculatedMontant = calculateCorrectTotalFinal(order);
                console.log(`💰 [BULK] Order ${order.id} - main calculation result:`, calculatedMontant);
              } catch (error) {
                console.error(`❌ [BULK] Order ${order.id} - main calculation failed:`, error);
                calculatedMontant = null;
              }
              
              // If main calculation failed or returned invalid value, use fallback
              if (!calculatedMontant || calculatedMontant === 0 || isNaN(calculatedMontant)) {
                console.warn(`⚠️ [BULK] Order ${order.id} - using fallback calculation`);
                
                const totalAmount = parseFloat(order.total_amount || 0);
                const quantity = parseFloat(order.quantity || order.quantity_ordered || 1);
                const deliveryPrice = parseFloat(order.delivery_price || 0);
                const finalTotal = parseFloat(order.final_total || 0);
                
                console.log(`🔢 [BULK] Fallback data for order ${order.id}:`, {
                  totalAmount, quantity, deliveryPrice, finalTotal
                });
                
                // Try final_total first, then calculate from components
                if (finalTotal > 0) {
                  calculatedMontant = finalTotal;
                  console.log(`✅ [BULK] Using final_total: ${calculatedMontant}`);
                } else if (totalAmount > 0) {
                  calculatedMontant = (totalAmount * quantity) + deliveryPrice;
                  console.log(`✅ [BULK] Calculated from components: ${totalAmount} × ${quantity} + ${deliveryPrice} = ${calculatedMontant}`);
                } else {
                  // Last resort - use 0 if no data available
                  calculatedMontant = 0;
                  console.log(`⚠️ [BULK] Using zero montant (no valid data): ${calculatedMontant}`);
                }
              }
              
              const finalMontant = calculatedMontant || 0; // Allow 0 values
              console.log(`💰 [BULK] Final montant for order ${order.id}: ${finalMontant} DA`);
              return finalMontant;
            })(), // Use frontend Total calculation with robust fallback
            total_amount: order.total_amount, // Send individual amounts for backend calculation
            delivery_price: order.delivery_price,
            product_details: order.product_details, // Include full product details for variant extraction
            remarque: order.notes || order.remarks || '',
            produit: order.product_details ? 
              (typeof order.product_details === 'string' ? 
                JSON.parse(order.product_details).name : 
                order.product_details.name) || 'Produit' : 'Produit',
            type_id: 1, // Standard delivery
            poids: 1, // Default weight
            stop_desk: 1, // Stop desk delivery (updated as requested)
            station_code: order.ecotrack_station_code || '', // Use selected station code
            stock: 0,
            can_open: 0
          };
          
          console.log(`💰 EcoTrack Total Final Amount Calculation for Order ${order.id}:`, {
            original_product_amount: parseFloat(order.total_amount) || 0,
            original_delivery_price: parseFloat(order.delivery_price) || 0,
            original_total_would_be: (parseFloat(order.total_amount) || 0) + (parseFloat(order.delivery_price) || 0),
            corrected_total_final_sent: ecotrackData.montant,
            corruption_detected: (parseFloat(order.delivery_price) || 0) === (parseFloat(order.total_amount) || 0),
            product_details_available: !!order.product_details,
            verification: `Sending ${ecotrackData.montant} DA to EcoTrack`,
            product_details_summary: order.product_details ? 
              (() => {
                try {
                  const pd = typeof order.product_details === 'string' ? JSON.parse(order.product_details) : order.product_details;
                  return {
                    name: pd.name,
                    unit_price: pd.unit_price,
                    quantity: pd.quantity,
                    variant: pd.variant || pd.variante || pd.size || pd.color || 'none'
                  };
                } catch (e) {
                  return 'parsing_error';
                }
              })() : 'no_product_details'
          });
          
          // Calculate correct Total Final for EcoTrack - only fix obvious corruption
          // Simple function to calculate total for EcoTrack (same logic as Total column)
          function calculateCorrectTotalFinal(order) {
            console.log(`🧮 [ECOTRACK] Calculating total for order ${order.order_number || order.id}...`);
            console.log(`🧮 [ECOTRACK] Input data:`, {
              total_amount: order.total_amount,
              delivery_price: order.delivery_price,
              final_total: order.final_total,
              product_details: order.product_details,
              quantity: order.quantity,
              quantity_ordered: order.quantity_ordered
            });
            
            // Check if we have a pre-calculated final_total from the edit form
            const storedFinalTotal = parseFloat(order.final_total || 0);
            
            if (storedFinalTotal > 0) {
              console.log(`📝 [ECOTRACK] Using stored final_total: ${storedFinalTotal} DA`);
              return storedFinalTotal;
            }
            
            // Extract quantity and calculate product total (same logic as Total column)
            let quantity = 1;
            let unitPrice = 0;
            let productTotal = 0;
            
            // Try to get quantity from multiple sources
            if (order.quantity && order.quantity > 0) {
              quantity = parseFloat(order.quantity);
              console.log(`📊 [ECOTRACK] Using order.quantity: ${quantity}`);
            } else if (order.quantity_ordered && order.quantity_ordered > 0) {
              quantity = parseFloat(order.quantity_ordered);
              console.log(`📊 [ECOTRACK] Using order.quantity_ordered: ${quantity}`);
            } else if (order.product_details) {
              try {
                const details = typeof order.product_details === 'string' 
                  ? JSON.parse(order.product_details) 
                  : order.product_details;
                quantity = parseFloat(details.quantity || 1);
                console.log(`📊 [ECOTRACK] Using product_details.quantity: ${quantity}`);
                
                // If we have unit price in product details, use it
                if (details.unit_price) {
                  unitPrice = parseFloat(details.unit_price);
                  productTotal = unitPrice * quantity;
                  console.log(`📊 [ECOTRACK] Using unit_price from product_details: ${unitPrice} DA × ${quantity} = ${productTotal} DA`);
                }
              } catch (e) {
                console.log(`⚠️ [ECOTRACK] Failed to parse product_details for order ${order.id}`);
                quantity = 1;
              }
            }
            
            // If we don't have unit price from product details, treat total_amount as unit price
            if (unitPrice === 0) {
              unitPrice = parseFloat(order.total_amount || 0);
              productTotal = unitPrice * quantity;
              console.log(`💰 [ECOTRACK] CRITICAL: Using total_amount as unit price: ${unitPrice} DA × ${quantity} = ${productTotal} DA`);
              console.log(`💰 [ECOTRACK] This should be: ${unitPrice} × ${quantity} = ${productTotal} (expecting ${2800 * 3} for correct calculation)`);
            }
            
            // Add delivery price
            const deliveryPrice = parseFloat(order.delivery_price || 0);
            const finalTotal = productTotal + deliveryPrice;
            
            console.log(`📊 [ECOTRACK] Final calculation: ${productTotal} DA (product) + ${deliveryPrice} DA (delivery) = ${finalTotal} DA`);
            console.log(`📊 [ECOTRACK] Expected for quantity ${quantity}: ${unitPrice} × ${quantity} + ${deliveryPrice} = ${(unitPrice * quantity) + deliveryPrice} DA`);
            
            // Ensure we always return a valid number
            const validFinalTotal = isNaN(finalTotal) || finalTotal <= 0 ? (unitPrice + deliveryPrice) : finalTotal;
            console.log(`📊 [ECOTRACK] Returning final total: ${validFinalTotal} DA`);
            
            return validFinalTotal;
          }
          
          // Function to validate commune for EcoTrack
          function validateCommuneForEcotrack(communeName) {
            if (!communeName || typeof communeName !== 'string') {
              return '';
            }
            
            const cleaned = communeName.trim();
            
            // Skip if it's generic text
            if (cleaned.includes('non spécifiée') || 
                cleaned.includes('Unknown') ||
                cleaned === 'Commune non spécifiée') {
              return '';
            }
            
            // Remove all apostrophes and clean the text
            const withoutApostrophes = cleaned.replace(/['`'']/g, '');
            
            // Common problematic commune names and their EcoTrack equivalents (without apostrophes)
            const communeMapping = {
              'sidi mhamed': 'Sidi Mhamed',
              'sidi m hamed': 'Sidi Mhamed',
              'alger centre': 'Alger-Centre',
              'hussein dey': 'Hussein Dey',
              'bab el oued': 'Bab El Oued',
              'el harrach': 'El Harrach',
              'bir mourad rais': 'Bir Mourad Rais',
              'el mouradia': 'El Mouradia',
              'casbah': 'La Casbah'
            };
            
            const lowerCleaned = withoutApostrophes.toLowerCase();
            
            // Check if we have a mapping for this commune
            if (communeMapping[lowerCleaned]) {
              console.log(`🔄 Mapping commune: "${cleaned}" -> "${communeMapping[lowerCleaned]}" (apostrophes removed)`);
              return communeMapping[lowerCleaned];
            }
            
            // For unmapped communes, format and remove apostrophes
            const formatted = withoutApostrophes
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ')
              .trim();
            
            // If it looks suspicious, return empty string
            if (formatted.length < 3 || formatted.length > 50) {
              console.log(`⚠️ Suspicious commune name, using empty: "${formatted}"`);
              return '';
            }
            
            if (withoutApostrophes !== cleaned) {
              console.log(`🔄 Removed apostrophes from commune: "${cleaned}" -> "${formatted}"`);
            }
            
            return formatted;
          }

          // Validate required fields before sending
          const requiredFields = ['reference', 'client', 'adresse', 'montant'];
          const missingFields = requiredFields.filter(field => {
            const value = ecotrackData[field];
            if (field === 'montant') {
              // For montant, only reject if it's null, undefined, empty string, or NaN
              // Allow 0 as a valid value
              return value === null || value === undefined || value === '' || isNaN(value);
            }
            return !value || value === '';
          });
          
          if (missingFields.length > 0) {
            console.error(`❌ Missing required fields for order ${order.id}:`, missingFields);
            console.error(`❌ EcoTrack data for order ${order.id}:`, ecotrackData);
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }

          console.log(`📋 Sending order ${order.id} to EcoTrack with data:`, {
            reference: ecotrackData.reference,
            client: ecotrackData.client,
            phone: ecotrackData.phone,
            adresse: ecotrackData.adresse,
            wilaya_id: ecotrackData.wilaya_id,
            commune: ecotrackData.commune || '(empty)',
            montant: ecotrackData.montant, // This is the frontend-calculated Total Final
            produit: ecotrackData.produit
          });
          
          console.log(`💰 Frontend Total Final Calculation:`, {
            product_amount: parseFloat(order.total_amount) || 0,
            delivery_price: parseFloat(order.delivery_price) || 0,
            total_final: ecotrackData.montant,
            note: 'This Total Final will be sent to backend and used directly'
          });

          // Create delivery in EcoTrack via backend API
          const response = await fetch('/api/ecotrack/create-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              orderData: ecotrackData,
              orderId: order.id
            })
          });

          if (response.ok) {
            const apiResult = await response.json();
            const result = apiResult.data; // Backend wraps the result
            console.log(`✅ Order ${order.id} sent to delivery:`, result);
            
            // Backend now handles status update and tracking ID storage automatically
            console.log('✅ Order status automatically updated to "out_for_delivery" by backend');
            
            successCount++;
          } else {
            const errorText = await response.text();
            let errorMessage = `HTTP ${response.status}`;
            
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.message) {
                errorMessage += `: ${errorData.message}`;
              }
              if (errorData.errors) {
                const fieldErrors = Object.entries(errorData.errors)
                  .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
                  .join('; ');
                errorMessage += ` (Fields: ${fieldErrors})`;
              }
            } catch (parseError) {
              errorMessage += `: ${errorText}`;
            }
            
            console.error(`❌ EcoTrack API Error for order ${order.id}:`, {
              status: response.status,
              body: errorText,
              sentData: ecotrackData
            });
            
            throw new Error(errorMessage);
          }
        } catch (error) {
          console.error(`❌ Error sending order ${order.id} to delivery:`, error);
          errorCount++;
          errors.push(`Order ${order.order_number}: ${error.message}`);
        }
      }

      // Show results
      if (successCount > 0) {
        message.success(t('orders.bulkDeliverySuccess', { count: successCount }));
      }
      
      if (errorCount > 0) {
        message.error(t('orders.bulkDeliveryErrors', { count: errorCount }));
        console.error('Bulk delivery errors:', errors);
      }

      // Refresh orders and clear selection
      await fetchOrders();
      handleClearSelection();
      setBulkDeliveryModalVisible(false);
      
    } catch (error) {
      console.error('Bulk send to delivery error:', error);
      message.error(t('orders.bulkDeliveryError') + ': ' + error.message);
    } finally {
      setBulkSendToDeliveryLoading(false);
    }
  };

  const viewEcotrackDetails = async (trackingId) => {
    if (!trackingId) {
      message.error(t("tracking.noTrackingId"));
      return;
    }

    // Ensure credentials are loaded
    if (!ecotrackCredentials) {
      message.error(t("tracking.credentialsNotLoaded"));
      return;
    }

    try {
      setEcotrackLoading(true);

      // Call the Ecotrack API directly using the same logic as ecotrackService
      const response = await fetch(
        "https://app.noest-dz.com/api/public/get/trackings/info",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_token: ecotrackCredentials.apiToken,
            user_guid: ecotrackCredentials.userGuid,
            trackings: [trackingId],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Ecotrack API response:", data);

      // Process the response data
      if (data && data[trackingId]) {
        const trackingData = data[trackingId];
        setEcotrackDetails(trackingData);
      } else {
        message.warning(t("tracking.noTrackingData"));
      }
    } catch (error) {
      console.error("Fetch Ecotrack details error:", error);
      message.error(t("tracking.fetchError"));
      // Fallback to opening external link if API fails
      const ecotrackUrl = `https://app.noest-dz.com/tracking/${trackingId}`;
      window.open(ecotrackUrl, "_blank");
    } finally {
      setEcotrackLoading(false);
    }
  };

  const showTrackingModal = (order) => {
    setSelectedOrder(order);
    setTrackingModalVisible(true);
    if (order.ecotrack_tracking_id) {
      viewEcotrackDetails(order.ecotrack_tracking_id);
    }
  };

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploading(true);

      const response = await fetch("/api/orders/import", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const formatMessage = result.format_detected
          ? ` (${result.format_detected} format detected)`
          : "";
        message.success(
          t("dashboard.importSuccess", { count: result.imported }) +
            formatMessage
        );

        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          Modal.warning({
            title: t("dashboard.importWarnings"),
            content: (
              <div>
                <p>{t("dashboard.missingFieldsWarning")}:</p>
                <ul style={{ maxHeight: "200px", overflow: "auto" }}>
                  {result.warnings.slice(0, 10).map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                  {result.warnings.length > 10 && (
                    <li>
                      {t("dashboard.andMore", {
                        count: result.warnings.length - 10,
                      })}
                    </li>
                  )}
                </ul>
              </div>
            ),
            width: 600,
          });
        }

        // Show errors if any
        if (result.errors && result.errors.length > 0) {
          Modal.error({
            title: t("dashboard.importErrors"),
            content: (
              <div>
                <p>{t("dashboard.someRowsFailed")}:</p>
                <ul style={{ maxHeight: "200px", overflow: "auto" }}>
                  {result.errors.slice(0, 10).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>
                      {t("dashboard.andMore", {
                        count: result.errors.length - 10,
                      })}
                    </li>
                  )}
                </ul>
              </div>
            ),
            width: 600,
          });
        }

        fetchOrders();
        setImportModalVisible(false);
      } else {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || t("dashboard.importError")
        );
      }
    } catch (error) {
      message.error(error.message || t("dashboard.importError"));
    } finally {
      setUploading(false);
    }

    return false; // Prevent auto upload
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        format: "csv",
        ...(statusFilter && { status: statusFilter }),
        ...(assignedToFilter && { assigned_to: assignedToFilter }),
      });

      const response = await fetch(`/api/orders/export?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `orders_export_${
          new Date().toISOString().split("T")[0]
        }.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        message.success(t("orders.exportSuccess"));
      } else {
        throw new Error("Export failed");
      }
    } catch (error) {
      message.error(t("orders.exportError"));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "orange",
      confirmed: "green",
      processing: "blue",
      out_for_delivery: "purple",
      delivered: "success",
      cancelled: "error",
      returned: "warning",
      on_hold: "default",
      "0_tent": "cyan",
      "1_tent": "geekblue",
      "2_tent": "magenta",
      "3_tent": "volcano",
      "4_tent": "gold",
      "5_tent": "lime",
      "6_tent": "red",
    };
    return colors[status] || "default";
  };

  // Memoized Status cell component to minimize re-renders
  const StatusCell = React.memo(function StatusCell({ t, status, orderId, isUpdating, onChange, getStatusColor }) {
    const statusText = t(`orders.statuses.${status}`);
    const truncatedText = statusText.length > 12 ? statusText.substring(0, 12) + "..." : statusText;

    const statusMenu = (
      <Menu onClick={({ key }) => onChange(orderId, key)}>
        <Menu.Item key="pending">{t("orders.statuses.pending")}</Menu.Item>
        <Menu.Item key="confirmed">{t("orders.statuses.confirmed")}</Menu.Item>
        <Menu.Item key="processing">{t("orders.statuses.processing")}</Menu.Item>
        <Menu.Item key="out_for_delivery">{t("orders.statuses.out_for_delivery")}</Menu.Item>
        <Menu.Item key="delivered">{t("orders.statuses.delivered")}</Menu.Item>
        <Menu.Item key="cancelled">{t("orders.statuses.cancelled")}</Menu.Item>
        <Menu.Item key="returned">{t("orders.statuses.returned")}</Menu.Item>
        <Menu.Item key="on_hold">{t("orders.statuses.on_hold")}</Menu.Item>
        <Menu.Divider />
        <Menu.SubMenu title="Tent Status">
          <Menu.Item key="0_tent">{t("orders.statuses.0_tent") || "0 Tent"}</Menu.Item>
          <Menu.Item key="1_tent">{t("orders.statuses.1_tent") || "1 Tent"}</Menu.Item>
          <Menu.Item key="2_tent">{t("orders.statuses.2_tent") || "2 Tent"}</Menu.Item>
          <Menu.Item key="3_tent">{t("orders.statuses.3_tent") || "3 Tent"}</Menu.Item>
          <Menu.Item key="4_tent">{t("orders.statuses.4_tent") || "4 Tent"}</Menu.Item>
          <Menu.Item key="5_tent">{t("orders.statuses.5_tent") || "5 Tent"}</Menu.Item>
          <Menu.Item key="6_tent">{t("orders.statuses.6_tent") || "6 Tent"}</Menu.Item>
        </Menu.SubMenu>
      </Menu>
    );

    return (
      <Dropdown overlay={statusMenu} trigger={["click"]} disabled={isUpdating}>
        <Tag 
          color={getStatusColor(status)} 
          size="small" 
          style={{ cursor: isUpdating ? "not-allowed" : "pointer", maxWidth: "100px", opacity: isUpdating ? 0.6 : 1 }}
        >
          <Tooltip title={statusText}>
            <Space size={4}>
              {isUpdating && <Spin size="small" />}
              <span>{truncatedText}</span>
            </Space>
          </Tooltip>
        </Tag>
      </Dropdown>
    );
  });

  // Memoized Variant cell for Excel variants
  const VariantCell = React.memo(function VariantCell({ t, parsedDetails }) {
    if (!parsedDetails) {
      return (
        <Text type="secondary" style={{ fontSize: "12px" }}>
          -
        </Text>
      );
    }

    try {
      const excelVariants = [];
      if (parsedDetails.variant) excelVariants.push(parsedDetails.variant);
      if (parsedDetails.size) excelVariants.push(parsedDetails.size);
      if (parsedDetails.color) excelVariants.push(parsedDetails.color);
      if (parsedDetails.model) excelVariants.push(parsedDetails.model);
      if (parsedDetails.style) excelVariants.push(parsedDetails.style);

      if (excelVariants.length === 0) {
        return (
          <Tooltip title={t("orders.noVariantFromExcel")}>
            <Tag color="default" size="small" style={{ fontSize: "11px" }}>
              {t("orders.noVariant")}
            </Tag>
          </Tooltip>
        );
      }

      const variantText = excelVariants.join(", ");
      const displayText = variantText.length > 15 ? variantText.substring(0, 15) + "..." : variantText;

      return (
        <Tooltip 
          title={
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                📋 {t("orders.variantExcelData")}:
              </div>
              <div style={{ fontSize: '12px' }}>
                {excelVariants.map((variant, index) => (
                  <div key={index}>• {variant}</div>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: 4, fontStyle: 'italic' }}>
                {t("orders.variantExcelNote")}
              </div>
            </div>
          }
          placement="topLeft"
        >
          <Tag color="orange" size="small" style={{ fontSize: "11px", cursor: "pointer" }}>
            📋 {displayText}
          </Tag>
        </Tooltip>
      );
    } catch (error) {
      return (
        <Text type="secondary" style={{ fontSize: "12px" }}>
          -
        </Text>
      );
    }
  });

  const getAssignmentMenu = (record) => {
    return (
      <Menu onClick={({ key }) => handleAssignOrder(record.id, key)}>
        <Menu.Item key="null">
          <Text type="secondary">{t("orders.unassigned")}</Text>
        </Menu.Item>
        <Menu.Divider />
        {usersLoading ? (
          <Menu.Item key="loading" disabled>
            <Space>
              <Spin size="small" />
              <Text type="secondary">{t("common.loading")}</Text>
            </Space>
          </Menu.Item>
        ) : Array.isArray(users) && users.length > 0 ? (
          users.map((user) => {
            const userName = `${user.first_name} ${user.last_name}`;
            return (
              <Menu.Item key={user.id}>
                <Tooltip title={userName}>
                  <div
                    className="assignment-user-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      maxWidth: "180px",
                    }}
                  >
                    <UserOutlined
                      style={{ marginRight: "8px", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {userName}
                    </span>
                  </div>
                </Tooltip>
              </Menu.Item>
            );
          })
        ) : (
          <Menu.Item key="no-users" disabled>
            <Text type="secondary">{t("users.noUsers")}</Text>
          </Menu.Item>
        )}
      </Menu>
    );
  };

  const columns = React.useMemo(() => [
    {
      title: t("orders.orderNumber"),
      dataIndex: "order_number",
      key: "order_number",
      width: 120,
      fixed: 'left',
      render: (orderNumber, record) => {
        // Check if order has variant information
        const productDetails = parsedProductDetailsById.get(record.id);
        const hasVariant = !!(productDetails && (productDetails.variant || productDetails.size || productDetails.color || productDetails.model || productDetails.style));

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Tooltip title={orderNumber}>
              <Text strong style={{ color: '#1890ff' }}>
                #{orderNumber}
              </Text>
            </Tooltip>
           
          </div>
        );
      },
    },
    {
      title: t("orders.customerName"),
      dataIndex: "customer_name",
      key: "customer_name",
      width: 150,
      ellipsis: true,
      render: (name) => {
        const displayName = name || t("orders.noCustomerName");
        return (
          <Tooltip title={displayName}>
            {name ? (
              <Text>{name}</Text>
            ) : (
              <Text type="secondary">{t("orders.noCustomerName")}</Text>
            )}
          </Tooltip>
        );
      },
    },
/* removed: stray variant renderer
              render: (_, record) => {
                try {
                  const productDetails = parsedProductDetailsById.get(record.id);
                  // Get Excel variant information
                  const excelVariants = [];
                  if (productDetails?.variant) excelVariants.push(productDetails.variant);
                  if (productDetails?.size) excelVariants.push(productDetails.size);
                  if (productDetails?.color) excelVariants.push(productDetails.color);
                  if (productDetails?.model) excelVariants.push(productDetails.model);
                  if (productDetails?.style) excelVariants.push(productDetails.style);

                  if (excelVariants.length === 0) {
                    return (
                      <Tooltip title={t("orders.noVariantFromExcel")}>
                        <Tag color="default" size="small" style={{ fontSize: "11px" }}>
                          {t("orders.noVariant")}
                        </Tag>
                      </Tooltip>
                    );
                  }

                  const variantText = excelVariants.join(", ");
                  const displayText = variantText.length > 15 ? variantText.substring(0, 15) + "..." : variantText;
          
                  return (
                    <Tooltip title={variantText}>
                      <Text style={{ fontSize: '12px' }}>📋 {displayText}</Text>
                    </Tooltip>
                  );
                } catch (_) {
                  return (
                    <Tooltip title={t("orders.noVariantFromExcel")}>
                      <Tag color="default" size="small" style={{ fontSize: "11px" }}>
                        {t("orders.noVariant")}
                      </Tag>
                    </Tooltip>
                  );
                }
        },
*/
  {
  title: t("orders.customerPhone"),
      dataIndex: "customer_phone",
      key: "customer_phone",
      width: 120,
      responsive: ["lg"],
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text>{text}</Text>
        </Tooltip>
      ),
  },
    {
      title: t("orders.customerCity"),
      dataIndex: "customer_city",
      key: "customer_city",
      width: 100,
      responsive: ["xl"],
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: t("orders.customerAddress"),
      dataIndex: "customer_address",
      key: "customer_address",
      width: 150,
      responsive: ["xxl"],
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: t("orders.status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status, record) => (
        <StatusCell
          t={t}
          status={status}
          orderId={record.id}
          isUpdating={updatingStatusId === record.id}
          onChange={handleStatusChange}
          getStatusColor={getStatusColor}
        />
      ),
    },
    {
      title: t("orders.totalAmount"),
      dataIndex: "total_amount",
      key: "total_amount",
      width: 100,
      responsive: ["sm"],
      render: (amount) => <Text strong>{`${amount || 0} DA`}</Text>,
    },
//     {
//       title: "Total",
//       key: "calculated_total",
//       width: 120,
//       responsive: ["sm"],
//       render: (_, record) => {
//         // Create a component for each cell to handle async API calls
//         const TotalCell = () => {
//           const [apiDeliveryPrice, setApiDeliveryPrice] = useState(null);
//           const [loading, setLoading] = useState(false);
          
//           // Extract quantity and unit price from product_details
//           let quantity = 1;
//           let unitPrice = 0;
//           let productTotal = 0;
          
//           // Check if we have a pre-calculated final_total from the edit form
//           const storedFinalTotal = parseFloat(record.final_total || 0);
          
//           if (record.product_details) {
//             try {
//               const details = typeof record.product_details === 'string' 
//                 ? JSON.parse(record.product_details) 
//                 : record.product_details;
//               quantity = parseFloat(details.quantity || 1);
              
//               // If we have unit price in product details, use it
//               if (details.unit_price) {
//                 unitPrice = parseFloat(details.unit_price);
//                 productTotal = unitPrice * quantity;
//                 console.log(`📊 Using unit_price from product_details: ${unitPrice} DA × ${quantity} = ${productTotal} DA`);
//               }
//             } catch (e) {
//               // If parsing fails, use defaults
//               quantity = 1;
//             }
//           }
          
//           // If we don't have unit price from product details, treat total_amount as unit price
//           if (unitPrice === 0) {
//             unitPrice = parseFloat(record.total_amount || 0);
//             productTotal = unitPrice * quantity;
//             console.log(`📊 Using total_amount as unit price: ${unitPrice} DA × ${quantity} = ${productTotal} DA`);
//           }
          
//           // Check if delivery price seems incorrect (same as product amount)
//           const storedDeliveryPrice = parseFloat(record.delivery_price || 0);
//           const deliveryPriceSeemsSuspicious = Math.abs(storedDeliveryPrice - productTotal) < 0.01;
          
//           // Auto-fetch correct delivery price if suspicious and we have required data
//           useEffect(() => {
//             const fetchCorrectDeliveryPrice = async () => {
//               if (deliveryPriceSeemsSuspicious && record.wilaya_id && !loading && apiDeliveryPrice === null) {
//                 setLoading(true);
//                 try {
//                   console.log(`🔄 Auto-fetching delivery price from EcoTrack fees API for order ${record.order_number}...`);
                  
//                   // Get delivery type (convert from our format to EcoTrack format)
//                   const deliveryType = record.delivery_type === 'stop_desk' ? 'stop_desk' : 'home';
                  
//                   // Call EcoTrack fees API directly
//                   const correctDeliveryPrice = await ecoTrackFeesService.getCachedDeliveryPrice(
//                     record.wilaya_id, 
//                     deliveryType
//                   );
                  
//                   if (correctDeliveryPrice !== null) {
//                     console.log(`✅ Got correct delivery price for ${record.order_number}: ${correctDeliveryPrice} DA (was ${storedDeliveryPrice} DA)`);
//                     setApiDeliveryPrice(correctDeliveryPrice);
//                   } else {
//                     console.warn(`⚠️ No delivery price found for order ${record.order_number}, using stored price`);
//                     setApiDeliveryPrice(storedDeliveryPrice); // Fallback to stored price
//                   }
                  
//                 } catch (error) {
//                   console.error(`❌ Failed to fetch delivery price from EcoTrack fees API for order ${record.order_number}:`, error);
//                   setApiDeliveryPrice(storedDeliveryPrice); // Fallback to stored price
//                 } finally {
//                   setLoading(false);
//                 }
//               } else if (!deliveryPriceSeemsSuspicious) {
//                 // Use stored price if it seems correct
//                 setApiDeliveryPrice(storedDeliveryPrice);
//               }
//             };
            
//             fetchCorrectDeliveryPrice();
//           }, [record.order_number, deliveryPriceSeemsSuspicious, record.wilaya_id]);
          
//           // Use API delivery price if available, otherwise use stored price
//           const deliveryPrice = apiDeliveryPrice !== null ? apiDeliveryPrice : storedDeliveryPrice;
          
//           // Use stored final_total if available (from edit form), otherwise calculate it
//           let finalTotal;
//           let isUsingStoredTotal = false;
          
//           if (storedFinalTotal > 0) {
//             // Use the pre-calculated final_total from edit form
//             finalTotal = storedFinalTotal;
//             isUsingStoredTotal = true;
//             console.log(`📊 Using stored final_total for order ${record.order_number}: ${finalTotal} DA`);
//             console.log(`🔍 isUsingStoredTotal = ${isUsingStoredTotal}, should show 📝 icon`);
//           } else {
//             // Calculate total: product + delivery
//             finalTotal = productTotal + deliveryPrice;
//             console.log(`📊 Calculated total for order ${record.order_number}: ${productTotal} + ${deliveryPrice} = ${finalTotal} DA`);
//             console.log(`🔍 isUsingStoredTotal = ${isUsingStoredTotal}, no 📝 icon`);
//           }
          
//           // Create detailed tooltip showing the breakdown
//           const wasRecalculated = deliveryPriceSeemsSuspicious && apiDeliveryPrice !== null && apiDeliveryPrice !== storedDeliveryPrice;
          
//           // Show different tooltip formats based on whether we have quantity info and stored total
//           let tooltipContent;
//           if (isUsingStoredTotal) {
//             tooltipContent = `💰 EDIT FORM TOTAL: ${finalTotal.toFixed(2)} DA
// 📝 This total was set manually in the edit form
// 📊 Calculated would be: ${productTotal.toFixed(2)} DA (product) + ${deliveryPrice.toFixed(2)} DA (delivery) = ${(productTotal + deliveryPrice).toFixed(2)} DA${wasRecalculated ? '\n✅ Delivery updated via EcoTrack: ' + storedDeliveryPrice.toFixed(2) + ' DA → ' + apiDeliveryPrice.toFixed(2) + ' DA' : ''}`;
//           } else if (quantity > 1) {
//             tooltipContent = `Product: ${unitPrice.toFixed(2)} DA × ${quantity} = ${productTotal.toFixed(2)} DA
// Delivery: ${deliveryPrice.toFixed(2)} DA ${wasRecalculated ? '(EcoTrack Fees API)' : loading ? '(Checking EcoTrack...)' : '(stored)'}
// Total: ${finalTotal.toFixed(2)} DA${wasRecalculated ? '\n✅ Fixed via EcoTrack: ' + storedDeliveryPrice.toFixed(2) + ' DA → ' + apiDeliveryPrice.toFixed(2) + ' DA' : ''}`;
//           } else {
//             tooltipContent = `Product: ${productTotal.toFixed(2)} DA
// Delivery: ${deliveryPrice.toFixed(2)} DA ${wasRecalculated ? '(EcoTrack Fees API)' : loading ? '(Checking EcoTrack...)' : '(stored)'}
// Total: ${finalTotal.toFixed(2)} DA${wasRecalculated ? '\n✅ Fixed via EcoTrack: ' + storedDeliveryPrice.toFixed(2) + ' DA → ' + apiDeliveryPrice.toFixed(2) + ' DA' : ''}`;
//           }
//           if (loading) {
//             return (
//               <Tooltip title="Fetching correct delivery price from EcoTrack fees API...">
//                 <Text style={{ color: '#1890ff' }}>
//                   <Spin size="small" style={{ marginRight: 4 }} />
//                   {`${(isUsingStoredTotal ? storedFinalTotal : productTotal + storedDeliveryPrice).toFixed(2)} DA`}
//                 </Text>
//               </Tooltip>
//             );
//           }
          
//           return (
//             <Tooltip title={tooltipContent}>
//               <Text strong style={{ 
//                 color: isUsingStoredTotal ? '#722ed1' : (wasRecalculated ? '#52c41a' : '#1890ff') // Purple for stored, green if auto-corrected, blue otherwise
//               }}>
//                 {`${finalTotal.toFixed(2)} DA`}
//                 {(() => {
//                   console.log(`🎨 Rendering order ${record.order_number}: isUsingStoredTotal=${isUsingStoredTotal}, should show 📝=${isUsingStoredTotal}`);
//                   return isUsingStoredTotal && <span style={{ marginLeft: 4 }}>📝</span>;
//                 })()}
//                 {wasRecalculated && <span style={{ marginLeft: 4 }}>✅</span>}
//               </Text>
//             </Tooltip>
//           );
//         };
        
//         return <TotalCell />;
//       },
//     },
    {
      title: t("orders.boutique"),
      key: "boutique",
      width: 120,
      responsive: ["md"],
      render: (_, record) => {
        const boutiqueInfo = getOrderProductBoutique(record);
        
        if (!boutiqueInfo) {
          return (
            <Tooltip title={t("orders.productNotInDatabase")}>
              <Tag color="default" size="small">
                {t("orders.notInDb")}
              </Tag>
            </Tooltip>
          );
        }
        
        return (
          <Tooltip title={`${t("orders.product")}: ${boutiqueInfo.productName} | ${t("orders.boutique")}: ${boutiqueInfo.locationName}`}>
            <Tag color="blue" size="small">
              {boutiqueInfo.locationName}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t("orders.variantExcel"),
      key: "variant_excel",
      width: 140,
      responsive: ["lg"],
      render: (_, record) => (
        <VariantCell t={t} parsedDetails={parsedProductDetailsById.get(record.id)} />
      ),
    },
    ...(ecotrackEnabled
      ? [
          {
            title: t("tracking.ecotrackId"),
            dataIndex: "ecotrack_tracking_id",
            key: "ecotrack_tracking_id",
            width: 120,
            responsive: ["lg"],
            render: (trackingId) =>
              trackingId ? (
                <Text copyable style={{ fontSize: "12px" }}>
                  {trackingId}
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  {t("tracking.noTrackingId")}
                </Text>
              ),
          },
        ]
      : []),
    ...(canAssignOrders
      ? [
          {
            title: t("orders.assignedTo"),
            key: "assigned_to",
            width: 150,
            responsive: ["md"],
            ellipsis: true,
            render: (_, record) => {
              const isAssigned =
                record.assigned_first_name && record.assigned_last_name;
              const assignedName = isAssigned
                ? `${record.assigned_first_name} ${record.assigned_last_name}`
                : t("orders.unassigned");

              return (
                <Dropdown
                  overlay={getAssignmentMenu(record)}
                  trigger={["click"]}
                >
                  <Button
                    type="text"
                    size="small"
                    className={`assignment-status ${
                      isAssigned ? "assigned" : "unassigned"
                    }`}
                    style={{
                      padding: "2px 6px",
                      border: isAssigned
                        ? "1px solid #52c41a"
                        : "1px solid #d9d9d9",
                      borderRadius: "4px",
                      color: isAssigned ? "#52c41a" : "#999",
                      fontSize: "12px",
                      maxWidth: "100%",
                    }}
                  >
                    <Tooltip title={assignedName}>
                      <Space size="small">
                        <UserOutlined style={{ fontSize: "10px" }} />
                        <span
                          className="assignment-text"
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "90px",
                            display: "inline-block",
                          }}
                        >
                          {assignedName}
                        </span>
                      </Space>
                    </Tooltip>
                  </Button>
                </Dropdown>
              );
            },
          },
        ]
      : []),
    {
      title: t("orders.createdAt"),
      dataIndex: "created_at",
      key: "created_at",
      width: 100,
      responsive: ["lg"],
      render: (date) => <Text>{new Date(date).toLocaleDateString()}</Text>,
    },
    {
      title: t("orders.notes"),
      dataIndex: "notes",
      key: "notes",
      width: 120,
      responsive: ["xxl"],
      ellipsis: true,
      render: (text) => {
        if (!text) return <Text type="secondary">-</Text>;
        return (
          <Tooltip title={text}>
            <Text>{text}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: canAssignOrders ? 180 : 80,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              // Open modal immediately for fast UX
              setEditingOrder(record);
              setModalVisible(true);

              // Parse product_details quickly (non-blocking work only)
              let productInfo = {};
              try {
                if (record.product_details) {
                  const parsed = typeof record.product_details === 'string'
                    ? JSON.parse(record.product_details)
                    : record.product_details;
                  if (parsed && typeof parsed === 'object') {
                    productInfo = parsed;
                  }
                }
              } catch (error) {
                const productText = String(record.product_details || '');
                productInfo = {
                  name: productText,
                  variant: productText,
                  description: productText,
                  original_product_text: productText
                };
              }

              // Set initial form values immediately
              const deliveryPrice = parseFloat(record.delivery_price || 0);
              form.setFieldsValue({
                ...record,
                product_info: productInfo,
                notes: record.notes || '',
                delivery_price: deliveryPrice,
              });
              setCurrentDeliveryType(record.delivery_type || 'home');

              // Defer any non-critical work so UI stays snappy
              setTimeout(() => {
                // Load baladias if order has a wilaya (async chain but doesn't block modal)
                if (record.wilaya_id) {
                  handleAutoWilayaSelection(record.wilaya_id);
                  if (record.baladia_id) {
                    fetchBaladias(record.wilaya_id).then(() => {
                      form.setFieldsValue({
                        baladia_id: record.baladia_id,
                        baladia_name: record.baladia_name,
                      });
                    });
                  }
                }

                // Update totals cheaply
                try { updateFinalTotal(); } catch (_) {}
              }, 0);
            }}
          />
          {ecotrackEnabled && record.ecotrack_tracking_id && (
            <Tooltip title={t("tracking.viewEcotrackDetails")}>
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => showTrackingModal(record)}
              />
            </Tooltip>
          )}
          {canAssignOrders && (
            <Dropdown overlay={getAssignmentMenu(record)} trigger={["click"]} onOpenChange={(open) => { if (open) ensureUsers(); }}>
              <Tooltip title={t("orders.assignTooltip")}>
                <Button
                  type="primary"
                  size="small"
                  icon={<UserAddOutlined />}
                  className="assignment-button"
                  style={{ fontSize: "10px", padding: "0 4px" }}
                >
                  <span className="btn-text-xs">{t("orders.assign")}</span>
                </Button>
              </Tooltip>
            </Dropdown>
          )}
          {canDeleteOrders && (
            <Popconfirm
              title={t("orders.deleteConfirm")}
              onConfirm={() => handleDeleteOrder(record.id)}
              okText={t("common.yes")}
              cancelText={t("common.no")}
            >
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [t, parsedProductDetailsById, getStatusColor, ecotrackEnabled, canAssignOrders, ensureUsers, handleStatusChange, showTrackingModal, handleDeleteOrder]);

  // Virtualized body for large tables
  const VirtualBody = React.useCallback((props) => {
    const { children, ...restProps } = props;
    // rc-virtual-list expects data and render item; adapt Ant Table body rows
    const rows = React.Children.toArray(children);
    const itemCount = rows.length;
    const itemHeight = 42; // approximate row height; tweak as needed

    return (
      <VirtualList 
        data={rows} 
        height={Math.min(600, itemCount * itemHeight)} 
        itemHeight={itemHeight} 
        itemKey={(row, index) => (row && row.key != null ? row.key : index)}
      >
        {(row) => row}
      </VirtualList>
    );
  }, []);

  return (
    <div className="orders-page">
      {/* Statistics Section */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f0f9ff' }}>
              <Statistic
                title="En cours de livraison"
                value={orderStats.out_for_delivery}
                valueStyle={{ color: '#1890ff', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff7e6' }}>
              <Statistic
                title={t("orders.statistics.pending")}
                value={orderStats.pending}
                valueStyle={{ color: '#fa8c16', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f6ffed' }}>
              <Statistic
                title={t("orders.statistics.confirmed")}
                value={orderStats.confirmed}
                valueStyle={{ color: '#52c41a', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card size="small" style={{ textAlign: 'center', backgroundColor: '#e6f7ff' }}>
              <Statistic
                title={t("orders.statistics.processing")}
                value={orderStats.processing}
                valueStyle={{ color: '#13c2c2', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card size="small" style={{ textAlign: 'center', backgroundColor: '#f0f5ff' }}>
              <Statistic
                title={t("orders.statistics.delivered")}
                value={orderStats.delivered}
                valueStyle={{ color: '#722ed1', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <Card size="small" style={{ textAlign: 'center', backgroundColor: '#fff1f0' }}>
              <Statistic
                title={t("orders.statistics.cancelled")}
                value={orderStats.cancelled}
                valueStyle={{ color: '#f5222d', fontSize: '20px' }}
              />
            </Card>
          </Col>
        </Row>
     
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {isAdmin && (
          <>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  block
                  size="small"
                  onClick={() => setImportModalVisible(true)}
                  icon={<UploadOutlined />}
                >
                  <span className="btn-text">{t("common.import")}</span>
                </Button>
              </Space>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type="primary"
                  block
                  size="small"
                  loading={distributionLoading}
                  onClick={() => setDistributionModalVisible(true)}
                  icon={<ShareAltOutlined />}
                >
                  <span className="btn-text">{t("orders.distribute")}</span>
                </Button>
              </Space>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button
                  type={googleSheetsEnabled ? "primary" : "default"}
                  block
                  size="small"
                  onClick={() => setGoogleSheetsModalVisible(true)}
                  icon={<LinkOutlined />}
                >
                  <span className="btn-text">{t("orders.googleSheets")}</span>
                </Button>
              </Space>
            </Col>
          </>
        )}
      </Row>

      {/* Bulk Actions Row */}
      {selectedRowKeys.length > 0 && (
        <Card style={{ marginBottom: 16, backgroundColor: '#f0f5ff', border: '1px solid #d6e4ff' }}>
          <Row gutter={[16, 8]} align="middle">
            <Col>
              <Text strong style={{ color: '#1890ff' }}>
                {t('orders.selectedCount', { count: selectedRowKeys.length })}
              </Text>
            </Col>
            <Col flex="auto">
              <Space wrap>
                <Button
                  type="primary"
                  icon={<TruckOutlined />}
                  onClick={handleBulkSendToDelivery}
                  disabled={selectedOrders.filter(order => order.status === 'confirmed').length === 0}
                >
                  {t('orders.sendToDelivery')}
                </Button>
                
                {canAssignOrders && (
                  <Space.Compact>
                    <Select
                      style={{ width: 160 }}
                      placeholder={t('orders.selectAssignee')}
                      value={bulkAssignedTo}
                      onChange={setBulkAssignedTo}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      loading={usersLoading}
                      onDropdownVisibleChange={(open) => { if (open) ensureUsers(); }}
                      options={(Array.isArray(users) ? users : []).map(u => ({
                        label: `${u.first_name} ${u.last_name}`,
                        value: u.id
                      }))}
                    />
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={handleBulkAssign}
                      disabled={!bulkAssignedTo}
                      loading={loading}
                    >
                      {t('orders.bulkAssign')}
                    </Button>
                    <Button
                      icon={<UserOutlined />}
                      onClick={handleBulkUnassign}
                      loading={loading}
                    >
                      {t('orders.bulkUnassign')}
                    </Button>
                  </Space.Compact>
                )}
                
                <Button
                  icon={<CheckCircleOutlined />}
                  onClick={handleSelectAll}
                >
                  {t('orders.selectAll')}
                </Button>
                <Button
                  icon={<ExclamationCircleOutlined />}
                  onClick={handleClearSelection}
                >
                  {t('orders.clearSelection')}
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder={t("orders.searchByNameOrPhone") || "Search by name or phone..."}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t("orders.filterByStatus")}
              style={{ width: "100%" }}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value || "");
                console.log('🏷️ Status filter changed:', value);
              }}
              allowClear
            >
              <Option value="pending">{t("orders.statuses.pending")}</Option>
              <Option value="confirmed">
                {t("orders.statuses.confirmed")}
              </Option>
              <Option value="processing">
                {t("orders.statuses.processing")}
              </Option>
              <Option value="out_for_delivery">
                {t("orders.statuses.out_for_delivery")}
              </Option>
              <Option value="delivered">
                {t("orders.statuses.delivered")}
              </Option>
              <Option value="cancelled">
                {t("orders.statuses.cancelled")}
              </Option>
              <Option value="returned">{t("orders.statuses.returned")}</Option>
              <Option value="on_hold">{t("orders.statuses.on_hold")}</Option>
              <Option value="0_tent">
                {t("orders.statuses.0_tent") || "0 Tent"}
              </Option>
              <Option value="1_tent">
                {t("orders.statuses.1_tent") || "1 Tent"}
              </Option>
              <Option value="2_tent">
                {t("orders.statuses.2_tent") || "2 Tent"}
              </Option>
              <Option value="3_tent">
                {t("orders.statuses.3_tent") || "3 Tent"}
              </Option>
              <Option value="4_tent">
                {t("orders.statuses.4_tent") || "4 Tent"}
              </Option>
              <Option value="5_tent">
                {t("orders.statuses.5_tent") || "5 Tent"}
              </Option>
              <Option value="6_tent">
                {t("orders.statuses.6_tent") || "6 Tent"}
              </Option>
            </Select>
          </Col>
          {isAdmin && (
            <Col xs={24} sm={12} md={6}>
              <Select
                placeholder={t("orders.filterByAssignee")}
                style={{ width: "100%" }}
                value={assignedToFilter}
                onChange={(value) => {
                  setAssignedToFilter(value || "");
                  console.log('👤 Assigned to filter changed:', value);
                }}
                allowClear
              >
                <Option value="null">{t("orders.unassigned")}</Option>
                {Array.isArray(users) &&
                  users.map((user) => (
                    <Option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </Option>
                  ))}
              </Select>
            </Col>
          )}
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder={t("orders.filterByBoutique")}
              style={{ width: "100%" }}
              value={boutiqueFilter}
              onChange={(value) => {
                setBoutiqueFilter(value || "");
                console.log('🏪 Boutique filter changed:', value);
              }}
              allowClear
              loading={loadingLocations}
            >
              <Option value="has_match">{t("orders.hasProductInDb")}</Option>
              <Option value="no_match">{t("orders.noProductInDb")}</Option>
              <Option disabled>────────────</Option>
              {locations.map((location) => (
                <Option key={location.id} value={location.id}>
                  🏪 {location.name}
                </Option>
              ))}
            </Select>
          </Col>
          {/* <Col xs={24} sm={12} md={6}>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'search',
                    label: t("common.search"),
                    icon: <SearchOutlined />,
                    onClick: handleSearch,
                  },
                  {
                    key: 'clear',
                    label: t("common.clear"), 
                    icon: <ReloadOutlined />,
                    onClick: handleClearSearch,
                  },
                  ...(isAdmin ? [{
                    key: 'add',
                    label: t("common.add"),
                    icon: <PlusOutlined />,
                    onClick: () => {
                      setEditingOrder(null);
                      form.resetFields();
                      setModalVisible(true);
                      
                      // Reset final total for new order
                      setFinalTotal(0);
                    },
                  }] : []),
                  {
                    key: 'refresh',
                    label: t("common.refresh"),
                    icon: <ReloadOutlined />,
                    onClick: fetchOrders,
                  },
                  {
                    key: 'test-ecotrack',
                    label: 'Test EcoTrack API',
                    icon: <GlobalOutlined />,
                    onClick: testEcoTrackFeesAPI,
                    disabled: loading,
                  },
                  {
                    key: 'recalculate-delivery',
                    label: 'Fix Delivery Prices',
                    icon: <CalculatorOutlined />,
                    onClick: handleBulkRecalculateDeliveryPrices,
                    disabled: loading,
                  },
                ],
              }}
              placement="bottomRight"
            >
              <Button size="small" icon={<SettingOutlined />}>
                {t("common.actions")} <DownOutlined />
              </Button>
            </Dropdown>
          </Col> */}
        </Row>
      </Card>
      

      {/* Orders Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={React.useMemo(() => derivedFilteredOrders.slice(
            (pagination.current - 1) * pagination.pageSize,
            pagination.current * pagination.pageSize
          ), [derivedFilteredOrders, pagination.current, pagination.pageSize])}
          rowKey="id"
          loading={loading}
          size="small"
          components={{
            body: VirtualBody
          }}
          rowSelection={React.useMemo(() => ({
            selectedRowKeys,
            onChange: handleRowSelectionChange,
            getCheckboxProps: () => ({ disabled: false }),
          }), [selectedRowKeys, handleRowSelectionChange])}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: derivedFilteredOrders.length, // Use filtered orders length
            showSizeChanger: true,
            showQuickJumper: true,
            responsive: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} ${t("dashboard.outOf")} ${total}${searchText ? ` (filtered from ${allOrders.length})` : ''}`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Create/Edit Order Modal */}
      <Modal
        title={editingOrder ? t("orders.editOrder") : t("orders.createOrder")}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingOrder(null);
          setCurrentDeliveryType('home'); // Reset delivery type state
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingOrder ? handleUpdateOrder : handleCreateOrder}
          onValuesChange={(changedValues, allValues) => {
            if (changedValues.delivery_type) {
              console.log('🚚 Delivery type changed:', changedValues.delivery_type);
            }
            if (Object.keys(changedValues).length > 0) {
              console.log('📝 Form values changed:', changedValues);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customer_name"
                label={t("orders.customerName")}
                rules={[
                  { required: true, message: t("orders.customerNameRequired") },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customer_phone"
                label={t("orders.customerPhone")}
                rules={[
                  {
                    required: true,
                    message: t("orders.customerPhoneRequired"),
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="customer_address"
            label={t("orders.customerAddress")}
          >
            <TextArea rows={2} />
          </Form.Item>

          {/* Delivery Management Section */}
          <Card
            title={t("delivery.deliveryManagement")}
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Form.Item
                  name="wilaya_id"
                  label={t("delivery.wilaya")}
                  rules={[
                    { required: true, message: t("delivery.wilayaRequired") },
                  ]}
                >
                  <Select
                    placeholder={t("delivery.selectWilaya")}
                    showSearch
                    optionFilterProp="label"
                    onChange={handleWilayaChange}
                    loading={loadingWilayas}
                    options={wilayas.map(w => ({
                      label: `${w.code} - ${w.name_fr}`,
                      value: w.id
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                {/* Keep baladia_name for compatibility */}
                <Form.Item name="baladia_name" hidden>
                  <Input />
                </Form.Item>
                
                <Form.Item
                  name="baladia_id"
                  label={t("delivery.baladia")}
                >
                  <Select
                    placeholder="Select Baladia"
                    showSearch
                    optionFilterProp="label"
                    onChange={handleBaladiaChange}
                    loading={loadingBaladias}
                    allowClear
                    disabled={!selectedWilaya}
                    notFoundContent={loadingBaladias ? <Spin size="small" /> : null}
                    options={baladias.map(b => ({
                      label: b.name_en || b.name_fr || b.name_ar,
                      value: b.id
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="delivery_type"
                  label={t("delivery.deliveryType")}
                  initialValue="home"
                  rules={[
                    {
                      required: true,
                      message: t("delivery.deliveryTypeRequired"),
                    },
                  ]}
                >
                  <Select 
                    placeholder={t("delivery.selectType")}
                    onChange={(value) => handleDeliveryFieldChange(value, 'delivery_type')}
                    options={[
                      { value: 'home', label: `${t("delivery.types.home")} (À domicile)` },
                      { value: 'stop_desk', label: 'Stop Desk (Point de collecte)' },
                      { value: 'les_changes', label: 'les changes' }
                    ]}
                  />
                </Form.Item>
              </Col>
              
              {/* Show helpful message for les_changes delivery type */}
              {currentDeliveryType === 'les_changes' && (
                <Col span={24}>
                  <Alert
                    message="Mode manuel activé pour Les Changes"
                    description="Veuillez saisir manuellement le prix de livraison dans le champ 'Prix de Livraison'. L'auto-calcul est désactivé pour ce type de livraison."
                    type="info"
                    showIcon
                    style={{ margin: '8px 0' }}
                  />
                </Col>
              )}
              
              <Col span={6}>
                <Form.Item
                  name="ecotrack_station_code"
                  label="EcoTrack Station"
                  tooltip="Required for stop desk delivery in EcoTrack"
                  style={{ 
                    display: currentDeliveryType === 'stop_desk' ? 'block' : 'none' 
                  }}
                  rules={[
                    {
                      required: currentDeliveryType === 'stop_desk',
                      message: 'Station code is required for stop desk delivery'
                    }
                  ]}
                >
                  <Select 
                    placeholder={`Select EcoTrack station (${ecotrackStations.length} available)`}
                    loading={loadingStations}
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) => {
                      const children = option.children;
                      if (typeof children === 'string') {
                        return children.toLowerCase().includes(input.toLowerCase());
                      }
                      const childrenStr = String(children || '');
                      return childrenStr.toLowerCase().includes(input.toLowerCase());
                    }}
                    onDropdownVisibleChange={(open) => {
                      if (open) {
                        console.log('🚉 Station dropdown opened, stations:', ecotrackStations);
                      }
                    }}
                    notFoundContent={loadingStations ? "Loading stations..." : `No stations found (${ecotrackStations.length} loaded)`}
                  >
                    {ecotrackStations.map((station) => (
                      <Option key={station.code} value={station.code}>
                        {station.code} - {station.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="delivery_price"
                  label={
                    <span>
                      {t("delivery.deliveryPrice")}
                      {currentDeliveryType === 'les_changes' && (
                        <span style={{ color: '#52c41a', marginLeft: 4 }}>
                          ✏️ Manual
                        </span>
                      )}
                    </span>
                  }
                  rules={[
                    // No validation - accept delivery price as provided from API
                  ]}>
                  <Input
                    type="number"
                    suffix="DA"
                    placeholder={
                      currentDeliveryType === 'les_changes' 
                        ? "Entrez le prix manuellement" 
                        : "Prix depuis API/Base de données"
                    }
                    style={{
                      backgroundColor: currentDeliveryType === 'les_changes' ? '#f6ffed' : undefined,
                      borderColor: currentDeliveryType === 'les_changes' ? '#52c41a' : undefined
                    }}
                    min={0}
                    disabled={false}
                    onChange={(e) => {
                      const value = e.target.value;
                      console.log('🚚 Changement manuel du prix de livraison:', value);
                      if (currentDeliveryType === 'les_changes') {
                        console.log('🔄 Les Changes: Manual delivery price entry enabled');
                      }
                      handleDeliveryFieldChange(value, 'delivery_price');
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="customer_city"
                label={t("orders.customerCity")}
                rules={[
                  { required: true, message: t("orders.customerCityRequired") },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="total_amount"
                label={t("orders.totalAmount")}
                rules={[
                  { required: true, message: t("orders.totalAmountRequired") },
                ]}
              >
                <Input
                  type="number"
                  min={0}
                  suffix="DA"
                  placeholder="0"
                  onChange={(e) => {
                    const unitPrice = parseFloat(e.target.value || 0);
                    // Update the unit_price in product_info for backend compatibility
                    form.setFieldsValue({
                      product_info: {
                        ...form.getFieldValue('product_info'),
                        unit_price: unitPrice
                      }
                    });
                    updateProductTotal();
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Final Total Display */}
          <Row gutter={16}>
            <Col span={24}>
              <Card
                size="small"
                style={{
                  backgroundColor: "#f0f8ff",
                  border: "1px solid #1890ff",
                  marginBottom: 16,
                }}
              >
                <Form.Item dependencies={["total_amount", "delivery_price", ["product_info", "quantity"]]} noStyle>
                  {({ getFieldValue }) => {
                    // Calculate product total from quantity × unit price (total_amount now represents unit price)
                    const quantity = parseFloat(
                      getFieldValue(["product_info", "quantity"]) || 0
                    );
                    const unitPrice = parseFloat(
                      getFieldValue("total_amount") || 0
                    );
                    const productTotal = quantity * unitPrice;
                    const deliveryPrice = parseFloat(
                      getFieldValue("delivery_price") || 0
                    );
                    const calculatedTotal = productTotal + deliveryPrice;
                    
                    // Use the state final total if it's been calculated, otherwise use calculated total
                    const displayTotal = finalTotal > 0 ? finalTotal : calculatedTotal;

                    return (
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Text strong style={{ fontSize: "16px" }}>
                            {t("orders.finalTotal")}:
                          </Text>
                        </Col>
                        <Col>
                          <Text
                            strong
                            style={{
                              fontSize: "18px",
                              color: "#1890ff",
                            }}
                          >
                            {displayTotal.toFixed(2)} DA
                          </Text>
                        </Col>
                      </Row>
                    );
                  }}
                </Form.Item>
              </Card>
            </Col>
          </Row>
          <Form.Item
            name="product_details"
            label={t("orders.productDetails")}
            rules={[
              { required: true, message: t("orders.productDetailsRequired") },
            ]}
          >
            <Card 
              size="small" 
              style={{ backgroundColor: '#fafafa' }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    📦 {t("orders.productInformation")}
                  </span>
                  {selectedProduct && (
                    <Tag color="green" size="small">
                      {t("orders.autoSelected")}
                    </Tag>
                  )}
                </div>
              }
            >
              {/* Product Selection Section */}
              <div style={{ 
                backgroundColor: '#f0f8ff', 
                padding: '12px', 
                borderRadius: '6px', 
                marginBottom: '16px',
                border: '1px solid #d9d9d9'
              }}>
                <Text strong style={{ fontSize: '13px', color: '#1890ff', marginBottom: '8px', display: 'block' }}>
                  🔍 {t("orders.productSelection")}
                </Text>
                <Row gutter={[12, 8]}>
                  {/* <Col span={12}>
                    <Form.Item
                      name={['product_info', 'sku']}
                      label={t("orders.productSku")}
                      style={{ marginBottom: 8 }}
                    >
                      <Select
                        placeholder={t("orders.selectProductSku")}
                        showSearch
                        optionFilterProp="children"
                        loading={loadingProducts}
                        onChange={handleProductSelection}
                        filterOption={(input, option) =>
                          option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                        }
                      >
                        {products.map((product) => (
                          <Option key={product.sku} value={product.sku}>
                            {product.sku} - {product.name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col> */}
                  <Col span={12}>
                    <Form.Item
                      name={['product_info', 'name']}
                      label={t("orders.productName")}
                      style={{ marginBottom: 8 }}
                    >
                      <Input 
                        placeholder={t("orders.enterProductName")} 
                        style={{ backgroundColor: selectedProduct ? '#f6ffed' : undefined }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Product Details Section */}
              <div style={{ 
                backgroundColor: '#fff7e6', 
                padding: '12px', 
                borderRadius: '6px', 
                marginBottom: '16px',
                border: '1px solid #d9d9d9'
              }}>
                <Text strong style={{ fontSize: '13px', color: '#fa8c16', marginBottom: '8px', display: 'block' }}>
                  📋 {t("orders.productInfo")}
                </Text>
                <Row gutter={[12, 8]}>
                  <Col span={8}>
                    <Form.Item
                      name={['product_info', 'quantity']}
                      label={t("orders.quantity")}
                      style={{ marginBottom: 8 }}
                      initialValue={1}
                    >
                      <Input 
                        type="number" 
                        min={1} 
                        defaultValue={1}
                        placeholder="1"
                        max={productStock || undefined}
                        onChange={() => updateProductTotal()}
                        prefix="📦"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item
                      name={['product_info', 'category']}
                      label={t("orders.productCategory")}
                      style={{ marginBottom: 8 }}
                    >
                      <Input 
                        placeholder={t("orders.enterProductCategory")}
                        style={{ backgroundColor: selectedProduct ? '#f6ffed' : undefined }}
                        prefix="🏷️"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Product Variants Section */}
              

                {/* Excel Variant Information Section - Always show when there's variant data */}
                <Form.Item dependencies={[['product_info', 'variant'], ['product_info', 'size'], ['product_info', 'color'], ['product_info', 'model'], ['product_info', 'style']]} noStyle>
                  {({ getFieldValue }) => {
                    const variant = getFieldValue(['product_info', 'variant']);
                    const size = getFieldValue(['product_info', 'size']);
                    const color = getFieldValue(['product_info', 'color']);
                    const model = getFieldValue(['product_info', 'model']);
                    const style = getFieldValue(['product_info', 'style']);
                    
                    const hasVariantData = variant || size || color || model || style;
                    
                    if (!hasVariantData) return null;
                    
                    return (
                      <div style={{ 
                        backgroundColor: '#fff7e6', 
                        padding: '12px', 
                        borderRadius: '6px', 
                        marginBottom: '16px',
                        border: '2px solid #ffa940'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                          <Text strong style={{ 
                            fontSize: '14px', 
                            color: '#fa8c16', 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            📋 {t("orders.variantExcel")} 
                            <Tag color="orange" size="small">
                              {t("orders.variantExcelData")}
                            </Tag>
                          </Text>
                        </div>
                        
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          {variant && (
                            <div style={{ 
                              backgroundColor: '#fff', 
                              padding: '8px', 
                              borderRadius: '4px',
                              border: '1px solid #ffd591'
                            }}>
                              <Text strong style={{ fontSize: '12px', color: '#fa8c16' }}>Variante générale:</Text>
                              <div style={{ fontSize: '13px', marginTop: '2px' }}>{variant}</div>
                            </div>
                          )}
                         
                          {color && (
                            <div style={{ 
                              backgroundColor: '#fff', 
                              padding: '8px', 
                              borderRadius: '4px',
                              border: '1px solid #ffd591'
                            }}>
                              <Text strong style={{ fontSize: '12px', color: '#fa8c16' }}>🎨 Couleur:</Text>
                              <div style={{ fontSize: '13px', marginTop: '2px' }}>{color}</div>
                            </div>
                          )}
                          {model && (
                            <div style={{ 
                              backgroundColor: '#fff', 
                              padding: '8px', 
                              borderRadius: '4px',
                              border: '1px solid #ffd591'
                            }}>
                              <Text strong style={{ fontSize: '12px', color: '#fa8c16' }}>🏷️ Modèle:</Text>
                              <div style={{ fontSize: '13px', marginTop: '2px' }}>{model}</div>
                            </div>
                          )}
                          {style && (
                            <div style={{ 
                              backgroundColor: '#fff', 
                              padding: '8px', 
                              borderRadius: '4px',
                              border: '1px solid #ffd591'
                            }}>
                              <Text strong style={{ fontSize: '12px', color: '#fa8c16' }}>✨ Style:</Text>
                              <div style={{ fontSize: '13px', marginTop: '2px' }}>{style}</div>
                            </div>
                          )}
                        </div>
                        
                        <div style={{ 
                          fontSize: '11px', 
                          color: '#8c8c8c', 
                          fontStyle: 'italic',
                          padding: '6px 8px',
                          backgroundColor: '#fff',
                          borderRadius: '4px',
                          border: '1px solid #ffd591'
                        }}>
                          💡 {t("orders.variantExcelNote")}
                        </div>
                      </div>
                    );
                  }}
                </Form.Item>
              </div>

              {/* Product Database Status Section */}
              {!selectedProduct && form.getFieldValue(['product_info', 'name']) && (
                <div style={{ 
                  backgroundColor: '#fff7e6',
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '16px',
                  border: '1px solid #ffd591'
                }}>
                  <Text strong style={{ 
                    fontSize: '13px', 
                    color: '#fa8c16', 
                    marginBottom: '8px', 
                    display: 'block' 
                  }}>
                    ⚠️ {t("products.notInDatabase")}
                  </Text>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: '12px', color: '#8c8c8c' }}>
                      "{form.getFieldValue(['product_info', 'name'])}" is not in our product database
                    </Text>
                    <Tag color="orange">
                      Manual Selection Required
                    </Tag>
                  </div>
                  <div style={{ marginTop: 8, color: '#fa8c16', fontSize: '12px' }}>
                    💡 Please select an existing product from the database manually
                  </div>
                </div>
              )}

              {/* Stock Information Section */}
              {selectedProduct && (
                <div style={{ 
                  backgroundColor: productStock <= 5 ? '#fff2f0' : '#f6ffed',
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '16px',
                  border: `1px solid ${productStock <= 5 ? '#ffccc7' : '#b7eb8f'}`
                }}>
                  <Text strong style={{ 
                    fontSize: '13px', 
                    color: productStock <= 5 ? '#ff4d4f' : '#52c41a', 
                    marginBottom: '8px', 
                    display: 'block' 
                  }}>
                    📊 {t("stock.stockStatus")}
                  </Text>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>{t("stock.currentStock")}:</Text>
                    <Tag color={productStock <= 5 ? 'red' : productStock <= 10 ? 'orange' : 'green'}>
                      {productStock} {t("stock.units")}
                    </Tag>
                  </div>
                  {productStock <= 5 && (
                    <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: '12px', fontWeight: 'bold' }}>
                      ⚠️ {t("stock.lowStockWarning")}
                    </div>
                  )}
                </div>
              )}

              {/* Description Section */}
              <div style={{ 
                backgroundColor: '#f0f2f5', 
                padding: '12px', 
                borderRadius: '6px', 
                marginBottom: '16px',
                border: '1px solid #d9d9d9'
              }}>
                <Text strong style={{ fontSize: '13px', color: '#595959', marginBottom: '8px', display: 'block' }}>
                  📝 {t("orders.productDescription")}
                </Text>
                <Form.Item
                  name={['product_info', 'description']}
                  style={{ marginBottom: 0 }}
                >
                  <TextArea
                    rows={3}
                    placeholder={t("orders.enterProductDescription")}
                    style={{ resize: 'vertical' }}
                  />
                </Form.Item>
              </div>

              {/* External Link Section */}
              {/* Product External Link Section - Only show when product exists in database */}
              {selectedProduct && (
                <div style={{ 
                  backgroundColor: '#f0f8ff', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '8px',
                  border: '1px solid #d9d9d9'
                }}>
                  <Text strong style={{ fontSize: '13px', color: '#1890ff', marginBottom: '8px', display: 'block' }}>
                    🔗 {t("orders.productExternalLink")}
                  </Text>
                  <Form.Item
                    name={['product_info', 'external_link']}
                    style={{ marginBottom: 0 }}
                  >
                    <Form.Item dependencies={[['product_info', 'external_link'], ['product_info', 'sku']]} noStyle>
                      {({ getFieldValue }) => {
                        const externalLink = getFieldValue(['product_info', 'external_link']);
                        const currentSku = getFieldValue(['product_info', 'sku']);
                        
                        // Also check if we have a selected product with external_link
                        const productExternalLink = selectedProduct?.external_link;
                      const displayLink = externalLink || productExternalLink;
                      
                      console.log('External Link Debug:', {
                        formExternalLink: externalLink,
                        selectedProductLink: productExternalLink,
                        displayLink: displayLink,
                        currentSku: currentSku
                      });
                      
                      if (!displayLink) {
                        return (
                          <div style={{ 
                            padding: '12px', 
                            border: '1px dashed #d9d9d9', 
                            borderRadius: '6px', 
                            backgroundColor: '#fafafa',
                            color: '#999',
                            fontStyle: 'italic',
                            textAlign: 'center'
                          }}>
                            🚫 {t("orders.noExternalLink") || "No external link available"}
                          </div>
                        );
                      }

                      return (
                        <div style={{ 
                          padding: '12px', 
                          border: '2px solid #1890ff', 
                          borderRadius: '6px', 
                          backgroundColor: '#f0f8ff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <LinkOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                          <Button
                            type="link"
                            style={{ 
                              padding: 0, 
                              height: 'auto',
                              color: '#1890ff',
                              textDecoration: 'underline',
                              fontSize: '14px',
                              fontWeight: '500',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '400px',
                              flex: 1
                            }}
                            onClick={() => {
                              if (displayLink.startsWith('http://') || displayLink.startsWith('https://')) {
                                window.open(displayLink, '_blank');
                              } else {
                                window.open(`https://${displayLink}`, '_blank');
                              }
                            }}
                            title={displayLink}
                          >
                            {displayLink}
                          </Button>
                          <Button
                            type="primary"
                            size="small"
                            icon={<LinkOutlined />}
                            onClick={() => {
                              if (displayLink.startsWith('http://') || displayLink.startsWith('https://')) {
                                window.open(displayLink, '_blank');
                              } else {
                                window.open(`https://${displayLink}`, '_blank');
                              }
                            }}
                          >
                            {t("orders.openLink")}
                          </Button>
                        </div>
                      );
                    }}
                  </Form.Item>
                </Form.Item>
                </div>
              )}

              {/* Info Section */}
              <div style={{ 
                backgroundColor: '#f0f0f0', 
                padding: '10px 12px', 
                borderRadius: '6px', 
                fontSize: '12px', 
                color: '#666' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  💡 <Text style={{ fontSize: '12px' }}>{t("orders.productDetailsHint")}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8c8c8c', fontSize: '11px' }}>
                  📄 <Text style={{ fontSize: '11px' }}>{t("orders.dataStorageHint")}</Text>
                </div>
                {selectedProduct && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: '#1890ff' }}>
                    📦 <Text style={{ fontSize: '11px' }}>{t("stock.autoStockDeduction")}</Text>
                  </div>
                )}
              </div>
            </Card>
          </Form.Item>
          {editingOrder && (
            <Form.Item name="status" label={t("orders.status")}>
              <Select>
                <Option value="pending">{t("orders.statuses.pending")}</Option>
                <Option value="confirmed">
                  {t("orders.statuses.confirmed")}
                </Option>
                <Option value="processing">
                  {t("orders.statuses.processing")}
                </Option>
                <Option value="out_for_delivery">
                  {t("orders.statuses.out_for_delivery")}
                </Option>
                <Option value="delivered">
                  {t("orders.statuses.delivered")}
                </Option>
                <Option value="cancelled">
                  {t("orders.statuses.cancelled")}
                </Option>
                <Option value="returned">
                  {t("orders.statuses.returned")}
                </Option>
                <Option value="on_hold">{t("orders.statuses.on_hold")}</Option>
                <Option value="0_tent">
                  {t("orders.statuses.0_tent") || "0 Tent"}
                </Option>
                <Option value="1_tent">
                  {t("orders.statuses.1_tent") || "1 Tent"}
                </Option>
                <Option value="2_tent">
                  {t("orders.statuses.2_tent") || "2 Tent"}
                </Option>
                <Option value="3_tent">
                  {t("orders.statuses.3_tent") || "3 Tent"}
                </Option>
                <Option value="4_tent">
                  {t("orders.statuses.4_tent") || "4 Tent"}
                </Option>
                <Option value="5_tent">
                  {t("orders.statuses.5_tent") || "5 Tent"}
                </Option>
                <Option value="6_tent">
                  {t("orders.statuses.6_tent") || "6 Tent"}
                </Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item dependencies={['notes']} noStyle>
            {({ getFieldValue }) => {
              return (
                <Form.Item name="notes" label={t("orders.notes")}>
                  <TextArea 
                    rows={3}
                    placeholder={t("orders.notesPlaceholder")}
                    onChange={(e) => {
                      // Update form field when user types
                      form.setFieldsValue({ notes: e.target.value });
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          
          {/* Hidden fields to preserve Excel variant information during updates */}
          <Form.Item name={['product_info', 'variant']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['product_info', 'size']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['product_info', 'color']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['product_info', 'model']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['product_info', 'style']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['product_info', 'original_product_text']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['product_info', 'matched_variant_size']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['product_info', 'matched_variant_color']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['product_info', 'matched_variant_model']} hidden>
            <Input />
          </Form.Item>
          <Form.Item name={['product_info', 'matched_variant_style']} hidden>
            <Input />
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingOrder ? t("common.save") : t("common.submit")}
              </Button>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  setEditingOrder(null);
                  form.resetFields();
                }}
              >
                {t("common.cancel")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
        
      </Modal>

      {/* Import Modal */}
      <Modal
        title={t("orders.importOrders")}
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={700}
      >
        <Alert
          message={t("orders.importInstructions")}
          description={
            <div>
              <p>{t("dashboard.uploadHint")}</p>
              <div style={{ marginTop: 12 }}>
                <Text strong>Supported formats:</Text>
                <ul style={{ marginTop: 8, marginBottom: 0 }}>
                  <li>
                    <Text strong>NOEST EXPRESS Format:</Text> ID, Réf, Client,
                    Tel 1, Tel 2, Adresse, Commune, Wilaya, Total, Remarque,
                    Produits
                  </li>
                  <li>
                    <Text strong>Legacy Format:</Text> FULL_NAME, PHONE,
                    COMMUNE, WILAYA, PRODUCT, PRIX total, etc.
                  </li>
                </ul>
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Upload.Dragger
          accept=".xlsx,.xls,.csv"
          multiple={false}
          beforeUpload={handleFileUpload}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">{t("dashboard.uploadText")}</p>
          <p className="ant-upload-hint">
            Excel (.xlsx, .xls) or CSV files. Format will be auto-detected.
          </p>
        </Upload.Dragger>

        {uploading && (
          <div style={{ marginTop: 16 }}>
            <Spin />
            <Text style={{ marginLeft: 8 }}>{t("dashboard.uploading")}</Text>
          </div>
        )}
      </Modal>

      {/* Distribution Modal */}
      <Modal
        title={t("orders.distribution.title")}
        open={distributionModalVisible}
        onCancel={() => {
          setDistributionModalVisible(false);
          setSelectedAlgorithm("");
        }}
        onOk={async () => {
          if (!selectedAlgorithm) {
            message.error(t("orders.distribution.selectAlgorithm"));
            return;
          }

          setDistributionModalVisible(false);
          await handleDistributeOrders(selectedAlgorithm);
        }}
        confirmLoading={distributionLoading}
        okText={t("orders.distribution.distribute")}
        cancelText={t("common.cancel")}
        width={600}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text>{t("orders.distribution.selectAlgorithmDescription")}</Text>
          <Radio.Group
            value={selectedAlgorithm}
            onChange={(e) => setSelectedAlgorithm(e.target.value)}
            style={{ width: "100%" }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Radio value="round_robin">
                <Space direction="vertical" size={0}>
                  <Text strong>
                    {t("orders.distribution.algorithms.roundRobin")}
                  </Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {t("orders.distribution.algorithms.roundRobinDesc")}
                  </Text>
                </Space>
              </Radio>
              <Radio value="balanced_workload">
                <Space direction="vertical" size={0}>
                  <Text strong>
                    {t("orders.distribution.algorithms.balancedWorkload")}
                  </Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {t("orders.distribution.algorithms.balancedWorkloadDesc")}
                  </Text>
                </Space>
              </Radio>
              <Radio value="performance_based">
                <Space direction="vertical" size={0}>
                  <Text strong>
                    {t("orders.distribution.algorithms.performanceBased")}
                  </Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>
                    {t("orders.distribution.algorithms.performanceBasedDesc")}
                  </Text>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </Space>
      </Modal>

      {/* Tracking Details Modal */}
      <Modal
        title={
          <Space>
            <TruckOutlined />
            {t("tracking.trackingDetails")}
            {selectedOrder && ` - ${selectedOrder.order_number}`}
          </Space>
        }
        open={trackingModalVisible}
        onCancel={() => {
          setTrackingModalVisible(false);
          setSelectedOrder(null);
          setEcotrackDetails(null);
        }}
        footer={[
          <Button key="close" onClick={() => setTrackingModalVisible(false)}>
            {t("common.close")}
          </Button>,
        ]}
        width={800}
      >
        {ecotrackLoading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text>{t("tracking.loadingEcotrack")}</Text>
            </div>
          </div>
        ) : ecotrackDetails ? (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label={t("tracking.trackingId")}>
                <Text copyable>{selectedOrder?.ecotrack_tracking_id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.status")}>
                <Tag color="blue">
                  {ecotrackDetails.OrderInfo?.status || "Unknown"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.recipient")}>
                {ecotrackDetails.recipientName || t("tracking.unknown")}
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.phone")}>
                {ecotrackDetails.OrderInfo?.phone || t("tracking.unknown")}
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.location")}>
                {ecotrackDetails.OrderInfo?.commune || t("tracking.unknown")}
              </Descriptions.Item>
              <Descriptions.Item label={t("tracking.amount")}>
                {ecotrackDetails.OrderInfo?.prix || t("tracking.unknown")}
              </Descriptions.Item>
            </Descriptions>

            {ecotrackDetails.activity &&
              ecotrackDetails.activity.length > 0 && (
                <div>
                  <h4>{t("tracking.ecotrackHistory")}</h4>
                  <Timeline mode="left">
                    {ecotrackDetails.activity.map((item, index) => (
                      <Timeline.Item
                        key={index}
                        color={index === 0 ? "blue" : "green"}
                      >
                        <div>
                          <Text strong>{item.event}</Text>
                          <div style={{ color: "#666", fontSize: "12px" }}>
                            {new Date(item.date).toLocaleString()}
                          </div>
                          {item.event_key && (
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary">
                                Status: {item.event_key}
                              </Text>
                            </div>
                          )}
                        </div>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </div>
              )}
          </div>
        ) : (
          <Alert
            message={t("tracking.noTrackingData")}
            description={t("tracking.noTrackingDataDesc")}
            type="info"
            showIcon
          />
        )}
      </Modal>

      {/* Google Sheets Auto-Sync Status Modal */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined />
            {t("orders.googleSheetsAutoSync")}
          </Space>
        }
        open={googleSheetsModalVisible}
        onCancel={() => setGoogleSheetsModalVisible(false)}
        footer={null}
        width={700}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          {/* Authentication Status */}
          <Card size="small">
            <Space>
              <Text strong>{t("orders.authenticationStatus")}:</Text>
              {googleAuthStatus?.isAuthenticated ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  {t("orders.authenticated")}
                </Tag>
              ) : (
                <Tag color="red" icon={<ExclamationCircleOutlined />}>
                  {t("orders.notAuthenticated")}
                </Tag>
              )}
            </Space>
            {!googleAuthStatus?.isAuthenticated && (
              <div style={{ marginTop: 8 }}>
                <Button 
                  type="primary" 
                  size="small"
                  onClick={async () => {
                    try {
                      await googleAuthService.openAuthPopup();
                      const status = await googleAuthService.getAuthStatus();
                      setGoogleAuthStatus(status);
                      message.success(t("orders.authenticationSuccess"));
                    } catch (error) {
                      message.error(t("orders.authenticationError"));
                    }
                  }}
                >
                  {t("orders.authenticateGoogle")}
                </Button>
              </div>
            )}
          </Card>

          {/* Auto-Sync Information */}
          <Alert
            message={t("orders.autoSyncEnabled")}
            description={t("orders.autoSyncDescription")}
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
          />

          {/* How It Works */}
          <Card title={t("orders.howItWorks")} size="small">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Text strong>1. {t("orders.automaticImport")}</Text>
                <br />
                <Text type="secondary">{t("orders.automaticImportDesc")}</Text>
              </div>
              <div>
                <Text strong>2. {t("orders.automaticTracking")}</Text>
                <br />
                <Text type="secondary">{t("orders.automaticTrackingDesc")}</Text>
              </div>
              <div>
                <Text strong>3. {t("orders.automaticSync")}</Text>
                <br />
                <Text type="secondary">{t("orders.automaticSyncDesc")}</Text>
              </div>
            </Space>
          </Card>

          {/* Statistics */}
          <Card title={t("orders.syncStatistics")} size="small">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title={t("orders.ordersWithSource")}
                  value={orders.filter(order => order.source_spreadsheet_id).length}
                  total={orders.length}
                  suffix={`/ ${orders.length}`}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={t("orders.autoSyncReady")}
                  value={Math.round((orders.filter(order => order.source_spreadsheet_id).length / Math.max(orders.length, 1)) * 100)}
                  suffix="%"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title={t("orders.lastSync")}
                  value={new Date().toLocaleTimeString()}
                />
              </Col>
            </Row>
          </Card>

          {/* Configuration Options */}
          <Form layout="vertical">
            <Form.Item>
              <Space>
                <Switch
                  checked={googleSheetsEnabled}
                  onChange={setGoogleSheetsEnabled}
                  disabled={!googleAuthStatus?.isAuthenticated}
                />
                <Text>{t("orders.enableAutoSync")}</Text>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {t("orders.enableAutoSyncDesc")}
                </Text>
              </div>
            </Form.Item>

            {/* Manual Sync Section */}
            <Form.Item>
              <div style={{ marginBottom: 8 }}>
                <Text strong>{t("orders.manualSync")}</Text>
              </div>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  type="default"
                  icon={<SyncOutlined />}
                  loading={loading}
                  onClick={handleManualSyncAllOrders}
                  disabled={!googleAuthStatus?.isAuthenticated || !googleSheetsEnabled}
                  block
                >
                  {t("orders.syncNow")}
                </Button>
                <Button
                  type="dashed"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    const ordersWithSource = allOrders.filter(order => 
                      order.source_spreadsheet_id && 
                      order.source_sheet_name && 
                      order.order_number
                    );
                    const ordersWithPartialSource = allOrders.filter(order => 
                      order.source_spreadsheet_id || 
                      order.source_sheet_name || 
                      order.source_file_name
                    );
                    
                    Modal.info({
                      title: t("orders.sourceTrackingStatus"),
                      content: (
                        <div>
                          <p><strong>{t("orders.totalOrders")}:</strong> {orders.length}</p>
                          <p><strong>{t("orders.ordersWithCompleteSource")}:</strong> {ordersWithSource.length}</p>
                          <p><strong>{t("orders.ordersWithPartialSource")}:</strong> {ordersWithPartialSource.length}</p>
                          <p><strong>{t("orders.ordersWithoutSource")}:</strong> {allOrders.length - ordersWithPartialSource.length}</p>
                          <br />
                          <p style={{ fontSize: '12px', color: '#666' }}>
                            {t("orders.sourceTrackingExplanation")}
                          </p>
                        </div>
                      ),
                      width: 500
                    });
                  }}
                  size="small"
                  block
                >
                  {t("orders.checkSourceStatus")}
                </Button>
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {t("orders.syncNowDesc")}
                </Text>
              </div>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button 
                  type="primary"
                  onClick={() => {
                    const newConfig = { enabled: googleSheetsEnabled, autoSync: true };
                    setGoogleSheetsConfig(newConfig);
                    localStorage.setItem('googleSheetsConfig', JSON.stringify(newConfig));
                    message.success(t("orders.configurationSaved"));
                    setGoogleSheetsModalVisible(false);
                  }}
                  disabled={!googleAuthStatus?.isAuthenticated}
                >
                  {t("common.save")}
                </Button>
                <Button onClick={() => setGoogleSheetsModalVisible(false)}>
                  {t("common.close")}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      {/* Bulk Delivery Confirmation Modal */}
      <Modal
        title={t('orders.bulkDeliveryConfirmation')}
        open={bulkDeliveryModalVisible}
        onOk={() => executeBulkSendToDelivery()}
        onCancel={() => setBulkDeliveryModalVisible(false)}
        confirmLoading={bulkSendToDeliveryLoading}
        okText={t('orders.confirmSendToDelivery')}
        cancelText={t('common.cancel')}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>{t('orders.bulkDeliveryWarning')}</Text>
        </div>
        
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label={t('orders.totalSelected')}>
            {selectedRowKeys.length}
          </Descriptions.Item>
          <Descriptions.Item label={t('orders.confirmedOrders')}>
            {selectedOrders.filter(order => order.status === 'confirmed').length}
          </Descriptions.Item>
          <Descriptions.Item label={t('orders.nonConfirmedOrders')}>
            {selectedOrders.filter(order => order.status !== 'confirmed').length}
          </Descriptions.Item>
        </Descriptions>

        {selectedOrders.filter(order => order.status !== 'confirmed').length > 0 && (
          <Alert
            message={t('orders.nonConfirmedWarning')}
            description={t('orders.nonConfirmedDescription')}
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        <div style={{ marginTop: 16 }}>
          <Text strong>{t('orders.ordersSummary')}:</Text>
          <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
            {selectedOrders.filter(order => order.status === 'confirmed').map(order => (
              <div key={order.id} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text>#{order.id} - {order.client_name} - {order.total_amount} DA</Text>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrderManagement;
