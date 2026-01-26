const mysql = require('mysql2/promise');
require('dotenv').config();

async function deepSearchRes() {
    const db = 'rtrwbilling';
    console.log(`Checking ${db}...`);
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: '',
        database: db
    });

    const [tables] = await connection.execute("SHOW TABLES");
    const names = tables.map(t => Object.values(t)[0]);

    for (const table of names) {
        if (table.includes('pelanggan') || table.includes('customer') || table.includes('client')) {
            try {
                const [cols] = await connection.execute(`SHOW COLUMNS FROM ${table}`);
                const nameCol = cols.find(c => c.Field.toLowerCase().includes('name') || c.Field.toLowerCase().includes('nama'))?.Field;
                if (nameCol) {
                    const [rows] = await connection.execute(`SELECT * FROM ${table} WHERE ${nameCol} LIKE '%Teo%' OR ${nameCol} LIKE '%Ady%'`);
                    if (rows.length > 0) {
                        console.log(`FOUND IN ${table}:`, JSON.stringify(rows, null, 2));
                    }
                }
            } catch (e) { }
        }
    }
    await connection.end();
}
deepSearchRes();
