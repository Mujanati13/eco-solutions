const { pool } = require('../../config/database');

class DeliveryPricingService {
  // Get all wilayas with their delivery pricing
  static async getAllWilayasWithPricing(statusFilter = null) {
    try {
      let whereClause = '';
      const queryParams = [];

      // Build WHERE clause based on status filter
      if (statusFilter === 'active') {
        whereClause = 'WHERE w.is_active = true';
      } else if (statusFilter === 'inactive') {
        whereClause = 'WHERE w.is_active = false';
      } else {
        whereClause = 'WHERE 1=1'; // No filter, get all
      }

      const [wilayas] = await pool.query(`
        SELECT 
          w.id,
          w.code,
          w.name_ar,
          w.name_fr,
          w.name_en,
          w.is_active,
          GROUP_CONCAT(
            JSON_OBJECT(
              'delivery_type', dp.delivery_type,
              'base_price', dp.base_price,
              'weight_threshold', dp.weight_threshold,
              'additional_weight_price', dp.additional_weight_price,
              'delivery_time_min', dp.delivery_time_min,
              'delivery_time_max', dp.delivery_time_max,
              'is_active', dp.is_active,
              'priority', dp.priority,
              'pricing_level', dp.pricing_level,
              'baladia_id', dp.baladia_id
            )
          ) as pricing_options
        FROM wilayas w
        LEFT JOIN delivery_pricing dp ON w.id = dp.wilaya_id AND dp.is_active = true
        ${whereClause}
        GROUP BY w.id
        ORDER BY w.code
      `);

      return wilayas.map(wilaya => ({
        ...wilaya,
        pricing_options: wilaya.pricing_options 
          ? JSON.parse(`[${wilaya.pricing_options}]`)
          : []
      }));
    } catch (error) {
      console.error('Error fetching wilayas with pricing:', error);
      throw error;
    }
  }

  // Get active wilayas for dropdown
  static async getActiveWilayas() {
    try {
      const [wilayas] = await pool.query(`
        SELECT id, code, name_ar, name_fr, name_en
        FROM wilayas
        WHERE is_active = true
        ORDER BY code
      `);
      return wilayas;
    } catch (error) {
      console.error('Error fetching active wilayas:', error);
      throw error;
    }
  }

  // Calculate delivery price for an order
  static async calculateDeliveryPrice(wilayaId, deliveryType = 'home', weight = 1.0, volume = 0) {
    try {
      const [pricing] = await pool.query(`
        SELECT 
          base_price,
          weight_threshold,
          additional_weight_price,
          volume_threshold,
          additional_volume_price,
          delivery_time_min,
          delivery_time_max
        FROM delivery_pricing
        WHERE wilaya_id = ? AND delivery_type = ? AND is_active = true
      `, [wilayaId, deliveryType]);

      if (pricing.length === 0) {
        // Fallback to default pricing if no specific pricing found
        return {
          price: 500.00, // Default price
          delivery_time_min: 48,
          delivery_time_max: 96,
          breakdown: {
            base_price: 500.00,
            weight_additional: 0,
            volume_additional: 0
          }
        };
      }

      const pricingData = pricing[0];
      let totalPrice = parseFloat(pricingData.base_price);
      let weightAdditional = 0;
      let volumeAdditional = 0;

      // Calculate additional weight cost
      if (weight > pricingData.weight_threshold) {
        const additionalWeight = weight - pricingData.weight_threshold;
        weightAdditional = additionalWeight * parseFloat(pricingData.additional_weight_price);
        totalPrice += weightAdditional;
      }

      // Calculate additional volume cost
      if (volume > pricingData.volume_threshold) {
        const additionalVolume = volume - pricingData.volume_threshold;
        volumeAdditional = additionalVolume * parseFloat(pricingData.additional_volume_price);
        totalPrice += volumeAdditional;
      }

      return {
        price: Math.round(totalPrice * 100) / 100, // Round to 2 decimal places
        delivery_time_min: pricingData.delivery_time_min,
        delivery_time_max: pricingData.delivery_time_max,
        breakdown: {
          base_price: parseFloat(pricingData.base_price),
          weight_additional: Math.round(weightAdditional * 100) / 100,
          volume_additional: Math.round(volumeAdditional * 100) / 100
        }
      };
    } catch (error) {
      console.error('Error calculating delivery price:', error);
      throw error;
    }
  }

  // Get delivery pricing for a specific wilaya
  static async getWilayaPricing(wilayaId) {
    try {
      const [pricing] = await pool.query(`
        SELECT 
          dp.*,
          w.name_ar,
          w.name_fr,
          w.name_en,
          w.code
        FROM delivery_pricing dp
        JOIN wilayas w ON dp.wilaya_id = w.id
        WHERE dp.wilaya_id = ? AND dp.is_active = true
        ORDER BY dp.delivery_type
      `, [wilayaId]);

      return pricing;
    } catch (error) {
      console.error('Error fetching wilaya pricing:', error);
      throw error;
    }
  }

  // Update delivery pricing
  static async updateDeliveryPricing(wilayaId, deliveryType, pricingData) {
    try {
      const {
        base_price,
        weight_threshold = 1.0,
        additional_weight_price = 0,
        volume_threshold = 0,
        additional_volume_price = 0,
        delivery_time_min = 24,
        delivery_time_max = 72,
        priority = 1,
        notes = ''
      } = pricingData;

      const [result] = await pool.query(`
        UPDATE delivery_pricing 
        SET 
          base_price = ?,
          weight_threshold = ?,
          additional_weight_price = ?,
          volume_threshold = ?,
          additional_volume_price = ?,
          delivery_time_min = ?,
          delivery_time_max = ?,
          priority = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE wilaya_id = ? AND delivery_type = ?
      `, [
        base_price,
        weight_threshold,
        additional_weight_price,
        volume_threshold,
        additional_volume_price,
        delivery_time_min,
        delivery_time_max,
        priority,
        notes,
        wilayaId,
        deliveryType
      ]);

      if (result.affectedRows === 0) {
        // Create new pricing if it doesn't exist
        await pool.query(`
          INSERT INTO delivery_pricing (
            wilaya_id, delivery_type, base_price, weight_threshold, 
            additional_weight_price, volume_threshold, additional_volume_price,
            delivery_time_min, delivery_time_max, priority, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          wilayaId, deliveryType, base_price, weight_threshold,
          additional_weight_price, volume_threshold, additional_volume_price,
          delivery_time_min, delivery_time_max, priority, notes
        ]);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating delivery pricing:', error);
      throw error;
    }
  }

  // Create new delivery pricing
  static async createDeliveryPricing(pricingData) {
    try {
      const {
        wilaya_id,
        delivery_type = 'home',
        base_price,
        weight_threshold = 1.0,
        additional_weight_price = 0,
        volume_threshold = 0,
        additional_volume_price = 0,
        delivery_time_min = 24,
        delivery_time_max = 72,
        priority = 1,
        notes = ''
      } = pricingData;

      const [result] = await pool.query(`
        INSERT INTO delivery_pricing (
          wilaya_id, delivery_type, base_price, weight_threshold,
          additional_weight_price, volume_threshold, additional_volume_price,
          delivery_time_min, delivery_time_max, priority, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        wilaya_id, delivery_type, base_price, weight_threshold,
        additional_weight_price, volume_threshold, additional_volume_price,
        delivery_time_min, delivery_time_max, priority, notes
      ]);

      return { id: result.insertId, success: true };
    } catch (error) {
      console.error('Error creating delivery pricing:', error);
      throw error;
    }
  }

  // Delete delivery pricing
  static async deleteDeliveryPricing(wilayaId, deliveryType) {
    try {
      const [result] = await pool.query(`
        DELETE FROM delivery_pricing 
        WHERE wilaya_id = ? AND delivery_type = ?
      `, [wilayaId, deliveryType]);

      return { success: result.affectedRows > 0 };
    } catch (error) {
      console.error('Error deleting delivery pricing:', error);
      throw error;
    }
  }

  // Toggle wilaya status
  static async toggleWilayaStatus(wilayaId, isActive) {
    try {
      const [result] = await pool.query(`
        UPDATE wilayas 
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [isActive, wilayaId]);

      return { success: result.affectedRows > 0 };
    } catch (error) {
      console.error('Error toggling wilaya status:', error);
      throw error;
    }
  }

  // Get delivery pricing statistics
  static async getDeliveryPricingStats() {
    try {
      const [stats] = await pool.query(`
        SELECT 
          COUNT(DISTINCT w.id) as total_wilayas,
          COUNT(DISTINCT CASE WHEN w.is_active = true THEN w.id END) as active_wilayas,
          COUNT(dp.id) as total_pricing_rules,
          AVG(dp.base_price) as avg_base_price,
          MIN(dp.base_price) as min_price,
          MAX(dp.base_price) as max_price,
          COUNT(DISTINCT CASE WHEN dp.delivery_type = 'home' THEN dp.wilaya_id END) as home_delivery_coverage,
          COUNT(DISTINCT CASE WHEN dp.delivery_type = 'office' THEN dp.wilaya_id END) as office_delivery_coverage
        FROM wilayas w
        LEFT JOIN delivery_pricing dp ON w.id = dp.wilaya_id AND dp.is_active = true
      `);

      return stats[0];
    } catch (error) {
      console.error('Error fetching delivery pricing stats:', error);
      throw error;
    }
  }

  // Bulk update delivery pricing
  static async bulkUpdatePricing(updates) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const update of updates) {
        const {
          wilaya_id,
          delivery_type,
          base_price,
          weight_threshold,
          additional_weight_price,
          delivery_time_min,
          delivery_time_max
        } = update;

        await connection.query(`
          INSERT INTO delivery_pricing (
            wilaya_id, delivery_type, base_price, weight_threshold,
            additional_weight_price, delivery_time_min, delivery_time_max
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            base_price = VALUES(base_price),
            weight_threshold = VALUES(weight_threshold),
            additional_weight_price = VALUES(additional_weight_price),
            delivery_time_min = VALUES(delivery_time_min),
            delivery_time_max = VALUES(delivery_time_max),
            updated_at = CURRENT_TIMESTAMP
        `, [
          wilaya_id, delivery_type, base_price, weight_threshold,
          additional_weight_price, delivery_time_min, delivery_time_max
        ]);
      }

      await connection.commit();
      return { success: true, updated: updates.length };
    } catch (error) {
      await connection.rollback();
      console.error('Error in bulk update delivery pricing:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get baladias for a specific wilaya
  static async getBaladiasByWilaya(wilayaId) {
    try {
      const [baladias] = await pool.query(`
        SELECT id, code, name_ar, name_fr, name_en, delivery_zone, is_active
        FROM baladias 
        WHERE wilaya_id = ? AND is_active = true
        ORDER BY name_en
      `, [wilayaId]);

      return baladias;
    } catch (error) {
      console.error('Error fetching baladias:', error);
      throw error;
    }
  }

  // Get all active baladias
  static async getAllActiveBaladias() {
    try {
      const [baladias] = await pool.query(`
        SELECT 
          b.id, 
          b.code, 
          b.name_ar, 
          b.name_fr, 
          b.name_en, 
          b.delivery_zone,
          w.code as wilaya_code,
          w.name_en as wilaya_name
        FROM baladias b
        JOIN wilayas w ON b.wilaya_id = w.id
        WHERE b.is_active = true AND w.is_active = true
        ORDER BY w.code, b.name_en
      `);

      return baladias;
    } catch (error) {
      console.error('Error fetching active baladias:', error);
      throw error;
    }
  }

  // Calculate delivery price with baladia support
  static async calculateDeliveryPriceWithLocation(data) {
    try {
      const { wilaya_id, baladia_id, delivery_type = 'home', weight = 1.0, pricing_level = 'wilaya' } = data;

      let query;
      let params;

      if (pricing_level === 'baladia' && baladia_id) {
        // Look for baladia-specific pricing first
        query = `
          SELECT 
            dp.*,
            w.name_en as wilaya_name,
            b.name_en as baladia_name,
            b.delivery_zone
          FROM delivery_pricing dp
          JOIN wilayas w ON dp.wilaya_id = w.id
          LEFT JOIN baladias b ON dp.baladia_id = b.id
          WHERE dp.wilaya_id = ? 
            AND (dp.baladia_id = ? OR dp.baladia_id IS NULL)
            AND dp.delivery_type = ?
            AND dp.is_active = true
          ORDER BY dp.baladia_id DESC, dp.priority ASC
          LIMIT 1
        `;
        params = [wilaya_id, baladia_id, delivery_type];
      } else {
        // Wilaya-level pricing
        query = `
          SELECT 
            dp.*,
            w.name_en as wilaya_name
          FROM delivery_pricing dp
          JOIN wilayas w ON dp.wilaya_id = w.id
          WHERE dp.wilaya_id = ? 
            AND dp.delivery_type = ?
            AND dp.is_active = true
            AND dp.pricing_level = 'wilaya'
          ORDER BY dp.priority ASC
          LIMIT 1
        `;
        params = [wilaya_id, delivery_type];
      }

      const [pricing] = await pool.query(query, params);

      if (!pricing.length) {
        // Try fallback to wilaya-level pricing if baladia-specific not found
        if (pricing_level === 'baladia' && baladia_id) {
          console.log('No baladia-specific pricing found, falling back to wilaya pricing');
          return await this.calculateDeliveryPrice(wilaya_id, delivery_type, weight, 0);
        }
        
        // Ultimate fallback with default pricing
        console.log('No pricing found for wilaya, using default pricing');
        return {
          price: delivery_type === 'home' ? 500.00 : 450.00,
          delivery_time_min: 48,
          delivery_time_max: 96,
          breakdown: {
            base_price: delivery_type === 'home' ? 500.00 : 450.00,
            weight_additional: 0,
            volume_additional: 0
          },
          wilaya_name: 'Unknown',
          baladia_name: null
        };
      }

      const pricingData = pricing[0];
      return this.calculatePriceFromPricing(pricingData, weight);
    } catch (error) {
      console.error('Error calculating delivery price with location:', error);
      throw error;
    }
  }

  // Helper method to calculate actual price from pricing data
  static calculatePriceFromPricing(pricingData, weight) {
    const basePrice = parseFloat(pricingData.base_price);
    const weightThreshold = parseFloat(pricingData.weight_threshold || 1.0);
    const additionalWeightPrice = parseFloat(pricingData.additional_weight_price || 0);

    let weightAdditional = 0;
    if (weight > weightThreshold) {
      const additionalWeight = weight - weightThreshold;
      weightAdditional = Math.ceil(additionalWeight) * additionalWeightPrice;
    }

    const totalPrice = basePrice + weightAdditional;

    return {
      price: totalPrice,
      breakdown: {
        base_price: basePrice,
        weight_additional: weightAdditional,
        volume_additional: 0 // For future use
      },
      delivery_time_min: pricingData.delivery_time_min || 24,
      delivery_time_max: pricingData.delivery_time_max || 72,
      wilaya_name: pricingData.wilaya_name,
      baladia_name: pricingData.baladia_name || null,
      delivery_zone: pricingData.delivery_zone || null
    };
  }
}

module.exports = DeliveryPricingService;
