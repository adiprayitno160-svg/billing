export declare class InvoiceCleanupService {
    private static readonly INVOICE_DIR;
    private static readonly MAX_AGE_MS;
    /**
     * Run the cleanup process
     */
    static runCleanup(): Promise<void>;
    /**
     * Start the scheduler
     */
    static startScheduler(): void;
}
//# sourceMappingURL=InvoiceCleanupService.d.ts.map