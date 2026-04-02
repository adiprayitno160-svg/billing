"use strict";
/**
 * Notification Scheduler
 * Automatically processes and sends pending notifications
 */
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
exports.NotificationScheduler = void 0;
const cron = __importStar(require("node-cron"));
const UnifiedNotificationService_1 = require("./UnifiedNotificationService");
const pool_1 = require("../../db/pool");
class NotificationScheduler {
    /**
     * Check if the scheduler is in rest period (anti-spam)
     */
    static checkWorkRestCycle() {
        const now = Date.now();
        if (this.isResting) {
            const restElapsed = now - this.restStartTime;
            if (restElapsed >= this.REST_DURATION_MS) {
                // Rest period over, start new work cycle
                this.isResting = false;
                this.cycleStartTime = now;
                this.totalSentInCycle = 0;
                console.log(`[NotificationScheduler] ✅ Rest period over (${Math.round(restElapsed / 1000)}s). Resuming notification delivery...`);
                return true; // Can work
            }
            // Still resting
            return false;
        }
        // Currently working - check if work period exceeded
        const workElapsed = now - this.cycleStartTime;
        if (workElapsed >= this.WORK_DURATION_MS && this.totalSentInCycle > 0) {
            // Work period over, start rest
            this.isResting = true;
            this.restStartTime = now;
            console.log(`[NotificationScheduler] 😴 Anti-spam pause activated. Sent ${this.totalSentInCycle} in ${Math.round(workElapsed / 1000)}s. Pausing for ${this.REST_DURATION_MS / 1000}s...`);
            return false;
        }
        return true; // Can work
    }
    /**
     * Initialize scheduler
     */
    static initialize() {
        if (this.cronJob) {
            console.log('Notification scheduler already initialized');
            return;
        }
        // Run every 1 minute to process pending notifications
        // User requested 5 messages per minute max with 12s interval
        this.cronJob = cron.schedule('0 * * * * *', async () => {
            if (this.isRunning) {
                // If running for more than 5 minutes, force reset (zombie check)
                const diff = Date.now() - (this.lastRunTime || 0);
                if (diff > 300000 && this.lastRunTime > 0) {
                    console.warn('[NotificationScheduler] ⚠️ Force resetting stuck scheduler (stalled for >5m)');
                    this.isRunning = false;
                }
                else {
                    return;
                }
            }
            // Anti-spam: Check work/rest cycle
            if (!this.checkWorkRestCycle()) {
                return; // In rest period, skip this tick
            }
            this.isRunning = true;
            this.lastRunTime = Date.now();
            try {
                // Limit 5 messages per minute as requested
                const result = await UnifiedNotificationService_1.UnifiedNotificationService.sendPendingNotifications(5);
                if (result.sent > 0 || result.failed > 0) {
                    this.totalSentInCycle += result.sent;
                    console.log(`[NotificationScheduler] 📨 Processed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped (cycle total: ${this.totalSentInCycle})`);
                }
            }
            catch (error) {
                console.error('[NotificationScheduler] ❌ Error processing notifications:', error);
            }
            finally {
                this.isRunning = false;
            }
        });
        // Run Cleanup Daily 3 AM
        cron.schedule('0 3 * * *', async () => {
            await this.cleanupOldLogs();
        });
        // DISABLED per user request to stop monitoring notifications
        // // Run Network Monitoring Check every 5 minutes
        // cron.schedule('*/5 * * * *', async () => {
        //   try {
        //     await NetworkMonitoringService.checkAutoOutageJobs();
        //     // Check for Auto-Complaint Escalations
        //     await AIDiagnosticsService.processEscalations();
        //   } catch (error) {
        //     console.error('[NotificationScheduler] Error in monitoring check:', error);
        //   }
        // });
        // DISABLED per user request - only isolation notifications are active
        // Run daily at 8 AM to check for overdue invoices
        // cron.schedule('0 8 * * *', async () => {
        //   try {
        //     await this.checkOverdueInvoices();
        //   } catch (error) {
        //     console.error('[NotificationScheduler] Error checking overdue invoices:', error);
        //   }
        // });
        // DISABLED per user request - only isolation notifications are active
        // Run Monthly on 20th at 9 AM for Payment Reminders
        // cron.schedule('0 9 20 * *', async () => {
        //   try {
        //     console.log('[NotificationScheduler] Running monthly payment reminders (20th)...');
        //     await this.checkMonthlyInvoiceReminders();
        //   } catch (error) {
        //     console.error('[NotificationScheduler] Error sending monthly reminders:', error);
        //   }
        // });
        // Auto-retry failed notifications every hour (only those with retry_count < max_retries)
        cron.schedule('0 * * * *', async () => {
            try {
                console.log('[NotificationScheduler] 🔄 Auto-retrying failed notifications...');
                await this.retryFailedNotifications();
            }
            catch (error) {
                console.error('[NotificationScheduler] Error retrying failed notifications:', error);
            }
        });
        console.log('✅ Notification scheduler initialized');
    }
    /**
     * Check and notify overdue invoices
     */
    static async checkOverdueInvoices() {
        const todayDay = new Date().getDate();
        if (todayDay < 20) {
            console.log(`[NotificationScheduler] ⏸️ Skipping checkOverdueInvoices because today (${todayDay}) is before the 20th.`);
            return;
        }
        const connection = await pool_1.databasePool.getConnection();
        try {
            // Get invoices that are overdue and haven't been notified today
            const [invoices] = await connection.query(`SELECT i.id, i.customer_id, i.invoice_number, i.due_date, i.remaining_amount
         FROM invoices i
         WHERE i.status IN ('sent', 'overdue')
           AND i.due_date < CURDATE()
           AND CAST(i.remaining_amount AS DECIMAL(10,2)) > 100
           AND DATEDIFF(CURDATE(), i.due_date) IN (1, 3, 7, 14, 21, 28)
           AND NOT EXISTS (
             SELECT 1 FROM unified_notifications_queue unq
             WHERE unq.invoice_id = i.id
               AND unq.notification_type = 'invoice_overdue'
               AND DATE(unq.created_at) = CURDATE()
           )
         LIMIT 100`);
            console.log(`[NotificationScheduler] Found ${invoices.length} overdue invoices to notify`);
            for (const invoice of invoices) {
                try {
                    await UnifiedNotificationService_1.UnifiedNotificationService.notifyInvoiceOverdue(invoice.id);
                }
                catch (error) {
                    console.error(`[NotificationScheduler] Error notifying invoice ${invoice.id}:`, error);
                }
            }
        }
        finally {
            connection.release();
        }
    }
    /**
     * Check and notify monthly reminders (20th)
     */
    static async checkMonthlyInvoiceReminders() {
        const connection = await pool_1.databasePool.getConnection();
        try {
            // Get unpaid invoices
            const [invoices] = await connection.query(`SELECT i.id
         FROM invoices i
         WHERE i.status IN ('sent')
           AND CAST(i.remaining_amount AS DECIMAL(10,2)) > 100
           AND NOT EXISTS (
             SELECT 1 FROM unified_notifications_queue unq
             WHERE unq.invoice_id = i.id
               AND unq.notification_type = 'invoice_reminder'
               AND DATE(unq.created_at) = CURDATE()
           )`);
            console.log(`[NotificationScheduler] Found ${invoices.length} invoices for monthly reminder`);
            for (const invoice of invoices) {
                try {
                    await UnifiedNotificationService_1.UnifiedNotificationService.notifyInvoiceReminder(invoice.id);
                }
                catch (error) {
                    console.error(`[NotificationScheduler] Error notifying reminder for invoice ${invoice.id}:`, error);
                }
            }
        }
        finally {
            connection.release();
        }
    }
    /**
     * Cleanup old notification logs
     */
    static async cleanupOldLogs() {
        console.log('[NotificationScheduler] 🧹 Starting notification cleanup...');
        const connection = await pool_1.databasePool.getConnection();
        try {
            const [result] = await connection.query("DELETE FROM unified_notifications_queue WHERE created_at < DATE_SUB(NOW(), INTERVAL 60 DAY) AND status IN ('sent', 'skipped')");
            console.log(`[NotificationScheduler] 🧹 Cleaned up ${result.affectedRows} old notifications`);
        }
        catch (error) {
            console.error('[NotificationScheduler] ❌ Cleanup failed:', error);
        }
        finally {
            connection.release();
        }
    }
    /**
     * Stop scheduler
     */
    static stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('Notification scheduler stopped');
        }
    }
    /**
     * Retry failed notifications that haven't exceeded max retries
     */
    static async retryFailedNotifications() {
        const connection = await pool_1.databasePool.getConnection();
        try {
            // Reset failed notifications where retry_count < max_retries
            const [result] = await connection.query(`UPDATE unified_notifications_queue 
         SET status = 'pending', 
             retry_count = retry_count + 1,
             error_message = CONCAT(IFNULL(error_message, ''), ' [Auto-retry at ', NOW(), ']'),
             updated_at = NOW()
         WHERE status = 'failed' 
         AND retry_count < max_retries
         AND customer_id IS NOT NULL`);
            if (result.affectedRows > 0) {
                console.log(`[NotificationScheduler] ✅ Reset ${result.affectedRows} failed notifications for retry`);
            }
        }
        catch (error) {
            console.error('[NotificationScheduler] ❌ Failed to retry notifications:', error);
        }
        finally {
            connection.release();
        }
    }
    /**
     * Manually trigger notification processing
     */
    static async processNow() {
        return await UnifiedNotificationService_1.UnifiedNotificationService.sendPendingNotifications(100);
    }
}
exports.NotificationScheduler = NotificationScheduler;
NotificationScheduler.cronJob = null;
NotificationScheduler.isRunning = false;
NotificationScheduler.lastRunTime = 0;
// Anti-spam work/rest cycle: 3 minutes active, 2 minutes pause
NotificationScheduler.WORK_DURATION_MS = 3 * 60 * 1000; // 3 minutes active
NotificationScheduler.REST_DURATION_MS = 2 * 60 * 1000; // 2 minutes pause
NotificationScheduler.cycleStartTime = Date.now();
NotificationScheduler.isResting = false;
NotificationScheduler.restStartTime = 0;
NotificationScheduler.totalSentInCycle = 0;
//# sourceMappingURL=NotificationScheduler.js.map