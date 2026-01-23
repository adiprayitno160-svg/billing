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
            const { whatsappService } = await import('../whatsapp/WhatsAppService');
            const message = `Halo ${customer.name}, masa aktif layanan prepaid Anda telah berakhir hari ini. Layanan Anda sementara dinonaktifkan. Silakan lakukan pembayaran tagihan untuk mengaktifkan kembali layanan Anda. Terima kasih.`;
            await whatsappService.sendMessage(customer.phone, message);
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
