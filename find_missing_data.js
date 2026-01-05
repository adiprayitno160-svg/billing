const mysql = require('mysql2/promise');
require('dotenv').config();

async function findData() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    try {
        const [dbs] = await conn.query("SHOW DATABASES");
        const dbNames = dbs.map(d => d.Database);

        console.log('Found Databases:', dbNames);

        for (const db of dbNames) {
            if (['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db)) continue;

            console.log(`\nAnalyzing DB: ${db}`);
            try {
                // Check for customers table
                const [tables] = await conn.query(`SHOW TABLES FROM ${db} LIKE 'customers'`);
                if (tables.length > 0) {
                    const [custCount] = await conn.query(`SELECT COUNT(*) as c FROM ${db}.customers`);
                    console.log(`  - customers: ${custCount[0].c} rows`);
                } else {
                    console.log(`  - customers table NOT FOUND`);
                }

                // Check for mikrotik_settings
                const [mikroTables] = await conn.query(`SHOW TABLES FROM ${db} LIKE 'mikrotik_settings'`);
                if (mikroTables.length > 0) {
                    const [mikroRows] = await conn.query(`SELECT host, username FROM ${db}.mikrotik_settings LIMIT 1`);
                    if (mikroRows.length > 0) {
                        console.log(`  - mikrotik_settings: Found config for ${mikroRows[0].host}`);
                    } else {
                        console.log(`  - mikrotik_settings: Table empty`);
                    }
                }

            } catch (err) {
                console.log(`  - Error scanning ${db}: ${err.message}`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

findData();
