
import { UnifiedNotificationService } from './src/services/notification/UnifiedNotificationService';
import { whatsappService } from './src/services/whatsapp';

async function main() {
    console.log('--- Manual Queue Processor ---');
    try {
        // 1. Check WhatsApp Status
        const status = whatsappService.getStatus();
        console.log('WhatsApp Status:', JSON.stringify(status, null, 2));

        if (!status.ready) {
            console.log('WhatsApp is not ready. Attempting to wait...');
            // In a real scenario we'd need to be logged in. 
            // If this is local Laragon, maybe the QR hasn't been scanned.
        }

        console.log('Starting processing...');
        const result = await UnifiedNotificationService.sendPendingNotifications(5);
        console.log('Result:', JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error: any) {
        console.error('Fatal Error:', error.message);
        process.exit(1);
    }
}
main();
