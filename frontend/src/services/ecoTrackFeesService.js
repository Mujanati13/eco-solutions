// EcoTrack Fees Service - Uses backend proxy to avoid CORS issues
class EcoTrackFeesService {
  constructor() {
    this.backendUrl = 'http://localhost:5000/api'; // Backend API URL (port 5000)
  }

  // Get delivery price directly from backend API (preferred method)
  async getCachedDeliveryPrice(wilayaId, deliveryType = 'home') {
    try {
      console.log(`💰 Getting delivery price for wilaya ${wilayaId}, type: ${deliveryType}`);
      
      // Use backend endpoint directly for better performance
      const response = await fetch(
        `${this.backendUrl}/ecotrack-fees/price?wilaya_id=${wilayaId}&delivery_type=${deliveryType}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        console.warn(`⚠️ No delivery price found for wilaya ${wilayaId}:`, result.error);
        return null;
      }

      console.log(`✅ Delivery price for wilaya ${wilayaId} (${result.price_type}): ${result.price} DA`);
      return result.price;

    } catch (error) {
      console.error('❌ Error getting cached delivery price:', error);
      return null;
    }
  }

  // Get all fees data (for testing purposes)
  async getDeliveryFees() {
    try {
      console.log('🌐 Calling EcoTrack fees API via backend proxy...');

      const response = await fetch(`${this.backendUrl}/ecotrack-fees`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Backend API returned error');
      }

      console.log('✅ EcoTrack fees response received via backend:', {
        cached: result.cached,
        wilayas: result.wilayas_count,
        method: result.method
      });

      return result.data;
    } catch (error) {
      console.error('❌ EcoTrack fees API error:', error);
      throw error;
    }
  }
}

// Export singleton instance
const ecoTrackFeesService = new EcoTrackFeesService();
export default ecoTrackFeesService;