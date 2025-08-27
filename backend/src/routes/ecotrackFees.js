const express = require('express');
const router = express.Router();

// Add CORS headers for this specific route
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// EcoTrack API configuration
const ECOTRACK_CONFIG = {
  baseUrl: 'https://app.noest-dz.com/api/public',
  api_token: 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG',
  user_guid: '2QG0JDFP'
};

// Cache for fees data to avoid repeated API calls
let feesCache = null;
let cacheTimestamp = null;
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch delivery fees from EcoTrack API
 * GET /api/ecotrack-fees
 */
router.get('/', async (req, res) => {
  try {
    console.log('🌐 Fetching delivery fees from EcoTrack API...');
    
    // Check cache first
    const now = Date.now();
    if (feesCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_EXPIRY) {
      console.log('📋 Returning cached EcoTrack fees data');
      return res.json({
        success: true,
        data: feesCache,
        cached: true,
        cache_age: Math.round((now - cacheTimestamp) / 1000)
      });
    }

    // Try different methods to call EcoTrack API
    let response;
    let method = 'unknown';

    try {
      // Method 1: GET with query parameters
      console.log('📡 Trying GET method...');
      const params = new URLSearchParams({
        api_token: ECOTRACK_CONFIG.api_token,
        user_guid: ECOTRACK_CONFIG.user_guid
      });
      
      response = await fetch(`${ECOTRACK_CONFIG.baseUrl}/fees?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      method = 'GET';
      
      if (!response.ok && response.status === 405) {
        throw new Error('GET method not allowed');
      }
    } catch (error) {
      console.log('❌ GET method failed:', error.message);
      
      try {
        // Method 2: POST with FormData
        console.log('📡 Trying POST with FormData...');
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('api_token', ECOTRACK_CONFIG.api_token);
        formData.append('user_guid', ECOTRACK_CONFIG.user_guid);

        response = await fetch(`${ECOTRACK_CONFIG.baseUrl}/fees`, {
          method: 'POST',
          body: formData
        });
        method = 'POST (FormData)';
        
        if (!response.ok && response.status === 405) {
          throw new Error('POST FormData method not allowed');
        }
      } catch (formError) {
        console.log('❌ POST FormData method failed:', formError.message);
        
        // Method 3: POST with JSON
        console.log('📡 Trying POST with JSON...');
        response = await fetch(`${ECOTRACK_CONFIG.baseUrl}/fees`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_token: ECOTRACK_CONFIG.api_token,
            user_guid: ECOTRACK_CONFIG.user_guid
          })
        });
        method = 'POST (JSON)';
      }
    }

    if (!response.ok) {
      throw new Error(`EcoTrack API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ EcoTrack fees received via ${method}:`, Object.keys(data));

    // Validate response structure
    if (!data.tarifs || !data.tarifs.return) {
      throw new Error('Invalid EcoTrack API response structure');
    }

    // Update cache
    feesCache = data;
    cacheTimestamp = now;

    console.log(`📊 Cached fees for ${Object.keys(data.tarifs.return).length} wilayas`);

    res.json({
      success: true,
      data: data,
      method: method,
      cached: false,
      wilayas_count: Object.keys(data.tarifs.return).length
    });

  } catch (error) {
    console.error('❌ EcoTrack fees API error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get delivery price for specific wilaya and delivery type
 * GET /api/ecotrack-fees/price?wilaya_id=16&delivery_type=home
 */
router.get('/price', async (req, res) => {
  try {
    const { wilaya_id, delivery_type = 'home' } = req.query;

    if (!wilaya_id) {
      return res.status(400).json({
        success: false,
        error: 'wilaya_id parameter is required'
      });
    }

    console.log(`💰 Getting delivery price for wilaya ${wilaya_id}, type: ${delivery_type}`);

    // Get fees data directly (avoid recursive call)
    const now = Date.now();
    if (!feesCache || !cacheTimestamp || (now - cacheTimestamp) >= CACHE_EXPIRY) {
      console.log('📋 Cache expired or empty, fetching fresh fees data...');
      
      // Try different methods to call EcoTrack API
      let response;
      let method = 'unknown';

      try {
        // Method 1: GET with query parameters
        console.log('📡 Trying GET method...');
        const params = new URLSearchParams({
          api_token: ECOTRACK_CONFIG.api_token,
          user_guid: ECOTRACK_CONFIG.user_guid
        });
        
        response = await fetch(`${ECOTRACK_CONFIG.baseUrl}/fees?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        });
        method = 'GET';
        
        if (!response.ok && response.status === 405) {
          throw new Error('GET method not allowed');
        }
      } catch (error) {
        console.log('❌ GET method failed:', error.message);
        
        try {
          // Method 2: POST with FormData
          console.log('📡 Trying POST with FormData...');
          const FormData = require('form-data');
          const formData = new FormData();
          formData.append('api_token', ECOTRACK_CONFIG.api_token);
          formData.append('user_guid', ECOTRACK_CONFIG.user_guid);

          response = await fetch(`${ECOTRACK_CONFIG.baseUrl}/fees`, {
            method: 'POST',
            body: formData
          });
          method = 'POST (FormData)';
          
          if (!response.ok && response.status === 405) {
            throw new Error('POST FormData method not allowed');
          }
        } catch (formError) {
          console.log('❌ POST FormData method failed:', formError.message);
          
          // Method 3: POST with JSON
          console.log('📡 Trying POST with JSON...');
          response = await fetch(`${ECOTRACK_CONFIG.baseUrl}/fees`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              api_token: ECOTRACK_CONFIG.api_token,
              user_guid: ECOTRACK_CONFIG.user_guid
            })
          });
          method = 'POST (JSON)';
        }
      }

      if (!response.ok) {
        throw new Error(`EcoTrack API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ EcoTrack fees received via ${method} for price lookup`);

      // Validate response structure
      if (!data.tarifs || !data.tarifs.return) {
        throw new Error('Invalid EcoTrack API response structure');
      }

      // Update cache
      feesCache = data;
      cacheTimestamp = now;
    } else {
      console.log('📋 Using cached fees data for price lookup');
    }

    const wilayaKey = wilaya_id.toString();
    const wilayaData = feesCache.tarifs.return[wilayaKey];

    if (!wilayaData) {
      return res.status(404).json({
        success: false,
        error: `No pricing data found for wilaya ${wilaya_id}`,
        available_wilayas: Object.keys(feesCache.tarifs.return)
      });
    }

    let price;
    let priceType;

    if (delivery_type === 'stop_desk' && wilayaData.tarif_stopdesk) {
      price = parseFloat(wilayaData.tarif_stopdesk);
      priceType = 'stop_desk';
    } else if (wilayaData.tarif) {
      price = parseFloat(wilayaData.tarif);
      priceType = 'regular';
    } else {
      return res.status(404).json({
        success: false,
        error: `No ${delivery_type} pricing found for wilaya ${wilaya_id}`,
        available_pricing: {
          regular: wilayaData.tarif || null,
          stop_desk: wilayaData.tarif_stopdesk || null
        }
      });
    }

    console.log(`✅ Price for wilaya ${wilaya_id} (${priceType}): ${price} DA`);

    res.json({
      success: true,
      wilaya_id: parseInt(wilaya_id),
      delivery_type: delivery_type,
      price_type: priceType,
      price: price,
      currency: 'DA',
      cached: cacheTimestamp && (now - cacheTimestamp) < CACHE_EXPIRY
    });

  } catch (error) {
    console.error('❌ Error getting delivery price:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;