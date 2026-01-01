import * as cron from 'node-cron';
import { databasePool } from '../../db/pool';
import { PrepaidService } from '../billing/PrepaidService';

/**
 * Prepaid Scheduler
 * Handles automated tasks for prepaid billing system
 */
export class PrepaidScheduler {
    private static expiryCheckJob: cron.ScheduledTask | null = null;

    /**
     * Initialize prepaid scheduler
     */
    static initialize(): void {
        console.log('[PrepaidScheduler] Initializing...');

        // Check for expired prepaid customers every 30 minutes
        this.expiryCheckJob = cron.schedule('*/30 * * * *', async () => {
            await this.checkExpiredCustomers();
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta"
        });

        console.log('[PrepaidScheduler] ✅ Initialized - Running every 30 minutes');
    }

    /**
     * Check and disable expired prepaid customers
     */
    static async checkExpiredCustomers(): Promise<{ processed: number; disabled: number; errors: number }> {
        console.log('[PrepaidScheduler] 🔍 Checking for expired customers...');

        let processed = 0;
        let disabled = 0;
        let errors = 0;

        try {
            const expiredCustomers = await PrepaidService.getExpiredCustomers();
            console.log(`[PrepaidScheduler] Found ${expiredCustomers.length} expired customers`);

            for (const customer of expiredCustomers) {
                processed++;

                try {
                    // Disable PPPoE in Mikrotik
                    if (customer.pppoe_username) {
                        const { getMikrotikConfig } = await import('../pppoeService');
                        const { updatePppoeSecret } = await import('../mikrotikService');

                        const config = await getMikrotikConfig();
                        if (config) {
                            await updatePppoeSecret(config, customer.pppoe_username, { disabled: true });
                            console.log(`[PrepaidScheduler] ✅ Disabled PPPoE: ${customer.pppoe_username}`);
                            disabled++;
                        }
                    }

                    // Mark as isolated in database
                    await databasePool.execute(
                        'UPDATE customers SET is_isolated = 1 WHERE id = ?',
                        [customer.id]
                    );

                    // Send WhatsApp notification
                    if (customer.phone) {
                        await this.sendExpiryNotification(customer);
                    }

                } catch (custError: any) {
                    console.error(`[PrepaidScheduler] ❌ Error processing customer ${customer.id}:`, custError);
                    errors++;
                }
            }

            console.log(`[PrepaidScheduler] ✅ Completed: ${processed} processed, ${disabled} disabled, ${errors} errors`);

        } catch (error: any) {
            console.error('[PrepaidScheduler] ❌ Fatal error in expiry checker:', error);
            errors++;
        }

        return { processed, disabled, errors };
    }

    /**
     * Send expiry notification to customer
     */
    private static async sendExpiryNotification(customer: any): Promise<void> {
        try {
            const { WhatsAppServiceBaileys } = await import('../whatsapp/WhatsAppServiceBaileys');

            const expiryDate = new Date(customer.expiry_date);
            const message = `⚠️ *MASA AKTIF HABIS*\n\n` +
                `Halo *${customer.name}*,\n\n` +
                `Masa aktif paket internet Anda telah berakhir pada:\n` +
                `📅 ${expiryDate.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}\n\n` +
                `🔒 *Internet Anda telah dinonaktifkan.*\n\n` +
                `💡 *Cara Aktivasi Kembali:*\n` +
                `1️⃣ Ketik */beli* untuk melihat paket\n` +
                `2️⃣ Pilih paket yang diinginkan\n` +
                `3️⃣ Transfer sesuai nominal\n` +
                `4️⃣ Kirim bukti transfer\n` +
                `5️⃣ Internet aktif otomatis!\n\n` +
                `Terima kasih atas pengertiannya 🙏`;

            await WhatsAppServiceBaileys.sendMessage(customer.phone, message);
            console.log(`[PrepaidScheduler] 📱 Notification sent to ${customer.name} (${customer.phone})`);

        } catch (notifError: any) {
            console.error(`[PrepaidScheduler] ⚠️ Failed to send notification:`, notifError);
        }
    }

    /**
     * Stop all scheduled jobs
     */
    static stop(): void {
        if (this.expiryCheckJob) {
            this.expiryCheckJob.stop();
            console.log('[PrepaidScheduler] Stopped');
        }
    }

    /**
     * Get scheduler status
     */
    static getStatus(): { running: boolean } {
        return {
            running: this.expiryCheckJob !== null
        };
    }
}
