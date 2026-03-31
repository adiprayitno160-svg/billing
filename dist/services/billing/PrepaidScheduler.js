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
exports.PrepaidScheduler = void 0;
const cron = __importStar(require("node-cron"));
const pool_1 = require("../../db/pool");
const PrepaidService_1 = require("../billing/PrepaidService");
/**
 * Prepaid Scheduler
 * Handles automated tasks for prepaid billing system
 */
class PrepaidScheduler {
    /**
     * Initialize prepaid scheduler
     */
    static initialize() {
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
    static async checkExpiredCustomers() {
        console.log('[PrepaidScheduler] 🔍 Checking for expired customers...');
        let processed = 0;
        let disabled = 0;
        let errors = 0;
        try {
            const expiredCustomers = await PrepaidService_1.PrepaidService.getExpiredCustomers();
            console.log(`[PrepaidScheduler] Found ${expiredCustomers.length} expired customers`);
            for (const customer of expiredCustomers) {
                processed++;
                try {
                    // Disable PPPoE in Mikrotik
                    if (customer.pppoe_username) {
                        const { getMikrotikConfig } = await Promise.resolve().then(() => __importStar(require('../pppoeService')));
                        const { updatePppoeSecret } = await Promise.resolve().then(() => __importStar(require('../mikrotikService')));
                        const config = await getMikrotikConfig();
                        if (config) {
                            await updatePppoeSecret(config, customer.pppoe_username, { disabled: true });
                            console.log(`[PrepaidScheduler] ✅ Disabled PPPoE: ${customer.pppoe_username}`);
                            disabled++;
                        }
                    }
                    // Mark as isolated in database
                    await pool_1.databasePool.execute('UPDATE customers SET is_isolated = 1 WHERE id = ?', [customer.id]);
                    // Send WhatsApp notification
                    if (customer.phone) {
                        await this.sendExpiryNotification(customer);
                    }
                }
                catch (custError) {
                    console.error(`[PrepaidScheduler] ❌ Error processing customer ${customer.id}:`, custError);
                    errors++;
                }
            }
            console.log(`[PrepaidScheduler] ✅ Completed: ${processed} processed, ${disabled} disabled, ${errors} errors`);
        }
        catch (error) {
            console.error('[PrepaidScheduler] ❌ Fatal error in expiry checker:', error);
            errors++;
        }
        return { processed, disabled, errors };
    }
    /**
     * Send expiry notification to customer
     */
    static async sendExpiryNotification(customer) {
        try {
            const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../whatsapp/WhatsAppService')));
            const message = `Halo ${customer.name}, masa aktif layanan prepaid Anda telah berakhir hari ini. Layanan Anda sementara dinonaktifkan. Silakan lakukan pembayaran tagihan untuk mengaktifkan kembali layanan Anda. Terima kasih.`;
            await whatsappService.sendMessage(customer.phone, message);
            console.log(`[PrepaidScheduler] 📱 Notification sent to ${customer.name} (${customer.phone})`);
        }
        catch (notifError) {
            console.error(`[PrepaidScheduler] ⚠️ Failed to send notification:`, notifError);
        }
    }
    /**
     * Stop all scheduled jobs
     */
    static stop() {
        if (this.expiryCheckJob) {
            this.expiryCheckJob.stop();
            console.log('[PrepaidScheduler] Stopped');
        }
    }
    /**
     * Get scheduler status
     */
    static getStatus() {
        return {
            running: this.expiryCheckJob !== null
        };
    }
}
exports.PrepaidScheduler = PrepaidScheduler;
PrepaidScheduler.expiryCheckJob = null;
//# sourceMappingURL=PrepaidScheduler.js.map