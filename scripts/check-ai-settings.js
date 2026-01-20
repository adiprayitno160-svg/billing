
require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkSettings() {
    console.log('Checking AI Settings in DB...');

    // Create connection
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
        const [rows] = await pool.query('SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1');
        if (rows.length > 0) {
            console.log('✅ Found AI Settings:');
            // Hide part of API key
            const settings = rows[0];
            if (settings.api_key) {
                settings.api_key = settings.api_key.substring(0, 5) + '...' + settings.api_key.substring(settings.api_key.length - 4);
            }
            console.log(settings);
        } else {
            console.log('❌ No AI Settings found in DB');
        }
    } catch (error) {
        console.error('❌ Error reading DB:', error.message);
    } finally {
        await pool.end();
    }
}

checkSettings();
