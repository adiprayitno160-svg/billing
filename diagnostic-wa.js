
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

console.log('--- DIAGNOSTIC SCRIPT START ---');

const sessionPath = path.join(process.cwd(), '.test_auth_session');

if (fs.existsSync(sessionPath)) {
    console.log(`[Diagnostic] Clearing old session at ${sessionPath}`);
    fs.rmSync(sessionPath, { recursive: true, force: true });
}

console.log('[Diagnostic] Initializing Client...');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'test_client',
        dataPath: sessionPath
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-extensions',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('[Diagnostic] QR RECEIVED!');
    console.log('[Diagnostic] Scan this QR Code logic is working.');
    // qrcode.generate(qr, { small: true }); // Need qrcode-terminal package, but let's just log existence
    console.log('QR String Length:', qr.length);
    console.log('QR String Start:', qr.substring(0, 20));
});

client.on('ready', () => {
    console.log('[Diagnostic] CLIENT IS READY!');
    console.log('[Diagnostic] Connection Successful.');
    client.destroy().then(() => {
        console.log('[Diagnostic] Destroyed client. Test Passed.');
        process.exit(0);
    });
});

client.on('authenticated', () => {
    console.log('[Diagnostic] AUTHENTICATED');
});

client.on('auth_failure', (msg) => {
    console.error('[Diagnostic] AUTH FAILURE:', msg);
    process.exit(1);
});

client.on('disconnected', (reason) => {
    console.log('[Diagnostic] DISCONNECTED:', reason);
});

console.log('[Diagnostic] Calling client.initialize()...');
client.initialize().catch(err => {
    console.error('[Diagnostic] INITIALIZE ERROR:', err);
    process.exit(1);
});
