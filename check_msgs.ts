
import { databasePool } from './src/db/pool';

async function checkMessages() {
    try {
        console.log('--- Checking Last 10 WhatsApp Messages ---');
        const [rows] = await databasePool.query(
            "SELECT id, phone_number, message_content, direction, status, created_at FROM whatsapp_bot_messages ORDER BY id DESC LIMIT 10"
        );
        console.table(rows);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkMessages();
