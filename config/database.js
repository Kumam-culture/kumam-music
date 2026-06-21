const mysql = require('mysql2/promise');

console.log('🔍 Checking environment variables:');
console.log('MYSQLHOST:', process.env.MYSQLHOST || 'NOT SET');
console.log('MYSQLUSER:', process.env.MYSQLUSER || 'NOT SET');
console.log('MYSQLDATABASE:', process.env.MYSQLDATABASE || 'NOT SET');
console.log('MYSQLPORT:', process.env.MYSQLPORT || 'NOT SET');

// Use the variables directly from Railway
const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: parseInt(process.env.MYSQLPORT) || 3306,
  ssl: {
    rejectUnauthorized: false  // CRITICAL for Railway
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection immediately
(async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully!');
    console.log('📊 Connected to:', process.env.MYSQLDATABASE);
    connection.release();
  } catch (error) {
    console.error('❌ Database connection FAILED!');
    console.error('Error:', error.message);
    console.error('Error code:', error.code);
    
    // Log what we're trying to connect to (without password)
    console.log('Connection attempt:');
    console.log('  Host:', process.env.MYSQLHOST);
    console.log('  User:', process.env.MYSQLUSER);
    console.log('  Database:', process.env.MYSQLDATABASE);
    console.log('  Port:', process.env.MYSQLPORT);
  }
})();

module.exports = pool;