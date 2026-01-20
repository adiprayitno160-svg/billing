
import { databasePool } from '../db/pool';
import { WhatsAppClient } from '../services/whatsapp/WhatsAppClient';
import { ChatBotService } from '../services/ai/ChatBotService';

async function diagnose() {
    console.log('🔍 Starting WhatsApp & AI Diagnostics...');
    console.log('----------------------------------------');

    // 1. Check Database Table
    try {
        console.log('Checking database table `whatsapp_bot_messages`...');
        const [rows] = await databasePool.query('SHOW TABLES LIKE "whatsapp_bot_messages"');
        if ((rows as any[]).length > 0) {
            console.log('✅ Table `whatsapp_bot_messages` EXISTS.');

            // Check columns
            const [cols] = await databasePool.query('SHOW COLUMNS FROM whatsapp_bot_messages');
            const colNames = (cols as any[]).map(c => c.Field);
            console.log('   Columns:', colNames.join(', '));
            if (!colNames.includes('direction')) console.error('   ❌ Column `direction` MISSING!');
        } else {
            console.error('❌ Table `whatsapp_bot_messages` DOES NOT EXIST.');
            console.log('   Attempting to create it...');
            await databasePool.query(`
                CREATE TABLE IF NOT EXISTS whatsapp_bot_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    phone_number VARCHAR(20),
                    customer_id INT NULL,
                    direction ENUM('inbound', 'outbound') DEFAULT 'outbound',
                    message_type VARCHAR(20) DEFAULT 'text',
                    message_content TEXT,
                    status VARCHAR(20) DEFAULT 'sent',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_phone (phone_number),
                    INDEX idx_created (created_at)
                )
            `);
            console.log('   ✅ Table created successfully.');
        }
    } catch (err: any) {
        console.error('❌ Database Error:', err.message);
    }

    // 2. Check WhatsApp Client
    console.log('\nChecking WhatsApp Client Status...');
    const wa = WhatsAppClient.getInstance();
    const status = wa.getStatus();
    console.log('   Status:', status);

    if (status.ready) {
        console.log('✅ WhatsApp is READY.');
    } else {
        console.error('❌ WhatsApp is NOT READY.');
        if ((status as any).qr || status.hasQRCode) console.log('   QR Code is available (scan required).');
    }


    // 3. Check AI Service & Settings
    console.log('\nChecking AI Service Configuration...');
    try {
        // Check DB for stored settings
        try {
            const [rows] = await databasePool.query('SELECT * FROM ai_settings');
            console.log('   Stored Settings (ai_settings):', rows);

            // AUTO-FIX: If we see invalid model, fix it
            const [modelRows] = await databasePool.query('SELECT * FROM ai_settings WHERE model = "gemini-2.5-flash"');
            if ((modelRows as any[]).length > 0) {
                console.log('   ⚠️ Found INVALID model "gemini-2.5-flash" in DB. Fixing it...');
                await databasePool.query('UPDATE ai_settings SET model = "gemini-1.5-flash" WHERE model = "gemini-2.5-flash"');
                console.log('   ✅ Fixed model to "gemini-1.5-flash".');
            }
        } catch (e) {
            console.log('   (Could not read ai_settings table:', (e as any).message, ')');
        }

        // Access private property logic or test simple prompt

        console.log('   Testing AI with "Halo"...');
        const response = await ChatBotService.ask('Halo, test diagnosa', { status: 'guest' });
        console.log('   AI Response:', response);
        if (response && response.length > 0) {
            console.log('✅ AI Service is RESPONDING.');
        } else {
            console.warn('⚠️ AI returned empty response.');
        }
    } catch (err: any) {
        console.error('❌ AI Service FAILED:', err.message);
        if (err.message.includes('404') || err.message.includes('model')) {
            console.error('   👉 Likely invalid model name. Check ChatBotService.ts default model.');
        }
    }

    console.log('\n----------------------------------------');
    console.log('Diagnostics Complete.');
    process.exit(0);
}

diagnose();
