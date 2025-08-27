const axios = require('axios');
const { pool } = require('../../config/database');

class EcotrackService {
  constructor() {
    this.baseURL = 'https://app.noest-dz.com/api';
    // Initialize with default values, will be loaded from database
    this.apiToken = null;
    this.userGuid = null;
    this.isEnabled = false;
    this.configLoaded = false;
    
    // Cache for station codes
    this.stationCodesCache = null;
    this.stationCodesCacheExpiry = null;
    this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Start loading configuration from database on startup (don't await)
    this.loadConfigFromDatabase().catch(error => {
      console.error('❌ Failed to load initial EcoTrack config:', error);
    });
  }

  /**
   * Ensure configuration is loaded from database before API calls
   */
  async ensureConfigLoaded() {
    if (!this.configLoaded) {
      console.log('🔄 Config not loaded yet, loading from database...');
      await this.loadConfigFromDatabase();
    }
    
    // Log current credentials being used
    console.log('🔑 Current EcoTrack credentials:');
    console.log(`   API Token: ${this.apiToken ? '***' + this.apiToken.slice(-4) : 'NOT SET'}`);
    console.log(`   User GUID: ${this.userGuid || 'NOT SET'}`);
    console.log(`   Enabled: ${this.isEnabled}`);
    console.log(`   Config Loaded: ${this.configLoaded}`);
    
    if (!this.apiToken || !this.userGuid) {
      throw new Error('EcoTrack credentials not available after loading from database');
    }
  }

  /**
   * Load configuration from database
   */
  async loadConfigFromDatabase() {
    try {
      const [configs] = await pool.query('SELECT * FROM ecotrack_config ORDER BY updated_at DESC LIMIT 1');
      
      if (configs.length > 0) {
        const config = configs[0];
        this.apiToken = config.api_token;
        this.userGuid = config.user_guid;
        this.isEnabled = config.is_enabled;
        this.configLoaded = true;
        
        console.log('🔄 EcoTrack configuration loaded from database:');
        console.log(`   API Token: ${this.apiToken ? '***' + this.apiToken.slice(-4) : 'Not set'}`);
        console.log(`   User GUID: ${this.userGuid || 'Not set'}`);
        console.log(`   Enabled: ${this.isEnabled}`);
      } else {
        // Fallback to environment variables or hardcoded defaults
        this.apiToken = process.env.ECOTRACK_API_TOKEN || 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG';
        this.userGuid = process.env.ECOTRACK_USER_GUID || '2QG0JDFP';
        this.isEnabled = true;
        this.configLoaded = true;
        
        console.log('⚠️ No database config found, using fallback values');
        console.log(`   API Token: ${this.apiToken ? '***' + this.apiToken.slice(-4) : 'Not set'}`);
        console.log(`   User GUID: ${this.userGuid || 'Not set'}`);
      }
      
      this.updateAxiosClient();
    } catch (error) {
      console.error('❌ Failed to load EcoTrack config from database:', error);
      // Use fallback values
      this.apiToken = process.env.ECOTRACK_API_TOKEN || 'PqIG59oLQNvQdNYuy7rlFm8ZCwAD2qgp5cG';
      this.userGuid = process.env.ECOTRACK_USER_GUID || '2QG0JDFP';
      this.isEnabled = true;
      this.configLoaded = true;
      this.updateAxiosClient();
    }
  }

  /**
   * Get the appropriate EcoTrack account for an order based on its location
   * Simple logic: 
   * 1. If order has location → use location-specific account
   * 2. If no location → look at products in order to find location
   * 3. If still no location → use default account
   * @param {Object} orderData - Order data containing location information
   * @returns {Promise<Object>} - { account, source } where source indicates how account was selected
   */
  async getAccountForOrder(orderData) {
    try {
      console.log('🏪 Selecting EcoTrack account for order:', {
        order_id: orderData.id,
        order_number: orderData.order_number,
        location_id: orderData.location_id,
        boutique_id: orderData.boutique_id,
        stock_location_id: orderData.stock_location_id
      });

      // Step 1: Check if order has a direct location
      let locationId = orderData.location_id || orderData.boutique_id || orderData.stock_location_id;
      
      if (locationId) {
        console.log(`🔍 Order has direct location_id: ${locationId} - Looking for location-specific account`);
        
        const account = await this.getAccountByLocation(locationId);
        if (account) {
          return {
            account,
            source: 'order_location',
            selection_method: `order_location_id:${locationId}`
          };
        } else {
          console.log(`⚠️ No EcoTrack account found for order location_id: ${locationId}`);
        }
      }

      // Step 2: If no direct location, extract product name from order and match to products table
      if (!locationId && orderData.product_details) {
        console.log('🔍 No direct location found, extracting product info from order...');
        
        try {
          let productDetails;
          if (typeof orderData.product_details === 'string') {
            productDetails = JSON.parse(orderData.product_details);
          } else {
            productDetails = orderData.product_details;
          }
          
          if (productDetails && productDetails.name) {
            const productName = productDetails.name.trim();
            console.log(`🎯 Looking for product in database: "${productName}"`);
            
            // Search for matching product in database using similar logic to frontend
            const [matchedProducts] = await pool.query(`
              SELECT p.id, p.name, p.location_id, sl.name as location_name
              FROM products p
              LEFT JOIN stock_locations sl ON p.location_id = sl.id
              WHERE p.location_id IS NOT NULL
              AND (
                LOWER(p.name) = LOWER(?) OR
                LOWER(p.name) LIKE LOWER(?) OR
                LOWER(?) LIKE LOWER(CONCAT('%', p.name, '%'))
              )
              ORDER BY 
                CASE 
                  WHEN LOWER(p.name) = LOWER(?) THEN 1
                  WHEN LOWER(p.name) LIKE LOWER(?) THEN 2
                  ELSE 3
                END
              LIMIT 1
            `, [productName, `%${productName}%`, productName, productName, `%${productName}%`]);
            
            if (matchedProducts.length > 0) {
              const matchedProduct = matchedProducts[0];
              locationId = matchedProduct.location_id;
              
              console.log(`🎯 Matched product "${productName}" to database product:`, {
                product_id: matchedProduct.id,
                product_name: matchedProduct.name,
                location_id: matchedProduct.location_id,
                location_name: matchedProduct.location_name
              });
              
              const account = await this.getAccountByLocation(locationId);
              if (account) {
                return {
                  account,
                  source: 'product_name_match',
                  selection_method: `product_name_match:${matchedProduct.name}->location_id:${locationId}`
                };
              } else {
                console.log(`⚠️ No EcoTrack account found for matched product location_id: ${locationId}`);
              }
            } else {
              console.log(`📍 No matching product found in database for: "${productName}"`);
            }
          } else {
            console.log('📍 No product name found in product_details');
          }
        } catch (error) {
          console.log('⚠️ Error parsing product_details or matching product:', error.message);
        }
      }

      // Step 3: Use default EcoTrack account (when no location found)
      console.log('🔄 No location found, using default EcoTrack account...');
      
      const defaultAccount = await this.getDefaultAccount();
      if (defaultAccount) {
        return {
          account: defaultAccount,
          source: 'default_account',
          selection_method: 'is_default=1'
        };
      }

      // Step 4: Final fallback to global config (backward compatibility)
      console.log('⚠️ No default account found, falling back to global config...');
      await this.ensureConfigLoaded();
      
      if (this.apiToken && this.userGuid) {
        return {
          account: {
            id: null,
            name: 'Global Configuration',
            api_token: this.apiToken,
            user_guid: this.userGuid,
            location_id: null,
            location_name: 'Global',
            location_code: 'GLOBAL'
          },
          source: 'global_config',
          selection_method: 'ecotrack_config_table'
        };
      }

      throw new Error('No EcoTrack account configuration found');
      
    } catch (error) {
      console.error('❌ Error selecting EcoTrack account:', error);
      throw new Error(`Failed to select EcoTrack account: ${error.message}`);
    }
  }

  /**
   * Get EcoTrack account by location ID
   * @param {number} locationId - Location ID
   * @returns {Promise<Object|null>} - Account object or null if not found
   */
  async getAccountByLocation(locationId) {
    try {
      const [accounts] = await pool.query(`
        SELECT 
          ea.*,
          sl.name as location_name,
          sl.code as location_code
        FROM ecotrack_accounts ea
        JOIN stock_locations sl ON ea.location_id = sl.id
        WHERE ea.location_id = ? AND ea.is_enabled = 1
        ORDER BY ea.updated_at DESC
        LIMIT 1
      `, [locationId]);
      
      if (accounts.length > 0) {
        const account = accounts[0];
        console.log('✅ Found EcoTrack account for location:', {
          account_id: account.id,
          account_name: account.account_name,
          location_name: account.location_name,
          api_token: '***' + account.api_token.slice(-4),
          user_guid: account.user_guid
        });
        
        return {
          id: account.id,
          name: account.account_name,
          api_token: account.api_token,
          user_guid: account.user_guid,
          location_id: account.location_id,
          location_name: account.location_name,
          location_code: account.location_code
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting account by location:', error);
      return null;
    }
  }

  /**
   * Get default EcoTrack account
   * @returns {Promise<Object|null>} - Default account object or null if not found
   */
  async getDefaultAccount() {
    try {
      const [defaultAccounts] = await pool.query(`
        SELECT 
          ea.*,
          sl.name as location_name,
          sl.code as location_code
        FROM ecotrack_accounts ea
        JOIN stock_locations sl ON ea.location_id = sl.id
        WHERE ea.is_enabled = 1 AND ea.is_default = 1
        ORDER BY ea.updated_at DESC
        LIMIT 1
      `);
      
      if (defaultAccounts.length > 0) {
        const account = defaultAccounts[0];
        console.log('✅ Found default EcoTrack account:', {
          account_id: account.id,
          account_name: account.account_name,
          location_name: account.location_name,
          api_token: '***' + account.api_token.slice(-4),
          user_guid: account.user_guid
        });
        
        return {
          id: account.id,
          name: account.account_name,
          api_token: account.api_token,
          user_guid: account.user_guid,
          location_id: account.location_id,
          location_name: account.location_name,
          location_code: account.location_code
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting default account:', error);
      return null;
    }
  }

  /**
   * Update axios client with current credentials
   */
  updateAxiosClient() {
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
        'partner-id': this.userGuid
      },
      timeout: 30000
    });
  }

  /**
   * Update configuration dynamically and save to database
   * @param {string} apiToken - New API token
   * @param {string} userGuid - New user GUID
   * @param {boolean} isEnabled - Whether integration is enabled
   * @param {number} userId - ID of user making the change
   */
  async updateConfig(apiToken, userGuid, isEnabled = true, userId = null) {
    console.log('🔄 Updating EcotrackService configuration:');
    console.log(`   Old API Token: ${this.apiToken ? '***' + this.apiToken.slice(-4) : 'Not set'}`);
    console.log(`   New API Token: ${apiToken ? '***' + apiToken.slice(-4) : 'Not set'}`);
    console.log(`   Old User GUID: ${this.userGuid || 'Not set'}`);
    console.log(`   New User GUID: ${userGuid || 'Not set'}`);
    console.log(`   Enabled: ${isEnabled}`);
    
    try {
      // Check if config exists
      const [existingConfigs] = await pool.query('SELECT id FROM ecotrack_config LIMIT 1');
      
      if (existingConfigs.length > 0) {
        // Update existing configuration
        await pool.query(`
          UPDATE ecotrack_config 
          SET api_token = ?, user_guid = ?, is_enabled = ?, updated_by = ?, updated_at = NOW()
          WHERE id = ?
        `, [apiToken, userGuid, isEnabled, userId, existingConfigs[0].id]);
        
        console.log('✅ Configuration updated in database');
      } else {
        // Insert new configuration
        await pool.query(`
          INSERT INTO ecotrack_config (api_token, user_guid, is_enabled, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?)
        `, [apiToken, userGuid, isEnabled, userId, userId]);
        
        console.log('✅ New configuration inserted into database');
      }
      
      // Update in-memory values
      this.apiToken = apiToken;
      this.userGuid = userGuid;
      this.isEnabled = isEnabled;
      
      // Update axios client with new credentials
      this.updateAxiosClient();
      
      console.log('✅ EcotrackService configuration updated successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to save EcoTrack config to database:', error);
      
      // Still update in-memory values as fallback
      this.apiToken = apiToken;
      this.userGuid = userGuid;
      this.isEnabled = isEnabled;
      this.updateAxiosClient();
      
      throw error;
    }
  }

  /**
   * Get current configuration from database
   */
  async getConfig() {
    try {
      const [configs] = await pool.query(`
        SELECT 
          api_token, 
          user_guid, 
          is_enabled, 
          created_at, 
          updated_at,
          u1.name as created_by_name,
          u2.name as updated_by_name
        FROM ecotrack_config 
        LEFT JOIN users u1 ON ecotrack_config.created_by = u1.id
        LEFT JOIN users u2 ON ecotrack_config.updated_by = u2.id
        ORDER BY updated_at DESC 
        LIMIT 1
      `);
      
      if (configs.length > 0) {
        return {
          apiToken: configs[0].api_token,
          userGuid: configs[0].user_guid,
          isEnabled: configs[0].is_enabled,
          createdAt: configs[0].created_at,
          updatedAt: configs[0].updated_at,
          createdBy: configs[0].created_by_name,
          updatedBy: configs[0].updated_by_name
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get EcoTrack config from database:', error);
      return null;
    }
  }

  /**
   * Validate that all required Ecotrack credentials are configured
   * @returns {boolean} - Whether credentials are valid
   */
  validateCredentials() {
    const missing = [];
    
    if (!this.apiToken) missing.push('ECOTRACK_API_TOKEN');
    if (!this.userGuid) missing.push('ECOTRACK_USER_GUID');
    
    if (missing.length > 0) {
      console.warn(`⚠️  Missing Ecotrack credentials: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }

  /**
   * Create a new order in Ecotrack using the new API endpoint
   * @param {Object} orderData - Order information
   * @returns {Promise<Object>} - Tracking information
   */
  async createShipment(orderData) {
    console.log(`🚚 🔴 EcotrackService.createShipment CALLED!`);
    console.log(`🚚 EcotrackService.createShipment called with:`, orderData);
    console.log(`🚚 Function entry timestamp:`, new Date().toISOString());
    
    // Step 1: Select the appropriate EcoTrack account for this order
    const accountSelection = await this.getAccountForOrder(orderData);
    const selectedAccount = accountSelection.account;
    
    console.log(`🏪 Selected EcoTrack account:`, {
      account_id: selectedAccount.id,
      account_name: selectedAccount.name,
      location: selectedAccount.location_name,
      source: accountSelection.source,
      method: accountSelection.selection_method,
      api_token: '***' + selectedAccount.api_token.slice(-4),
      user_guid: selectedAccount.user_guid
    });
    
    // Step 2: Validate selected account credentials
    if (!selectedAccount.api_token || !selectedAccount.user_guid) {
      console.error(`❌ Selected account missing credentials`);
      throw new Error(`Selected EcoTrack account "${selectedAccount.name}" is missing required credentials`);
    }

    try {
      // Parse product details if it's a string
      let productDetails;
      if (typeof orderData.product_details === 'string') {
        try {
          productDetails = JSON.parse(orderData.product_details);
        } catch {
          productDetails = { name: orderData.product_details };
        }
      } else {
        productDetails = orderData.product_details || {};
      }

      // Prepare order data according to Ecotrack API requirements
      console.log(`🗺️ DEBUG: Geographic data mapping:`);
      console.log(`  - orderData.wilaya_id: ${orderData.wilaya_id}`);
      console.log(`  - orderData.commune: ${orderData.commune}`);
      console.log(`  - orderData.baladia_name: ${orderData.baladia_name}`);
      console.log(`  - orderData.customer_city: ${orderData.customer_city}`);
      
      const fallbackMapping = this.mapCityToWilayaId(orderData.customer_city || '');
      console.log(`  - Fallback mapping for "${orderData.customer_city}":`, fallbackMapping);
      
      let finalWilayaId = orderData.wilaya_id || fallbackMapping.wilaya_id;
      let finalCommune = orderData.commune || orderData.baladia_name || orderData.customer_city || fallbackMapping.commune;
      
      // Validate and fix wilaya_id for Ecotrack (must be between 1-58)
      if (finalWilayaId > 58 || finalWilayaId < 1) {
        console.log(`⚠️ Invalid wilaya_id ${finalWilayaId} for Ecotrack (must be 1-58)`);
        
        // Try to map based on customer_city
        if (orderData.customer_city) {
          const cityBasedMapping = this.mapCityToWilayaId(orderData.customer_city);
          if (cityBasedMapping.wilaya_id >= 1 && cityBasedMapping.wilaya_id <= 58) {
            finalWilayaId = cityBasedMapping.wilaya_id;
            finalCommune = cityBasedMapping.commune;
            console.log(`🔄 Remapped to wilaya_id: ${finalWilayaId}, commune: ${finalCommune}`);
          }
        }
        
        // Special handling for numeric city names that represent wilaya codes
        if (orderData.customer_city && /^\d+$/.test(orderData.customer_city)) {
          const cityAsNumber = parseInt(orderData.customer_city);
          if (cityAsNumber >= 1 && cityAsNumber <= 58) {
            finalWilayaId = cityAsNumber;
            // Map to appropriate commune based on wilaya
            const wilayaCommunes = {
              16: 'Alger Centre',  // Algiers
              21: 'Skikda',        // Skikda  
              23: 'Annaba',        // Annaba
              31: 'Oran',          // Oran
              19: 'Setif',         // Setif
              15: 'Tizi Ouzou',    // Tizi Ouzou
              27: 'Mostaganem',    // Mostaganem
              17: 'Djelfa',        // Djelfa
              6: 'Bejaia'          // Bejaia
            };
            finalCommune = wilayaCommunes[cityAsNumber] || `Wilaya${cityAsNumber}`;
            console.log(`🔢 Mapped numeric city "${orderData.customer_city}" to wilaya_id: ${finalWilayaId}, commune: ${finalCommune}`);
          }
        }
        
        // Final fallback to Algiers if still invalid
        if (finalWilayaId > 58 || finalWilayaId < 1) {
          finalWilayaId = 16; // Default to Algiers
          finalCommune = 'Alger Centre';
          console.log(`🏛️ Fallback to Algiers: wilaya_id: ${finalWilayaId}, commune: ${finalCommune}`);
        }
      }
      
      // Validate and fix commune name for Ecotrack using comprehensive mapping
      finalCommune = this.validateAndFixCommune(finalCommune, finalWilayaId);
      
      console.log(`  - Final wilaya_id: ${finalWilayaId}`);
      console.log(`  - Final commune: "${finalCommune}"`);
      console.log(`  - Original commune from order: "${orderData.commune}"`);
      
      // Determine which montant to use - prioritize frontend calculation
      const finalMontant = orderData.montant || this.calculateTotalAmount(orderData);
      const montantSource = orderData.montant ? 'Frontend (Total Final)' : 'Backend calculation';
      
      // Log delivery pricing details for debugging
      console.log(`🚚 Delivery pricing breakdown:`, {
        delivery_type: orderData.delivery_type,
        delivery_price: orderData.delivery_price,
        total_amount: orderData.total_amount,
        calculated_montant: finalMontant,
        source: montantSource
      });
      
      // Determine stop_desk value based ONLY on delivery type
      // 0: à domicile (home delivery), 1: stop desk (pickup point)
      const deliveryType = orderData.delivery_type || 'home';
      const hasStationCode = orderData.station_code || orderData.ecotrack_station_code;
      
      // ONLY use stop desk if explicitly selected as delivery type
      const stopDesk = deliveryType === 'stop_desk' ? 1 : 0;
      
      console.log(`🚚 Delivery type: ${deliveryType}, station_code: ${hasStationCode}, stop_desk: ${stopDesk}`);
      
      // Determine type_id based on delivery type
      // 1: Livraison (Delivery) - default for home/stop_desk
      // 2: Échange (Exchange) - for les_changes
      // 3: Pick up - for pickup points
      let typeId = 1; // Default to delivery
      
      if (deliveryType === 'les_changes') {
        typeId = 2; // Exchange
        console.log('🔄 Les Changes delivery type detected - setting type_id to 2 (Échange)');
      } else if (deliveryType === 'pickup_point') {
        typeId = 3; // Pick up
        console.log('📦 Pickup point delivery type detected - setting type_id to 3 (Pick up)');
      } else {
        console.log('🚚 Standard delivery type detected - setting type_id to 1 (Livraison)');
      }
      
      console.log(`💰 Using montant: ${finalMontant} DA (Source: ${montantSource})`);
      
      const ecotrackOrderData = {
        api_token: selectedAccount.api_token, // Required - from selected account
        user_guid: selectedAccount.user_guid, // Required - from selected account
        reference: orderData.order_number || `REF-${Date.now()}`, // Nullable | max:255
        client: orderData.customer_name || 'Customer', // Required | max:255
        phone: (orderData.customer_phone?.replace(/\D/g, '') || '0555123456').substring(0, 10), // Required | digits between 9,10
        phone_2: orderData.customer_phone_2 ? orderData.customer_phone_2.replace(/\D/g, '').substring(0, 10) : undefined, // Optional | digits between 9,10
        adresse: orderData.customer_address || orderData.customer_city || 'Address', // Required | max:255 - Use address or city as fallback
        wilaya_id: finalWilayaId, // Required | integer between 1,48
        commune: finalCommune, // Required | max:255
        montant: finalMontant, // Required | numeric - Use frontend Total Final or backend calculation
        remarque: this.buildRemarqueWithConfirmer(orderData.notes, orderData.confirmed_by_name, productDetails, orderData.quantity) || '', // max:255
        produit: productDetails.name || 'Product', // Required
        type_id: typeId, // Required | integer between 1,3 (1: Livraison, 2: Échange, 3: Pick up) - determined by delivery_type
        poids: Math.max(1, Math.floor(orderData.weight || productDetails.weight || 1)), // Required | integer (minimum 1)
        stop_desk: stopDesk, // Required | integer between 0,1 (0: à domicile, 1: stop desk) - determined from delivery_type or station_code
        station_code: stopDesk === 1 ? (orderData.ecotrack_station_code || orderData.station_code || await this.getStationCodeForWilaya(finalWilayaId)) : undefined, // Required only for stop_desk = 1
        stock: 0, // integer between 0,1 (0: Non, 1: Oui) - set to 0 since stock module is disabled
        can_open: 0 // integer between 0,1 (0: Non, 1: Oui) - default to no
      };

      console.log('🚚 Creating Ecotrack order with new API:', {
        ...ecotrackOrderData,
        api_token: '***' + ecotrackOrderData.api_token.slice(-4), // Hide full token in logs
      });
      
      if (stopDesk === 1) {
        console.log(`🚉 Stop desk delivery - Station selection: ${orderData.station_code ? 'Frontend provided' : 'API fetched'} - Using: ${ecotrackOrderData.station_code}`);
      } else {
        console.log(`🏠 Home delivery - No station code required`);
      }

      // Use the correct API endpoint for creating orders
      console.log('🌐 Making request to: https://app.noest-dz.com/api/public/create/order');
      console.log('🔑 Using headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
        'partner-id': this.userGuid
      });
      
      let createResponse;
      let attemptCount = 0;
      const maxAttempts = 4;
      // Use actual communes from Tamanrasset wilaya based on database
      const alternativeCommunes = ['In Salah', 'Tamanrasset', 'In Guezzam', 'Tin Zaouatine'];
      
      // Try multiple commune name formats for problematic locations
      while (attemptCount < maxAttempts) {
        attemptCount++;
        
        // For Tamanrasset, try alternative spellings
        if (attemptCount > 1 && finalWilayaId === 11) {
          ecotrackOrderData.commune = alternativeCommunes[attemptCount - 1] || ecotrackOrderData.commune;
          console.log(`🔄 Attempt ${attemptCount}: Trying commune name: ${ecotrackOrderData.commune}`);
        }
        
        try {
          createResponse = await axios.post('https://app.noest-dz.com/api/public/create/order', ecotrackOrderData, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${selectedAccount.api_token}`,
              'partner-id': selectedAccount.user_guid
            },
            timeout: 30000
          });
          
          // If we get here, the request was successful
          break;
          
        } catch (error) {
          console.log(`❌ Attempt ${attemptCount} failed:`, error.response?.data);
          
          // If it's a commune validation error and we have more attempts, continue
          if (error.response?.status === 422 && 
              error.response?.data?.errors?.commune && 
              attemptCount < maxAttempts &&
              finalWilayaId === 11) {
            console.log(`🔄 Commune validation failed, trying alternative name...`);
            continue;
          }
          
          // If it's not a commune error or we're out of attempts, throw the error
          throw error;
        }
      }
      
      console.log('🎯 Raw Ecotrack API Response:', createResponse.data);
      console.log('🎯 Response Status:', createResponse.status);
      console.log('🎯 Response Headers:', createResponse.headers);
      
      // Handle different response formats
      let trackingId;
      let success = false;
      
      if (createResponse.data) {
        // Check if API explicitly returned success: false
        if (createResponse.data.success === false) {
          throw new Error(`Ecotrack API Error: ${createResponse.data.message || 'Unknown error'}`);
        }
        
        // Check for success in different formats
        if (createResponse.data.success === true || createResponse.data.success === 1) {
          success = true;
          trackingId = createResponse.data.tracking || createResponse.data.tracking_id || createResponse.data.id;
        } else if (createResponse.status === 200 || createResponse.status === 201) {
          // Sometimes API returns 200/201 without explicit success field
          success = true;
          trackingId = createResponse.data.tracking || createResponse.data.tracking_id || createResponse.data.id || createResponse.data.data?.tracking;
        } else if (createResponse.data.message && !createResponse.data.errors) {
          // Check if it's a success message without explicit success flag
          success = true;
          trackingId = createResponse.data.tracking || createResponse.data.tracking_id || createResponse.data.id;
        }
      }
      
      if (!success || !trackingId) {
        console.error('❌ Unexpected API response format:', createResponse.data);
        throw new Error(`Unexpected API response: ${JSON.stringify(createResponse.data)}`);
      }

      console.log('✅ Ecotrack order created with tracking:', trackingId);

      return {
        success: true,
        tracking_id: trackingId,
        status: 'created', // Initial status
        tracking_url: `https://app.noest-dz.com/tracking/${trackingId}`,
        // Account usage information
        account_used: {
          id: selectedAccount.id,
          name: selectedAccount.name,
          location_id: selectedAccount.location_id,
          location_name: selectedAccount.location_name,
          location_code: selectedAccount.location_code,
          selection_source: accountSelection.source,
          selection_method: accountSelection.selection_method,
          api_token_suffix: selectedAccount.api_token.slice(-4),
          user_guid: selectedAccount.user_guid
        }
      };
    } catch (error) {
      console.error('🚨 Ecotrack API Error Details:');
      console.error('Status:', error.response?.status);
      console.error('Status Text:', error.response?.statusText);
      console.error('Response Data:', error.response?.data);
      console.error('Request URL:', error.config?.url);
      console.error('Request Method:', error.config?.method);
      console.error('Request Data:', error.config?.data);
      console.error('Full Error:', error.message);
      
      throw new Error(`Failed to create Ecotrack shipment: ${error.response?.status} ${error.response?.statusText} - ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get tracking information for orders
   * @param {Array<string>} trackingIds - Array of Ecotrack tracking IDs
   * @param {Object} orderData - Optional order data to help select account
   * @returns {Promise<Object>} - Tracking information with account usage
   */
  async getTrackingInfo(trackingIds, orderData = null) {
    try {
      console.log(`🔍 Getting tracking info for IDs:`, trackingIds);
      
      // If we have order data, use it to select the appropriate account
      // Otherwise, try to use default account
      let accountSelection;
      if (orderData) {
        accountSelection = await this.getAccountForOrder(orderData);
      } else {
        // Use default account for tracking queries without order context
        accountSelection = await this.getAccountForOrder({});
      }
      
      const selectedAccount = accountSelection.account;
      console.log(`🏪 Using account for tracking: ${selectedAccount.name} (${accountSelection.source})`);

      if (!trackingIds || !Array.isArray(trackingIds) || trackingIds.length === 0) {
        throw new Error('Invalid tracking IDs provided');
      }

      // Call EcoTrack API to get tracking information
      const response = await axios.post('https://app.noest-dz.com/api/public/get/trackings/info', {
        api_token: selectedAccount.api_token,
        user_guid: selectedAccount.user_guid,
        trackings: trackingIds
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      console.log('🎯 EcoTrack tracking info response:', response.data);

      return {
        ...response.data,
        // Include account usage information
        account_used: {
          id: selectedAccount.id,
          name: selectedAccount.name,
          location_name: selectedAccount.location_name,
          selection_source: accountSelection.source,
          selection_method: accountSelection.selection_method
        }
      };
      
    } catch (error) {
      console.error('Error getting tracking info:', error);
      throw new Error(`Failed to get tracking information: ${error.message}`);
    }
  }

  /**
   * Add a remark to an EcoTrack shipment
   * @param {string} trackingId - Ecotrack tracking ID
   * @param {string} content - Remark content
   * @param {Object} orderData - Optional order data to help select account
   * @returns {Promise<Object>} - Add remark result with account usage
   */
  async addRemark(trackingId, content, orderData = null) {
    try {
      console.log(`💬 Adding remark to EcoTrack tracking ID: ${trackingId}`);
      
      // Select the appropriate account
      let accountSelection;
      if (orderData) {
        accountSelection = await this.getAccountForOrder(orderData);
      } else {
        accountSelection = await this.getAccountForOrder({});
      }
      
      const selectedAccount = accountSelection.account;
      console.log(`🏪 Using account for remark: ${selectedAccount.name} (${accountSelection.source})`);

      if (!trackingId || !content) {
        throw new Error('Tracking ID and content are required');
      }

      // Debug: Log the content being sent
      console.log(`📝 DEBUG - Adding remark to tracking ${trackingId}:`);
      console.log(`📝 DEBUG - Content being sent: "${content}"`);
      console.log(`📝 DEBUG - Content length: ${content.length} characters`);
      console.log(`📝 DEBUG - API Token (last 4 chars): ***${selectedAccount.api_token.slice(-4)}`);

      // Call EcoTrack API to add remark
      const response = await axios.post('https://app.noest-dz.com/api/public/add/maj', {
        api_token: selectedAccount.api_token,
        tracking: trackingId,
        content: content
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000
      });

      // Debug: Log the response
      console.log(`📝 DEBUG - EcoTrack add remark response:`, response.data);
      console.log(`📝 DEBUG - Response status: ${response.status}`);
      console.log(`📝 DEBUG - Response headers:`, response.headers);
      console.log('🎯 EcoTrack add remark response:', response.data);

      return {
        ...response.data || { success: true },
        // Account usage information
        account_used: {
          id: selectedAccount.id,
          name: selectedAccount.name,
          location_name: selectedAccount.location_name,
          selection_source: accountSelection.source,
          selection_method: accountSelection.selection_method
        }
      };
      
    } catch (error) {
      console.error('Error adding remark:', error);
      throw new Error(`Failed to add remark: ${error.message}`);
    }
  }

  /**
   * Delete an order in Ecotrack (only before validation)
   * @param {string} trackingId - Ecotrack tracking ID
   * @param {string} reason - Cancellation reason
   * @param {Object} orderData - Optional order data to help select account
   * @returns {Promise<Object>} - Cancellation result with account usage
   */
  async cancelShipment(trackingId, reason = 'Order cancelled', orderData = null) {
    console.log(`🚚 ❌ ECOTRACK CANCELLATION: Cancelling shipment for order ${trackingId}`);
    console.log(`🚚 Tracking ID to cancel: ${trackingId}`);
    
    // Select the appropriate account
    let accountSelection;
    if (orderData) {
      accountSelection = await this.getAccountForOrder(orderData);
    } else {
      // Use default account for cancellations without order context
      accountSelection = await this.getAccountForOrder({});
    }
    
    const selectedAccount = accountSelection.account;
    console.log(`🏪 Using account for cancellation: ${selectedAccount.name} (${accountSelection.source})`);

    // Validate tracking ID format
    if (!trackingId || typeof trackingId !== 'string' || trackingId.trim().length === 0) {
      throw new Error('Invalid tracking ID provided');
    }

    const cleanTrackingId = trackingId.trim();
    console.log(`🔍 Cleaned tracking ID: "${cleanTrackingId}"`);
    
    // EcoTrack tracking IDs typically follow patterns like: 2QG-19B-10402641
    const trackingIdPattern = /^[A-Z0-9]+-[A-Z0-9]+-[0-9]+$/;
    if (!trackingIdPattern.test(cleanTrackingId)) {
      console.warn(`⚠️ Tracking ID "${cleanTrackingId}" doesn't match expected EcoTrack format (XXX-XXX-XXXXXXXX)`);
    }

    try {
      const requestData = {
        api_token: selectedAccount.api_token,
        user_guid: selectedAccount.user_guid,
        tracking: cleanTrackingId
      };

      console.log('🗑️ Cancelling Ecotrack order with data:', {
        api_token: selectedAccount.api_token,
        user_guid: selectedAccount.user_guid,
        tracking: cleanTrackingId
      });
      console.log('🌐 Making request to: https://app.noest-dz.com/api/public/delete/order');

      // Use the correct public API endpoint for deleting orders
      const response = await axios.post('https://app.noest-dz.com/api/public/delete/order', requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      console.log('🎯 Ecotrack cancel response status:', response.status);
      console.log('🎯 Ecotrack cancel response data:', response.data);

      if (!response.data.success) {
        throw new Error(`Failed to delete order in Ecotrack: ${response.data.message || 'Unknown error'}`);
      }

      console.log('✅ Ecotrack order cancelled successfully:', trackingId);

      return {
        success: true,
        tracking_id: trackingId,
        status: 'cancelled',
        message: 'Order deleted successfully',
        // Account usage information
        account_used: {
          id: selectedAccount.id,
          name: selectedAccount.name,
          location_name: selectedAccount.location_name,
          selection_source: accountSelection.source,
          selection_method: accountSelection.selection_method
        }
      };
    } catch (error) {
      console.error('Ecotrack cancel shipment error:', error.response?.data || error.message);
      console.error('🚨 Ecotrack cancellation error for', trackingId, ':', error.message);
      
      // Provide more specific error messages based on the response
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        let errorMessage = errorData.message || 'Validation error';
        
        if (errorData.errors && errorData.errors.tracking) {
          const trackingErrors = errorData.errors.tracking;
          if (trackingErrors.includes('Le champ tracking sélectionné est invalide.')) {
            errorMessage = `Tracking ID "${trackingId}" is invalid or not found in EcoTrack system. This could mean:
            1. The tracking ID doesn't exist
            2. The order is already delivered/completed and cannot be cancelled
            3. The order was not created through this account
            4. The tracking ID format is incorrect`;
          }
        }
        
        throw new Error(`EcoTrack validation error: ${errorMessage}`);
      }
      
      throw new Error(`Failed to cancel Ecotrack shipment: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Map city name to Wilaya ID and get default commune
   * @param {string} cityName - City name
   * @returns {Object} - {wilaya_id, commune}
   */
  mapCityToWilayaId(cityName) {
    const cityMappings = {
      'adrar': { wilaya_id: 1, commune: 'Adrar' },
      'chlef': { wilaya_id: 2, commune: 'Chlef' },
      'laghouat': { wilaya_id: 3, commune: 'Laghouat' },
      'oum-el-bouaghi': { wilaya_id: 4, commune: 'Oum El Bouaghi' },
      'batna': { wilaya_id: 5, commune: 'Batna' },
      'bejaia': { wilaya_id: 6, commune: 'Bejaia' },
      'biskra': { wilaya_id: 7, commune: 'Biskra' },
      'bechar': { wilaya_id: 8, commune: 'Bechar' },
      'blida': { wilaya_id: 9, commune: 'Blida' },
      'bouira': { wilaya_id: 10, commune: 'Bouira' },
      'tamanrasset': { wilaya_id: 11, commune: 'In Salah' }, // Use In Salah instead of Tamanrasset
      'tebessa': { wilaya_id: 12, commune: 'Tebessa' },
      'tlemcen': { wilaya_id: 13, commune: 'Tlemcen' },
      'tiaret': { wilaya_id: 14, commune: 'Tiaret' },
      'tizi-ouzou': { wilaya_id: 15, commune: 'Tizi Ouzou' },
      'alger': { wilaya_id: 16, commune: 'Alger Centre' },
      'algiers': { wilaya_id: 16, commune: 'Alger Centre' },
      'djelfa': { wilaya_id: 17, commune: 'Djelfa' },
      'jijel': { wilaya_id: 18, commune: 'Jijel' },
      'setif': { wilaya_id: 19, commune: 'Setif' },
      'saida': { wilaya_id: 20, commune: 'Saida' },
      'skikda': { wilaya_id: 21, commune: 'Skikda' },
      'sidi-bel-abbes': { wilaya_id: 22, commune: 'Sidi Bel Abbes' },
      'annaba': { wilaya_id: 23, commune: 'Annaba' },
      'guelma': { wilaya_id: 24, commune: 'Guelma' },
      'constantine': { wilaya_id: 25, commune: 'Constantine' },
      'medea': { wilaya_id: 26, commune: 'Medea' },
      'mostaganem': { wilaya_id: 27, commune: 'Mostaganem' },
      'msila': { wilaya_id: 28, commune: 'M\'Sila' },
      'mascara': { wilaya_id: 29, commune: 'Mascara' },
      'ouargla': { wilaya_id: 30, commune: 'Ouargla' },
      'oran': { wilaya_id: 31, commune: 'Oran' },
      'el-bayadh': { wilaya_id: 32, commune: 'El Bayadh' },
      'illizi': { wilaya_id: 33, commune: 'Illizi' },
      'bordj-bou-arreridj': { wilaya_id: 34, commune: 'Bordj Bou Arreridj' },
      'boumerdes': { wilaya_id: 35, commune: 'Boumerdes' },
      'el-tarf': { wilaya_id: 36, commune: 'El Tarf' },
      'tindouf': { wilaya_id: 37, commune: 'Tindouf' },
      'tissemsilt': { wilaya_id: 38, commune: 'Tissemsilt' },
      'el-oued': { wilaya_id: 39, commune: 'El Oued' },
      'khenchela': { wilaya_id: 40, commune: 'Khenchela' },
      'souk-ahras': { wilaya_id: 41, commune: 'Souk Ahras' },
      'tipaza': { wilaya_id: 42, commune: 'Tipaza' },
      'mila': { wilaya_id: 43, commune: 'Mila' },
      'ain-defla': { wilaya_id: 44, commune: 'Ain Defla' },
      'naama': { wilaya_id: 45, commune: 'Naama' },
      'ain-temouchent': { wilaya_id: 46, commune: 'Ain Temouchent' },
      'ghardaia': { wilaya_id: 47, commune: 'Ghardaia' },
      'relizane': { wilaya_id: 48, commune: 'Relizane' }
    };

    const normalizedCity = cityName.toLowerCase().trim().replace(/\s+/g, '-');
    return cityMappings[normalizedCity] || { wilaya_id: 16, commune: 'Alger Centre' }; // Default to Algiers
  }

  /**
   * Check if Ecotrack service is available (basic connectivity test)
   * @returns {Promise<boolean>} - Service availability
   */
  async healthCheck() {
    try {
      // Test with a simple call to get stations
      const response = await this.client.post('/desks', {
        api_token: this.apiToken,
        user_guid: this.userGuid
      });
      return response.status === 200;
    } catch (error) {
      console.error('Ecotrack health check failed:', error.message);
      return false;
    }
  }

  /**
   * Build remarque field including confirmer name, original notes, product variant, quantity and colis ouvrable
   * @param {string} notes - Original order notes
   * @param {string} confirmerName - Name of person who confirmed the order
   * @param {Object} productDetails - Product details object (optional)
   * @param {number} quantity - Order quantity (optional)
   * @returns {string} - Combined remarque with confirmer, notes, variant, quantity and colis ouvrable
   */
  buildRemarqueWithConfirmer(notes = '', confirmerName = '', productDetails = null, quantity = null) {
    let remarque = '';
    const addedParts = new Set(); // Track added parts to prevent duplicates
    
    // Add quantity information if available
    if (quantity && quantity > 0) {
      const quantityPart = `Quantité: ${quantity}`;
      remarque += quantityPart;
      addedParts.add(quantityPart.toLowerCase());
    }
    
    // Add "colis ouvrable" information
    const colisOuvrablePart = 'Colis ouvrable';
    if (remarque) {
      remarque += ' | ';
    }
    remarque += colisOuvrablePart;
    addedParts.add(colisOuvrablePart.toLowerCase());
    
    // Add confirmer information if available
    if (confirmerName && confirmerName.trim()) {
      const confirmerPart = `Confirmé par: ${confirmerName.trim()}`;
      if (remarque) {
        remarque += ' | ';
      }
      remarque += confirmerPart;
      addedParts.add(confirmerPart.toLowerCase());
    }
    
    // Add product variant information if available
    if (productDetails) {
      let variant = '';
      
      // Try to extract variant from different possible fields
      if (productDetails.variant) {
        variant = productDetails.variant;
      } else if (productDetails.variante) {
        variant = productDetails.variante;
      } else if (productDetails.product_variant) {
        variant = productDetails.product_variant;
      } else if (productDetails.size || productDetails.color || productDetails.model) {
        // Build variant from individual attributes
        const variantParts = [];
        if (productDetails.size) variantParts.push(productDetails.size);
        if (productDetails.color) variantParts.push(productDetails.color);
        if (productDetails.model) variantParts.push(productDetails.model);
        variant = variantParts.join(' ');
      }
      
      if (variant && variant.trim()) {
        const variantPart = `Variante: ${variant.trim()}`;
        if (!addedParts.has(variantPart.toLowerCase())) {
          if (remarque) {
            remarque += ' | ';
          }
          remarque += variantPart;
          addedParts.add(variantPart.toLowerCase());
        }
      }
    }
    
    // Clean and process notes
    if (notes && notes.trim()) {
      let cleanNotes = notes.trim();
      
      // Keep "colis ouvrable" text (no longer removing it since we add it explicitly)
      // cleanNotes = cleanNotes.replace(/colis ouvrable/gi, '').trim();
      
      // Remove potential product name patterns (anything that looks like a product name)
      // Remove common product patterns like "PRODUCT NAME", product codes, etc.
      cleanNotes = cleanNotes.replace(/^[A-Z\s]+[A-Z]+$/g, '').trim(); // Remove all-caps product names
      cleanNotes = cleanNotes.replace(/\b[A-Z]{2,}\s+[A-Z]{2,}[A-Z\s]*\b/g, '').trim(); // Remove patterns like "WOMEN CAT LUNETTE"
      
      // Split notes by common separators and process each part
      const noteParts = cleanNotes.split(/[|,;]/).map(part => part.trim()).filter(part => part.length > 0);
      
      for (const notePart of noteParts) {
        // Skip empty parts or very short meaningless parts
        if (notePart.length < 2) continue;
        
        // Skip parts that look like product names (all uppercase, multiple words)
        if (/^[A-Z\s]+[A-Z]+$/.test(notePart) && notePart.split(' ').length > 1) {
          console.log(`📝 Skipping product name pattern: "${notePart}"`);
          continue;
        }
        
        // Check if this part is already included (case-insensitive)
        const notePartLower = notePart.toLowerCase();
        let isDuplicate = false;
        
        for (const addedPart of addedParts) {
          if (addedPart.includes(notePartLower) || notePartLower.includes(addedPart)) {
            isDuplicate = true;
            break;
          }
        }
        
        if (!isDuplicate) {
          if (remarque) {
            remarque += ' | ';
          }
          remarque += notePart;
          addedParts.add(notePartLower);
        }
      }
    }
    
    // Additional cleanup: remove redundant separators and spaces
    remarque = remarque.replace(/\s*\|\s*\|\s*/g, ' | '); // Fix double separators
    remarque = remarque.replace(/^\s*\|\s*/, ''); // Remove leading separator
    remarque = remarque.replace(/\s*\|\s*$/, ''); // Remove trailing separator
    remarque = remarque.trim();
    
    // Ensure it doesn't exceed 255 characters (EcoTrack limit)
    if (remarque.length > 255) {
      remarque = remarque.substring(0, 252) + '...';
    }
    
    console.log(`📝 Built clean remarque: "${remarque}" (from confirmer: "${confirmerName}", variant: "${productDetails?.variant || 'none'}", notes: "${notes}")`);
    console.log(`📝 Removed duplicates and cleaned: original length ${(confirmerName + (productDetails?.variant || '') + notes).length} -> final length ${remarque.length}`);
    return remarque;
  }

  /**
   * Calculate the correct total amount for EcoTrack
   * Priority: (product_price * quantity) + delivery_price, fallback to other methods
   * @param {Object} orderData - Order data
   * @returns {number} - Total amount including delivery
   */
  calculateTotalAmount(orderData) {
    let totalAmount = 0;
    
    console.log(`🧮 Calculating total amount from order data:`, {
      total_amount: orderData.total_amount,
      delivery_price: orderData.delivery_price,
      final_total: orderData.final_total,
      montant: orderData.montant,
      delivery_type: orderData.delivery_type,
      product_details: orderData.product_details ? 'Available' : 'Missing'
    });
    
    // Extract product details for proper calculation
    let productDetails = null;
    if (orderData.product_details) {
      try {
        productDetails = typeof orderData.product_details === 'string' 
          ? JSON.parse(orderData.product_details) 
          : orderData.product_details;
      } catch (error) {
        console.warn('⚠️ Could not parse product_details:', error.message);
      }
    }
    
    // Method 1: Calculate from product details (unit_price * quantity) + delivery_price
    if (productDetails && productDetails.unit_price && productDetails.quantity) {
      const unitPrice = parseFloat(productDetails.unit_price) || 0;
      const quantity = parseFloat(productDetails.quantity) || 1;
      let deliveryPrice = parseFloat(orderData.delivery_price) || 0;
      
      // Ensure delivery price is correct for delivery type
      if (orderData.delivery_type === 'stop_desk' && deliveryPrice > 0) {
        console.log(`🚉 Stop desk delivery detected - delivery price: ${deliveryPrice} DA`);
      } else if (orderData.delivery_type === 'home' && deliveryPrice > 0) {
        console.log(`🏠 Home delivery detected - delivery price: ${deliveryPrice} DA`);
      }
      
      totalAmount = (unitPrice * quantity) + deliveryPrice;
      console.log(`✅ Using product details method: (${unitPrice} × ${quantity}) + ${deliveryPrice} = ${totalAmount}`);
      return totalAmount;
    }
    
    // Method 2: Handle multiple products in product_details array
    if (productDetails && Array.isArray(productDetails)) {
      let productsTotal = 0;
      console.log(`📦 Multiple products detected: ${productDetails.length} items`);
      
      productDetails.forEach((product, index) => {
        const unitPrice = parseFloat(product.unit_price || product.price) || 0;
        const quantity = parseFloat(product.quantity) || 1;
        const productSubtotal = unitPrice * quantity;
        productsTotal += productSubtotal;
        
        console.log(`  Product ${index + 1}: ${product.name || 'Unknown'} - ${unitPrice} × ${quantity} = ${productSubtotal} DA`);
      });
      
      const deliveryPrice = parseFloat(orderData.delivery_price) || 0;
      totalAmount = productsTotal + deliveryPrice;
      
      console.log(`✅ Multiple products total: ${productsTotal} + delivery ${deliveryPrice} = ${totalAmount} DA`);
      return totalAmount;
    }
    
    // Method 3: total_amount + delivery_price (assuming total_amount already includes quantity)
    const productAmount = parseFloat(orderData.total_amount) || 0;
    const deliveryAmount = parseFloat(orderData.delivery_price) || 0;
    
    if (productAmount > 0) {
      totalAmount = productAmount + deliveryAmount;
      console.log(`✅ Using total_amount + delivery method: ${productAmount} + ${deliveryAmount} = ${totalAmount}`);
      return totalAmount;
    }
    
    // Method 4: final_total (if calculated)
    if (orderData.final_total && parseFloat(orderData.final_total) > 0) {
      totalAmount = parseFloat(orderData.final_total);
      console.log(`✅ Using final_total: ${totalAmount}`);
      return totalAmount;
    }
    
    // Method 4: montant (frontend calculated)
    if (orderData.montant && parseFloat(orderData.montant) > 0) {
      totalAmount = parseFloat(orderData.montant);
      console.log(`✅ Using montant field: ${totalAmount}`);
      return totalAmount;
    }
    
    // Fallback: just the product amount
    if (productAmount > 0) {
      totalAmount = productAmount;
      console.log(`⚠️ Fallback to product amount only: ${totalAmount}`);
      return totalAmount;
    }
    
    console.warn(`⚠️ Could not calculate valid total amount, using 0`);
    return 0;
  }

  /**
   * Get station code for a given wilaya (required when stop_desk = 1)
   * Fetches from EcoTrack API and caches the result
   * @param {number} wilayaId - Wilaya ID
   * @returns {Promise<string>} - Station code for the wilaya
   */
  async getStationCodeForWilaya(wilayaId) {
    try {
      // Get fresh station codes from API
      const stations = await this.fetchStationCodes();
      
      // Find station for the given wilaya
      const station = stations.find(s => {
        // Match by wilaya ID in the code (format like "01A", "02A", etc.)
        const stationWilayaId = parseInt(s.code.substring(0, 2));
        return stationWilayaId === wilayaId;
      });
      
      if (station) {
        console.log(`🚉 Found station for wilaya ${wilayaId}: ${station.code} (${station.name})`);
        return station.code;
      }
      
      // Fallback to Alger if not found
      console.warn(`⚠️ No station found for wilaya ${wilayaId}, using Alger fallback`);
      const algerStation = stations.find(s => s.code.startsWith('16'));
      return algerStation ? algerStation.code : '16A';
      
    } catch (error) {
      console.error(`❌ Error getting station code for wilaya ${wilayaId}:`, error.message);
      // Fallback to hardcoded mapping if API fails
      return this.getFallbackStationCode(wilayaId);
    }
  }

  /**
   * Fetch station codes from EcoTrack API with caching
   * @returns {Promise<Array>} - Array of station objects
   */
  async fetchStationCodes() {
    // Check if we have valid cached data
    if (this.stationCodesCache && 
        this.stationCodesCacheExpiry && 
        Date.now() < this.stationCodesCacheExpiry) {
      console.log('📋 Using cached station codes');
      return this.stationCodesCache;
    }
    
    console.log('🌐 Fetching fresh station codes from EcoTrack API...');
    
    try {
      // Ensure we have credentials
      await this.ensureConfigLoaded();
      
      // Use any available account for fetching stations
      let apiToken = this.apiToken;
      let userGuid = this.userGuid;
      
      // Try to get credentials from default account if global config not available
      if (!apiToken || !userGuid) {
        const defaultAccount = await this.getDefaultAccount();
        if (defaultAccount) {
          apiToken = defaultAccount.api_token;
          userGuid = defaultAccount.user_guid;
        }
      }
      
      if (!apiToken || !userGuid) {
        throw new Error('No EcoTrack credentials available for fetching stations');
      }
      
      const response = await axios.get('https://app.noest-dz.com/api/public/desks', {
        params: {
          api_token: apiToken,
          user_guid: userGuid
        },
        headers: {
          'Accept': 'application/json',
        },
        timeout: 30000
      });
      
      console.log('🔍 Raw API response:', response.status, response.data);
      
      if (response.data) {
        let stations = response.data;
        
        // Handle different response formats
        if (response.data.data && Array.isArray(response.data.data)) {
          stations = response.data.data;
          console.log('📊 Using response.data.data format');
        } else if (!Array.isArray(response.data)) {
          console.log('🔍 Non-array response format:', typeof response.data);
          console.log('🔍 Response keys:', Object.keys(response.data));
          
          // Handle object format like {"01A": {"code": "1A", "name": "Adrar", ...}, "02A": {...}}
          if (typeof response.data === 'object' && response.data !== null) {
            const stationKeys = Object.keys(response.data);
            if (stationKeys.length > 0) {
              // Convert object format to array format
              stations = stationKeys.map(key => {
                const station = response.data[key];
                return {
                  id: key,
                  code: station.code || key,
                  name: station.name || station.libelle || key,
                  ...station
                };
              });
              console.log('📊 Converted object format to array format');
              console.log(`🔍 Converted ${stations.length} stations from object keys`);
            } else {
              console.error('❌ Empty object response');
              throw new Error('Empty object response from stations API');
            }
          } else if (response.data.stations && Array.isArray(response.data.stations)) {
            stations = response.data.stations;
            console.log('📊 Using response.data.stations format');
          } else if (response.data.desks && Array.isArray(response.data.desks)) {
            stations = response.data.desks;
            console.log('📊 Using response.data.desks format');
          } else {
            console.error('❌ Unknown response structure:', response.data);
            throw new Error(`Invalid response format: expected array or object with stations/desks`);
          }
        } else {
          console.log('📊 Using direct array format');
        }
        
        if (Array.isArray(stations) && stations.length > 0) {
          this.stationCodesCache = stations;
          this.stationCodesCacheExpiry = Date.now() + this.CACHE_DURATION;
          
          console.log(`✅ Fetched ${stations.length} station codes from EcoTrack API`);
          console.log('� Sample stations:', stations.slice(0, 3).map(s => `${s.code || s.id}: ${s.name}`));
          
          return stations;
        } else {
          console.warn('⚠️ Empty stations array received');
          return [];
        }
      } else {
        throw new Error('Empty response from stations API');
      }
      
    } catch (error) {
      console.error('❌ Failed to fetch station codes from API:', error.message);
      
      // Return cached data if available, even if expired
      if (this.stationCodesCache) {
        console.log('🔄 Using expired cached station codes as fallback');
        return this.stationCodesCache;
      }
      
      throw error;
    }
  }

  /**
   * Fallback station codes when API is unavailable
   * @param {number} wilayaId - Wilaya ID
   * @returns {string} - Fallback station code
   */
  getFallbackStationCode(wilayaId) {
    // Simplified fallback mapping based on common patterns
    const fallbackCodes = {
      16: '16A', // Alger
      31: '31A', // Oran
      25: '25A', // Constantine
      23: '23A', // Annaba
      19: '19A', // Setif
      15: '15A', // Tizi Ouzou
      6: '06A',  // Bejaia
      9: '09A',  // Blida
      21: '21A', // Skikda
      27: '27A'  // Mostaganem
    };
    
    // Format wilaya ID with leading zero if needed
    const formattedWilayaId = wilayaId.toString().padStart(2, '0');
    const fallbackCode = fallbackCodes[wilayaId] || `${formattedWilayaId}A`;
    
    console.log(`� Using fallback station code for wilaya ${wilayaId}: ${fallbackCode}`);
    return fallbackCode;
  }

  /**
   * Validate and fix commune names to match EcoTrack accepted values
   * @param {string} commune - Original commune name
   * @param {number} wilayaId - Wilaya ID for context
   * @returns {string} - Valid commune name
   */
  validateAndFixCommune(commune, wilayaId) {
    if (!commune || typeof commune !== 'string') {
      return this.getDefaultCommuneForWilaya(wilayaId);
    }
    
    const originalCommune = commune;
    
    // Common problematic communes mapping
    const communeMapping = {
      'Douira': 'Alger Centre',
      'douira': 'Alger Centre',
      'Tamanrasset': 'In Salah',
      'تمنراست': 'In Salah',
      'Bir Mourad Rais': 'Bir Mourad Rais',
      'El Harrach': 'El Harrach',
      'Rouiba': 'Rouiba',
      'Reghaia': 'Reghaia',
      'Dar El Beida': 'Dar El Beida',
      // Staoueli area alternatives (common misspelling)
      'Setaouali': 'Staoueli',
      'setaouali': 'Staoueli',
      // Oum El Bouaghi alternatives
      'Oum El Bouaghi': 'Oum el bouaghi',
      'Oum el Bouaghi': 'Oum el bouaghi',
      'Oum el bouaghi': 'Oum el bouaghi',
      'أم البواقي': 'Oum el bouaghi'
    };
    
    // Direct mapping first
    if (communeMapping[commune]) {
      console.log(`🔄 Mapped commune "${originalCommune}" to "${communeMapping[commune]}"`);
      return communeMapping[commune];
    }
    
    // Case-insensitive mapping
    const lowerCommune = commune.toLowerCase();
    for (const [key, value] of Object.entries(communeMapping)) {
      if (key.toLowerCase() === lowerCommune) {
        console.log(`🔄 Case-insensitive mapping: "${originalCommune}" to "${value}"`);
        return value;
      }
    }
    
    // If commune contains problematic words, fallback to wilaya default
    const problematicTerms = ['non spécifiée', 'unknown', 'undefined', 'null'];
    if (problematicTerms.some(term => lowerCommune.includes(term))) {
      const defaultCommune = this.getDefaultCommuneForWilaya(wilayaId);
      console.log(`🔄 Problematic commune "${originalCommune}" mapped to default: "${defaultCommune}"`);
      return defaultCommune;
    }
    
    // Return original if it seems valid
    return commune;
  }

  /**
   * Get default commune for a wilaya
   * @param {number} wilayaId - Wilaya ID
   * @returns {string} - Default commune name
   */
  getDefaultCommuneForWilaya(wilayaId) {
    const defaultCommunes = {
      1: 'Adrar',
      2: 'Chlef',
      3: 'Laghouat',
      4: 'Oum el bouaghi',
      5: 'Batna',
      6: 'Bejaia',
      7: 'Biskra',
      8: 'Bechar',
      9: 'Blida',
      10: 'Bouira',
      11: 'In Salah', // Tamanrasset -> In Salah
      12: 'Tebessa',
      13: 'Tlemcen',
      14: 'Tiaret',
      15: 'Tizi Ouzou',
      16: 'Alger Centre', // Alger
      17: 'Djelfa',
      18: 'Jijel',
      19: 'Setif',
      20: 'Saida',
      21: 'Skikda',
      22: 'Sidi Bel Abbes',
      23: 'Annaba',
      24: 'Guelma',
      25: 'Constantine',
      26: 'Medea',
      27: 'Mostaganem',
      28: 'M\'Sila',
      29: 'Mascara',
      30: 'Ouargla',
      31: 'Oran',
      32: 'El Bayadh',
      33: 'Illizi',
      34: 'Bordj Bou Arreridj',
      35: 'Boumerdes',
      36: 'El Tarf',
      37: 'Tindouf',
      38: 'Tissemsilt',
      39: 'El Oued',
      40: 'Khenchela',
      41: 'Souk Ahras',
      42: 'Tipaza',
      43: 'Mila',
      44: 'Ain Defla',
      45: 'Naama',
      46: 'Ain Temouchent',
      47: 'Ghardaia',
      48: 'Relizane'
    };
    
    return defaultCommunes[wilayaId] || 'Alger Centre';
  }

  /**
   * Get delivery fees for all wilayas from EcoTrack fees API
   * API documentation shows POST but actual implementation requires GET
   * @returns {Object} Delivery fees data from EcoTrack API
   */
  async getDeliveryFees() {
    try {
      await this.ensureConfigLoaded();
      
      console.log('📡 [ECOTRACK] Fetching delivery fees from official API...');
      
      // API requires GET method with query parameters (despite documentation showing POST)
      const params = new URLSearchParams({
        api_token: this.apiToken,
        user_guid: this.userGuid
      });
      
      const url = `${this.baseURL}/public/fees?${params.toString()}`;
      
      console.log('📡 [ECOTRACK] Calling fees API (GET method - API actual requirement):', {
        url: `${this.baseURL}/public/fees`,
        api_token: this.apiToken ? '***' + this.apiToken.slice(-4) : 'NOT SET',
        user_guid: this.userGuid ? '***' + this.userGuid.slice(-4) : 'NOT SET',
        method: 'GET (API requires GET despite documentation showing POST)'
      });
      
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('🚚 [ECOTRACK] Fees API response status:', response.status);
      console.log('🚚 [ECOTRACK] Fees API response data:', JSON.stringify(response.data, null, 2));
      
      // Handle the response format based on actual API behavior
      if (response.data) {
        // Check if response has the expected structure from documentation
        if (response.data.tarifs && response.data.tarifs.return) {
          return response.data;
        }
        // Fallback: check if response is direct wilaya mapping
        else if (typeof response.data === 'object' && Object.keys(response.data).some(key => !isNaN(key))) {
          return { tarifs: { return: response.data } };
        }
        // Return as-is and let the calling code handle it
        else {
          return response.data;
        }
      } else {
        throw new Error('Empty response from EcoTrack fees API');
      }
      
    } catch (error) {
      console.error('❌ [ECOTRACK] Error fetching delivery fees:', error.message);
      if (error.response) {
        console.error('❌ [ECOTRACK] API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      throw error;
    }
  }
}

module.exports = new EcotrackService();