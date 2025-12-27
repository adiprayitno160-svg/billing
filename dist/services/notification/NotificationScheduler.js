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
     * Initialize scheduler
     */
    static initialize() {
        if (this.cronJob) {
            console.log('Notification scheduler already initialized');
            return;
        }
        // Run every 2 minutes to process pending notifications
        this.cronJob = cron.schedule('*/2 * * * *', async () => {
            if (this.isRunning) {
                console.log('[NotificationScheduler] Already running, skipping...');
                return;
            }
            this.isRunning = true;
            try {
                const result = await UnifiedNotificationService_1.UnifiedNotificationService.sendPendingNotifications(50);
                console.log(`[NotificationScheduler] Processed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
            }
            catch (error) {
                console.error('[NotificationScheduler] Error processing notifications:', error);
            }
            finally {
                this.isRunning = false;
            }
        });
        // Also run daily at 8 AM to check for overdue invoices
        cron.schedule('0 8 * * *', async () => {
            try {
                await this.checkOverdueInvoices();
            }
            catch (error) {
                console.error('[NotificationScheduler] Error checking overdue invoices:', error);
            }
        });
        console.log('✅ Notification scheduler initialized');
    }
    /**
     * Check and notify overdue invoices
     */
    static async checkOverdueInvoices() {
        const connection = await pool_1.databasePool.getConnection();
        try {
            // Get invoices that are overdue and haven't been notified today
            const [invoices] = await connection.query(`SELECT i.id, i.customer_id, i.invoice_number, i.due_date, i.remaining_amount
         FROM invoices i
         WHERE i.status IN ('sent', 'partial', 'overdue')
           AND i.due_date < CURDATE()
           AND i.remaining_amount > 0
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
     * Manually trigger notification processing
     */
    static async processNow() {
        return await UnifiedNotificationService_1.UnifiedNotificationService.sendPendingNotifications(100);
    }
}
exports.NotificationScheduler = NotificationScheduler;
NotificationScheduler.cronJob = null;
NotificationScheduler.isRunning = false;
//# sourceMappingURL=NotificationScheduler.js.map