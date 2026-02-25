
import { databasePool } from './src/db/pool';

async function searchWhatsAppMessages() {
    try {
        const query = `
            SELECT * FROM whatsapp_bot_messages 
            WHERE message_content LIKE '%Wildan%' OR message_content LIKE '%Yeni%'
            ORDER BY created_at DESC
        `;
        const [rows] = await databasePool.query(query) as any;
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
searchWhatsAppMessages();
