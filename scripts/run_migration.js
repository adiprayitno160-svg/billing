const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
    console.log('🔄 Checking for Database Migrations...');

    // Create connection
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
        'migration_customers_monitoring.sql',
        'migration_add_bank_settings.sql'
    ];

    for (const file of migrationFiles) {
        const sqlFile = path.join(__dirname, '../' + file);
        if (!fs.existsSync(sqlFile)) {
            console.log(`ℹ️ Migration file not found: ${file}`);
            continue;
        }

        console.log(`Processing ${file}...`);
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        // Split by semicolon to run statements individually
        // This ensures that if one statement fails (e.g. duplicate column), others still run
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await connection.query(statement);
                console.log(`   ✅ Executed: ${statement.substring(0, 50)}...`);
            } catch (err) {
                // Check for duplicate column or table exists
                const isDuplicate = err.code === 'ER_DUP_FIELDNAME' ||
                    err.code === 'ER_TABLE_EXISTS_ERROR' ||
                    err.code === '42S21' ||
                    (err.sqlMessage && err.sqlMessage.includes('Duplicate column')) ||
                    (err.sqlMessage && err.sqlMessage.includes('already exists'));

                if (isDuplicate) {
                    console.log(`   ℹ️ Skipped (Already exists): ${statement.substring(0, 50)}...`);
                } else {
                    console.warn(`   ⚠️ Warning: ${err.message}`);
                    // Don't stop execution, proceed to next statement
                }
            }
        }
    }

    await connection.end();
}

run();
