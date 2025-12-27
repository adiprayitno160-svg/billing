
import { WhatsAppService } from '../services/whatsapp/WhatsAppService';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function repairWhatsApp() {
    console.log('🚀 Starting WhatsApp Service Repair...');

    try {
        // 1. Destroy existing client
        console.log('Step 1: Destroying current client if any...');
        try {
            await WhatsAppService.destroy();
        } catch (e) {
            console.log('Info: Client was not active or failed to destroy.');
        }

        // 2. Kill all chromium processes (forceful)
        console.log('Step 2: Killing potential zombie browser processes...');
        if (process.platform === 'linux') {
            try {
                await execAsync('pkill -f chrome || true');
                await execAsync('pkill -f chromium || true');
                console.log('✅ Killed Linux chrome/chromium processes.');
            } catch (e) { }
        } else {
            try {
                await execAsync('taskkill /F /IM chrome.exe /T || true');
                await execAsync('taskkill /F /IM chromium.exe /T || true');
                console.log('✅ Killed Windows chrome/chromium processes.');
            } catch (e) { }
        }

        // 3. Wipe session folder
        console.log('Step 3: Wiping baileys-session folder...');
        const sessionPath = path.join(process.cwd(), 'baileys-session');
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('✅ Session folder deleted.');
        } else {
            console.log('ℹ️ No session folder found.');
        }

        // 4. Wipe cache
        const cachePath = path.join(process.cwd(), '.wwebjs_cache');
        if (fs.existsSync(cachePath)) {
            fs.rmSync(cachePath, { recursive: true, force: true });
            console.log('✅ Cache deleted.');
        }

        console.log('✨ Cleanup complete! Now re-initializing...');

        // 5. Re-initialize
        await WhatsAppService.initialize();
        console.log('✅ WhatsApp initialization command sent.');
        console.log('📱 Please wait about 10-20 seconds, then check /settings/whatsapp for the NEW QR Code.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Repair failed:', error);
        process.exit(1);
    }
}

repairWhatsApp();
