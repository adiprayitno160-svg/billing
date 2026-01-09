
import { databasePool } from './src/db/pool';

async function setup() {
    try {
        console.log('📊 Updating whatsapp_bot_messages...');

        const [cols] = await databasePool.query("SHOW COLUMNS FROM whatsapp_bot_messages LIKE 'media_url'");
        if ((cols as any[]).length === 0) {
            console.log('Adding media_url column...');
            await databasePool.query(`
                ALTER TABLE whatsapp_bot_messages 
                ADD COLUMN media_url VARCHAR(255) NULL AFTER message_content
            `);
            console.log('✅ Added media_url to whatsapp_bot_messages');
        } else {
            console.log('ℹ️ media_url already exists');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

setup();
