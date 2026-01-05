const mysql = require('mysql2/promise');

async function checkAsRoot() {
    // Try connecting as root with empty password (common Laragon default)
    try {
        console.log('Attempting connection as root (no password)...');
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: ''
        });

        const [dbs] = await conn.query("SHOW DATABASES");
        console.log('--- Databases visible to ROOT ---');
        console.table(dbs);

        // Scan ALL DBs found
        for (const dbRow of dbs) {
            const dbName = dbRow.Database;
            if (['information_schema', 'performance_schema', 'mysql', 'sys', 'phpmyadmin'].includes(dbName)) continue;

            console.log(`Checking DB: ${dbName}`);
            const [tables] = await conn.query(`SHOW TABLES FROM ${dbName}`);
            // If we find a 'customers' table, count it
            for (const t of tables) {
                const tName = Object.values(t)[0];
                if (tName === 'customers') {
                    const [c] = await conn.query(`SELECT COUNT(*) as cnt FROM ${dbName}.customers`);
                    console.log(`  FOUND customers table in ${dbName} with ${c[0].cnt} rows!`);
                }
            }
        }

        await conn.end();
    } catch (e) {
        console.log('Root connection failed:', e.message);

        // Try 'root' with 'password123' just in case
        try {
            console.log('Attempting connection as root (password123)...');
            const conn2 = await mysql.createConnection({
                host: 'localhost',
                user: 'root',
                password: 'password123'
            });
            const [dbs] = await conn2.query("SHOW DATABASES");
            console.log('--- Databases visible to ROOT (pw:password123) ---');
            console.table(dbs);
            await conn2.end();
        } catch (e2) {
            console.log('Root (password123) failed:', e2.message);
        }
    }
}

checkAsRoot();
