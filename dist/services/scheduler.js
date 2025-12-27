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
exports.SchedulerService = void 0;
const cron = __importStar(require("node-cron"));
const invoiceService_1 = require("./billing/invoiceService");
// WhatsApp service removed
const isolationService_1 = require("./billing/isolationService");
const pool_1 = require("../db/pool");
const backupService_1 = require("./backupService");
class SchedulerService {
    /**
     * Initialize all scheduled tasks
     */
    static initialize() {
        if (this.isInitialized) {
            console.log('Scheduler already initialized');
            return;
        }
        console.log('Initializing billing scheduler...');
        // ========== ALUR BILLING BARU ==========
        // 1. Tanggal 1: Generate tagihan otomatis untuk bulan berjalan
        // 2. Jatuh tempo: Tanggal 28 bulan tersebut
        // 3. Tanggal 25-31: Kirim notifikasi peringatan blokir
        // 4. Tanggal 1 bulan berikutnya: Blokir otomatis yang belum bayar
        // Generate monthly invoices - tanggal 1 jam 00:10
        this.applyInvoiceScheduleFromDb().catch((err) => {
            console.error('Failed to apply Invoice Generation schedule, fallback to default (day 1 00:10):', err);
            this.scheduleInvoiceGeneration([1], 0, 10);
        });
        // Send payment reminders - controlled by settings
        this.applyReminderScheduleFromDb().catch((err) => {
            console.error('Failed to apply Payment Reminder schedule, fallback enabling at 08:00 daily:', err);
            this.schedulePaymentReminders(true);
        });
        // Auto isolate - tanggal 1 jam 00:00 (blokir yang belum bayar tagihan bulan sebelumnya)
        this.applyAutoIsolationScheduleFromDb().catch((err) => {
            console.error('Failed to apply Auto Isolation schedule from DB, falling back to default (day 1 00:00):', err);
            this.scheduleAutoIsolation([1], 0, 0); // Tanggal 1 jam 00:00
        });
        // Auto restore paid customers - setiap hari jam 06:00
        cron.schedule('0 6 * * *', async () => {
            console.log('Running auto restore for paid customers...');
            try {
                const result = await isolationService_1.IsolationService.autoRestorePaidCustomers();
                console.log(`Auto restored ${result.restored} customers, failed ${result.failed}`);
            }
            catch (error) {
                console.error('Error auto restoring customers:', error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta"
        });
        // Calculate SLA and apply discounts - setiap tanggal 1 jam 06:00
        cron.schedule('0 6 1 * *', async () => {
            console.log('Running SLA calculation and discount application...');
            try {
                await this.calculateSlaAndApplyDiscounts();
            }
            catch (error) {
                console.error('Error calculating SLA and applying discounts:', error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta"
        });
        // Send overdue notifications - controlled by settings
        this.applyOverdueScheduleFromDb().catch((err) => {
            console.error('Failed to apply Overdue Notification schedule, fallback enabling at 10:00 daily:', err);
            this.scheduleOverdueNotifications(true);
        });
        // Send isolation warnings 3 days before isolation - daily at 09:00
        // ALSO send warnings from 25th-31st of each month (before blocking on 1st)
        cron.schedule('0 9 * * *', async () => {
            const today = new Date();
            const dayOfMonth = today.getDate();
            // Send warnings from 25th to end of month (days before blocking on 1st)
            if (dayOfMonth >= 25) {
                console.log(`[Pre-Block Warning] Running on day ${dayOfMonth} - sending block warnings...`);
                try {
                    const { IsolationService } = await Promise.resolve().then(() => __importStar(require('./billing/isolationService')));
                    // Send warnings for unpaid invoices that will be blocked on 1st
                    const result = await IsolationService.sendPreBlockWarnings();
                    console.log(`[Pre-Block Warning] Sent: ${result.warned} warned, ${result.failed} failed`);
                }
                catch (error) {
                    console.error('Error sending pre-block warnings:', error);
                }
            }
            // Also send regular isolation warnings (3 days before deadline)
            console.log('Running isolation warnings (3 days before deadline)...');
            try {
                const { IsolationService } = await Promise.resolve().then(() => __importStar(require('./billing/isolationService')));
                const result = await IsolationService.sendIsolationWarnings(3);
                console.log(`Isolation warnings sent: ${result.warned} warned, ${result.failed} failed`);
            }
            catch (error) {
                console.error('Error sending isolation warnings:', error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta"
        });
        // Send payment shortage warnings - daily at 10:00 (for payments overdue >= 14 days)
        cron.schedule('0 10 * * *', async () => {
            console.log('Running payment shortage warnings (14+ days overdue)...');
            try {
                const { PaymentShortageService } = await Promise.resolve().then(() => __importStar(require('./billing/PaymentShortageService')));
                const result = await PaymentShortageService.checkAndNotifyShortages(14);
                console.log(`Payment shortage warnings: ${result.checked} checked, ${result.notified} notified, ${result.failed} failed`);
            }
            catch (error) {
                console.error('Error sending payment shortage warnings:', error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta"
        });
        // Daily late payment recalculation - every day at 00:30
        cron.schedule('30 0 * * *', async () => {
            console.log('Running daily late payment recalculation...');
            try {
                const { LatePaymentTrackingService } = await Promise.resolve().then(() => __importStar(require('./billing/LatePaymentTrackingService')));
                const result = await LatePaymentTrackingService.dailyRecalculation();
                console.log(`Late payment recalculation: ${result.processed} processed, ${result.errors} errors`);
            }
            catch (error) {
                console.error('Error in daily late payment recalculation:', error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta"
        });
        // Weekly database backup with 90-day retention - every Sunday at 02:00 Asia/Jakarta
        cron.schedule('0 2 * * 0', async () => {
            console.log('[Scheduler] Running weekly database backup...');
            const backup = new backupService_1.BackupService();
            try {
                const file = await backup.backupDatabase();
                const deleted = await backup.cleanOldBackups(90);
                console.log(`[Scheduler] Backup created: ${file}. Old backups deleted: ${deleted}`);
            }
            catch (error) {
                console.error('[Scheduler] Weekly backup failed:', error);
            }
        }, { scheduled: true, timezone: 'Asia/Jakarta' });
        this.isInitialized = true;
        console.log('Billing scheduler initialized successfully');
    }
    /**
     * Send invoice notifications via WhatsApp
     */
    static async sendInvoiceNotifications(invoiceIds) {
        try {
            // WhatsApp service removed
            // const whatsappService = new WhatsappService();
            // 
            // for (const invoiceId of invoiceIds) {
            //     const invoice = await InvoiceService.getInvoiceById(invoiceId);
            //     if (invoice && invoice.phone) {
            //         await whatsappService.sendInvoiceNotification(invoice);
            //     }
            // }
        }
        catch (error) {
            console.error('Error sending invoice notifications:', error);
        }
    }
    /**
     * Send payment reminders
     */
    static async sendPaymentReminders() {
        try {
            // WhatsApp service removed
            // const whatsappService = new WhatsappService();
            // Get invoices due in 3 days
            const dueIn3Days = new Date();
            dueIn3Days.setDate(dueIn3Days.getDate() + 3);
            const { databasePool } = await Promise.resolve().then(() => __importStar(require('../db/pool')));
            const query = `
                SELECT i.*, c.name as customer_name, c.phone
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.status IN ('sent', 'partial')
                AND i.due_date = $1
                AND c.phone IS NOT NULL
            `;
            const result = await databasePool.query(query, [dueIn3Days.toISOString().split('T')[0]]);
            for (const invoice of result) {
                // WhatsApp notification removed
                // await whatsappService.sendPaymentReminder(invoice);
            }
        }
        catch (error) {
            console.error('Error sending payment reminders:', error);
        }
    }
    /**
     * Send overdue notifications
     */
    static async sendOverdueNotifications() {
        try {
            // WhatsApp service removed
            // const whatsappService = new WhatsappService();
            const overdueInvoices = await invoiceService_1.InvoiceService.getOverdueInvoices();
            for (const invoice of overdueInvoices) {
                // WhatsApp notification removed
                // if (invoice.phone) {
                //     await whatsappService.sendOverdueNotification(invoice);
                // }
            }
        }
        catch (error) {
            console.error('Error sending overdue notifications:', error);
        }
    }
    /**
     * Calculate SLA and apply discounts
     */
    static async calculateSlaAndApplyDiscounts() {
        try {
            const { DiscountService } = await Promise.resolve().then(() => __importStar(require('./billing/discountService')));
            // Get previous month
            const currentDate = new Date();
            const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            const period = `${previousMonth.getFullYear()}-${(previousMonth.getMonth() + 1).toString().padStart(2, '0')}`;
            // Calculate SLA for all customers
            const slaResults = [];
            // Apply discounts based on SLA
            /*for (const result of slaResults) {
                if (result.compensation_amount > 0) {
                    await DiscountService.applySLADiscount(result.customer_id, period);
                }
            }*/
        }
        catch (error) {
            console.error('Error calculating SLA and applying discounts:', error);
        }
    }
    /**
     * Manual trigger for invoice generation
     */
    static async triggerMonthlyInvoices(period) {
        try {
            const invoiceIds = await invoiceService_1.InvoiceService.generateMonthlyInvoices(period);
            await this.sendInvoiceNotifications(invoiceIds);
            return invoiceIds;
        }
        catch (error) {
            console.error('Error triggering monthly invoices:', error);
            throw error;
        }
    }
    /**
     * Manual trigger for auto isolation
     */
    static async triggerAutoIsolation() {
        try {
            // IsolationService removed - functionality disabled
            // return await IsolationService.autoIsolateOverdueCustomers();
            return { isolated: 0, failed: 0 };
        }
        catch (error) {
            console.error('Error triggering auto isolation:', error);
            throw error;
        }
    }
    /**
     * Manual trigger for auto restore
     */
    static async triggerAutoRestore() {
        try {
            // IsolationService removed - functionality disabled
            // return await IsolationService.autoRestorePaidCustomers();
            return { restored: 0, failed: 0 };
        }
        catch (error) {
            console.error('Error triggering auto restore:', error);
            throw error;
        }
    }
    /**
     * Get scheduler status
     */
    static getStatus() {
        return {
            isRunning: this.isInitialized,
            initialized: this.isInitialized,
            lastRun: this.isInitialized ? 'Just now' : 'Never',
            nextRun: this.isInitialized ? 'Next scheduled run' : 'Not scheduled',
            totalJobs: 10,
            tasks: [
                'Monthly invoice generation (configurable days/time)',
                'Payment reminders (daily 08:00)',
                'Auto isolation (configurable days at 01:00)',
                'Auto restore (daily 06:00)',
                'SLA calculation (1st day 06:00)',
                'Overdue notifications (daily 10:00)',
                'Telegram monitoring (every 5 minutes)',
                'ONT status check (every 5 minutes)',
                'Customer isolation check (every 5 minutes)',
                'Daily system summary (daily 18:00)'
            ]
        };
    }
    // =============== INVOICE GENERATION SCHEDULING ===============
    static scheduleInvoiceGeneration(daysOfMonth, hour = 0, minute = 10) {
        for (const job of this.invoiceGenerationJobs) {
            try {
                job.stop();
            }
            catch { }
        }
        this.invoiceGenerationJobs = [];
        const uniqueDays = Array.from(new Set(daysOfMonth.filter(d => Number.isInteger(d) && d >= 1 && d <= 31)));
        if (uniqueDays.length === 0)
            uniqueDays.push(1);
        const h = Math.max(0, Math.min(23, Number(hour)));
        const m = Math.max(0, Math.min(59, Number(minute)));
        for (const day of uniqueDays) {
            const expression = `${m} ${h} ${day} * *`;
            const task = cron.schedule(expression, async () => {
                console.log(`[Invoice Generation] Running for day ${day} at ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                try {
                    const currentDate = new Date();
                    const period = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
                    const invoiceIds = await invoiceService_1.InvoiceService.generateMonthlyInvoices(period);
                    console.log(`Generated ${invoiceIds.length} invoices for period ${period}`);
                    await this.sendInvoiceNotifications(invoiceIds);
                }
                catch (error) {
                    console.error('Error generating monthly invoices:', error);
                }
            }, { scheduled: true, timezone: 'Asia/Jakarta' });
            this.invoiceGenerationJobs.push(task);
        }
        console.log(`[Invoice Generation] Scheduled for days: ${uniqueDays.join(', ')} at ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    static async applyInvoiceScheduleFromDb() {
        const [rows] = await pool_1.databasePool.execute(`SELECT cron_schedule, is_enabled FROM scheduler_settings WHERE task_name = 'monthly_invoice' LIMIT 1`);
        let days = null;
        let hour = 0;
        let minute = 10;
        let isActive = true;
        if (Array.isArray(rows) && rows.length > 0) {
            const row = rows[0];
            isActive = row.is_enabled !== 0 && row.is_enabled !== false;
            if (row.cron_schedule && typeof row.cron_schedule === 'string') {
                const [daysPart, timePart] = String(row.cron_schedule).split('|');
                days = (daysPart || '').split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
                if (timePart) {
                    const [hStr, mStr] = timePart.split(':');
                    const h = parseInt(hStr || '0', 10);
                    const m = parseInt(mStr || '0', 10);
                    if (!Number.isNaN(h))
                        hour = Math.max(0, Math.min(23, h));
                    if (!Number.isNaN(m))
                        minute = Math.max(0, Math.min(59, m));
                }
            }
        }
        if (!isActive) {
            for (const job of this.invoiceGenerationJobs) {
                try {
                    job.stop();
                }
                catch { }
            }
            this.invoiceGenerationJobs = [];
            console.log('[Invoice Generation] Disabled via settings');
            return;
        }
        this.scheduleInvoiceGeneration(days && days.length ? days : [1], hour, minute);
    }
    static async updateInvoiceSchedule(daysOfMonth, isActive = true, hour = 0, minute = 10) {
        const validDays = Array.from(new Set(daysOfMonth.filter(d => Number.isInteger(d) && d >= 1 && d <= 31)));
        const daysToSave = validDays.length ? validDays : [1];
        const h = Math.max(0, Math.min(23, Number(hour)));
        const m = Math.max(0, Math.min(59, Number(minute)));
        await pool_1.databasePool.execute(`INSERT INTO scheduler_settings (task_name, cron_schedule, description, is_enabled)
             VALUES ('monthly_invoice', ?, 'Generate monthly invoices', ?)
             ON DUPLICATE KEY UPDATE cron_schedule = VALUES(cron_schedule), is_enabled = VALUES(is_enabled), updated_at = CURRENT_TIMESTAMP`, [`${daysToSave.join(',')}|${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, isActive ? 1 : 0]);
        if (isActive) {
            this.scheduleInvoiceGeneration(daysToSave, h, m);
        }
        else {
            for (const job of this.invoiceGenerationJobs) {
                try {
                    job.stop();
                }
                catch { }
            }
            this.invoiceGenerationJobs = [];
            console.log('[Invoice Generation] Disabled');
        }
        return { days: daysToSave, isActive, hour: h, minute: m };
    }
    // =============== REMINDER/OVERDUE TOGGLES ===============
    static schedulePaymentReminders(enable) {
        if (this.paymentReminderJob) {
            try {
                this.paymentReminderJob.stop();
            }
            catch { }
            this.paymentReminderJob = null;
        }
        if (!enable) {
            console.log('[Payment Reminders] Disabled');
            return;
        }
        this.paymentReminderJob = cron.schedule('0 8 * * *', async () => {
            console.log('Running payment reminders...');
            try {
                await this.sendPaymentReminders();
            }
            catch (error) {
                console.error('Error sending payment reminders:', error);
            }
        }, { scheduled: true, timezone: 'Asia/Jakarta' });
        console.log('[Payment Reminders] Enabled at 08:00 daily');
    }
    static scheduleOverdueNotifications(enable) {
        if (this.overdueNotificationJob) {
            try {
                this.overdueNotificationJob.stop();
            }
            catch { }
            this.overdueNotificationJob = null;
        }
        if (!enable) {
            console.log('[Overdue Notifications] Disabled');
            return;
        }
        this.overdueNotificationJob = cron.schedule('0 10 * * *', async () => {
            console.log('Running overdue notifications...');
            try {
                await this.sendOverdueNotifications();
            }
            catch (error) {
                console.error('Error sending overdue notifications:', error);
            }
        }, { scheduled: true, timezone: 'Asia/Jakarta' });
        console.log('[Overdue Notifications] Enabled at 10:00 daily');
    }
    static async applyReminderScheduleFromDb() {
        const [rows] = await pool_1.databasePool.execute(`SELECT is_enabled FROM scheduler_settings WHERE task_name = 'payment_reminder' LIMIT 1`);
        let active = true;
        if (Array.isArray(rows) && rows.length > 0) {
            const row = rows[0];
            active = row.is_enabled !== 0 && row.is_enabled !== false;
        }
        this.schedulePaymentReminders(active);
    }
    static async applyOverdueScheduleFromDb() {
        const [rows] = await pool_1.databasePool.execute(`SELECT is_enabled FROM scheduler_settings WHERE task_name = 'overdue_notification' LIMIT 1`);
        let active = true;
        if (Array.isArray(rows) && rows.length > 0) {
            const row = rows[0];
            active = row.is_enabled !== 0 && row.is_enabled !== false;
        }
        this.scheduleOverdueNotifications(active);
    }
    static async updateNotificationSettings({ paymentReminderActive, overdueNotificationActive }) {
        if (typeof paymentReminderActive === 'boolean') {
            await pool_1.databasePool.execute(`INSERT INTO scheduler_settings (task_name, cron_schedule, description, is_enabled)
                 VALUES ('payment_reminder', '0 8 * * *', 'Send payment reminders - daily 08:00', ?)
                 ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_at = CURRENT_TIMESTAMP`, [paymentReminderActive ? 1 : 0]);
            this.schedulePaymentReminders(paymentReminderActive);
        }
        if (typeof overdueNotificationActive === 'boolean') {
            await pool_1.databasePool.execute(`INSERT INTO scheduler_settings (task_name, cron_schedule, description, is_enabled)
                 VALUES ('overdue_notification', '0 10 * * *', 'Send overdue notifications - daily 10:00', ?)
                 ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), updated_at = CURRENT_TIMESTAMP`, [overdueNotificationActive ? 1 : 0]);
            this.scheduleOverdueNotifications(overdueNotificationActive);
        }
    }
    /**
     * Schedule Auto Isolation jobs for given days of month (default 00:00 Asia/Jakarta)
     * HARUS dijalankan SEBELUM generate tagihan baru
     */
    static scheduleAutoIsolation(daysOfMonth, hour = 0, minute = 0) {
        // Clear previous jobs
        for (const job of this.autoIsolationJobs) {
            try {
                job.stop();
            }
            catch { }
        }
        this.autoIsolationJobs = [];
        const uniqueDays = Array.from(new Set(daysOfMonth.filter(d => Number.isInteger(d) && d >= 1 && d <= 31)));
        if (uniqueDays.length === 0) {
            uniqueDays.push(1);
        }
        const h = Math.max(0, Math.min(23, Number(hour)));
        const m = Math.max(0, Math.min(59, Number(minute)));
        for (const day of uniqueDays) {
            const expression = `${m} ${h} ${day} * *`;
            const task = cron.schedule(expression, async () => {
                console.log(`[Auto Isolation] Running for day ${day} at ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                try {
                    // Isolir pelanggan dengan tagihan bulan sebelumnya yang belum lunas
                    const result = await isolationService_1.IsolationService.autoIsolatePreviousMonthUnpaid();
                    console.log(`[Auto Isolation] Completed: ${result.isolated} isolated, ${result.failed} failed`);
                }
                catch (error) {
                    console.error('Error auto isolating customers:', error);
                }
            }, { scheduled: true, timezone: 'Asia/Jakarta' });
            this.autoIsolationJobs.push(task);
        }
        console.log(`[Auto Isolation] Scheduled for days: ${uniqueDays.join(', ')} at ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    /**
     * Read Auto Isolation schedule from DB and apply
     * We store comma-separated days in scheduler_settings.cron_schedule for task_name='auto_isolation'
     */
    static async applyAutoIsolationScheduleFromDb() {
        const [rows] = await pool_1.databasePool.execute(`SELECT cron_schedule, is_enabled FROM scheduler_settings WHERE task_name = 'auto_isolation' LIMIT 1`);
        let days = null;
        let isActive = true;
        let hour = 1;
        let minute = 0;
        if (Array.isArray(rows) && rows.length > 0) {
            const row = rows[0];
            isActive = row.is_enabled !== 0 && row.is_enabled !== false;
            if (row.cron_schedule && typeof row.cron_schedule === 'string') {
                // Support format: "days|HH:MM" or legacy "days"
                const [daysPart, timePart] = String(row.cron_schedule).split('|');
                days = (daysPart || '').split(',')
                    .map((s) => parseInt(s.trim(), 10))
                    .filter((n) => !Number.isNaN(n));
                if (timePart) {
                    const [hStr, mStr] = timePart.split(':');
                    const h = parseInt(hStr || '0', 10);
                    const m = parseInt(mStr || '0', 10);
                    if (!Number.isNaN(h))
                        hour = Math.max(0, Math.min(23, h));
                    if (!Number.isNaN(m))
                        minute = Math.max(0, Math.min(59, m));
                }
            }
        }
        if (!isActive) {
            // If disabled, clear jobs
            for (const job of this.autoIsolationJobs) {
                try {
                    job.stop();
                }
                catch { }
            }
            this.autoIsolationJobs = [];
            console.log('[Auto Isolation] Disabled via settings');
            return;
        }
        this.scheduleAutoIsolation(days && days.length ? days : [1], hour, minute);
    }
    /**
     * Update Auto Isolation schedule and re-schedule jobs
     */
    static async updateAutoIsolationSchedule(daysOfMonth, isActive = true, hour = 1, minute = 0) {
        const validDays = Array.from(new Set(daysOfMonth.filter(d => Number.isInteger(d) && d >= 1 && d <= 31)));
        const daysToSave = validDays.length ? validDays : [1];
        const h = Math.max(0, Math.min(23, Number(hour)));
        const m = Math.max(0, Math.min(59, Number(minute)));
        await pool_1.databasePool.execute(`INSERT INTO scheduler_settings (task_name, cron_schedule, description, is_enabled)
             VALUES ('auto_isolation', ?, 'Auto isolate overdue customers', ?)
             ON DUPLICATE KEY UPDATE cron_schedule = VALUES(cron_schedule), is_enabled = VALUES(is_enabled), updated_at = CURRENT_TIMESTAMP`, [`${daysToSave.join(',')}|${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, isActive ? 1 : 0]);
        if (isActive) {
            this.scheduleAutoIsolation(daysToSave, h, m);
        }
        else {
            for (const job of this.autoIsolationJobs) {
                try {
                    job.stop();
                }
                catch { }
            }
            this.autoIsolationJobs = [];
            console.log('[Auto Isolation] Disabled');
        }
        return { days: daysToSave, isActive, hour: h, minute: m };
    }
}
exports.SchedulerService = SchedulerService;
SchedulerService.isInitialized = false;
SchedulerService.autoIsolationJobs = [];
SchedulerService.invoiceGenerationJobs = [];
SchedulerService.paymentReminderJob = null;
SchedulerService.overdueNotificationJob = null;
//# sourceMappingURL=scheduler.js.map