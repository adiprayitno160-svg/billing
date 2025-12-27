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
exports.InvoiceSchedulerService = void 0;
const cron = __importStar(require("node-cron"));
const pool_1 = require("../../db/pool");
class InvoiceSchedulerService {
    /**
     * Initialize the invoice scheduler
     */
    static async initialize() {
        try {
            console.log('🕒 Initializing Invoice Scheduler Service...');
            // Get scheduler settings from database
            const settings = await this.getSchedulerSettings();
            if (!settings || !settings.auto_generate_enabled) {
                console.log('⏸️  Auto invoice generation is disabled');
                return;
            }
            // Schedule: Run on 1st day of every month at 01:00 AM
            const schedule = settings.cron_schedule || '0 1 1 * *';
            this.cronJob = cron.schedule(schedule, async () => {
                await this.runMonthlyInvoiceGeneration();
            });
            console.log(`✅ Invoice Scheduler initialized with schedule: ${schedule}`);
        }
        catch (error) {
            console.error('❌ Error initializing Invoice Scheduler:', error);
            throw error;
        }
    }
    /**
     * Run monthly invoice generation
     */
    static async runMonthlyInvoiceGeneration() {
        if (this.isRunning) {
            console.log('⏳ Invoice generation already running, skipping...');
            return;
        }
        this.isRunning = true;
        const conn = await pool_1.databasePool.getConnection();
        try {
            console.log('🚀 Starting monthly invoice generation...');
            await conn.beginTransaction();
            // Get current period (YYYY-MM)
            const now = new Date();
            const currentPeriod = now.toISOString().slice(0, 7);
            // Get scheduler settings
            const settings = await this.getSchedulerSettings();
            const dueDateOffset = settings?.due_date_offset || 7;
            console.log(`📅 Generating invoices for period: ${currentPeriod}`);
            // Get all active subscriptions that don't have invoice for current period
            const subscriptionsQuery = `
                SELECT 
                    s.*,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.custom_payment_deadline,
                    c.custom_isolate_days_after_deadline
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE s.status = 'active'
                AND NOT EXISTS (
                    SELECT 1 FROM invoices i 
                    WHERE i.customer_id = s.customer_id 
                    AND i.subscription_id = s.id
                    AND i.period = ?
                )
            `;
            const [subscriptions] = await conn.query(subscriptionsQuery, [currentPeriod]);
            console.log(`👥 Found ${subscriptions.length} active subscriptions to invoice`);
            let createdCount = 0;
            let errorCount = 0;
            const errors = [];
            for (const subscription of subscriptions) {
                try {
                    // Calculate due date only if enabled
                    let dueDateStr = null;
                    if (settings.enable_due_date !== false) {
                        const periodDate = new Date(currentPeriod + '-01');
                        const dueDate = new Date(periodDate);
                        // Use custom payment deadline if set, otherwise use default offset
                        if (subscription.custom_payment_deadline && subscription.custom_payment_deadline >= 1 && subscription.custom_payment_deadline <= 31) {
                            // Use custom deadline date (e.g., 25th of the month)
                            dueDate.setDate(subscription.custom_payment_deadline);
                            // If custom deadline is before period start, use next month
                            if (dueDate < periodDate) {
                                dueDate.setMonth(dueDate.getMonth() + 1);
                            }
                        }
                        else {
                            // Use default offset from period start
                            dueDate.setDate(dueDate.getDate() + dueDateOffset);
                        }
                        dueDateStr = dueDate.toISOString().slice(0, 10);
                    }
                    // Generate invoice number
                    const invoiceNumber = await this.generateInvoiceNumber(currentPeriod, conn);
                    const price = parseFloat(subscription.price);
                    // Insert invoice
                    const invoiceInsertQuery = `
                        INSERT INTO invoices (
                            invoice_number, customer_id, subscription_id, period, due_date,
                            subtotal, discount_amount, total_amount, paid_amount, remaining_amount,
                            status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 'sent', NOW(), NOW())
                    `;
                    const [invoiceResult] = await conn.execute(invoiceInsertQuery, [
                        invoiceNumber,
                        subscription.customer_id,
                        subscription.id,
                        currentPeriod,
                        dueDateStr,
                        price,
                        price,
                        price
                    ]);
                    const invoiceId = invoiceResult.insertId;
                    // Insert invoice item
                    const itemInsertQuery = `
                        INSERT INTO invoice_items (
                            invoice_id, description, quantity, unit_price, total_price, created_at
                        ) VALUES (?, ?, 1, ?, ?, NOW())
                    `;
                    const description = `Paket ${subscription.package_name} - ${currentPeriod}`;
                    await conn.execute(itemInsertQuery, [
                        invoiceId,
                        description,
                        price,
                        price
                    ]);
                    createdCount++;
                    console.log(`✅ Invoice ${invoiceNumber} created for ${subscription.customer_name}`);
                }
                catch (itemError) {
                    errorCount++;
                    const errorMsg = `Customer ${subscription.customer_name}: ${itemError.message}`;
                    errors.push(errorMsg);
                    console.error(`❌ ${errorMsg}`);
                }
            }
            await conn.commit();
            // Log the result
            const logMessage = `Invoice generation completed: ${createdCount} created, ${errorCount} errors`;
            console.log(`✅ ${logMessage}`);
            // Save scheduler log
            await this.saveSchedulerLog('monthly_invoice_generation', 'completed', logMessage, {
                period: currentPeriod,
                total_subscriptions: subscriptions.length,
                created_count: createdCount,
                error_count: errorCount,
                errors: errors.length > 0 ? errors : undefined
            });
        }
        catch (error) {
            await conn.rollback();
            console.error('❌ Error in monthly invoice generation:', error);
            // Save error log
            await this.saveSchedulerLog('monthly_invoice_generation', 'error', error.message, { error: error.stack });
        }
        finally {
            conn.release();
            this.isRunning = false;
        }
    }
    /**
     * Manually trigger invoice generation
     */
    static async triggerManualGeneration(period) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            const targetPeriod = period || new Date().toISOString().slice(0, 7);
            // Get scheduler settings
            const settings = await this.getSchedulerSettings();
            const dueDateOffset = settings?.due_date_offset || 7;
            // Get all active subscriptions
            const subscriptionsQuery = `
                SELECT 
                    s.*,
                    c.name as customer_name,
                    c.customer_code,
                    c.custom_payment_deadline,
                    c.custom_isolate_days_after_deadline
                FROM subscriptions s
                JOIN customers c ON s.customer_id = c.id
                WHERE s.status = 'active'
                AND NOT EXISTS (
                    SELECT 1 FROM invoices i 
                    WHERE i.customer_id = s.customer_id 
                    AND i.subscription_id = s.id
                    AND i.period = ?
                )
            `;
            const [subscriptions] = await conn.query(subscriptionsQuery, [targetPeriod]);
            let createdCount = 0;
            const errors = [];
            for (const subscription of subscriptions) {
                try {
                    const periodDate = new Date(targetPeriod + '-01');
                    const dueDate = new Date(periodDate);
                    // Use custom payment deadline if set, otherwise use default offset
                    if (subscription.custom_payment_deadline && subscription.custom_payment_deadline >= 1 && subscription.custom_payment_deadline <= 31) {
                        // Use custom deadline date (e.g., 25th of the month)
                        dueDate.setDate(subscription.custom_payment_deadline);
                        // If custom deadline is before period start, use next month
                        if (dueDate < periodDate) {
                            dueDate.setMonth(dueDate.getMonth() + 1);
                        }
                    }
                    else {
                        // Use default offset from period start
                        dueDate.setDate(dueDate.getDate() + dueDateOffset);
                    }
                    const dueDateStr = dueDate.toISOString().slice(0, 10);
                    const invoiceNumber = await this.generateInvoiceNumber(targetPeriod, conn);
                    const price = parseFloat(subscription.price);
                    const [invoiceResult] = await conn.execute(`
                        INSERT INTO invoices (
                            invoice_number, customer_id, subscription_id, period, due_date,
                            subtotal, discount_amount, total_amount, paid_amount, remaining_amount,
                            status, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 'sent', NOW(), NOW())
                    `, [invoiceNumber, subscription.customer_id, subscription.id, targetPeriod, dueDateStr, price, price, price]);
                    const invoiceId = invoiceResult.insertId;
                    await conn.execute(`
                        INSERT INTO invoice_items (
                            invoice_id, description, quantity, unit_price, total_price, created_at
                        ) VALUES (?, ?, 1, ?, ?, NOW())
                    `, [invoiceId, `Paket ${subscription.package_name} - ${targetPeriod}`, price, price]);
                    // Send notification for created invoice
                    try {
                        const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../../services/notification/UnifiedNotificationService')));
                        await UnifiedNotificationService.notifyInvoiceCreated(invoiceId);
                    }
                    catch (notifError) {
                        console.error(`Error sending notification for invoice ${invoiceId}:`, notifError);
                        // Don't fail invoice creation if notification fails
                    }
                    createdCount++;
                }
                catch (itemError) {
                    errors.push(`${subscription.customer_name}: ${itemError.message}`);
                }
            }
            await conn.commit();
            return {
                success: true,
                message: `Berhasil membuat ${createdCount} invoice untuk periode ${targetPeriod}`,
                created_count: createdCount,
                error_count: errors.length,
                errors: errors.length > 0 ? errors : undefined
            };
        }
        catch (error) {
            await conn.rollback();
            return {
                success: false,
                message: `Gagal generate invoice: ${error.message}`
            };
        }
        finally {
            conn.release();
        }
    }
    /**
     * Get scheduler settings
     */
    static async getSchedulerSettings() {
        try {
            const [result] = await pool_1.databasePool.query(`
                SELECT * FROM scheduler_settings WHERE task_name = 'invoice_generation'
            `);
            if (result.length === 0) {
                // Create default settings if not exists
                await pool_1.databasePool.execute(`
                    INSERT INTO scheduler_settings (
                        task_name, is_enabled, cron_schedule, last_run, next_run, 
                        config, created_at, updated_at
                    ) VALUES (
                        'invoice_generation', 
                        1, 
                        '0 1 1 * *',
                        NULL,
                        NULL,
                        '{"due_date_offset": 7}',
                        NOW(),
                        NOW()
                    )
                `);
                return {
                    auto_generate_enabled: true,
                    cron_schedule: '0 1 1 * *',
                    due_date_offset: 7
                };
            }
            const firstResult = result[0];
            if (!firstResult) {
                return {
                    auto_generate_enabled: false,
                    cron_schedule: '0 1 1 * *',
                    due_date_offset: 7
                };
            }
            const config = typeof firstResult.config === 'string'
                ? JSON.parse(firstResult.config)
                : firstResult.config;
            return {
                ...config,
                cron_schedule: firstResult.cron_schedule,
                auto_generate_enabled: firstResult.is_enabled === 1,
                enable_due_date: config.enable_due_date !== false // Default to true
            };
        }
        catch (error) {
            console.error('Error getting scheduler settings:', error);
            return {
                auto_generate_enabled: false,
                cron_schedule: '0 1 1 * *',
                due_date_offset: 7,
                enable_due_date: true
            };
        }
    }
    /**
     * Update scheduler settings
     */
    static async updateSchedulerSettings(settings) {
        try {
            const currentSettings = await this.getSchedulerSettings();
            // Get current config to preserve other settings
            const [result] = await pool_1.databasePool.query(`
                SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation'
            `);
            let currentConfig = {};
            if (result && result.length > 0) {
                currentConfig = typeof result[0].config === 'string'
                    ? JSON.parse(result[0].config)
                    : result[0].config || {};
            }
            // Merge with new settings
            const newConfig = {
                ...currentConfig,
                ...(settings.due_date_offset !== undefined && { due_date_offset: settings.due_date_offset }),
                ...(settings.enable_due_date !== undefined && { enable_due_date: settings.enable_due_date })
            };
            await pool_1.databasePool.execute(`
                UPDATE scheduler_settings 
                SET 
                    is_enabled = ?,
                    cron_schedule = ?,
                    config = ?,
                    updated_at = NOW()
                WHERE task_name = 'invoice_generation'
            `, [
                settings.auto_generate_enabled !== undefined ? (settings.auto_generate_enabled ? 1 : 0) : (currentSettings.auto_generate_enabled ? 1 : 0),
                settings.cron_schedule || currentSettings.cron_schedule,
                JSON.stringify(newConfig)
            ]);
            // Restart scheduler if cron schedule changed
            if (settings.cron_schedule && this.cronJob) {
                this.cronJob.stop();
                await this.initialize();
            }
        }
        catch (error) {
            console.error('Error updating scheduler settings:', error);
            throw error;
        }
    }
    /**
     * Save scheduler log
     */
    static async saveSchedulerLog(task, status, message, metadata) {
        try {
            await pool_1.databasePool.execute(`
                INSERT INTO scheduler_logs (
                    task_name, status, message, metadata, created_at
                ) VALUES (?, ?, ?, ?, NOW())
            `, [task, status, message, metadata ? JSON.stringify(metadata) : null]);
        }
        catch (error) {
            console.error('Error saving scheduler log:', error);
        }
    }
    /**
     * Generate unique invoice number
     */
    static async generateInvoiceNumber(period, conn) {
        const [year, month] = period.split('-');
        const [result] = await conn.query(`
            SELECT invoice_number 
            FROM invoices 
            WHERE period = ? 
            ORDER BY invoice_number DESC 
            LIMIT 1
        `, [period]);
        let sequence = 1;
        if (result.length > 0 && result[0]) {
            const lastNumber = result[0].invoice_number;
            const match = lastNumber.match(/\/(\d+)$/);
            if (match) {
                sequence = parseInt(match[1]) + 1;
            }
        }
        const sequenceStr = sequence.toString().padStart(4, '0');
        return `INV/${year}/${month}/${sequenceStr}`;
    }
    /**
     * Stop the scheduler
     */
    static stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            console.log('⏸️  Invoice Scheduler stopped');
        }
    }
    /**
     * Start the scheduler
     */
    static start() {
        if (this.cronJob) {
            this.cronJob.start();
            console.log('▶️  Invoice Scheduler started');
        }
    }
}
exports.InvoiceSchedulerService = InvoiceSchedulerService;
InvoiceSchedulerService.cronJob = null;
InvoiceSchedulerService.isRunning = false;
//# sourceMappingURL=invoiceSchedulerService.js.map