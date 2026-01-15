
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the root .env file (assuming script is run from project root)
dotenv.config();

async function fixSchema() {
    console.log('🔧 Starting Schema Fix (JS Version) for WhatsApp Bot...');
    console.log('Database Host:', process.env.DB_HOST || 'localhost');

    // Create direct connection configuration
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'billing'
    };

    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('✅ Connected to database.');

        // 1. Fix whatsapp_bot_messages table
        console.log('1. Checking whatsapp_bot_messages table...');
        const [tables] = await connection.query("SHOW TABLES LIKE 'whatsapp_bot_messages'");

        if (tables.length === 0) {
            console.log('   Creating table whatsapp_bot_messages...');
            await connection.query(`
                CREATE TABLE whatsapp_bot_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    phone_number VARCHAR(20) NOT NULL,
                    message_type VARCHAR(20) DEFAULT 'text',
                    message_content TEXT,
                    media_url TEXT,
                    direction ENUM('inbound', 'outbound') DEFAULT 'inbound',
                    status VARCHAR(20) DEFAULT 'processed',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } else {
            console.log('   Table exists. Checking columns...');
            const [columns] = await connection.query("SHOW COLUMNS FROM whatsapp_bot_messages");
            const columnNames = columns.map(c => c.Field);

            if (!columnNames.includes('media_url')) {
                console.log('   Adding missing column: media_url');
                await connection.query("ALTER TABLE whatsapp_bot_messages ADD COLUMN media_url TEXT NULL AFTER message_content");
            }

            if (!columnNames.includes('status')) {
                console.log('   Adding missing column: status');
                await connection.query("ALTER TABLE whatsapp_bot_messages ADD COLUMN status VARCHAR(20) DEFAULT 'processed' AFTER direction");
            }
        }

        // 2. Fix notification_logs table
        console.log('2. Checking notification_logs table...');
        const [logTables] = await connection.query("SHOW TABLES LIKE 'notification_logs'");
        if (logTables.length > 0) {
            const [logColumns] = await connection.query("SHOW COLUMNS FROM notification_logs");
            const logColumnNames = logColumns.map(c => c.Field);

            if (!logColumnNames.includes('channel')) {
                console.log('   Adding missing column: channel');
                await connection.query("ALTER TABLE notification_logs ADD COLUMN channel VARCHAR(20) DEFAULT 'whatsapp' AFTER customer_id");
            }

            if (!logColumnNames.includes('recipient')) {
                console.log('   Adding missing column: recipient');
                await connection.query("ALTER TABLE notification_logs ADD COLUMN recipient VARCHAR(50) NULL AFTER channel");
            }
        }

        console.log('✅ Schema Fix Completed Successfully!');
    } catch (err) {
        console.error('❌ Error during schema fix:', err.message);
    } finally {
        if (connection) await connection.end();
    }
}

fixSchema();
