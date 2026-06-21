// db.js
const mysql = require('mysql2/promise');

// Determine if we're on Railway
const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

// Connection configuration
const getPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    // Use Railway URL if available
    return {
      uri: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
  }

  // Fallback to individual environment variables
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'railway',
    port: parseInt(process.env.DB_PORT) || 3306,
    ssl: isRailway ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
};

const pool = mysql.createPool(getPoolConfig());

// Connection test with detailed logging
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully!');
    console.log(`📊 Database: ${process.env.DB_NAME || 'railway'}`);
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('📋 Connection details:');
    console.error('  - Host:', process.env.DB_HOST || 'localhost');
    console.error('  - Database:', process.env.DB_NAME || 'kumam_music');
    console.error('  - Has SSL:', !!process.env.DATABASE_URL || isRailway);
  }
})();

module.exports = pool;