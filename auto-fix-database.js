/**
 * AUTO FIX DATABASE - Add missing columns
 * Run: node auto-fix-database.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function fixDatabase() {
  console.log(`\n${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}  AUTO FIX DATABASE - Missing Columns${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}\n`);

  let connection;

  try {
    // Connect to database
    console.log(`${colors.blue}[1/4] Connecting to database...${colors.reset}`);
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'billing'
    });

    console.log(`${colors.green}✓ Connected to database: ${process.env.DB_NAME || 'billing'}${colors.reset}\n`);

    // Check if prepaid_packages table exists
    console.log(`${colors.blue}[2/4] Checking prepaid_packages table...${colors.reset}`);
    
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'prepaid_packages'"
    );

    if (tables.length === 0) {
      console.log(`${colors.red}✗ Table 'prepaid_packages' not found!${colors.reset}`);
      console.log(`${colors.yellow}  Please create the table first.${colors.reset}\n`);
      process.exit(1);
    }

    console.log(`${colors.green}✓ Table exists${colors.reset}\n`);

    // Get current columns
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM prepaid_packages"
    );

    const existingColumns = columns.map(col => col.Field);
    console.log(`${colors.blue}[3/4] Adding missing columns...${colors.reset}`);

    let fixed = 0;
    
    // Add mikrotik_profile_name
    if (!existingColumns.includes('mikrotik_profile_name')) {
      console.log(`  ${colors.yellow}Adding: mikrotik_profile_name...${colors.reset}`);
      await connection.query(`
        ALTER TABLE prepaid_packages 
        ADD COLUMN mikrotik_profile_name VARCHAR(100) NULL 
        AFTER connection_type
      `);
      console.log(`  ${colors.green}✓ mikrotik_profile_name added${colors.reset}`);
      fixed++;
    } else {
      console.log(`  ${colors.cyan}○ mikrotik_profile_name already exists${colors.reset}`);
    }

    // Add parent_download_queue
    if (!existingColumns.includes('parent_download_queue')) {
      console.log(`  ${colors.yellow}Adding: parent_download_queue...${colors.reset}`);
      await connection.query(`
        ALTER TABLE prepaid_packages 
        ADD COLUMN parent_download_queue VARCHAR(100) NULL 
        AFTER mikrotik_profile_name
      `);
      console.log(`  ${colors.green}✓ parent_download_queue added${colors.reset}`);
      fixed++;
    } else {
      console.log(`  ${colors.cyan}○ parent_download_queue already exists${colors.reset}`);
    }

    // Add parent_upload_queue
    if (!existingColumns.includes('parent_upload_queue')) {
      console.log(`  ${colors.yellow}Adding: parent_upload_queue...${colors.reset}`);
      await connection.query(`
        ALTER TABLE prepaid_packages 
        ADD COLUMN parent_upload_queue VARCHAR(100) NULL 
        AFTER parent_download_queue
      `);
      console.log(`  ${colors.green}✓ parent_upload_queue added${colors.reset}`);
      fixed++;
    } else {
      console.log(`  ${colors.cyan}○ parent_upload_queue already exists${colors.reset}`);
    }

    console.log();

    // Verify
    console.log(`${colors.blue}[4/4] Verifying columns...${colors.reset}`);
    
    const [newColumns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'prepaid_packages'
        AND COLUMN_NAME IN ('mikrotik_profile_name', 'parent_download_queue', 'parent_upload_queue')
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME || 'billing']);

    if (newColumns.length === 3) {
      console.log(`${colors.green}✓ All 3 columns verified:${colors.reset}`);
      newColumns.forEach(col => {
        console.log(`  ${colors.cyan}• ${col.COLUMN_NAME} (${col.COLUMN_TYPE})${colors.reset}`);
      });
    } else {
      console.log(`${colors.yellow}⚠ Only ${newColumns.length}/3 columns found${colors.reset}`);
    }

    console.log();
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.green}✅ DATABASE FIX COMPLETED!${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.green}Columns fixed: ${fixed}${colors.reset}`);
    console.log();
    console.log(`${colors.yellow}Next steps:${colors.reset}`);
    console.log(`  1. Restart your application`);
    console.log(`  2. Test prepaid pages`);
    console.log();

  } catch (error) {
    console.log();
    console.log(`${colors.red}========================================${colors.reset}`);
    console.log(`${colors.red}❌ ERROR!${colors.reset}`);
    console.log(`${colors.red}========================================${colors.reset}`);
    console.log(`${colors.red}${error.message}${colors.reset}`);
    console.log();
    
    if (error.code === 'ECONNREFUSED') {
      console.log(`${colors.yellow}Possible causes:${colors.reset}`);
      console.log(`  • MySQL server is not running`);
      console.log(`  • Wrong host or port in .env file`);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log(`${colors.yellow}Possible causes:${colors.reset}`);
      console.log(`  • Wrong username or password in .env file`);
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log(`${colors.yellow}Possible causes:${colors.reset}`);
      console.log(`  • Database '${process.env.DB_NAME || 'billing'}' does not exist`);
    }
    
    console.log();
    process.exit(1);
    
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixDatabase();

