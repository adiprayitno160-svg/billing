"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FoonteProvider = void 0;
const axios_1 = __importDefault(require("axios"));
class FoonteProvider {
    constructor() {
        this.token = process.env.FOONTE_TOKEN || '';
    }
    static getInstance() {
        if (!FoonteProvider.instance) {
            FoonteProvider.instance = new FoonteProvider();
        }
        return FoonteProvider.instance;
    }
    isConfigured() {
        return !!process.env.FOONTE_TOKEN;
    }
    /**
     * Send message via Foonte API
     */
    async sendMessage(to, message) {
        const token = process.env.FOONTE_TOKEN;
        if (!token) {
            console.warn('[Foonte] Token not configured. Skipping fallback.');
            return false;
        }
        try {
            console.log(`[Foonte] Attempting to send message to ${to}...`);
            // Foonte requires 628xxx format
            let target = to.replace(/\D/g, '');
            if (target.startsWith('0'))
                target = '62' + target.substring(1);
            if (!target.startsWith('62'))
                target = '62' + target;
            // Use URLSearchParams for x-www-form-urlencoded (preferred by Foonte)
            const params = new URLSearchParams();
            params.append('target', target);
            params.append('message', message);
            const response = await axios_1.default.post('https://api.fonnte.com/send', params, {
                headers: {
                    'Authorization': token
                }
            });
            console.log('[Foonte] Response:', response.data);
            // Foonte can return { status: true, ... } or { status: false, reason: ... }
            const success = response.data && response.data.status;
            if (success) {
                console.log(`[Foonte] ✅ Message sent successfully to ${to}`);
                return true;
            }
            else {
                console.error(`[Foonte] ❌ API returned error:`, response.data);
                return false;
            }
        }
        catch (error) {
            console.error('[Foonte] Request failed:', error.message);
            if (error.response) {
                console.error('[Foonte] Error details:', error.response.data);
            }
            return false;
        }
    }
}
exports.FoonteProvider = FoonteProvider;
//# sourceMappingURL=FoonteProvider.js.map