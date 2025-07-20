const { pool } = require('../config/database');

async function createGoogleTokensTable() {
  try {
    // Create table for storing user Google tokens
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_google_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expiry_date DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ user_google_tokens table created/verified');
  } catch (error) {
    console.error('❌ Error creating user_google_tokens table:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  createGoogleTokensTable()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createGoogleTokensTable };
