import * as cron from 'node-cron';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { InvoiceService } from './invoiceService';

export class InvoiceSchedulerService {
    private static cronJob: cron.ScheduledTask | null = null;
    private static isRunning: boolean = false;

    /**
     * Initialize the invoice scheduler
     */
    static async initialize(): Promise<void> {
        try {
            console.log('🕒 Initializing Invoice Scheduler Service...');

            // Get scheduler settings from database
            const settings = await this.getSchedulerSettings();

            if (!settings || !settings.auto_generate_enabled) {
                console.log('⏸️  Auto invoice generation is disabled');
                return;
            }

            // Schedule: Run daily at 01:00 AM to check for anniversaries (H-7)
            const schedule = settings.cron_schedule || '0 1 * * *';

            if (this.cronJob) {
                this.cronJob.stop();
            }

            this.cronJob = cron.schedule(schedule, async () => {
                await this.runMonthlyInvoiceGeneration();
            });

            // Schedule: Daily Reminder Check at 09:00 AM
            // Checks for due/overdue invoices and sends notifications
            const reminderSchedule = '0 9 * * *';
            cron.schedule(reminderSchedule, async () => {
                await this.runInvoiceReminders();
            });

            console.log(`✅ Invoice Scheduler initialized with schedule: ${schedule} (Generation) & ${reminderSchedule} (Reminders)`);

        } catch (error) {
            console.error('❌ Error initializing Invoice Scheduler:', error);
            throw error;
        }
    }

    /**
     * Run monthly invoice generation
     */
    static async runMonthlyInvoiceGeneration(): Promise<void> {
        if (this.isRunning) {
            console.log('⏳ Invoice generation already running, skipping...');
            return;
        }

        this.isRunning = true;
        try {
            console.log('🚀 Starting monthly invoice generation...');

            // Get current period (YYYY-MM)
            const now = new Date();
            const currentPeriod = now.toISOString().slice(0, 7);

            // Use the more complete InvoiceService logic
            console.log(`📅 Generating invoices for period: ${currentPeriod} using InvoiceService`);

            // Auto scheduler usually respects the billing day (DAY check)
            const createdInvoiceIds = await InvoiceService.generateMonthlyInvoices(currentPeriod, undefined, false);

            const createdCount = createdInvoiceIds.length;
            const logMessage = `Invoice generation completed: ${createdCount} created via InvoiceService`;
            console.log(`✅ ${logMessage}`);

            // Save scheduler log
            await this.saveSchedulerLog(
                'monthly_invoice_generation',
                'completed',
                logMessage,
                {
                    period: currentPeriod,
                    created_count: createdCount
                }
            );

        } catch (error: any) {
            console.error('❌ Error in monthly invoice generation:', error);

            // Save error log
            await this.saveSchedulerLog(
                'monthly_invoice_generation',
                'error',
                error.message,
                { error: error.stack }
            );

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Run Invoice Reminders (Daily Check)
     */
    static async runInvoiceReminders(): Promise<void> {
        console.log('🔔 Starting daily invoice reminder check...');
        try {
            const today = new Date();
            const currentDay = today.getDate();

            // USER REQUIREMENT: Do not send any invoice delivery or reminders before the 20th.
            if (currentDay < 20) {
                console.log(`⏸️ Skipping invoice reminders because today (${currentDay}) is before the 20th.`);
                return;
            }

            const { UnifiedNotificationService } = await import('../notification/UnifiedNotificationService');
            const { whatsappService } = await import('../whatsapp/WhatsAppService');
            today.setHours(0, 0, 0, 0);

            // =========================================================================
            // 1. AUTO-SEND DRAFT INVOICES (Repeats every 3 days starting from 20th)
            //    - Runs on: 20, 23, 26, 29
            // =========================================================================
            if (currentDay >= 20 && (currentDay - 20) % 3 === 0) {
                console.log(`📡 [AUTO-SEND] Starting auto-delivery for unpaid invoices (Day ${currentDay})...`);

                const [draftInvoices] = await databasePool.query<RowDataPacket[]>(
                    `SELECT i.*, c.name, c.phone 
                     FROM invoices i 
                     JOIN customers c ON i.customer_id = c.id 
                     WHERE i.status = 'draft' 
                     AND c.status = 'active'`
                );

                console.log(`📡 Found ${draftInvoices.length} draft invoices to send.`);

                for (const inv of draftInvoices) {
                    if (!inv.phone) continue;

                    try {
                        // Mark as sent before notifying so it isn't treated as draft
                        await databasePool.execute('UPDATE invoices SET status = "sent" WHERE id = ?', [inv.id]);
                        
                        // Let UnifiedNotificationService handle the formatting and PDF generation
                        await UnifiedNotificationService.notifyInvoiceCreated(inv.id, false);
                        
                        console.log(`✅ Auto-sent invoice ${inv.invoice_number} to ${inv.name} with PDF attached.`);
                    } catch (err) {
                        console.error(`❌ Failed to auto-send invoice ${inv.id}:`, err);
                    }
                }
            }

            // =========================================================================
            // 2. EXISTING REMINDER LOGIC (STRICTLY EVERY 3 DAYS STARTING FROM 20TH)
            //    - Runs on day 20, 23, 26, 29, 31 (for those end of month cases)
            // =========================================================================
            if (currentDay >= 20 && ((currentDay - 20) % 3 === 0 || currentDay === 31)) {
                const [invoices] = await databasePool.query<RowDataPacket[]>(
                    `SELECT i.*, c.name, c.phone 
                     FROM invoices i 
                     JOIN customers c ON i.customer_id = c.id 
                     WHERE i.status IN ('unpaid', 'partial', 'sent', 'overdue') 
                     AND i.remaining_amount > 0 
                     AND c.status = 'active'
                     AND i.customer_id NOT IN (SELECT customer_id FROM scheduler_settings WHERE task_name = 'suppress_reminders')`
                );

                let sentCount = 0;

                for (const invoice of invoices) {
                    if (!invoice.due_date) continue;

                    const dueDate = new Date(invoice.due_date);
                    dueDate.setHours(0, 0, 0, 0);

                    const diffTime = today.getTime() - dueDate.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    let type = '';

                    // Reminder Logic
                    try {
                        if (diffDays <= 0) {
                            await UnifiedNotificationService.notifyInvoiceReminder(invoice.id);
                            sentCount++;
                        } else if (diffDays > 0) {
                            await UnifiedNotificationService.notifyInvoiceOverdue(invoice.id);
                            sentCount++;
                        }
                    } catch (err) {
                        console.error(`❌ Failed to queue reminder for invoice ${invoice.id}:`, err);
                    }
                }

                if (sentCount > 0) {
                    console.log(`✅ Queued ${sentCount} invoice reminders.`);
                    await UnifiedNotificationService.sendPendingNotifications(20);
                }
            } // End of if currentDay >= 20 block

        } catch (error) {
            console.error('❌ Error running invoice reminders:', error);
        }
    }

    /**
     * Manually trigger invoice generation
     */
    static async triggerManualGeneration(period?: string, customerId?: number): Promise<{
        success: boolean;
        message: string;
        created_count: number;
        error_count: number;
        errors?: string[];
    }> {
        try {
            const targetPeriod = period || new Date().toISOString().slice(0, 7);
            console.log(`🎯 Manually triggering invoice generation for period: ${targetPeriod}${customerId ? ` for customer: ${customerId}` : ''}`);

            let createdInvoiceIds: number[] = [];

            if (customerId) {
                // Generate for one customer specifically, force mode
                createdInvoiceIds = await InvoiceService.generateMonthlyInvoices(targetPeriod, customerId, true);
            } else {
                // Generate for all that haven't been invoiced, force mode because it's manual trigger
                createdInvoiceIds = await InvoiceService.generateMonthlyInvoices(targetPeriod, undefined, true);
            }

            return {
                success: true,
                message: `Berhasil membuat ${createdInvoiceIds.length} invoice untuk periode ${targetPeriod}`,
                created_count: createdInvoiceIds.length,
                error_count: 0
            };

        } catch (error: any) {
            console.error('❌ Error in manual invoice generation:', error);
            return {
                success: false,
                message: `Gagal generate invoice: ${error.message}`,
                created_count: 0,
                error_count: 1,
                errors: [error.message]
            };
        }
    }

    /**
     * Get scheduler settings
     */
    static async getSchedulerSettings(): Promise<any> {
        try {
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT * FROM scheduler_settings WHERE task_name = 'invoice_generation'
            `);

            if (result.length === 0) {
                // Create default settings if not exists
                await databasePool.execute(`
                    INSERT INTO scheduler_settings (
                        task_name, is_enabled, cron_schedule, config, created_at, updated_at
                    ) VALUES (
                        'invoice_generation', 1, '0 1 1 * *', 
                        '{"due_date_offset": 7, "due_date_fixed_day": 28, "enable_due_date": true}',
                        NOW(), NOW()
                    )
                `);

                return {
                    auto_generate_enabled: true,
                    cron_schedule: '0 1 1 * *',
                    due_date_offset: 7,
                    due_date_fixed_day: 28,
                    enable_due_date: true
                };
            }

            const firstResult = result[0];
            let config = {};
            if (typeof firstResult.config === 'string' && firstResult.config.trim()) {
                try {
                    config = JSON.parse(firstResult.config);
                } catch (e) {
                    console.error('[InvoiceScheduler] Failed to parse config JSON in getSchedulerSettings', e);
                    config = {};
                }
            } else if (firstResult.config) {
                config = firstResult.config;
            }

            return {
                ...config,
                cron_schedule: firstResult.cron_schedule,
                auto_generate_enabled: firstResult.is_enabled === 1
            };

        } catch (error) {
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
    static async updateSchedulerSettings(settings: {
        auto_generate_enabled?: boolean;
        cron_schedule?: string;
        due_date_offset?: number;
        due_date_fixed_day?: number;
        enable_due_date?: boolean;
    }): Promise<void> {
        try {
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation'
            `);

            let currentConfig: any = {};
            if (result && result.length > 0) {
                let config = result[0].config;
                if (typeof config === 'string' && config.trim()) {
                    try {
                        currentConfig = JSON.parse(config);
                    } catch (e) {
                        console.error('[InvoiceScheduler] Failed to parse config JSON in updateSchedulerSettings', e);
                        currentConfig = {};
                    }
                } else if (config) {
                    currentConfig = config;
                }
            }

            const newConfig = {
                ...currentConfig,
                ...(settings.due_date_offset !== undefined && { due_date_offset: settings.due_date_offset }),
                ...(settings.due_date_fixed_day !== undefined && { due_date_fixed_day: settings.due_date_fixed_day }),
                ...(settings.enable_due_date !== undefined && { enable_due_date: settings.enable_due_date })
            };

            await databasePool.execute(`
                UPDATE scheduler_settings 
                SET 
                    is_enabled = ?,
                    cron_schedule = ?,
                    config = ?,
                    updated_at = NOW()
                WHERE task_name = 'invoice_generation'
            `, [
                settings.auto_generate_enabled !== undefined ? (settings.auto_generate_enabled ? 1 : 0) : 1,
                settings.cron_schedule || '0 1 1 * *',
                JSON.stringify(newConfig)
            ]);

            // Restart scheduler to apply changes
            await this.initialize();

        } catch (error) {
            console.error('Error updating scheduler settings:', error);
            throw error;
        }
    }

    /**
     * Save scheduler log
     */
    private static async saveSchedulerLog(task: string, status: string, message: string, metadata?: any): Promise<void> {
        try {
            await databasePool.execute(`
                INSERT INTO scheduler_logs (
                    task_name, status, message, metadata, created_at
                ) VALUES (?, ?, ?, ?, NOW())
            `, [task, status, message, metadata ? JSON.stringify(metadata) : null]);
        } catch (error) {
            console.error('Error saving scheduler log:', error);
        }
    }

    /**
     * Generate unique invoice number
     */
    static async generateInvoiceNumber(period: string, conn: any): Promise<string> {
        const [year, month] = period.split('-');
        const [result] = await conn.query(`
            SELECT invoice_number FROM invoices 
            WHERE period = ? ORDER BY invoice_number DESC LIMIT 1
        `, [period]);

        let sequence = 1;
        if (result && result.length > 0) {
            const lastNumber = result[0].invoice_number;
            const parts = lastNumber.split('/');
            const lastSeq = parseInt(parts[parts.length - 1]);
            if (!isNaN(lastSeq)) sequence = lastSeq + 1;
        }

        return `INV/${year}/${month}/${sequence.toString().padStart(4, '0')}`;
    }

    static stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            console.log('⏸️  Invoice Scheduler stopped');
        }
    }

    static start(): void {
        if (this.cronJob) {
            this.cronJob.start();
            console.log('▶️  Invoice Scheduler started');
        }
    }
}
