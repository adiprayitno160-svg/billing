import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const [rows] = await pool.query('SHOW TABLES');
        const tables = rows.map(r => Object.values(r)[0]);
        console.log("Tables:", tables);

        // find which tables have customer_id
        for (const table of tables) {
            try {
                const [cols] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE 'customer_id'`);
                if (cols.length > 0) {
                    console.log(`Table ${table} has customer_id`);
                }
            } catch(e) {}
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
