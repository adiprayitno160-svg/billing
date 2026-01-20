const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
    console.log('🔄 Checking for Database Migrations...');

    // Create connection with multipleStatements enabled
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing',
        multipleStatements: true
    };

    let connection;
    try {
        connection = await mysql.createConnection(config);
    } catch (err) {
        console.error('❌ DB Connection Failed:', err.message);
        process.exit(1);
    }

    // List of migration files to run in order
    const migrationFiles = [
        'migration_autocomplaint.sql',
        'migration_customers_monitoring.sql'
    ];

    for (const file of migrationFiles) {
        const sqlFile = path.join(__dirname, '../' + file);
        if (!fs.existsSync(sqlFile)) {
            console.log(`ℹ️ Migration file not found: ${file}`);
            continue;
        }

        const sql = fs.readFileSync(sqlFile, 'utf8');
        console.log(`Applying ${file}...`);

        try {
            await connection.query(sql);
            console.log(`✅ ${file} executed successfully.`);
        } catch (err) {
            // Check for duplicate column or table exists (ER_DUP_FIELDNAME / 42S21)
            const isDuplicate = err.code === 'ER_DUP_FIELDNAME' ||
                err.code === 'ER_TABLE_EXISTS_ERROR' ||
                err.code === '42S21' ||
                (err.sqlMessage && err.sqlMessage.includes('Duplicate column'));

            if (isDuplicate) {
                console.log(`ℹ️ ${file} already applied (Skipping).`);
            } else {
                console.warn(`⚠️ Migration Warning in ${file}:`, err.message);
            }
        }
    }

    await connection.end();
}

run();
