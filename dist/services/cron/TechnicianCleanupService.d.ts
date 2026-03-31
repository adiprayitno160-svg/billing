export declare class TechnicianCleanupService {
    /**
     * Start the scheduler to clean up old technician logs.
     * Schedule: Runs at 02:00 AM on the 1st day of every month.
     * Retention: 2 months (60 days).
     */
    static startScheduler(): void;
    /**
     * Delete technician jobs older than 2 months (completed/cancelled only).
     */
    static cleanupOldJobs(): Promise<void>;
}
//# sourceMappingURL=TechnicianCleanupService.d.ts.map