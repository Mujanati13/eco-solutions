const mysql = require('mysql2/promise');
require('dotenv').config();

const setupDatabase = async () => {
  try {
    console.log('🔄 Setting up database...');

    // Connect to MySQL server (without specific database)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'eco_s_orders';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created or already exists`);

    // Close the connection
    await connection.end();

    // Now run the database initialization
    const Database = require('../config/initDatabase');
    await Database.initializeSchema();
    await Database.createDefaultAdmin();

    console.log('✅ Database setup completed successfully!');
    console.log('');
    console.log('Default admin credentials:');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('');
    console.log('Please change the default password after first login!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
