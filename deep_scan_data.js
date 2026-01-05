const mysql = require('mysql2/promise');
require('dotenv').config();

async function deepScan() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    try {
        console.log('--- DEEP DATABASE SCAN ---');
        console.log('Looking for tables with "customer" in the name...');

        const [dbs] = await conn.query("SHOW DATABASES");

        for (const dbRow of dbs) {
            const dbName = dbRow.Database;
            if (['information_schema', 'performance_schema', 'mysql', 'sys', 'phpmyadmin'].includes(dbName)) continue;

            console.log(`\n📂 Database: [${dbName}]`);

            // Get all tables
            const [tables] = await conn.query(`SHOW TABLES FROM ${dbName}`);
            const tableKey = `Tables_in_${dbName}`;

            let foundCustomerTable = false;

            for (const tableRow of tables) {
                const tableName = tableRow[tableKey];

                // Check if table name contains 'cust' or 'pengguna' or 'client'
                if (tableName.toLowerCase().includes('cust') ||
                    tableName.toLowerCase().includes('users') ||
                    tableName.toLowerCase().includes('client')) {

                    foundCustomerTable = true;
                    // Count rows
                    try {
                        const [count] = await conn.query(`SELECT COUNT(*) as c FROM ${dbName}.${tableName}`);
                        console.log(`   Detailed Table: ${tableName} - ${count[0].c} rows`);

                        // If it has rows, let's see columns to identify if it's the right one
                        if (count[0].c > 0) {
                            const [cols] = await conn.query(`DESCRIBE ${dbName}.${tableName}`);
                            const colNames = cols.map(c => c.Field).join(', ');
                            console.log(`      Columns: ${colNames.substring(0, 100)}...`);
                        }

                    } catch (e) {
                        console.log(`   Table: ${tableName} - (Error reading: ${e.message})`);
                    }
                }
            }

            if (!foundCustomerTable) {
                console.log('   (No obvious customer tables found)');
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

deepScan();
