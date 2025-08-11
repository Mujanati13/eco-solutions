import React, { useState, useEffect } from "react";
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
} from "@ant-design/icons";
import { orderService } from "../../services/orderService";
import { userService } from "../../services/userService";
import orderProductService from "../../services/orderProductService";
import stockService from "../../services/stockService";
import variantService from "../../services/variantService";
import googleAuthService from "../../services/googleAuthService";
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
  const [allOrders, setAllOrders] = useState([]); // Store all orders for frontend filtering
  const [filteredOrders, setFilteredOrders] = useState([]); // Store filtered orders
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
  
  // Final total calculation state
  const [finalTotal, setFinalTotal] = useState(0);
  
  // Multi-selection and bulk operations state
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkSendToDeliveryLoading, setBulkSendToDeliveryLoading] = useState(false);
  const [bulkDeliveryModalVisible, setBulkDeliveryModalVisible] = useState(false);

  // Product and stock tracking state
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productStock, setProductStock] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

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

  // Calculate statistics from orders
  const calculateStatistics = () => {
    const stats = {
      total: filteredOrders.length,
      pending: 0,
      confirmed: 0,
      processing: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
      totalAmount: 0,
      averageAmount: 0,
    };

    filteredOrders.forEach(order => {
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
    if (canAssignOrders) {
      fetchUsers();
    }
    
    // Debug function for checking tracking IDs
    window.debugTrackingIds = () => {
      console.log('🔍 Debug: All orders with EcoTrack tracking IDs:');
      const ordersWithTracking = allOrders.filter(order => order.ecotrack_tracking_id);
      
      if (ordersWithTracking.length === 0) {
        console.log('❌ No orders found with EcoTrack tracking IDs');
        console.log('Available orders:', allOrders.length);
        return;
      }
      
      ordersWithTracking.forEach(order => {
        console.log(`Order ${order.id} (${order.order_number}):`, {
          tracking_id: order.ecotrack_tracking_id,
          type: typeof order.ecotrack_tracking_id,
          length: order.ecotrack_tracking_id?.toString().length,
          trimmed: order.ecotrack_tracking_id?.toString().trim(),
          status: order.status,
          ecotrack_synced: order.ecotrack_synced
        });
      });
      
      console.log(`📊 Total orders with tracking: ${ordersWithTracking.length}`);
    };
    
    // Debug function to test delete API with specific tracking ID
    window.testEcotrackDelete = async (trackingId, orderId = null) => {
      try {
        console.log(`🧪 Testing EcoTrack delete API via backend:`, {
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
    console.log('- window.debugTrackingStorage() - Analyze tracking ID storage');

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

  // Frontend filtering effect
  useEffect(() => {
    applyFrontendFilters();
  }, [searchText, allOrders, statusFilter, assignedToFilter]);

  const applyFrontendFilters = () => {
    let filtered = [...allOrders];

    // Apply phone search filter
    if (searchText && searchText.trim()) {
      const searchTerm = searchText.trim().toLowerCase();
      filtered = filtered.filter(order => 
        (order.customer_phone && 
         order.customer_phone.toLowerCase().includes(searchTerm)) ||
        (order.customer_name && 
         order.customer_name.toLowerCase().includes(searchTerm))
      );
      console.log('📱 Frontend filtering by phone/name:', searchTerm);
      console.log('📊 Filtered results:', filtered.length);
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Apply assigned to filter
    if (assignedToFilter) {
      if (assignedToFilter === "null") {
        filtered = filtered.filter(order => !order.assigned_to);
      } else {
        filtered = filtered.filter(order => order.assigned_to == assignedToFilter);
      }
    }

    setFilteredOrders(filtered);
    
    // Update pagination total based on filtered results
    setPagination(prev => ({
      ...prev,
      total: filtered.length,
      current: 1 // Reset to first page when filtering
    }));
  };

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

  const fetchOrdersWithProducts = async () => {
    try {
      const response = await orderProductService.getOrdersWithProducts();
      setOrdersWithProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching orders with products:', error);
      // Don't show error message as this is supplementary data
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await userService.getUsers();

      // Based on your API format, the response should have { users: [...], pagination: {...} }
      const usersData = response.users || [];

      // Ensure usersData is an array
      const finalUsers = Array.isArray(usersData) ? usersData : [];
      setUsers(finalUsers);
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
    // This will trigger the filtering effect and show all orders
  };

  // Delivery management functions
  const fetchWilayas = async () => {
    try {
      setLoadingWilayas(true);
      const response = await orderService.getWilayas();
      if (response.success) {
        setWilayas(response.data);
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
      const response = await orderService.getBaladiasByWilaya(wilayaId);
      console.log('Baladias response:', response);
      if (response.success) {
        setBaladias(response.data);
        console.log('Set baladias:', response.data.length, 'items');
      }
    } catch (error) {
      console.error("Error fetching baladias:", error);
      message.error(t("delivery.errorFetchingBaladias"));
    } finally {
      setLoadingBaladias(false);
    }
  };

  const handleWilayaChange = (wilayaId) => {
    setSelectedWilaya(wilayaId);

    if (wilayaId) {
      // Calculate delivery price based on wilaya selection only
      setTimeout(() => {
        calculateDeliveryPrice();
      }, 100);
      
      console.log('🚚 Wilaya selected for delivery pricing:', wilayaId);
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

  const calculateDeliveryPrice = async () => {
    try {
      const formValues = form.getFieldsValue();
      const { wilaya_id, delivery_type, weight } = formValues;

      if (!wilaya_id) return;

      setLoadingDeliveryPrice(true);

      // Auto-calculate Prix de Livraison based on selected wilaya only
      const pricingData = {
        wilaya_id,
        delivery_type: delivery_type || "home",
        weight: weight || 1,
        pricing_level: "wilaya" // Always use wilaya-based pricing
      };

      const response = await orderService.calculateDeliveryPrice(pricingData);

      if (response.success && response.data) {
        // Handle different response formats from the API
        const deliveryPrice =
          response.data.delivery_price || response.data.price || 0;
        form.setFieldsValue({ delivery_price: deliveryPrice });
        
        // Update final total after delivery price is set
        setTimeout(() => {
          updateFinalTotal();
        }, 100);
        
        console.log('✅ Prix de Livraison auto-calculated from wilaya:', {
          wilaya_id,
          delivery_price: deliveryPrice
        });
      }
    } catch (error) {
      console.error("Error calculating delivery price:", error);
      message.error(t("delivery.errorCalculatingPrice"));
    } finally {
      setLoadingDeliveryPrice(false);
    }
  };

  const handleDeliveryFieldChange = () => {
    // Debounce the calculation
    setTimeout(() => {
      calculateDeliveryPrice();
      updateFinalTotal(); // Also update final total when delivery fields change
    }, 500);
  };

  // Load wilayas when component mounts
  useEffect(() => {
    fetchWilayas();
    fetchProducts();
  }, []);

  // Update final total when form values change
  useEffect(() => {
    updateFinalTotal();
  }, [form]);

  // Watch for wilaya_id changes and auto-calculate delivery price
  useEffect(() => {
    const wilaya_id = form.getFieldValue('wilaya_id');
    if (wilaya_id) {
      console.log('🔄 Wilaya detected in form, auto-calculating Prix de Livraison...');
      setTimeout(() => {
        calculateDeliveryPrice();
      }, 200);
    }
  }, [form.getFieldValue('wilaya_id')]);

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
          total_amount: product.selling_price.toFixed(2) // Set total_amount to unit price (this is now the main price field)
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
    // Get current form values
    const formValues = form.getFieldsValue();
    const quantity = parseFloat(formValues.product_info?.quantity || 0);
    const unitPrice = parseFloat(formValues.total_amount || 0); // total_amount now represents unit price
    const productTotal = quantity * unitPrice;
    const deliveryPrice = parseFloat(formValues.delivery_price || 0);
    const calculatedFinalTotal = productTotal + deliveryPrice;
    
    // Update final total state
    setFinalTotal(calculatedFinalTotal);
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
      // Calculate final total
      const totalAmount = parseFloat(values.total_amount || 0);
      const deliveryPrice = parseFloat(values.delivery_price || 0);
      const finalTotal = totalAmount + deliveryPrice;

      // Transform product_info to product_details JSON string
      const orderData = {
        ...values,
        final_total: finalTotal,
        product_details: values.product_info ? JSON.stringify(values.product_info) : "",
      };

      // Remove the nested product_info since we've converted it to product_details
      delete orderData.product_info;

      await orderService.createOrder(orderData);
      message.success(t("orders.createSuccess"));
      setModalVisible(false);
      form.resetFields();
      fetchOrders();
      fetchOrdersWithProducts(); // Refresh product data too
    } catch (error) {
      message.error(t("orders.createError"));
    }
  };

  const handleUpdateOrder = async (values) => {
    try {
      // Calculate final total
      const totalAmount = parseFloat(values.total_amount || 0);
      const deliveryPrice = parseFloat(values.delivery_price || 0);
      const finalTotal = totalAmount + deliveryPrice;

      // Transform product_info to product_details JSON string
      const orderData = {
        ...values,
        final_total: finalTotal,
        product_details: values.product_info ? JSON.stringify(values.product_info) : "",
      };

      // Remove the nested product_info since we've converted it to product_details
      delete orderData.product_info;

      await orderService.updateOrder(editingOrder.id, orderData);
      message.success(t("orders.updateSuccess"));
      setModalVisible(false);
      setEditingOrder(null);
      form.resetFields();
      fetchOrders();
      fetchOrdersWithProducts(); // Refresh product data too
    } catch (error) {
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
              // Just refresh the data and return early
              fetchOrders();
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
          fetchOrders();
        }, 2000);
      } else {
        // Show success message for other status changes
        message.success(t("orders.statusUpdateSuccess"));
        fetchOrders();
      }
    } catch (error) {
      message.error(t("orders.statusUpdateError"));
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
  const handleRowSelectionChange = (selectedRowKeys, selectedRows) => {
    console.log('🔲 Selected rows changed:', { selectedRowKeys, selectedRows });
    setSelectedRowKeys(selectedRowKeys);
    setSelectedOrders(selectedRows);
  };

  const handleSelectAll = () => {
    const allRowKeys = filteredOrders.map(order => order.id);
    setSelectedRowKeys(allRowKeys);
    setSelectedOrders(filteredOrders);
    message.info(t('orders.selectedAllOrders', { count: filteredOrders.length }));
  };

  const handleClearSelection = () => {
    setSelectedRowKeys([]);
    setSelectedOrders([]);
    // message.info(t('orders.selectionCleared'));
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
            montant: parseFloat(order.total_amount) || 0,
            remarque: order.notes || order.remarks || '',
            produit: order.product_details ? 
              (typeof order.product_details === 'string' ? 
                JSON.parse(order.product_details).name : 
                order.product_details.name) || 'Produit' : 'Produit',
            type_id: 1, // Standard delivery
            poids: 1, // Default weight
            stop_desk: 0, // Home delivery
            stock: 0,
            can_open: 0
          };
          
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
          const missingFields = requiredFields.filter(field => !ecotrackData[field] || ecotrackData[field] === '');
          
          if (missingFields.length > 0) {
            console.error(`❌ Missing required fields for order ${order.id}:`, missingFields);
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }

          console.log(`📋 Sending order ${order.id} to EcoTrack with data:`, {
            reference: ecotrackData.reference,
            client: ecotrackData.client,
            phone: ecotrackData.phone,
            adresse: ecotrackData.adresse,
            wilaya_id: ecotrackData.wilaya_id,
            commune: ecotrackData.commune || '(empty)',
            montant: ecotrackData.montant,
            produit: ecotrackData.produit
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

  const columns = [
    {
      title: t("orders.orderNumber"),
      dataIndex: "order_number",
      key: "order_number",
      width: 120,
      fixed: 'left',
      render: (orderNumber) => (
        <Tooltip title={orderNumber}>
          <Text strong style={{ color: '#1890ff' }}>
            #{orderNumber}
          </Text>
        </Tooltip>
      ),
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
      render: (status, record) => {
        const statusText = t(`orders.statuses.${status}`);
        const truncatedText = statusText.length > 12 ? statusText.substring(0, 12) + "..." : statusText;
        
        const statusMenu = (
          <Menu onClick={({ key }) => handleStatusChange(record.id, key)}>
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
          <Dropdown overlay={statusMenu} trigger={["click"]}>
            <Tag 
              color={getStatusColor(status)} 
              size="small" 
              style={{ cursor: "pointer", maxWidth: "100px" }}
            >
              <Tooltip title={statusText}>
                {truncatedText}
              </Tooltip>
            </Tag>
          </Dropdown>
        );
      },
    },
    {
      title: t("orders.totalAmount"),
      dataIndex: "total_amount",
      key: "total_amount",
      width: 100,
      responsive: ["sm"],
      render: (amount) => <Text strong>{`${amount || 0} DA`}</Text>,
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
            onClick={async () => {
              setEditingOrder(record);
              
              // Parse product_details if it exists and is valid JSON
              let productInfo = {};
              if (record.product_details) {
                try {
                  const parsed = typeof record.product_details === 'string' 
                    ? JSON.parse(record.product_details) 
                    : record.product_details;
                  
                  // If it's already an object with the expected structure, use it
                  if (parsed && typeof parsed === 'object') {
                    productInfo = parsed;
                  }
                } catch (error) {
                  console.warn('Could not parse product_details as JSON:', error);
                  // If parsing fails, try to extract info from string
                  productInfo = { description: record.product_details };
                }
              }

              // Set initial form values
              form.setFieldsValue({
                ...record,
                product_info: productInfo,
              });
              setModalVisible(true);
              
              // Auto-select product based on name match
              setTimeout(async () => {
                console.log('🚀 Starting auto-selection process for imported order...');
                
                if (productInfo.name) {
                  try {
                    console.log(`🔍 Attempting to auto-select product: "${productInfo.name}"`);
                    const matchedProduct = await autoSelectProductByName(productInfo.name);
                    if (matchedProduct) {
                      console.log('✅ Auto-selected product successfully:', matchedProduct.name, 'SKU:', matchedProduct.sku);
                    } else {
                      console.log('❌ No matching product found in database for:', productInfo.name);
                      console.log('💡 Available products:', products.map(p => p.name).slice(0, 5).join(', '), products.length > 5 ? '...' : '');
                      
                      // Show a notification that the product is not in the database
                      message.info(`Product "${productInfo.name}" from Excel not found in product database. Please select manually.`, 5);
                    }
                  } catch (error) {
                    console.warn('❌ Error during product auto-selection:', error);
                  }
                } else {
                  console.log('⚠️ No product name in import data for auto-selection');
                }

                // Auto-select variant from Excel import data
                if (productInfo) {
                  try {
                    const variantInfo = await autoSelectVariantFromExcel(productInfo);
                    if (variantInfo) {
                      console.log('✅ Auto-selected variant info:', variantInfo);
                      if (variantInfo.matched_variant_name) {
                        console.log('🎯 Matched with store variant:', variantInfo.matched_variant_name);
                      }
                    }
                  } catch (error) {
                    console.warn('❌ Error during variant auto-selection:', error);
                  }
                }
                
                // Update final total after form is populated and product selection
                updateFinalTotal();
              }, 800); // Increased delay to ensure modal is fully loaded
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
            <Dropdown overlay={getAssignmentMenu(record)} trigger={["click"]}>
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
  ];

  // Get paginated data from filtered orders
  const getPaginatedOrders = () => {
    const startIndex = (pagination.current - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return filteredOrders.slice(startIndex, endIndex);
  };

  const paginatedOrders = getPaginatedOrders();

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
            <Col>
              <Space>
                <Button
                  type="primary"
                  icon={<TruckOutlined />}
                  onClick={handleBulkSendToDelivery}
                  disabled={selectedOrders.filter(order => order.status === 'confirmed').length === 0}
                >
                  {t('orders.sendToDelivery')}
                </Button>
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
                ],
              }}
              placement="bottomRight"
            >
              <Button size="small" icon={<SettingOutlined />}>
                {t("common.actions")} <DownOutlined />
              </Button>
            </Dropdown>
          </Col>
        </Row>
      </Card>

      {/* Orders Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={paginatedOrders}
          rowKey="id"
          loading={loading}
          size="small"
          rowSelection={{
            selectedRowKeys,
            onChange: handleRowSelectionChange,
            getCheckboxProps: (record) => ({
              disabled: record.status !== 'confirmed', // Only enable selection for confirmed orders
            }),
          }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: filteredOrders.length, // Use filtered orders length
            showSizeChanger: true,
            showQuickJumper: true,
            responsive: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} ${t("dashboard.outOf")} ${total}${searchText ? ` (filtered from ${allOrders.length})` : ''}`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
          }}
          scroll={{ x: 1200, y: 600 }}
        />
      </Card>

      {/* Create/Edit Order Modal */}
      <Modal
        title={editingOrder ? t("orders.editOrder") : t("orders.createOrder")}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingOrder(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingOrder ? handleUpdateOrder : handleCreateOrder}
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
            // rules={[
            //   { required: true, message: t("orders.customerAddressRequired") },
            // ]}
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
                    optionFilterProp="children"
                    onChange={handleWilayaChange}
                    loading={loadingWilayas}
                    filterOption={(input, option) =>
                      option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                    }
                  >
                    {wilayas.map((wilaya) => (
                      <Option key={wilaya.id} value={wilaya.id}>
                        {wilaya.code} - {wilaya.name_fr}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="baladia_name"
                  label={t("delivery.baladia")}
                >
                  <Input
                    placeholder={t("delivery.baladiaFromExcel")}
                    prefix=""
                    disabled
                    style={{ 
                      backgroundColor: '#f0f9ff',
                      borderColor: '#3b82f6',
                      color: '#1e40af'
                    }}
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
                    onChange={handleDeliveryFieldChange}
                  >
                    <Option value="home">
                       {t("delivery.types.home")}
                    </Option>
                    <Option value="office">
                       {t("delivery.types.office")}
                    </Option>
                    <Option value="pickup_point">
                       {t("delivery.types.pickup_point")}
                    </Option>
                    <Option value="les_changes">
                       les changes
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item
                  name="delivery_price"
                  label={t("delivery.deliveryPrice")}
                >
                  <Input
                    type="number"
                    suffix="DA"
                    placeholder="0"
                    min={0}
                    onChange={handleDeliveryFieldChange}
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
                        disabled={selectedProduct}
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
                        disabled={selectedProduct}
                        prefix="🏷️"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Product Variants Section */}
                <div style={{ 
                  backgroundColor: '#f9f9f9', 
                  padding: '12px', 
                  borderRadius: '6px', 
                  marginBottom: '16px',
                  border: '1px solid #e0e0e0'
                }}>
                  <Text strong style={{ 
                    fontSize: '13px', 
                    color: '#666', 
                    marginBottom: '12px', 
                    display: 'block' 
                  }}>
                    🎨 {t("orders.productVariants")} {t("orders.autoSelected")}
                  </Text>
                  
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item
                        name={['product_info', 'size']}
                        label={t("orders.size")}
                        style={{ marginBottom: 8 }}
                      >
                        <Input 
                          placeholder={t("orders.enterSize")}
                          prefix="📏"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name={['product_info', 'color']}
                        label={t("orders.color")}
                        style={{ marginBottom: 8 }}
                      >
                        <Input 
                          placeholder={t("orders.enterColor")}
                          prefix="🎨"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item
                        name={['product_info', 'model']}
                        label={t("orders.model")}
                        style={{ marginBottom: 8 }}
                      >
                        <Input 
                          placeholder={t("orders.enterModel")}
                          prefix="🏷️"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name={['product_info', 'style']}
                        label={t("orders.style")}
                        style={{ marginBottom: 8 }}
                      >
                        <Input 
                          placeholder={t("orders.enterStyle")}
                          prefix="✨"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Matched Variant Information - Only show when product exists in database */}
                  {selectedProduct && (
                    <>
                      <Form.Item
                        name={['product_info', 'matched_variant_name']}
                        label={t("orders.matchedVariant")}
                        style={{ marginBottom: 8 }}
                      >
                        <Input 
                          placeholder={t("orders.matchedVariantFromStore")}
                          prefix="✅"
                          disabled
                          style={{ 
                            backgroundColor: '#f0f9ff',
                            borderColor: '#10b981',
                            color: '#047857'
                          }}
                        />
                      </Form.Item>

                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item
                            name={['product_info', 'variant']}
                            label={t("orders.excelVariant")}
                            style={{ marginBottom: 8 }}
                          >
                            <Input 
                              placeholder={t("orders.variantFromExcel")}
                              prefix="📋"
                              disabled
                              style={{ backgroundColor: '#fafafa' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name={['product_info', 'variant_price']}
                            label={t("orders.variantPrice")}
                            style={{ marginBottom: 8 }}
                          >
                            <Input 
                              placeholder={t("orders.priceFromVariant")}
                              prefix="💰"
                              disabled
                              style={{ backgroundColor: '#fafafa' }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                </div>
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
          <Form.Item name="notes" label={t("orders.notes")}>
            <TextArea rows={3} />
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
