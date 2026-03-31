export declare class MediaCleanupService {
    private static readonly CLEANUP_INTERVAL_MS;
    private static readonly MAX_AGE_DAYS;
    private static readonly UPLOAD_DIR;
    private static timer;
    /**
     * Start the cleanup scheduler
     */
    static startScheduler(maxAgeDays?: number): void;
    /**
     * Stop scheduler
     */
    static stopScheduler(): void;
    /**
     * Execute cleanup logic
     */
    static runCleanup(maxAgeDays: number): Promise<void>;
}
//# sourceMappingURL=MediaCleanupService.d.ts.map