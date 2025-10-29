/**
 * INSTANT DATABASE FIX
 * Jalankan: node fix-db-now.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixNow() {
  console.log('\n🔧 FIXING DATABASE...\n');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'billing'
  });

  try {
    // Get existing columns
    const [columns] = await connection.query("SHOW COLUMNS FROM prepaid_packages");
    const existing = columns.map(c => c.Field);

    // Fix 1: mikrotik_profile_name
    if (!existing.includes('mikrotik_profile_name')) {
      console.log('Adding: mikrotik_profile_name...');
      await connection.query(`
        ALTER TABLE prepaid_packages 
        ADD COLUMN mikrotik_profile_name VARCHAR(100) NULL
      `);
      console.log('✅ Added mikrotik_profile_name');
    } else {
      console.log('✓ mikrotik_profile_name exists');
    }

    // Fix 2: parent_download_queue
    if (!existing.includes('parent_download_queue')) {
      console.log('Adding: parent_download_queue...');
      await connection.query(`
        ALTER TABLE prepaid_packages 
        ADD COLUMN parent_download_queue VARCHAR(100) NULL
      `);
      console.log('✅ Added parent_download_queue');
    } else {
      console.log('✓ parent_download_queue exists');
    }

    // Fix 3: parent_upload_queue
    if (!existing.includes('parent_upload_queue')) {
      console.log('Adding: parent_upload_queue...');
      await connection.query(`
        ALTER TABLE prepaid_packages 
        ADD COLUMN parent_upload_queue VARCHAR(100) NULL
      `);
      console.log('✅ Added parent_upload_queue');
    } else {
      console.log('✓ parent_upload_queue exists');
    }

    console.log('\n✅ DATABASE FIXED!\n');
    console.log('Now restart: pm2 restart billing-system\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.log('\nTroubleshooting:');
    console.log('- Make sure MySQL is running');
    console.log('- Check .env file for correct credentials\n');
  } finally {
    await connection.end();
  }
}

fixNow();

