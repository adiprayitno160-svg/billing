
import { WhatsAppService } from './src/services/whatsapp/WhatsAppService';

async function checkStatus() {
    try {
        console.log('--- WhatsApp Service Status Check ---');

        console.log('Initializing WhatsApp Service...');
        // Initialize with timeout to avoid hanging if QR gen takes time
        const initPromise = WhatsAppService.initialize();

        // Wait up to 10 seconds for init
        await Promise.race([
            initPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Initialization timeout')), 10000))
        ]).catch(err => console.log('Init info:', err.message));

        const status = WhatsAppService.getStatus();
        console.log('Status:', JSON.stringify(status, null, 2));

        const qr = WhatsAppService.getQRCode();
        console.log('Has QR Code:', !!qr);

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

checkStatus();
