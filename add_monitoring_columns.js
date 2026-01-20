const mysql = require('mysql2/promise');

async function addColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billing'
  });
  
  try {
    // Check if columns exist
    const [existing] = await connection.execute(
      "SHOW COLUMNS FROM customers LIKE 'ignore_monitoring_start'"
    );
    
    if (existing.length === 0) {
      console.log('Adding ignore_monitoring_start column...');
      await connection.execute(
        "ALTER TABLE customers ADD COLUMN ignore_monitoring_start TIME NULL DEFAULT NULL"
      );
      console.log('Added ignore_monitoring_start column');
    } else {
      console.log('ignore_monitoring_start column already exists');
    }
    
    // Check if second column exists
    const [existing2] = await connection.execute(
      "SHOW COLUMNS FROM customers LIKE 'ignore_monitoring_end'"
    );
    
    if (existing2.length === 0) {
      console.log('Adding ignore_monitoring_end column...');
      await connection.execute(
        "ALTER TABLE customers ADD COLUMN ignore_monitoring_end TIME NULL DEFAULT NULL"
      );
      console.log('Added ignore_monitoring_end column');
    } else {
      console.log('ignore_monitoring_end column already exists');
    }
    
  } catch (e) {
    console.error('Error adding columns:', e.message);
  }
  
  await connection.end();
}

addColumns().catch(console.error);