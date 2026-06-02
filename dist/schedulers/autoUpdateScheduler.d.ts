/**
 * Auto Update Scheduler
 * AI-Assisted system to automatically check and apply updates
 */
export declare class AutoUpdateScheduler {
    private job;
    private isRunning;
    private isUpdating;
    /**
     * Start the auto-update scheduler
     */
    start(): Promise<void>;
    /**
     * Stop the scheduler
     */
    stop(): void;
    /**
     * The actual check and update logic
     */
    private runUpdateCheck;
}
export declare const autoUpdateScheduler: AutoUpdateScheduler;
//# sourceMappingURL=autoUpdateScheduler.d.ts.map