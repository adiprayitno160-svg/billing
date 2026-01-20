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

    const sqlFile = path.join(__dirname, '../migration_autocomplaint.sql');
    if (!fs.existsSync(sqlFile)) {
        console.log('ℹ️ No migration file found (migration_autocomplaint.sql).');
        await connection.end();
        return;
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');

    try {
        await connection.query(sql);
        console.log('✅ Migration (Auto-Complaint Tables) executed successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('ℹ️ Migration already applied (Skipping).');
        } else {
            console.warn('⚠️ Migration Warning:', err.message);
        }
    }

    await connection.end();
}

run();
