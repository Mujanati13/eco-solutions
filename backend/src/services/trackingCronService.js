const cron = require('node-cron');
const { pool } = require('../../config/database');
const ecotrackService = require('./ecotrackService');

class TrackingCronService {
  constructor() {
    this.isRunning = false;
  }

  // Start the cron job for daily tracking updates
  start() {
    console.log('🕐 Starting tracking cron service...');
    
    // Run daily at 6:00 AM
    cron.schedule('0 6 * * *', async () => {
      console.log('🔄 Running daily tracking sync...');
      await this.syncAllTrackingStatuses();
    });

    // Run every 4 hours during business hours (8 AM to 8 PM)
    cron.schedule('0 8,12,16,20 * * *', async () => {
      console.log('🔄 Running business hours tracking sync...');
      await this.syncActiveTrackingStatuses();
    });

    console.log('✅ Tracking cron service started');
  }

  // Sync all orders with tracking IDs
  async syncAllTrackingStatuses() {
    if (this.isRunning) {
      console.log('⏳ Tracking sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      // Get all orders with Ecotrack tracking IDs
      const [orders] = await pool.query(
        'SELECT id, order_number, ecotrack_tracking_id FROM orders WHERE ecotrack_tracking_id IS NOT NULL'
      );

      if (orders.length === 0) {
        console.log('📋 No orders with tracking IDs found');
        return;
      }

      console.log(`📦 Found ${orders.length} orders with tracking IDs`);

      const trackingIds = orders.map(order => order.ecotrack_tracking_id);
      
      // Get bulk tracking info from Ecotrack
      const trackingResults = await ecotrackService.getBulkTrackingInfo(trackingIds);
      
      let updatedCount = 0;
      let errorCount = 0;

      // Update each order with new tracking info
      for (const result of trackingResults) {
        try {
          if (result.success) {
            const order = orders.find(o => o.ecotrack_tracking_id === result.tracking_id);
            
            await pool.query(
              `UPDATE orders SET 
                ecotrack_status = ?, 
                ecotrack_last_update = NOW(),
                ecotrack_location = ?
              WHERE id = ?`,
              [result.status, result.location, order.id]
            );

            // Log the tracking update
            await pool.query(`
              INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
              VALUES (?, ?, ?, ?, NOW())
            `, [
              order.id,
              null, // System update
              'tracking_cron_sync',
              `Daily sync - Status: ${result.status} at ${result.location || 'Unknown location'}`
            ]);

            updatedCount++;
          } else {
            errorCount++;
            console.error(`❌ Failed to update tracking for ${result.tracking_id}: ${result.error}`);
          }
        } catch (updateError) {
          errorCount++;
          console.error('❌ Error updating order tracking:', updateError);
        }
      }

      console.log(`✅ Daily tracking sync completed: ${updatedCount} updated, ${errorCount} errors`);
    } catch (error) {
      console.error('❌ Daily tracking sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Sync only active/pending shipments (not delivered/cancelled)
  async syncActiveTrackingStatuses() {
    if (this.isRunning) {
      console.log('⏳ Tracking sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      // Get orders with tracking IDs that are not in final states
      const [orders] = await pool.query(`
        SELECT id, order_number, ecotrack_tracking_id 
        FROM orders 
        WHERE ecotrack_tracking_id IS NOT NULL 
        AND status NOT IN ('delivered', 'cancelled', 'returned')
        AND (ecotrack_status NOT IN ('delivered', 'cancelled') OR ecotrack_status IS NULL)
      `);

      if (orders.length === 0) {
        console.log('📋 No active orders with tracking IDs found');
        return;
      }

      console.log(`📦 Found ${orders.length} active orders with tracking IDs`);

      const trackingIds = orders.map(order => order.ecotrack_tracking_id);
      
      // Get bulk tracking info from Ecotrack
      const trackingResults = await ecotrackService.getBulkTrackingInfo(trackingIds);
      
      let updatedCount = 0;
      let errorCount = 0;

      // Update each order with new tracking info
      for (const result of trackingResults) {
        try {
          if (result.success) {
            const order = orders.find(o => o.ecotrack_tracking_id === result.tracking_id);
            
            await pool.query(
              `UPDATE orders SET 
                ecotrack_status = ?, 
                ecotrack_last_update = NOW(),
                ecotrack_location = ?
              WHERE id = ?`,
              [result.status, result.location, order.id]
            );

            // Log the tracking update
            await pool.query(`
              INSERT INTO tracking_logs (order_id, user_id, action, details, created_at)
              VALUES (?, ?, ?, ?, NOW())
            `, [
              order.id,
              null, // System update
              'tracking_active_sync',
              `Active sync - Status: ${result.status} at ${result.location || 'Unknown location'}`
            ]);

            updatedCount++;
          } else {
            errorCount++;
            console.error(`❌ Failed to update tracking for ${result.tracking_id}: ${result.error}`);
          }
        } catch (updateError) {
          errorCount++;
          console.error('❌ Error updating order tracking:', updateError);
        }
      }

      console.log(`✅ Active tracking sync completed: ${updatedCount} updated, ${errorCount} errors`);
    } catch (error) {
      console.error('❌ Active tracking sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Manual trigger for immediate sync
  async triggerManualSync() {
    console.log('🔄 Manual tracking sync triggered...');
    await this.syncAllTrackingStatuses();
  }

  // Check if sync is currently running
  isCurrentlyRunning() {
    return this.isRunning;
  }
}

module.exports = new TrackingCronService();
