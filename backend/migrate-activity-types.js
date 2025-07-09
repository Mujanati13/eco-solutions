const { pool } = require('./config/database');

async function updateActivityTypeEnum() {
  try {
    console.log('🔄 Updating activity_logs table to add new activity types...');
    
    await pool.query(`
      ALTER TABLE activity_logs 
      MODIFY COLUMN activity_type ENUM(
        'login', 'logout', 'order_create', 'order_update', 'order_delete',
        'order_assign', 'order_import', 'order_export', 'user_update',
        'export', 'view_page', 'search', 'filter', 'other'
      ) NOT NULL
    `);

    console.log('✅ Successfully updated activity_type column with new values');
    
    // Test the new enum values
    console.log('🧪 Testing new activity types...');
    
    // Try to insert a test record with the new activity type
    const [result] = await pool.query(`
      INSERT INTO activity_logs 
      (user_id, activity_type, activity_description, entity_type, entity_id)
      VALUES (1, 'order_assign', 'Test order assignment activity', 'order', '999')
    `);
    
    console.log('✅ Test activity inserted successfully with ID:', result.insertId);
    
    // Clean up the test record
    await pool.query('DELETE FROM activity_logs WHERE id = ?', [result.insertId]);
    console.log('🧹 Test record cleaned up');
    
    await pool.end();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating activity_type:', error);
    process.exit(1);
  }
}

updateActivityTypeEnum();
