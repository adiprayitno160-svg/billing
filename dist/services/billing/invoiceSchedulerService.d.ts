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
     * Manually trigger invoice generation
     */
    static triggerManualGeneration(period?: string): Promise<{
        success: boolean;
        message: string;
        created_count?: number;
        error_count?: number;
        errors?: string[];
    }>;
    /**
     * Get scheduler settings
     */
    private static getSchedulerSettings;
    /**
     * Update scheduler settings
     */
    static updateSchedulerSettings(settings: {
        auto_generate_enabled?: boolean;
        cron_schedule?: string;
        due_date_offset?: number;
        enable_due_date?: boolean;
    }): Promise<void>;
    /**
     * Save scheduler log
     */
    private static saveSchedulerLog;
    /**
     * Generate unique invoice number
     */
    private static generateInvoiceNumber;
    /**
     * Stop the scheduler
     */
    static stop(): void;
    /**
     * Start the scheduler
     */
    static start(): void;
}
//# sourceMappingURL=invoiceSchedulerService.d.ts.map