"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const BaileysWhatsAppService_1 = require("../services/whatsapp/BaileysWhatsAppService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
async function repairWhatsApp() {
    console.log('🚀 Starting WhatsApp Service Repair...');
    try {
        // 1. Destroy existing client
        console.log('Step 1: Destroying current client if any...');
        try {
            await BaileysWhatsAppService_1.BaileysWhatsAppService.destroy();
        }
        catch (e) {
            console.log('Info: Client was not active or failed to destroy.');
        }
        // 2. Kill all chromium processes (forceful)
        console.log('Step 2: Killing potential zombie browser processes...');
        if (process.platform === 'linux') {
            try {
                await execAsync('pkill -f chrome || true');
                await execAsync('pkill -f chromium || true');
                console.log('✅ Killed Linux chrome/chromium processes.');
            }
            catch (e) { }
        }
        else {
            try {
                await execAsync('taskkill /F /IM chrome.exe /T || true');
                await execAsync('taskkill /F /IM chromium.exe /T || true');
                console.log('✅ Killed Windows chrome/chromium processes.');
            }
            catch (e) { }
        }
        // 3. Wipe session folder
        console.log('Step 3: Wiping baileys-session folder...');
        const sessionPath = path.join(process.cwd(), 'baileys-session');
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('✅ Session folder deleted.');
        }
        else {
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
        await BaileysWhatsAppService_1.BaileysWhatsAppService.initialize();
        console.log('✅ WhatsApp initialization command sent.');
        console.log('📱 Please wait about 10-20 seconds, then check /settings/whatsapp for the NEW QR Code.');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Repair failed:', error);
        process.exit(1);
    }
}
repairWhatsApp();
//# sourceMappingURL=repair_wa.js.map