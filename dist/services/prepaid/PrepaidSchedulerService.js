"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("../../db/pool"));
const node_cron_1 = __importDefault(require("node-cron"));
const PrepaidActivationService_1 = __importDefault(require("./PrepaidActivationService"));
const AddressListService_1 = __importDefault(require("./AddressListService"));
// WhatsApp service removed
/**
 * Scheduler service untuk prepaid system
 * - Check expired packages
 * - Send expiry reminders
 * - Auto-suspend expired customers
 */
class PrepaidSchedulerService {
    constructor() {
        this.expiryCheckTask = null;
        this.reminderTask = null;
    }
    /**
     * Initialize all schedulers
     */
    async initialize() {
        console.log('🔄 Initializing Prepaid Scheduler Service...');
        // Run expiry check every hour
        this.expiryCheckTask = node_cron_1.default.schedule('0 * * * *', async () => {
            console.log('⏰ Running prepaid package expiry check...');
            await this.checkExpiredPackages();
        });
        // Run reminder check daily at 08:00
        this.reminderTask = node_cron_1.default.schedule('0 8 * * *', async () => {
            console.log('⏰ Running prepaid expiry reminder check...');
            await this.sendExpiryReminders();
        });
        console.log('✅ Prepaid schedulers initialized');
        console.log('   - Expiry check: Every hour');
        console.log('   - Reminder check: Daily at 08:00');
        // Run initial check
        await this.checkExpiredPackages();
    }
    /**
     * Check and suspend expired packages
     */
    async checkExpiredPackages() {
        try {
            // Get expired packages that are still marked as active
            const [expiredSubs] = await pool_1.default.query(`SELECT 
          pps.*,
          c.customer_code,
          c.name as customer_name,
          c.phone,
          pp.name as package_name
         FROM prepaid_package_subscriptions pps
         INNER JOIN customers c ON pps.customer_id = c.id
         INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
         WHERE pps.status = 'active' 
           AND pps.expiry_date < NOW()
         ORDER BY pps.expiry_date ASC`);
            console.log(`Found ${expiredSubs.length} expired package(s)`);
            let suspended = 0;
            for (const sub of expiredSubs) {
                try {
                    const success = await PrepaidActivationService_1.default.deactivatePackage(sub.id, 'Package expired');
                    if (success) {
                        suspended++;
                        console.log(`✅ Suspended: ${sub.customer_name} (${sub.package_name})`);
                        // Send WhatsApp notification
                        try {
                            // WhatsApp notification removed
                            // await WhatsAppNotificationService.sendPrepaidExpiredNotification(sub.customer_id, sub);
                        }
                        catch (notifError) {
                            console.error(`Failed to send expiry notification to ${sub.customer_name}:`, notifError);
                        }
                    }
                }
                catch (error) {
                    console.error(`Failed to suspend subscription ${sub.id}:`, error);
                }
            }
            console.log(`✅ Expiry check complete: ${suspended}/${expiredSubs.length} suspended`);
            return {
                processed: expiredSubs.length,
                suspended: suspended
            };
        }
        catch (error) {
            console.error('Error checking expired packages:', error);
            return { processed: 0, suspended: 0 };
        }
    }
    /**
     * Send expiry reminders to customers expiring soon
     */
    async sendExpiryReminders() {
        try {
            // Get packages expiring in next 24-48 hours
            const [expiringSoon] = await pool_1.default.query(`SELECT 
          pps.*,
          c.customer_code,
          c.name as customer_name,
          c.phone,
          pp.name as package_name,
          pp.price,
          DATEDIFF(pps.expiry_date, NOW()) as days_remaining,
          TIMESTAMPDIFF(HOUR, NOW(), pps.expiry_date) as hours_remaining
         FROM prepaid_package_subscriptions pps
         INNER JOIN customers c ON pps.customer_id = c.id
         INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
         WHERE pps.status = 'active' 
           AND pps.expiry_date > NOW()
           AND pps.expiry_date < DATE_ADD(NOW(), INTERVAL 48 HOUR)
         ORDER BY pps.expiry_date ASC`);
            console.log(`Found ${expiringSoon.length} package(s) expiring soon`);
            let remindersSent = 0;
            for (const sub of expiringSoon) {
                try {
                    // Check if reminder already sent today
                    const [existingReminder] = await pool_1.default.query(`SELECT id FROM whatsapp_notification_logs 
             WHERE customer_id = ? 
               AND notification_type = 'expiry_reminder'
               AND DATE(sent_at) = CURDATE()`, [sub.customer_id]);
                    if (existingReminder.length > 0) {
                        console.log(`Reminder already sent today for ${sub.customer_name}`);
                        continue;
                    }
                    // Send WhatsApp reminder
                    try {
                        // WhatsApp notification removed
                        // const sent = await WhatsAppNotificationService.sendPrepaidExpiryReminder(sub.customer_id, sub);
                        const sent = false; // WhatsApp service no longer available
                        if (sent) {
                            console.log(`📱 Reminder sent to ${sub.customer_name} (expires in ${sub.hours_remaining}h)`);
                            remindersSent++;
                        }
                    }
                    catch (notifError) {
                        console.error(`Failed to send reminder to ${sub.customer_name}:`, notifError);
                    }
                }
                catch (error) {
                    console.error(`Failed to send reminder for subscription ${sub.id}:`, error);
                }
            }
            console.log(`✅ Sent ${remindersSent} expiry reminders`);
            return remindersSent;
        }
        catch (error) {
            console.error('Error sending expiry reminders:', error);
            return 0;
        }
    }
    /**
     * Get statistics for active prepaid customers
     */
    async getStatistics() {
        try {
            const [stats] = await pool_1.default.query(`SELECT 
          COUNT(DISTINCT CASE WHEN pps.status = 'active' AND pps.expiry_date > NOW() THEN pps.customer_id END) as active_customers,
          COUNT(DISTINCT CASE WHEN pps.status = 'active' AND pps.expiry_date < NOW() THEN pps.customer_id END) as expired_customers,
          COUNT(DISTINCT CASE WHEN pps.status = 'active' AND pps.expiry_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY) THEN pps.customer_id END) as expiring_soon,
          COUNT(DISTINCT CASE WHEN c.billing_mode = 'prepaid' AND pps.id IS NULL THEN c.id END) as no_package
         FROM customers c
         LEFT JOIN prepaid_package_subscriptions pps ON c.id = pps.customer_id AND pps.status = 'active'
         WHERE c.billing_mode = 'prepaid'`);
            return stats[0];
        }
        catch (error) {
            console.error('Error getting prepaid statistics:', error);
            return null;
        }
    }
    /**
     * Manual trigger untuk expiry check (untuk testing)
     */
    async triggerExpiryCheck() {
        console.log('🔄 Manual trigger: Expiry check');
        return await this.checkExpiredPackages();
    }
    /**
     * Manual trigger untuk reminder check (untuk testing)
     */
    async triggerReminderCheck() {
        console.log('🔄 Manual trigger: Reminder check');
        return await this.sendExpiryReminders();
    }
    /**
     * Stop all schedulers
     */
    stop() {
        if (this.expiryCheckTask) {
            this.expiryCheckTask.stop();
            console.log('⏹️  Stopped expiry check scheduler');
        }
        if (this.reminderTask) {
            this.reminderTask.stop();
            console.log('⏹️  Stopped reminder scheduler');
        }
    }
    /**
     * Get list of customers needing portal redirect
     */
    async getCustomersNeedingRedirect() {
        const [customers] = await pool_1.default.query(`SELECT 
        c.id,
        c.customer_code,
        c.name,
        c.phone,
        c.status,
        c.billing_mode,
        pps.id as subscription_id,
        pps.expiry_date
       FROM customers c
       LEFT JOIN prepaid_package_subscriptions pps ON c.id = pps.customer_id AND pps.status = 'active' AND pps.expiry_date > NOW()
       WHERE c.billing_mode = 'prepaid' 
         AND c.status IN ('active', 'suspended')
         AND pps.id IS NULL
       ORDER BY c.customer_code ASC`);
        return customers;
    }
    /**
     * Auto-add customers to portal redirect if no active package
     */
    async autoManagePortalRedirect() {
        let added = 0;
        let removed = 0;
        try {
            // Get customers needing redirect
            const needingRedirect = await this.getCustomersNeedingRedirect();
            for (const customer of needingRedirect) {
                const success = await AddressListService_1.default.addToPortalRedirect(customer.id, 'No active package');
                if (success)
                    added++;
            }
            console.log(`✅ Added ${added} customers to portal-redirect`);
            return { added, removed };
        }
        catch (error) {
            console.error('Error managing portal redirect:', error);
            return { added: 0, removed: 0 };
        }
    }
}
exports.default = new PrepaidSchedulerService();
//# sourceMappingURL=PrepaidSchedulerService.js.map