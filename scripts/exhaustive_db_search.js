const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDbs() {
    const dbs = ['billing', 'billing_db', 'rtrwbilling', 'rtrwbill', 'sim_sekolah'];
    for (const db of dbs) {
        console.log(`\n--- DB: ${db} ---`);
        try {
            const connection = await mysql.createConnection({
                host: '127.0.0.1',
                user: 'root',
                password: '',
                database: db
            });
            const [tables] = await connection.execute("SHOW TABLES");
            const names = tables.map(t => Object.values(t)[0]);
            console.log("Tables:", names.join(', '));

            // Search in common table names
            const commonTables = ['customers', 'pelanggan', 'user', 'users', 'client', 'clients'];
            for (const ct of commonTables) {
                if (names.includes(ct)) {
                    const [count] = await connection.execute(`SELECT COUNT(*) as total FROM ${ct}`);
                    console.log(`  Table [${ct}] has ${count[0].total} rows`);
                    if (count[0].total > 0) {
                        const [cols] = await connection.execute(`SHOW COLUMNS FROM ${ct}`);
                        const nameCol = cols.find(c => c.Field.toLowerCase().includes('name') || c.Field.toLowerCase().includes('nama'))?.Field;
                        if (nameCol) {
                            const [rows] = await connection.execute(`SELECT id, ${nameCol} FROM ${ct} WHERE ${nameCol} LIKE 'T%' LIMIT 5`);
                            if (rows.length > 0) {
                                console.log(`  Found 'T' names in ${ct}:`, rows.map(r => r[nameCol]).join(', '));
                            }
                        }
                    }
                }
            }
            await connection.end();
        } catch (e) { }
    }
}
checkDbs();
