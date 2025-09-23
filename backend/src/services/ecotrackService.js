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
   * Format station code to remove leading zeros for EcoTrack API
   * Example: "05B" -> "5B", "01A" -> "1A"
   */
  formatStationCode(stationCode) {
    if (!stationCode) return stationCode;
    
    // Remove leading zeros while preserving the letter suffix
    // Examples: "05B" -> "5B", "01A" -> "1A", "12A" -> "12A"
    const match = stationCode.match(/^0*(\d+)([A-Z]*)$/);
    if (match) {
      return match[1] + match[2];
    }
    
    // If no match, return original (might already be in correct format)
    return stationCode;
  }

  /**
   * Remove accents from text for EcoTrack API compatibility
   * @param {string} text - Text to remove accents from
   * @returns {string} - Text without accents
   */
  removeAccents(text) {
    if (!text || typeof text !== 'string') return text;
    
    const accentMap = {
      'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'ā': 'a', 'ă': 'a', 'ą': 'a',
      'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ĕ': 'e', 'ė': 'e', 'ę': 'e', 'ě': 'e',
      'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'ĭ': 'i', 'į': 'i',
      'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ō': 'o', 'ŏ': 'o', 'ő': 'o',
      'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ŭ': 'u', 'ů': 'u', 'ű': 'u', 'ų': 'u',
      'ý': 'y', 'ÿ': 'y', 'ŷ': 'y',
      'ñ': 'n', 'ń': 'n', 'ň': 'n', 'ņ': 'n',
      'ç': 'c', 'ć': 'c', 'ĉ': 'c', 'ċ': 'c', 'č': 'c',
      'ś': 's', 'ŝ': 's', 'ş': 's', 'š': 's',
      'ź': 'z', 'ż': 'z', 'ž': 'z',
      'ď': 'd', 'đ': 'd',
      'ğ': 'g', 'ĝ': 'g', 'ġ': 'g', 'ģ': 'g',
      'ĥ': 'h', 'ħ': 'h',
      'ĵ': 'j',
      'ķ': 'k', 'ĸ': 'k',
      'ĺ': 'l', 'ļ': 'l', 'ľ': 'l', 'ŀ': 'l', 'ł': 'l',
      'ŕ': 'r', 'ŗ': 'r', 'ř': 'r',
      'ţ': 't', 'ť': 't', 'ŧ': 't',
      'ŵ': 'w',
      // Uppercase versions
      'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Ā': 'A', 'Ă': 'A', 'Ą': 'A',
      'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E', 'Ē': 'E', 'Ĕ': 'E', 'Ė': 'E', 'Ę': 'E', 'Ě': 'E',
      'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I', 'Ī': 'I', 'Ĭ': 'I', 'Į': 'I',
      'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ō': 'O', 'Ŏ': 'O', 'Ő': 'O',
      'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U', 'Ū': 'U', 'Ŭ': 'U', 'Ů': 'U', 'Ű': 'U', 'Ų': 'U',
      'Ý': 'Y', 'Ÿ': 'Y', 'Ŷ': 'Y',
      'Ñ': 'N', 'Ń': 'N', 'Ň': 'N', 'Ņ': 'N',
      'Ç': 'C', 'Ć': 'C', 'Ĉ': 'C', 'Ċ': 'C', 'Č': 'C',
      'Ś': 'S', 'Ŝ': 'S', 'Ş': 'S', 'Š': 'S',
      'Ź': 'Z', 'Ż': 'Z', 'Ž': 'Z',
      'Ď': 'D', 'Đ': 'D',
      'Ğ': 'G', 'Ĝ': 'G', 'Ġ': 'G', 'Ģ': 'G',
      'Ĥ': 'H', 'Ħ': 'H',
      'Ĵ': 'J',
      'Ķ': 'K',
      'Ĺ': 'L', 'Ļ': 'L', 'Ľ': 'L', 'Ŀ': 'L', 'Ł': 'L',
      'Ŕ': 'R', 'Ŗ': 'R', 'Ř': 'R',
      'Ţ': 'T', 'Ť': 'T', 'Ŧ': 'T',
      'Ŵ': 'W'
    };
    
    return text.replace(/[^\u0000-\u007E]/g, function(char) {
      return accentMap[char] || char;
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
      
      // Use order's actual wilaya_id and commune data without city-based redirection
      let finalWilayaId = orderData.wilaya_id;
      let finalCommune = orderData.commune || orderData.baladia_name;
      
      // Validate and fix wilaya_id for Ecotrack (must be between 1-58)
      if (finalWilayaId > 58 || finalWilayaId < 1) {
        console.log(`⚠️ Invalid wilaya_id ${finalWilayaId} for Ecotrack (must be 1-58)`);
        
        // For invalid wilaya_id, default to Algiers but keep the original commune
        finalWilayaId = 16; // Algiers
        console.log(`🔄 Using default wilaya_id: ${finalWilayaId} for invalid value`);
      }
      
      // Special handling for numeric city names that represent wilaya codes
      if (orderData.customer_city && /^\d+$/.test(orderData.customer_city)) {
        const cityAsNumber = parseInt(orderData.customer_city);
        if (cityAsNumber >= 1 && cityAsNumber <= 58) {
          finalWilayaId = cityAsNumber;
          // Get commune from EcoTrack API instead of hardcoded mapping
          try {
            const communes = await this.fetchCommunesFromEcoTrack(cityAsNumber);
            if (communes.length > 0) {
              // Use the first commune as default
              finalCommune = communes[0].nom;
              console.log(`🔢 Mapped numeric city "${orderData.customer_city}" to wilaya_id: ${finalWilayaId}, commune: ${finalCommune} (from EcoTrack API)`);
            } else {
              // Fallback to wilaya name if no communes found
              finalCommune = this.getWilayaNameById(cityAsNumber);
              console.log(`🔢 Mapped numeric city "${orderData.customer_city}" to wilaya_id: ${finalWilayaId}, commune: ${finalCommune} (fallback)`);
            }
          } catch (error) {
            console.warn(`⚠️ Error fetching communes for wilaya ${cityAsNumber}:`, error.message);
            finalCommune = this.getWilayaNameById(cityAsNumber);
            console.log(`🔢 Mapped numeric city "${orderData.customer_city}" to wilaya_id: ${finalWilayaId}, commune: ${finalCommune} (error fallback)`);
          }
        }
      }
      
      // Use wilaya name directly without complex validation
      finalCommune = this.getWilayaNameById(finalWilayaId);
      
      console.log(`  - Final wilaya_id: ${finalWilayaId}`);
      console.log(`  - Final commune: "${finalCommune}" (using wilaya name)`);
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
        source: montantSource,
        wilaya_id: finalWilayaId,
        wilaya_note: this.getWilayaDeliveryNote(finalWilayaId)
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
      
      // Get station code for stop_desk delivery
      let stationInfo = null;
      
      if (stopDesk === 1) {
        stationInfo = await this.getValidStationCodeForWilaya(orderData, finalWilayaId);
        console.log(`🚉 Using station code for wilaya ${finalWilayaId}: ${stationInfo.station_code}`);
      }

      const ecotrackOrderData = {
        api_token: selectedAccount.api_token, // Required - from selected account
        user_guid: selectedAccount.user_guid, // Required - from selected account
        reference: orderData.order_number || `REF-${Date.now()}`, // Nullable | max:255
        client: orderData.customer_name || 'Customer', // Required | max:255
        phone: (orderData.customer_phone?.replace(/\D/g, '') || '0555123456').substring(0, 10), // Required | digits between 9,10
        phone_2: orderData.customer_phone_2 ? orderData.customer_phone_2.replace(/\D/g, '').substring(0, 10) : undefined, // Optional | digits between 9,10
        adresse: orderData.customer_address || (() => {
          // Always use the original customer location for the address, regardless of wilaya mapping
          const city = orderData.customer_city || 'Ville';
          return city; // Keep the original customer city (e.g., "In Salah") in the address
        })() || 'Adresse non spécifiée', // Required | max:255 - Keep original customer location in address
        wilaya_id: finalWilayaId, // Use actual wilaya_id from database
        commune: finalCommune, // Use actual commune name
        montant: finalMontant, // Required | numeric - Use frontend Total Final or backend calculation
        remarque: (() => {
          const quantityValue = orderData.quantity_ordered || orderData.quantity;
          console.log('🔍 QUANTITY DEBUG:');
          console.log('  - orderData.quantity_ordered:', orderData.quantity_ordered);
          console.log('  - orderData.quantity:', orderData.quantity);
          console.log('  - Final quantity used for remarque:', quantityValue);
          console.log('  - Product details:', productDetails ? productDetails.name : 'No product details');
          
          const result = this.buildRemarqueWithConfirmer(orderData.notes, orderData.confirmed_by_name, productDetails, quantityValue);
          console.log('📝 Final remarque result:', result);
          return result || '';
        })(), // max:255
        produit: productDetails.name || 'Product', // Required
        type_id: typeId, // Required | integer between 1,3 (1: Livraison, 2: Échange, 3: Pick up) - determined by delivery_type
        poids: Math.max(1, Math.floor(orderData.weight || productDetails.weight || 1)), // Required | integer (minimum 1)
        stop_desk: stopDesk, // Required | integer between 0,1 (0: à domicile, 1: stop desk) - determined from delivery_type or station_code
        station_code: stationInfo ? this.formatStationCode(stationInfo.station_code) : undefined, // Required only for stop_desk = 1
        stock: 0, // integer between 0,1 (0: Non, 1: Oui) - set to 0 since stock module is disabled
        quantite: String(orderData.quantity || orderData.quantity_ordered || 1), // Required when stock = 1, must be string
        can_open: 0 // integer between 0,1 (0: Non, 1: Oui) - default to no
      };

      console.log('🚚 Creating Ecotrack order with new API:', {
        ...ecotrackOrderData,
        api_token: '***' + ecotrackOrderData.api_token.slice(-4), // Hide full token in logs
      });
      
      if (stopDesk === 1) {
        const formattedStationCode = this.formatStationCode(stationInfo.station_code);
        console.log(`🚉 Stop desk delivery - Using station: ${formattedStationCode} (formatted from ${stationInfo.station_code}) for wilaya ${finalWilayaId}`);
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
      // Alternative communes for different wilayas
      const alternativeCommunes = {
        // Major cities and common problematic wilayas
        1: ['Adrar', 'Reggane', 'Zaouiet Kounta', 'Timimoun'], // Adrar
        2: ['Chlef', 'Ténès', 'El Karimia', 'Boukadir'], // Chlef
        3: ['Laghouat', 'Aflou', 'Ksar El Hirane', 'Hassi Delaa'], // Laghouat
        4: ['Oum El Bouaghi', 'Ain Mlila', 'Ain Beida', 'Souk Naamane'], // Oum El Bouaghi
        5: ['Batna', 'Barika', 'Arris', 'Ain Touta'], // Batna
        6: ['Béjaïa', 'Akbou', 'Kherrata', 'Sidi Aich'], // Béjaïa
        7: ['Biskra', 'Tolga', 'Sidi Okba', 'El Kantara'], // Biskra
        8: ['Béchar', 'Beni Abbes', 'Kenadsa', 'Tabelbala'], // Béchar
        9: ['Blida', 'Boufarik', 'Larbaa', 'Meftah'], // Blida
        10: ['Bouira', 'Lakhdaria', 'M\'Chedallah', 'Sour El Ghozlane'], // Bouira
        11: ['Tamanrasset', 'In Salah', 'In Guezzam', 'Tin Zaouatine'], // Tamanrasset
        12: ['Tébessa', 'Cheria', 'El Aouinet', 'Bir El Ater'], // Tébessa
        13: ['Tlemcen', 'Maghnia', 'Remchi', 'Sebdou'], // Tlemcen
        14: ['Tiaret', 'Sougueur', 'Mahdia', 'Frenda'], // Tiaret
        15: ['Tizi Ouzou', 'Azazga', 'Draa Ben Khedda', 'Tigzirt'], // Tizi Ouzou
        16: ['Alger', 'Alger Centre', 'Bab El Oued', 'El Harrach', 'Draria', 'Rouiba'], // Alger
        17: ['Djelfa', 'Messaad', 'Ain Oussera', 'Hassi Bahbah'], // Djelfa
        18: ['Jijel', 'Ferraoun', 'El Milia', 'Taher'], // Jijel
        19: ['Sétif', 'El Eulma', 'Ain Arnat', 'Bougaa'], // Sétif
        20: ['Saïda', 'Ain El Hadjar', 'Ouled Brahim', 'Youb'], // Saïda
        21: ['Skikda', 'Collo', 'Azzaba', 'El Hadaiek'], // Skikda
        22: ['Sidi Bel Abbès', 'Télagh', 'Ben Badis', 'Tessala'], // Sidi Bel Abbès
        23: ['Annaba', 'El Hadjar', 'Berrahal', 'Ain Berda'], // Annaba
        24: ['Guelma', 'Bouchegouf', 'Heliopolis', 'Hammam Debagh'], // Guelma
        25: ['Constantine', 'Ali Mendjeli', 'Didouche Mourad', 'El Khroub'], // Constantine
        26: ['Médéa', 'Berrouaghia', 'Ksar El Boukhari', 'Tablat'], // Médéa
        27: ['Mostaganem', 'Relizane', 'Ain Nouissy', 'Stidia'], // Mostaganem
        28: ['MSila', 'M\'Sila', 'Msila', 'M Sila', 'Boussaada'], // M'Sila - WORKING: MSila is correct
        29: ['Mascara', 'Sig', 'Mohammadia', 'Tighennif'], // Mascara
        30: ['Ouargla', 'Hassi Messaoud', 'Touggourt', 'Nezla'], // Ouargla
        31: ['Oran', 'Es Senia', 'Bir El Djir', 'Arzew'], // Oran
        32: ['El Bayadh', 'Brézina', 'Bogtob', 'El Abiodh Sidi Cheikh'], // El Bayadh
        33: ['Illizi', 'In Amenas', 'Deb Deb', 'Bordj Omar Driss'], // Illizi
        34: ['Bordj Bou Arreridj', 'Ras El Oued', 'El Anseur', 'Bordj Ghdir'], // Bordj Bou Arreridj
        35: ['Boumerdès', 'Naciria', 'Khemis El Khechna', 'Boudouaou'], // Boumerdès
        36: ['El Tarf', 'El Kala', 'Bouhadjar', 'Ben M\'Hidi'], // El Tarf
        37: ['Tindouf'], // Tindouf
        38: ['Tissemsilt', 'Theniet El Had', 'Bordj Bou Naama', 'Lazharia'], // Tissemsilt
        39: ['El Oued', 'Robbah', 'Guemar', 'Taghzout'], // El Oued
        40: ['Khenchela', 'Chechar', 'Kais', 'Baghai'], // Khenchela
        41: ['Souk Ahras', 'Sedrata', 'M\'Daourouche', 'Bir Bouhouche'], // Souk Ahras
        42: ['Tipaza', 'Kolea', 'Cherchell', 'Menaceur'], // Tipaza
        43: ['Mila', 'Ferdjioua', 'Chelghoum Laid', 'Rouached'], // Mila
        44: ['Aïn Defla', 'Khemis Miliana', 'El Attaf', 'Djelida'], // Aïn Defla
        45: ['Naâma', 'Mecheria', 'Ain Sefra', 'Asla'], // Naâma
        46: ['Aïn Témouchent', 'Hammam Bouhadjar', 'Beni Saf', 'El Malah'], // Aïn Témouchent
        47: ['Ghardaïa', 'El Meniaa', 'Berriane', 'Metlili'], // Ghardaïa
        48: ['Relizane', 'Mazouna', 'Oued Rhiou', 'Yellel'], // Relizane
        49: ['Timimoun', 'Adrar', 'Aougrout', 'Charouine'], // Timimoun
        50: ['Bordj Badji Mokhtar', 'Timiaouine'], // Bordj Badji Mokhtar
        51: ['Ouled Djellal', 'Sidi Khaled', 'Besbes'], // Ouled Djellal
        52: ['Béni Abbès', 'Tabelbala', 'El Ouata'], // Béni Abbès
        53: ['In Salah', 'Ain Salah', 'Insalah', 'Centre-Ville', 'In-Salah'], // In Salah wilaya
        54: ['Djanet', 'Illizi'], // Djanet
        55: ['Touggourt', 'Megarine', 'Taibet', 'Nezla'], // Touggourt
        56: ['El M\'Ghair', 'El Mghair', 'Still', 'Djamaa'], // El M'Ghair
        57: ['El Meniaa', 'Hassi Gara', 'Hassi Fehal'], // El Meniaa
        58: ['El Meniaa', 'In Salah'] // El Meniaa (alternative)
      };
      
      // Try multiple commune name formats for problematic locations
      while (attemptCount < maxAttempts) {
        attemptCount++;
        
        // Use finalWilayaId for alternative communes
        if (attemptCount > 1) {
          const wilayaNames = {
            1: 'Adrar', 2: 'Chlef', 3: 'Laghouat', 4: 'Oum El Bouaghi', 5: 'Batna',
            6: 'Béjaïa', 7: 'Biskra', 8: 'Béchar', 9: 'Blida', 10: 'Bouira',
            11: 'Tamanrasset', 12: 'Tébessa', 13: 'Tlemcen', 14: 'Tiaret', 15: 'Tizi Ouzou',
            16: 'Alger', 17: 'Djelfa', 18: 'Jijel', 19: 'Sétif', 20: 'Saïda',
            21: 'Skikda', 22: 'Sidi Bel Abbès', 23: 'Annaba', 24: 'Guelma', 25: 'Constantine',
            26: 'Médéa', 27: 'Mostaganem', 28: 'MSila', 29: 'Mascara', 30: 'Ouargla',
            31: 'Oran', 32: 'El Bayadh', 33: 'Illizi', 34: 'Bordj Bou Arreridj', 35: 'Boumerdès',
            36: 'El Tarf', 37: 'Tindouf', 38: 'Tissemsilt', 39: 'El Oued', 40: 'Khenchela',
            41: 'Souk Ahras', 42: 'Tipaza', 43: 'Mila', 44: 'Aïn Defla', 45: 'Naama',
            46: 'Aïn Témouchent', 47: 'Ghardaïa', 48: 'Relizane', 49: 'Timimoun',
            50: 'Bordj Badji Mokhtar', 51: 'Ouled Djellal', 52: 'Béni Abbès', 53: 'In Salah',
            54: 'Djanet', 55: 'Touggourt', 56: 'El M\'Ghair', 57: 'El Meniaa'
          };
          
          // Build alternatives: specific alternatives + wilaya name as final fallback
          let alternatives = [];
          if (alternativeCommunes[finalWilayaId]) {
            alternatives = [...alternativeCommunes[finalWilayaId]];
          }
          // Always add wilaya name as final fallback if not already included
          if (wilayaNames[finalWilayaId] && !alternatives.includes(wilayaNames[finalWilayaId])) {
            alternatives.push(wilayaNames[finalWilayaId]);
          }
          
          if (alternatives.length > 0) {
            const alternativeIndex = attemptCount - 2;
            if (alternativeIndex < alternatives.length) {
              ecotrackOrderData.commune = alternatives[alternativeIndex];
              console.log(`🔄 Attempt ${attemptCount}: Trying commune "${ecotrackOrderData.commune}" for wilaya ${finalWilayaId} (fallback ${alternativeIndex + 1}/${alternatives.length})`);
            }
          }
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
          if (error.response?.status === 422 && attemptCount < maxAttempts) {
            // Check if it's a commune error or general validation error
            if (error.response?.data?.errors?.commune || 
                (error.response?.data?.message && error.response.data.message.toLowerCase().includes('commune'))) {
              console.log(`🔄 Commune validation failed, trying alternative name...`);
              continue; // Try next alternative commune
            }
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
      console.log('  ✓ Added quantity to remarque:', quantityPart);
    } else {
      console.log('  ⚠️ Quantity not added - value:', quantity, 'condition check:', !!(quantity && quantity > 0));
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
    let extractedVariant = 'none';
    if (productDetails) {
      let variant = '';
      
      // Try to extract variant from different possible fields
      if (productDetails.variant) {
        variant = productDetails.variant;
        extractedVariant = `direct.variant: ${variant}`;
      } else if (productDetails.variante) {
        variant = productDetails.variante;
        extractedVariant = `direct.variante: ${variant}`;
      } else if (productDetails.product_variant) {
        variant = productDetails.product_variant;
        extractedVariant = `direct.product_variant: ${variant}`;
      } else if (productDetails.size || productDetails.color || productDetails.model) {
        // Build variant from individual attributes
        const variantParts = [];
        if (productDetails.size) variantParts.push(productDetails.size);
        if (productDetails.color) variantParts.push(productDetails.color);
        if (productDetails.model) variantParts.push(productDetails.model);
        variant = variantParts.join(' ');
        extractedVariant = `attributes: ${variant}`;
      } else if (productDetails.name) {
        // Try to extract variant from product name patterns
        const productName = productDetails.name.trim();
        
        // Look for patterns like "PRODUCT NAME 1234" or "PRODUCT CODE variant"
        const variantPatterns = [
          /\b(\d{3,5})\b/g, // 3-5 digit codes like "2517"
          /\b(XS|S|M|L|XL|XXL)\b/gi, // Size patterns
          /\b(originale?|original|authentique?|authentic)\b/gi, // Authenticity markers
          /\b(noir|blanc|rouge|bleu|vert|jaune|rose|black|white|red|blue|green|yellow|pink)\b/gi, // Colors
          /\b(taille\s+\w+|size\s+\w+)\b/gi, // Size with prefix
          /\b(mod[eè]le?\s+\w+|model\s+\w+)\b/gi // Model with prefix
        ];
        
        const extractedVariants = [];
        
        for (const pattern of variantPatterns) {
          const matches = productName.match(pattern);
          if (matches) {
            extractedVariants.push(...matches);
          }
        }
        
        if (extractedVariants.length > 0) {
          variant = extractedVariants.join(' ');
          extractedVariant = `name_pattern: ${variant}`;
          console.log(`  🔍 Extracted variant from product name: "${variant}"`);
        }
      }
      
      if (variant && variant.trim()) {
        const variantPart = `Variante: ${variant.trim()}`;
        if (!addedParts.has(variantPart.toLowerCase())) {
          if (remarque) {
            remarque += ' | ';
          }
          remarque += variantPart;
          addedParts.add(variantPart.toLowerCase());
          console.log(`  ✓ Added variant to remarque: ${variantPart}`);
        }
      } else {
        console.log(`  ⚠️ No variant information found in productDetails`);
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
      cleanNotes = cleanNotes.replace(/\b[A-Z]+\s+[A-Z]+\s+[A-Z]+\b/g, '').trim(); // Remove 3+ word uppercase patterns
      cleanNotes = cleanNotes.replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+.*$/g, '').trim(); // Remove title case product names
      
      // Remove specific product name patterns that might slip through
      cleanNotes = cleanNotes.replace(/.*WOMEN.*CAT.*LUNETTE.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*ENSEMBLE.*FEMME.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*MONTRE.*FEMME.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*PARFUM.*HOMME.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*MATLERXS.*/gi, '').trim();
      cleanNotes = cleanNotes.replace(/.*[A-Z]{3,}.*\d{3,}.*/gi, '').trim(); // Remove patterns like MATLERXS 2517
      cleanNotes = cleanNotes.replace(/.*originale.*/gi, '').trim();
      
      // Split notes by common separators and process each part
      const noteParts = cleanNotes.split(/[|,;]/).map(part => part.trim()).filter(part => part.length > 0);
      
      for (const notePart of noteParts) {
        // Skip empty parts or very short meaningless parts
        if (notePart.length < 2) continue;
        
        // Skip parts that look like product names (various patterns)
        const isProductName = (
          // All uppercase with multiple words
          (/^[A-Z\s]+[A-Z]+$/.test(notePart) && notePart.split(' ').length > 1) ||
          // Contains common product keywords
          /\b(WOMEN|HOMME|FEMME|CAT|LUNETTE|ENSEMBLE|MONTRE|PARFUM|COLLECTION|MATLERXS|originale)\b/i.test(notePart) ||
          // Long uppercase sequences
          /[A-Z]{8,}/.test(notePart) ||
          // Title case product patterns
          /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(notePart) ||
          // Product codes with numbers
          /[A-Z]{3,}.*\d{3,}/.test(notePart) ||
          // Contains "originale" keyword
          /originale/i.test(notePart)
        );
        
        if (isProductName) {
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
          // remarque += notePart;
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
    
    console.log(`📝 Built clean remarque: "${remarque}" (from confirmer: "${confirmerName}", variant: "${extractedVariant}", notes: "${notes}")`);
    console.log(`📝 Removed duplicates and cleaned: original length ${(confirmerName + extractedVariant + notes).length} -> final length ${remarque.length}`);
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
    
    // Method 3: total_amount + delivery_price (but consider quantity if available)
    const productAmount = parseFloat(orderData.total_amount) || 0;
    const deliveryAmount = parseFloat(orderData.delivery_price) || 0;
    
    if (productAmount > 0) {
      // Check if we have quantity information to multiply
      let quantity = 1;
      
      // Try to get quantity from multiple sources
      if (orderData.quantity && orderData.quantity > 0) {
        quantity = parseFloat(orderData.quantity);
      } else if (orderData.quantity_ordered && orderData.quantity_ordered > 0) {
        quantity = parseFloat(orderData.quantity_ordered);
      } else if (productDetails && productDetails.quantity && productDetails.quantity > 0) {
        quantity = parseFloat(productDetails.quantity);
      }
      
      // Calculate total considering quantity
      const productTotal = productAmount * quantity;
      totalAmount = productTotal + deliveryAmount;
      
      console.log(`✅ Using total_amount × quantity + delivery method: ${productAmount} × ${quantity} + ${deliveryAmount} = ${totalAmount}`);
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
   * Get and validate station code for a wilaya
   * @param {Object} orderData - Order data that may contain station_code
   * @param {number} wilayaId - Target wilaya ID
   * @returns {Promise<Object>} - Object with station_code and corrected_wilaya_id
   */
  async getValidStationCodeForWilaya(orderData, wilayaId) {
    try {
      // First try to get station from actual EcoTrack stations API
      const stationInfo = await this.getStationByWilayaId(wilayaId);
      
      if (stationInfo) {
        console.log(`✅ Using EcoTrack station for wilaya ${wilayaId}: ${stationInfo.station_code} (${stationInfo.name})`);
        return stationInfo;
      }
      
      // Fallback to existing logic if API doesn't have the station
      // Check if frontend provided station codes
      const providedStationCode = orderData.ecotrack_station_code || orderData.station_code;
      
      if (providedStationCode) {
        // Extract wilaya ID from station code (first 2 digits)
        const stationCodeMatch = providedStationCode.match(/^(\d{1,2})/);
        if (stationCodeMatch) {
          const stationWilayaId = parseInt(stationCodeMatch[1]);
          
          if (stationWilayaId === wilayaId) {
            // Station code matches wilaya - use it
            console.log(`✅ Station code ${providedStationCode} matches wilaya ${wilayaId} - using as provided`);
            return {
              station_code: this.formatStationCode(providedStationCode),
              corrected_wilaya_id: wilayaId
            };
          } else {
            // Station code doesn't match - log warning and fetch correct one
            console.warn(`⚠️ Station code mismatch: ${providedStationCode} (wilaya ${stationWilayaId}) != wilaya ${wilayaId}. Fetching correct station code...`);
          }
        } else {
          console.warn(`⚠️ Invalid station code format: ${providedStationCode}. Fetching correct station code for wilaya ${wilayaId}...`);
        }
      }
      
      // Get correct station code for the wilaya
      const correctStationCode = await this.getStationCodeForWilaya(wilayaId);
      console.log(`🔧 Using station code for wilaya ${wilayaId}: ${correctStationCode}`);
      
      return {
        station_code: this.formatStationCode(correctStationCode),
        corrected_wilaya_id: wilayaId
      };
      
    } catch (error) {
      console.error(`❌ Error validating station code for wilaya ${wilayaId}:`, error.message);
      // Fallback to the original method
      const stationCode = await this.getStationCodeForWilaya(wilayaId);
      return {
        station_code: stationCode,
        corrected_wilaya_id: wilayaId
      };
    }
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
      
      // Find station for the wilaya
      const station = stations.find(s => {
        // Match by wilaya ID in the code (format like "01A", "02A", etc.)
        const stationWilayaId = parseInt(s.id.substring(0, 2));
        return stationWilayaId === wilayaId;
      });
      
      if (station) {
        console.log(`🚉 Found station for wilaya ${wilayaId}: ${station.id} (${station.name}) -> code: ${station.code}`);
        return station.code; // Return the code field (e.g., "5B") instead of id field (e.g., "05B")
      }
      
      // Log warning but return null instead of fallback to preserve original location
      console.warn(`⚠️ No station found for wilaya ${wilayaId}`);
      return null;
      
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
    // Enhanced fallback mapping based on the delivery pricing table
    const fallbackCodes = {
      // Major cities with confirmed stations
      16: '16A', // Alger
      31: '31A', // Oran
      25: '25A', // Constantine
      23: '23A', // Annaba
      19: '19A', // Setif
      15: '15A', // Tizi Ouzou
      6: '6A',   // Bejaia
      9: '9A',   // Blida
      21: '21A', // Skikda
      27: '27A', // Mostaganem
      
      // Additional wilayas from pricing table
      1: '1A',   // Adrar
      2: '2A',   // Chlef
      3: '3A',   // Laghouat
      4: '4A',   // Oum El Bouaghi
      5: '5A',   // Batna
      7: '7A',   // Biskra
      8: '8A',   // Béchar
      10: '10A', // Bouira
      11: '11A', // Tamanrasset
      12: '12A', // Tébessa
      13: '13A', // Tlemcen
      14: '14A', // Tiaret
      17: '17A', // Djelfa
      18: '18A', // Jijel
      20: '20A', // Saïda
      22: '22A', // Sidi Bel Abbès
      24: '24A', // Guelma
      26: '26A', // Médéa
      28: '28A', // M'Sila
      29: '29A', // Mascara
      30: '30A', // Ouargla
      32: '32A', // El Bayadh
      33: '33A', // Illizi
      34: '34A', // Bordj Bou Arreridj
      35: '35A', // Boumerdès
      36: '36A', // El Tarf
      37: '37A', // Tindouf
      38: '38A', // Tissemsilt
      39: '39A', // El Oued
      40: '40A', // Khenchela
      41: '41A', // Souk Ahras
      42: '42A', // Tipaza
      43: '43A', // Mila
      44: '44A', // Aïn Defla
      45: '45A', // Naâma
      46: '46A', // Aïn Témouchent
      47: '47A', // Ghardaïa
      48: '48A', // Relizane
      49: '49A', // Timimoun
      51: '51A', // Ouled Djellal
      53: '53A', // In Salah
      55: '55A', // Touggourt
      58: '58A', // El Meniaa
      52: '52A', // Beni Abbes
      53: '53A', // In Salah
      54: '54A', // In Guezzam (reserved)
      56: '56A', // Djanet (reserved)
      57: '57A', // El M'Ghair
      58: '58A'  // El Meniaa
    };
    
    // Get the fallback code
    let fallbackCode = fallbackCodes[wilayaId];
    
    // If no specific mapping, format with leading zero
    if (!fallbackCode) {
      const formattedWilayaId = wilayaId.toString().padStart(2, '0');
      fallbackCode = `${formattedWilayaId}A`;
    }
    
    console.log(`📍 Using fallback station code for wilaya ${wilayaId}: ${fallbackCode}`);
    
    return fallbackCode;
  }

  /**
   * Validate and fix commune names to match EcoTrack accepted values
   * @param {string} commune - Original commune name
   * @param {number} wilayaId - Wilaya ID for context
   * @returns {string} - Valid commune name
   */
  // Fetch valid communes from EcoTrack API
  async fetchValidCommunes() {
    try {
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
        console.log('⚠️ No EcoTrack credentials available for fetching communes');
        return null;
      }
      
      // Try different possible commune endpoints
      const possibleEndpoints = [
        'https://app.noest-dz.com/api/public/communes',
        'https://app.noest-dz.com/api/public/cities',
        'https://app.noest-dz.com/api/public/locations'
      ];
      
      for (const endpoint of possibleEndpoints) {
        try {
          console.log(`🔍 Trying to fetch communes from: ${endpoint}`);
          const response = await axios.get(endpoint, {
            params: {
              api_token: apiToken,
              user_guid: userGuid
            },
            headers: {
              'Accept': 'application/json',
            },
            timeout: 10000
          });
          
          if (response.data) {
            console.log(`✅ Successfully fetched communes from: ${endpoint}`);
            console.log('📊 Sample commune data:', JSON.stringify(response.data).substring(0, 500) + '...');
            return response.data;
          }
        } catch (error) {
          console.log(`❌ Failed to fetch from ${endpoint}:`, error.response?.status || error.message);
          continue;
        }
      }
      
      console.log('⚠️ No commune endpoints found, using fallback logic');
      return null;
    } catch (error) {
      console.error('❌ Error fetching communes from EcoTrack:', error.message);
      return null;
    }
  }

  // Enhanced commune validation using EcoTrack API data
  async validateCommuneWithAPI(commune, wilayaId) {
    try {
      console.log(`🔍 Validating commune "${commune}" for wilaya ${wilayaId} using EcoTrack API...`);
      
      // Fetch communes for this specific wilaya from EcoTrack API
      const communes = await this.fetchCommunesFromEcoTrack(wilayaId);
      
      if (communes.length === 0) {
        console.warn(`⚠️ No communes found in EcoTrack API for wilaya ${wilayaId}, using original: "${commune}"`);
        return commune;
      }
      
      // Try exact match first (case insensitive)
      let matchedCommune = communes.find(c => 
        c.nom.toLowerCase() === commune.toLowerCase()
      );
      
      if (matchedCommune) {
        console.log(`✅ Exact match found: "${matchedCommune.nom}" for "${commune}"`);
        return matchedCommune.nom;
      }
      
      // Try partial match (contains)
      matchedCommune = communes.find(c => 
        c.nom.toLowerCase().includes(commune.toLowerCase()) ||
        commune.toLowerCase().includes(c.nom.toLowerCase())
      );
      
      if (matchedCommune) {
        console.log(`🔍 Partial match found: "${matchedCommune.nom}" for "${commune}"`);
        return matchedCommune.nom;
      }
      
      // If no match found, use the first commune from EcoTrack API as fallback
      if (communes.length > 0) {
        const fallbackCommune = communes[0];
        console.log(`🔄 No match found, using first available commune: "${fallbackCommune.nom}" for "${commune}"`);
        return fallbackCommune.nom;
      }
      
      // Final fallback: return original commune name
      console.warn(`⚠️ No communes available, using original: "${commune}"`);
      return commune;
      
    } catch (error) {
      console.error(`❌ Error validating commune "${commune}" for wilaya ${wilayaId}:`, error.message);
      // Fallback to original commune name
      return commune;
    }
  }

  validateAndFixCommune(commune, wilayaId) {
    if (!commune || typeof commune !== 'string') {
      return this.getDefaultCommuneForWilaya(wilayaId);
    }
    
    const originalCommune = commune;
    
    // Common problematic communes mapping
    const communeMapping = {
      'Douira': 'Alger Centre',
      'douira': 'Alger Centre',
      'Tamanrasset': 'Ain Salah',
      'تمنراست': 'Ain Salah',
      'In Salah': 'Ain Salah',
      'in salah': 'Ain Salah',
      'In salah': 'Ain Salah',
      'IN SALAH': 'Ain Salah',
      'insalah': 'Ain Salah',
      'Insalah': 'Ain Salah',
      'Bir Mourad Rais': 'Bir Mourad Rais',
      'El Harrach': 'El Harrach',
      'Rouiba': 'Rouiba',
      'Reghaia': 'Reghaia',
      'Dar El Beida': 'Dar El Beida',
      // Bab Ezzouar area alternatives - use simple wilaya name
      'Bab Ezzouar': 'Alger',
      'Bab ezzouar': 'Alger',
      'BAB EZZOUAR': 'Alger',
      'bab ezzouar': 'Alger',
      // Staoueli area alternatives (common misspelling)
      'Setaouali': 'Staoueli',
      'setaouali': 'Staoueli',
      // Oum El Bouaghi alternatives
      'Oum El Bouaghi': 'Oum el bouaghi',
      'Oum el Bouaghi': 'Oum el bouaghi',
      'Oum el bouaghi': 'Oum el bouaghi',
      'أم البواقي': 'Oum el bouaghi',
      // Tébessa specific mappings
      'Bir Mokkadem': 'Tébessa',
      'Bir mokkadem': 'Tébessa',
      'bir mokkadem': 'Tébessa',
      'BIR MOKKADEM': 'Tébessa'
    };
    
    // Direct mapping first
    if (communeMapping[commune]) {
      console.log(`🔄 Mapped commune "${originalCommune}" to "${communeMapping[commune]}"`);
      return communeMapping[commune];
    }
    
    // Special handling for common problematic wilayas
    if (wilayaId === 16) {
      const algerCommunes = [
        'Alger Centre', 'Bab El Oued', 'El Harrach', 'Bir Mourad Rais', 
        'Rouiba', 'Reghaia', 'Dar El Beida', 'Baraki', 'Sidi Moussa'
      ];
      
      // If the commune contains common Alger area keywords, try to map it
      const lowerCommune = commune.toLowerCase();
      if (lowerCommune.includes('bab') && lowerCommune.includes('ez')) {
        console.log(`🏛️ Bab Ezzouar area detected, using Alger as fallback`);
        return 'Alger';
      }
      
      // Try some alternative basic commune names that might work
      const alternativeCommunes = ['Alger', 'Bab el Oued', 'El Harrach', 'Rouiba', 'Alger Centre', 'Kouba'];
      for (const altCommune of alternativeCommunes) {
        console.log(`🔄 Trying alternative commune: "${altCommune}" for wilaya 16`);
        return altCommune;
      }
    }
    
    // Special handling for Tébessa wilaya (12) - common problematic communes
    if (wilayaId === 12) {
      const tebesssaCommunes = [
        'Tébessa', 'Tebessa', 'Bir El Ater', 'Cheria', 'Negrine', 'El Houidjbet'
      ];
      
      // If the commune is Bir Mokkadem or similar, use Tébessa as fallback
      const lowerCommune = commune.toLowerCase();
      if (lowerCommune.includes('bir') && lowerCommune.includes('mokkadem')) {
        console.log(`🏛️ Bir Mokkadem detected, using Tébessa as fallback for EcoTrack compatibility`);
        return 'Tébessa';
      }
      
      // Try some alternative basic commune names that might work
      for (const altCommune of tebesssaCommunes) {
        console.log(`🔄 Trying alternative commune: "${altCommune}" for wilaya 12`);
        return altCommune;
      }
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
      11: 'Ain Salah', // Tamanrasset -> Ain Salah
      12: 'Tébessa',
      13: 'Tlemcen',
      14: 'Tiaret',
      15: 'Tizi Ouzou',
      16: 'Alger', // Alger
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
      48: 'Relizane',
      49: 'Timimoun',
      51: 'Ouled Djellal',
      52: 'Beni Abbes',
      53: 'In Salah',
      55: 'Touggourt',
      58: 'El Meniaa'
    };
    
    return defaultCommunes[wilayaId] || null; // Return null instead of defaulting to Alger Centre
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

  /**
   * Get delivery note for specific wilaya based on pricing table
   * @param {number} wilayaId - Wilaya ID
   * @returns {string} - Delivery note
   */
  getWilayaDeliveryNote(wilayaId) {
      // Special cases based on the pricing table and database mapping corrections
      const specialCases = {
        52: 'Limited delivery (redirected to Béchar)',
        56: 'El M\'Ghair - Limited delivery (redirected to El Oued)',
        57: 'Data correction: El M\'Ghair orders incorrectly mapped (redirected to El Oued)',
      };    return specialCases[wilayaId] || 'Standard delivery';
  }
  /**
   * Fetch EcoTrack stations from local API
   */
  async fetchEcoTrackStations() {
    try {
      const response = await axios.get('http://localhost:3000/api/ecotrack/stations');
      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }
      console.warn('⚠️ Failed to fetch EcoTrack stations from local API');
      return [];
    } catch (error) {
      console.error('❌ Error fetching EcoTrack stations:', error.message);
      return [];
    }
  }

  /**
   * Get station info by wilaya ID using local stations API
   */
  async getStationByWilayaId(wilayaId) {
    const stations = await this.fetchEcoTrackStations();
    
    // Find station that matches wilaya ID (station code pattern: wilayaId + 'A')
    const expectedCode = `${wilayaId}A`;
    const station = stations.find(s => s.code === expectedCode || s.id === expectedCode);
    
    if (station) {
      console.log(`🗺️ Found EcoTrack station for wilaya ${wilayaId}:`, {
        code: station.code,
        name: station.name,
        address: station.address
      });
      return {
        station_code: station.code,
        name: station.name,
        address: station.address
      };
    }
    
    console.warn(`⚠️ No EcoTrack station found for wilaya ${wilayaId}`);
    return null;
  }

  /**
   * Fetch communes from EcoTrack API
   * @param {number} wilayaId - Optional wilaya ID to filter communes
   * @returns {Promise<Array>} - Array of communes with their names and postal codes
   */
  async fetchCommunesFromEcoTrack(wilayaId = null) {
    try {
      console.log(`🌍 Starting fetchCommunesFromEcoTrack${wilayaId ? ` for wilaya ${wilayaId}` : ' (all wilayas)'}...`);
      
      // Ensure we have credentials
      await this.ensureConfigLoaded();
      
      // Use any available account for fetching communes
      let apiToken = this.apiToken;
      let userGuid = this.userGuid;
      
      console.log('🔑 Checking credentials:', {
        globalApiToken: !!this.apiToken,
        globalUserGuid: !!this.userGuid
      });
      
      // Try to get credentials from default account if global config not available
      if (!apiToken || !userGuid) {
        console.log('🔄 Global credentials not available, trying default account...');
        const defaultAccount = await this.getDefaultAccount();
        if (defaultAccount) {
          apiToken = defaultAccount.api_token;
          userGuid = defaultAccount.user_guid;
          console.log('✅ Using default account credentials');
        } else {
          console.warn('⚠️ No default account found');
        }
      }
      
      if (!apiToken || !userGuid) {
        throw new Error('No EcoTrack credentials available for fetching communes');
      }

      const requestData = {
        api_token: apiToken,
        user_guid: userGuid
      };

      // Add wilaya_id if specified
      if (wilayaId) {
        requestData.wilaya_id = wilayaId;
      }

      console.log(`🌍 Making request to EcoTrack communes API...`);
      console.log('📤 Request data:', {
        ...requestData,
        api_token: `***${apiToken.slice(-4)}` // Hide token in logs
      });

      // Try GET method instead of POST since API returns 405 for POST
      const response = await axios.get('https://app.noest-dz.com/api/public/get/communes', {
        params: requestData, // Send as query parameters instead of request body
        headers: {
          'Accept': 'application/json',
        },
        timeout: 30000
      });

      console.log('� Raw communes API response:', {
        status: response.status,
        statusText: response.statusText,
        dataType: typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'Not array',
        sampleData: Array.isArray(response.data) ? response.data.slice(0, 2) : response.data
      });

      if (response.data && Array.isArray(response.data)) {
        const communes = response.data;
        console.log(`✅ Fetched ${communes.length} communes from EcoTrack API`);
        if (communes.length > 0) {
          console.log('📊 Sample communes:', communes.slice(0, 3).map(c => ({
            nom: c.nom,
            wilaya_id: c.wilaya_id,
            code_postal: c.code_postal
          })));
        }
        return communes;
      } else {
        console.warn('⚠️ Unexpected response format from communes API:', response.data);
        return [];
      }

    } catch (error) {
      console.error('❌ Failed to fetch communes from EcoTrack API:', error.message);
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
      }
      return [];
    }
  }

  /**
   * Fetch wilayas directly from EcoTrack API
   * @returns {Promise<Array>} - Array of wilayas with their codes, names, and active status
   */
  async fetchWilayasFromEcoTrack() {
    try {
      console.log('🗺️ Starting fetchWilayasFromEcoTrack...');
      
      // Ensure we have credentials
      await this.ensureConfigLoaded();
      
      // Use any available account for fetching wilayas
      let apiToken = this.apiToken;
      let userGuid = this.userGuid;
      
      console.log('� Checking credentials:', {
        globalApiToken: !!this.apiToken,
        globalUserGuid: !!this.userGuid
      });
      
      // Try to get credentials from default account if global config not available
      if (!apiToken || !userGuid) {
        console.log('🔄 Global credentials not available, trying default account...');
        const defaultAccount = await this.getDefaultAccount();
        if (defaultAccount) {
          apiToken = defaultAccount.api_token;
          userGuid = defaultAccount.user_guid;
          console.log('✅ Using default account credentials');
        } else {
          console.warn('⚠️ No default account found');
        }
      }
      
      if (!apiToken || !userGuid) {
        throw new Error('No EcoTrack credentials available for fetching wilayas');
      }

      const requestData = {
        api_token: apiToken,
        user_guid: userGuid
      };

      console.log(`🗺️ Making request to EcoTrack wilayas API...`);
      console.log('📤 Request data:', {
        ...requestData,
        api_token: `***${apiToken.slice(-4)}` // Hide token in logs
      });

      // Try GET method first (since communes API needed GET instead of POST)
      let response;
      try {
        response = await axios.get('https://app.noest-dz.com/api/public/get/wilayas', {
          params: requestData,
          headers: {
            'Accept': 'application/json',
          },
          timeout: 30000
        });
      } catch (error) {
        if (error.response?.status === 405) {
          console.log('� GET method not allowed, trying POST...');
          // If GET fails with 405, try POST as documented
          response = await axios.post('https://app.noest-dz.com/api/public/get/wilayas', requestData, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            timeout: 30000
          });
        } else {
          throw error;
        }
      }

      console.log('� Raw wilayas API response:', {
        status: response.status,
        statusText: response.statusText,
        dataType: typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'Not array',
        sampleData: Array.isArray(response.data) ? response.data.slice(0, 3) : response.data
      });

      if (response.data && Array.isArray(response.data)) {
        const wilayas = response.data;
        console.log(`✅ Fetched ${wilayas.length} wilayas from EcoTrack API`);
        if (wilayas.length > 0) {
          console.log('📊 Sample wilayas:', wilayas.slice(0, 5).map(w => ({
            code: w.code,
            nom: w.nom,
            is_active: w.is_active
          })));
        }
        
        // Return raw data without any transformation or filtering
        return wilayas;
      } else {
        console.warn('⚠️ Unexpected response format from wilayas API:', response.data);
        return [];
      }

    } catch (error) {
      console.error('❌ Failed to fetch wilayas from EcoTrack API:', error.message);
      if (error.response) {
        console.error('❌ Response status:', error.response.status);
        console.error('❌ Response data:', error.response.data);
      }
      return [];
    }
  }

  /**
   * Get wilayas list from EcoTrack API (returns raw data without filtering)
   * @returns {Promise<Array>} - Array of wilayas exactly as returned by EcoTrack API
   */
  async getWilayasFromEcoTrack() {
    try {
      console.log('🗺️ Starting getWilayasFromEcoTrack (returning raw data)...');
      
      const wilayas = await this.fetchWilayasFromEcoTrack();
      
      console.log(`📊 Fetched ${wilayas.length} wilayas from EcoTrack API`);
      
      if (wilayas.length === 0) {
        console.warn('⚠️ No wilayas returned from EcoTrack API, checking credentials...');
        await this.ensureConfigLoaded();
        console.log('🔑 API Token available:', !!this.apiToken);
        console.log('🔑 User GUID available:', !!this.userGuid);
        return [];
      }
      
      // Return all wilayas without any filtering or transformation
      console.log(`✅ Returning ${wilayas.length} wilayas (raw data from EcoTrack API)`);
      console.log('📋 Sample raw wilayas:', wilayas.slice(0, 5));
      
      return wilayas;
    } catch (error) {
      console.error('❌ Failed to get wilayas from EcoTrack:', error.message);
      console.error('❌ Error stack:', error.stack);
      return [];
    }
  }

  /**
   * Get wilaya name by ID (basic mapping for display purposes)
   */
  getWilayaNameById(wilayaId) {
    const wilayaNames = {
      1: 'Adrar', 2: 'Chlef', 3: 'Laghouat', 4: 'Oum El Bouaghi', 5: 'Batna',
      6: 'Bejaia', 7: 'Biskra', 8: 'Bechar', 9: 'Blida', 10: 'Bouira',
      11: 'Tamanrasset', 12: 'Tebessa', 13: 'Tlemcen', 14: 'Tiaret', 15: 'Tizi Ouzou',
      16: 'Alger', 17: 'Djelfa', 18: 'Jijel', 19: 'Setif', 20: 'Saida',
      21: 'Skikda', 22: 'Sidi Bel Abbes', 23: 'Annaba', 24: 'Guelma', 25: 'Constantine',
      26: 'Medea', 27: 'Mostaganem', 28: 'Msila', 29: 'Mascara', 30: 'Ouargla',
      31: 'Oran', 32: 'El Bayadh', 33: 'Illizi', 34: 'Bordj Bou Arreridj', 35: 'Boumerdes',
      36: 'El Taref', 37: 'Tindouf', 38: 'Tissemsilt', 39: 'El Oued', 40: 'Khenchela',
      41: 'Souk Ahras', 42: 'Tipaza', 43: 'Mila', 44: 'Ain Defla', 45: 'Naama',
      46: 'Ain Temouchent', 47: 'Ghardaia', 48: 'Relizane', 49: 'Timimoun', 50: 'Bordj Badji Mokhtar',
      51: 'Ouled Djellal', 52: 'Beni Abbes', 53: 'In Salah', 54: 'In Guezzam', 55: 'Touggourt',
      56: 'Djanet', 57: 'El Meghaier', 58: 'El Meniaa'
    };
    return wilayaNames[wilayaId] || `Wilaya ${wilayaId}`;
  }
}

module.exports = new EcotrackService();