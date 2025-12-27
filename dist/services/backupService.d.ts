export interface BackupInfo {
    filename: string;
    type: 'database' | 'source' | 'full';
    size: number;
    date: Date;
    path: string;
}
export declare class BackupService {
    private backupDir;
    constructor();
    private ensureBackupDir;
    private getTimestamp;
    private getDatabaseConfig;
    /**
     * Backup database menggunakan mysqldump
     */
    backupDatabase(): Promise<string>;
    /**
     * Remove backups older than given retention days
     */
    cleanOldBackups(retentionDays: number): Promise<number>;
    /**
     * Backup source code (zip folder project)
     */
    backupSourceCode(): Promise<string>;
    /**
     * Backup lengkap (database + source code)
     */
    backupFull(): Promise<{
        database: string;
        source: string;
    }>;
    /**
     * Dapatkan daftar backup yang tersedia
     */
    listBackups(): Promise<BackupInfo[]>;
    /**
     * Restore database dari file backup
     */
    restoreDatabase(filename: string): Promise<void>;
    /**
     * Delete backup file
     */
    deleteBackup(filename: string): Promise<void>;
    /**
     * Download backup file
     */
    getBackupPath(filename: string): string;
    /**
     * Get backup file stats
     */
    getBackupStats(): {
        totalBackups: number;
        totalSize: number;
        oldestBackup: Date | null;
        newestBackup: Date | null;
    };
    /**
     * Format ukuran file ke human readable
     */
    formatFileSize(bytes: number): string;
}
//# sourceMappingURL=backupService.d.ts.map