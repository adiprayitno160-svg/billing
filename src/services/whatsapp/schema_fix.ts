
import { databasePool } from '../../db/pool';

async function fixSchema() {
    console.log('🔧 Starting Schema Fix for WhatsApp Bot...');

    try {
        const connection = await databasePool.getConnection();

        try {
            // 1. Fix whatsapp_bot_messages table
            console.log('1. Checking whatsapp_bot_messages table...');

            // Check if table exists
            const [tables]: any = await connection.query("SHOW TABLES LIKE 'whatsapp_bot_messages'");
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
                // Check columns
                const [columns]: any = await connection.query("SHOW COLUMNS FROM whatsapp_bot_messages");
                const columnNames = columns.map((c: any) => c.Field);

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
            const [logTables]: any = await connection.query("SHOW TABLES LIKE 'notification_logs'");
            if (logTables.length > 0) {
                const [logColumns]: any = await connection.query("SHOW COLUMNS FROM notification_logs");
                const logColumnNames = logColumns.map((c: any) => c.Field);

                if (!logColumnNames.includes('channel')) {
                    console.log('   Adding missing column: channel');
                    await connection.query("ALTER TABLE notification_logs ADD COLUMN channel VARCHAR(20) DEFAULT 'whatsapp' AFTER customer_id");
                }
            }

            console.log('✅ Schema Fix Completed Successfully!');

        } catch (err: any) {
            console.error('❌ Error during schema fix:', err.message);
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Fatal error:', error);
    }

    process.exit(0);
}

fixSchema();
