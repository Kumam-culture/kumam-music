const mysql = require('mysql2/promise');

console.log('🔍 Checking DATABASE_URL:', process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET');

// Use DATABASE_URL from Railway
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection immediately
(async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully!');
    console.log('📊 Connected to MySQL on Railway');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection FAILED!');
    console.error('Error:', error.message);
    console.error('Error Code:', error.code);
  }
})();

module.exports = pool;