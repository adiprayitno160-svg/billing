
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

async function cleanDatabase() {
    console.log('Connecting to database...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('Connected!');

    // Tables to check and drop if they exist
    const tablesToDrop = [
        'whatsapp_sessions',
        'whatsapp_auth',
        'whatsapp_bot_messages', // Optional: History messages
        'telegram_users',
        'telegram_updates',
        'telegram_sessions'
    ];

    // Get existing tables
    const [rows] = await connection.query('SHOW TABLES');
    const existingTables = (rows as any[]).map(row => Object.values(row)[0]);

    for (const table of tablesToDrop) {
        if (existingTables.includes(table)) {
            console.log(`Dropping table: ${table}...`);
            await connection.query(`DROP TABLE IF EXISTS ${table}`);
            console.log(`✅ Dropped ${table}`);
        } else {
            // Check if we should clean specific rows from other tables like 'notification_logs' for these channels
            console.log(`Note: Table ${table} not found.`);
        }
    }

    // Clean notification logs for whatsapp/telegram
    console.log('Cleaning notification logs for whatsapp/telegram...');
    try {
        await connection.query("DELETE FROM notification_logs WHERE channel IN ('whatsapp', 'telegram')");
        console.log('✅ Cleaned notification_logs');
    } catch (e: any) {
        console.log('⚠️ Error cleaning logs (maybe table missing): ' + e.message);
    }

    console.log('Database cleanup complete.');
    await connection.end();
}

cleanDatabase().catch(console.error);
