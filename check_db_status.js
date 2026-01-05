const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabases() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    try {
        console.log('--- Checking Available Databases ---');
        const [dbs] = await conn.query("SHOW DATABASES;");
        console.table(dbs);

        const currentDb = process.env.DB_NAME;
        console.log(`Current Configured DB: ${currentDb}`);

        console.log(`--- Checking tables in ${currentDb} ---`);
        await conn.changeUser({ database: currentDb });

        const tablesToCheck = ['customers', 'pppoe_profiles', 'pppoe_packages', 'users'];
        for (const table of tablesToCheck) {
            try {
                const [count] = await conn.query(`SELECT COUNT(*) as c FROM ${table}`);
                console.log(`${table}: ${count[0].c}`);
            } catch (e) {
                console.log(`${table}: ERROR - ${e.message}`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await conn.end();
    }
}

checkDatabases();
