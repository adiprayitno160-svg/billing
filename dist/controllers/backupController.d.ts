import { Request, Response, NextFunction } from 'express';
export declare class BackupController {
    private backupService;
    constructor();
    /**
     * Render halaman backup & restore
     */
    getBackupPage: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Buat backup database
     */
    createDatabaseBackup: (req: Request, res: Response) => Promise<void>;
    /**
     * Buat backup source code
     */
    createSourceBackup: (req: Request, res: Response) => Promise<void>;
    /**
     * Buat backup lengkap (database + source code)
     */
    createFullBackup: (req: Request, res: Response) => Promise<void>;
    /**
     * Restore database dari backup
     */
    restoreDatabase: (req: Request, res: Response) => Promise<void>;
    /**
     * Delete backup file
     */
    deleteBackup: (req: Request, res: Response) => Promise<void>;
    /**
     * Download backup file
     */
    downloadBackup: (req: Request, res: Response) => Promise<void>;
    /**
     * Upload dan restore backup
     */
    uploadAndRestore: (req: Request, res: Response) => Promise<void>;
    /**
     * API endpoint untuk mendapatkan daftar backup
     */
    getBackupsAPI: (req: Request, res: Response) => Promise<void>;
    /**
     * API endpoint untuk mendapatkan statistik backup
     */
    getStatsAPI: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=backupController.d.ts.map