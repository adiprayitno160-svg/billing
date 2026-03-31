export declare class InvoiceSchedulerService {
    private static cronJob;
    private static isRunning;
    /**
     * Initialize the invoice scheduler
     */
    static initialize(): Promise<void>;
    /**
     * Run monthly invoice generation
     */
    static runMonthlyInvoiceGeneration(): Promise<void>;
    /**
     * Run Invoice Reminders (Daily Check)
     */
    static runInvoiceReminders(): Promise<void>;
    /**
     * Manually trigger invoice generation
     */
    static triggerManualGeneration(period?: string, customerId?: number): Promise<{
        success: boolean;
        message: string;
        created_count: number;
        error_count: number;
        errors?: string[];
    }>;
    /**
     * Get scheduler settings
     */
    static getSchedulerSettings(): Promise<any>;
    /**
     * Update scheduler settings
     */
    static updateSchedulerSettings(settings: {
        auto_generate_enabled?: boolean;
        cron_schedule?: string;
        due_date_offset?: number;
        due_date_fixed_day?: number;
        enable_due_date?: boolean;
    }): Promise<void>;
    /**
     * Save scheduler log
     */
    private static saveSchedulerLog;
    /**
     * Generate unique invoice number
     */
    static generateInvoiceNumber(period: string, conn: any): Promise<string>;
    static stop(): void;
    static start(): void;
}
//# sourceMappingURL=invoiceSchedulerService.d.ts.map