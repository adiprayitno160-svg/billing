export declare class DatabaseBackupService {
    private backupDir;
    private driveService;
    constructor();
    /**
     * Get configured mysqldump path from DB
     */
    getMysqldumpPath(): Promise<string>;
    /**
     * Save configuration
     */
    saveConfiguration(mysqldumpPath: string): Promise<void>;
    /**
     * Perform Database Dump
     */
    dumpDatabase(): Promise<string>;
    /**
     * Delete files leaving only the N most recent ones
     */
    /**
     * Perform Database Restore
     */
    /**
     * Perform Database Restore
     */
    /**
     * Helper to detect mysql binary on Linux/Unix
     */
    detectMysqlBinary(): Promise<string>;
    /**
     * Perform Database Restore
     */
    restoreDatabase(filePath: string): Promise<void>;
    /**
     * Orchestrate Backup: Dump -> Upload -> Clean
     */
    backupNow(): Promise<any>;
    /**
     * Perform Full System Backup (Source + DB + Uploads)
     * Intended for migration to another server
     */
    fullSystemBackup(): Promise<string>;
    /**
     * Delete files leaving only the N most recent ones
     * Modified to handle both .sql and .tar.gz separately or together
     */
    rotateLocalBackups(maxFiles?: number): Promise<void>;
}
//# sourceMappingURL=DatabaseBackupService.d.ts.map