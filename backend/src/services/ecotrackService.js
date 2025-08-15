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
      
      // Special handling for Tamanrasset - try alternative names if needed
      if (finalCommune === 'Tamanrasset' || finalCommune === 'تمنراست') {
        console.log(`🏜️ Special handling for Tamanrasset commune`);
        // Try different formats that Ecotrack might accept
        // Based on database, try other communes in Tamanrasset wilaya
        finalCommune = 'In Salah'; // Try In Salah as it's a major city in the same wilaya
      }
      
      console.log(`  - Final wilaya_id: ${finalWilayaId}`);
      console.log(`  - Final commune: "${finalCommune}"`);
      console.log(`  - Original commune from order: "${orderData.commune}"`);
      
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
        montant: parseFloat(orderData.total_amount) || 0, // Required | numeric
        remarque: orderData.notes || '', // max:255
        produit: productDetails.name || 'Product', // Required
        type_id: 1, // Required | integer between 1,3 (1: Livraison, 2: Échange, 3: Pick up)
        poids: Math.max(1, Math.floor(orderData.weight || productDetails.weight || 1)), // Required | integer (minimum 1)
        stop_desk: 0, // Required | integer between 0,1 (0: à domicile, 1: stop desk)
        stock: 0, // integer between 0,1 (0: Non, 1: Oui) - set to 0 since stock module is disabled
        can_open: 0 // integer between 0,1 (0: Non, 1: Oui) - default to no
      };

      console.log('🚚 Creating Ecotrack order with new API:', ecotrackOrderData);

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
}

module.exports = new EcotrackService();