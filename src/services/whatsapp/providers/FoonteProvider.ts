
import axios from 'axios';
import { databasePool } from '../../../db/pool';

export class FoonteProvider {
    private static instance: FoonteProvider;
    private token: string;

    private constructor() {
        this.token = process.env.FOONTE_TOKEN || '';
    }

    public static getInstance(): FoonteProvider {
        if (!FoonteProvider.instance) {
            FoonteProvider.instance = new FoonteProvider();
        }
        return FoonteProvider.instance;
    }

    public isConfigured(): boolean {
        return !!process.env.FOONTE_TOKEN;
    }

    /**
     * Send message via Foonte API
     */
    public async sendMessage(to: string, message: string): Promise<boolean> {
        const token = process.env.FOONTE_TOKEN;
        if (!token) {
            console.warn('[Foonte] Token not configured. Skipping fallback.');
            return false;
        }

        try {
            console.log(`[Foonte] Attempting to send message to ${to}...`);

            // Foonte requires 628xxx format
            let target = to.replace(/\D/g, '');
            if (target.startsWith('0')) target = '62' + target.substring(1);
            if (!target.startsWith('62')) target = '62' + target;

            // Use URLSearchParams for x-www-form-urlencoded (preferred by Foonte)
            const params = new URLSearchParams();
            params.append('target', target);
            params.append('message', message);

            const response = await axios.post('https://api.fonnte.com/send', params, {
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
            } else {
                console.error(`[Foonte] ❌ API returned error:`, response.data);
                return false;
            }

        } catch (error: any) {
            console.error('[Foonte] Request failed:', error.message);
            if (error.response) {
                console.error('[Foonte] Error details:', error.response.data);
            }
            return false;
        }
    }
}
