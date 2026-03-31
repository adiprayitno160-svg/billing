export declare class UpdateService {
    private static projectRoot;
    /**
     * Check if Git is available
     */
    private static isGitAvailable;
    /**
     * Execute git command
     */
    private static execGit;
    /**
     * Create backup before update
     */
    private static createBackup;
    /**
     * Log update to history
     */
    private static logUpdate;
    /**
     * Update app version in database
     */
    private static updateVersion;
    /**
     * Apply update using git pull
     */
    static applyUpdate(targetVersion: string): Promise<{
        success: boolean;
        message: string;
        needsRestart: boolean;
    }>;
    /**
     * Rollback to previous version
     */
    static rollbackUpdate(targetVersion: string): Promise<void>;
    /**
     * Get update history
     */
    static getUpdateHistory(limit?: number): Promise<any[]>;
    /**
     * Install/update npm dependencies if package.json changed
     */
    static updateDependencies(): Promise<void>;
    /**
     * Rebuild TypeScript
     */
    static rebuildProject(): Promise<void>;
    /**
     * Restart application (using PM2)
     */
    static restartApplication(): Promise<void>;
    /**
     * Full update process with all steps
     */
    static performFullUpdate(targetVersion: string): Promise<{
        success: boolean;
        message: string;
        steps: {
            step: string;
            status: string;
            message: string;
        }[];
    }>;
}
//# sourceMappingURL=UpdateService.d.ts.map