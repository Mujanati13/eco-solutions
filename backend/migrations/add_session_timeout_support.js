const { pool } = require('../config/database');

async function addSessionTimeoutSupport() {
  try {
    console.log('Adding session timeout support to database...');

    // Check if columns already exist and add them individually
    const columnsToAdd = [
      { name: 'is_paused', definition: 'BOOLEAN DEFAULT FALSE' },
      { name: 'paused_at', definition: 'TIMESTAMP NULL' },
      { name: 'paused_duration', definition: 'INT DEFAULT 0 COMMENT "Total paused time in seconds"' },
      { name: 'resume_count', definition: 'INT DEFAULT 0 COMMENT "Number of times session was resumed"' }
    ];

    for (const column of columnsToAdd) {
      try {
        // Check if column exists
        const [existing] = await pool.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'real_time_sessions' 
            AND COLUMN_NAME = ?
        `, [column.name]);

        if (existing.length === 0) {
          // Column doesn't exist, add it
          await pool.query(`ALTER TABLE real_time_sessions ADD COLUMN ${column.name} ${column.definition}`);
          console.log(`✅ Added column ${column.name}`);
        } else {
          console.log(`⏭️  Column ${column.name} already exists`);
        }
      } catch (error) {
        console.error(`❌ Error adding column ${column.name}:`, error.message);
      }
    }

    // Create session activity log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_activity_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        activity_type ENUM('api_call', 'page_view', 'socket_event') DEFAULT 'api_call',
        endpoint VARCHAR(255),
        method VARCHAR(10),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_session_date (user_id, session_id, date),
        INDEX idx_timestamp (timestamp),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Update the daily summary calculation to account for paused time
    await pool.query(`
      DROP VIEW IF EXISTS v_daily_session_summary
    `);

    await pool.query(`
      CREATE VIEW v_daily_session_summary AS
      SELECT 
        user_id,
        date,
        COUNT(*) as session_count,
        SUM(GREATEST(COALESCE(duration_seconds, 0) - COALESCE(paused_duration, 0), 0)) as active_time_seconds,
        SUM(COALESCE(duration_seconds, 0)) as total_time_seconds,
        SUM(COALESCE(paused_duration, 0)) as total_paused_seconds,
        SUM(page_views) as total_page_views,
        SUM(resume_count) as total_resumes,
        MIN(TIME(start_time)) as first_login,
        MAX(TIME(COALESCE(end_time, last_activity))) as last_logout
      FROM real_time_sessions
      WHERE date >= CURDATE() - INTERVAL 30 DAY
      GROUP BY user_id, date
    `);

    console.log('✅ Session timeout support added successfully');
    console.log('📊 New features:');
    console.log('  - Automatic session pause after 10 minutes of inactivity');
    console.log('  - Session resume on next API call');
    console.log('  - Paused time tracking and exclusion from active time');
    console.log('  - Activity logging for debugging');

  } catch (error) {
    console.error('❌ Error adding session timeout support:', error);
    throw error;
  }
}

// Run the migration if called directly
if (require.main === module) {
  addSessionTimeoutSupport()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addSessionTimeoutSupport };
