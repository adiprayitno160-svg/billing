const mysql = require('mysql2/promise');

async function checkColumnType() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billing'
  });
  
  try {
    const [columns] = await connection.execute(
      'SHOW CREATE TABLE customers'
    );
    
    const createTable = columns[0]['Create Table'];
    console.log('ignore_monitoring columns definition:');
    const lines = createTable.split('\n');
    lines.forEach(line => {
      if (line.includes('ignore_monitoring')) {
        console.log(line.trim());
      }
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await connection.end();
}

checkColumnType().catch(console.error);