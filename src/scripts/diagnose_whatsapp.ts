
import { WhatsAppClient, WhatsAppEvents } from '../services/whatsapp/WhatsAppClient';
import { WhatsAppHandler } from '../services/whatsapp/WhatsAppHandler';
import { databasePool } from '../db/pool';

async function diagnose() {
    console.log('--- STARTING WHATSAPP DIAGNOSIS ---');

    // 1. Check DB Connection
    try {
        await databasePool.query('SELECT 1');
        console.log('✅ Database connection OK');
    } catch (e) {
        console.error('❌ Database connection FAILED:', e);
        process.exit(1);
    }

    // 2. Initialize Client
    console.log('Initializing WhatsApp Client...');
    const client = WhatsAppClient.getInstance();

    // Hook events directly here to see if they fire
    WhatsAppEvents.on('message', (msg) => {
        console.log('🔍 [DIAGNOSTIC] Event "message" fired!');
        console.log('   from:', msg.key.remoteJid);
        console.log('   content:', JSON.stringify(msg.message).substring(0, 50) + '...');
    });

    WhatsAppEvents.on('ready', () => {
        console.log('🔍 [DIAGNOSTIC] Event "ready" fired!');
    });

    WhatsAppEvents.on('qr', (qr) => {
        console.log('🔍 [DIAGNOSTIC] Event "qr" fired!');
    });

    await client.initialize();
    WhatsAppHandler.initialize();

    console.log('✅ Initialization Sequence Complete');
    console.log('⏳ Waiting for events... (Press Ctrl+C to stop)');

    // Keep alive
    setInterval(() => {
        const status = client.getStatus();
        console.log(`[STATUS CHECK] Ready: ${status.ready}, Init: ${status.initializing}, QR: ${status.hasQRCode}`);
    }, 5000);
}

diagnose().catch(console.error);
