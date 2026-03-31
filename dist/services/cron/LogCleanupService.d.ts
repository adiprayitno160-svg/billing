/**
 * Log Cleanup Service
 * ==============================
 * Scheduler that cleans up log files and database logs automatically:
 * - Runs every night at 02:00
 * - Deletes log files older than 7 days
 * - Deletes system_logs entries older than 30 days
 */
export declare function cleanupLogs(): Promise<{
    filesDeleted: number;
    dbRowsDeleted: number;
}>;
export declare function startLogCleanupScheduler(): void;
export declare function stopLogCleanupScheduler(): void;
//# sourceMappingURL=LogCleanupService.d.ts.map