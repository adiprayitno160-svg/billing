const mysql = require('mysql2/promise');
require('dotenv').config();

async function findCustomerInRtrwBilling() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: 'rtrwbilling'
    });

    try {
        const [tables] = await connection.execute("SHOW TABLES");
        const tableNames = tables.map(t => Object.values(t)[0]);

        console.log(`Searching in ${tableNames.length} tables...`);

        for (const table of tableNames) {
            try {
                // Check if table has a column that looks like 'name' or 'nama'
                const [cols] = await connection.execute(`SHOW COLUMNS FROM ${table}`);
                const hasName = cols.some(c => c.Field.toLowerCase().includes('name') || c.Field.toLowerCase().includes('nama'));

                if (hasName) {
                    const nameCol = cols.find(c => c.Field.toLowerCase().includes('name') || c.Field.toLowerCase().includes('nama')).Field;
                    const [rows] = await connection.execute(`SELECT * FROM ${table} WHERE ${nameCol} LIKE '%Teo%' OR ${nameCol} LIKE '%Ady%'`);
                    if (rows.length > 0) {
                        console.log(`\n!!! FOUND in table [${table}] !!!`);
                        console.log(JSON.stringify(rows, null, 2));
                    }
                }
            } catch (e) {
                // Skip if error
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

findCustomerInRtrwBilling();
