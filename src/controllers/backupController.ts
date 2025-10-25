import { Request, Response, NextFunction } from 'express';
import { BackupService } from '../services/backupService';
import * as path from 'path';
import * as fs from 'fs';

export class BackupController {
    private backupService: BackupService;

    constructor() {
        this.backupService = new BackupService();
    }

    /**
     * Render halaman backup & restore
     */
    getBackupPage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const backups = await this.backupService.listBackups();
            const stats = this.backupService.getBackupStats();

            res.render('backup/index', {
                title: 'Backup & Restore',
                backups,
                stats,
                formatSize: (bytes: number) => this.backupService.formatFileSize(bytes),
                success: req.flash('success'),
                error: req.flash('error'),
                currentPath: req.path
            });
        } catch (error) {
            console.error('Get backup page error:', error);
            next(error);
        }
    };

    /**
     * Buat backup database
     */
    createDatabaseBackup = async (req: Request, res: Response): Promise<void> => {
        try {
            const filename = await this.backupService.backupDatabase();
            req.flash('success', `Backup database berhasil dibuat: ${filename}`);
            res.redirect('/backup');
        } catch (error) {
            console.error('Create database backup error:', error);
            req.flash('error', error instanceof Error ? error.message : 'Gagal membuat backup database');
            res.redirect('/backup');
        }
    };

    /**
     * Buat backup source code
     */
    createSourceBackup = async (req: Request, res: Response): Promise<void> => {
        try {
            const filename = await this.backupService.backupSourceCode();
            req.flash('success', `Backup source code berhasil dibuat: ${filename}`);
            res.redirect('/backup');
        } catch (error) {
            console.error('Create source backup error:', error);
            req.flash('error', error instanceof Error ? error.message : 'Gagal membuat backup source code');
            res.redirect('/backup');
        }
    };

    /**
     * Buat backup lengkap (database + source code)
     */
    createFullBackup = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.backupService.backupFull();
            req.flash('success', `Backup lengkap berhasil dibuat. Database: ${result.database}, Source: ${result.source}`);
            res.redirect('/backup');
        } catch (error) {
            console.error('Create full backup error:', error);
            req.flash('error', error instanceof Error ? error.message : 'Gagal membuat backup lengkap');
            res.redirect('/backup');
        }
    };

    /**
     * Restore database dari backup
     */
    restoreDatabase = async (req: Request, res: Response): Promise<void> => {
        try {
            const { filename } = req.body;

            if (!filename) {
                req.flash('error', 'Nama file backup tidak valid');
                res.redirect('/backup');
                return;
            }

            await this.backupService.restoreDatabase(filename);
            req.flash('success', `Database berhasil di-restore dari: ${filename}`);
            res.redirect('/backup');
        } catch (error) {
            console.error('Restore database error:', error);
            req.flash('error', error instanceof Error ? error.message : 'Gagal restore database');
            res.redirect('/backup');
        }
    };

    /**
     * Delete backup file
     */
    deleteBackup = async (req: Request, res: Response): Promise<void> => {
        try {
            const { filename } = req.body;

            if (!filename) {
                req.flash('error', 'Nama file backup tidak valid');
                res.redirect('/backup');
                return;
            }

            await this.backupService.deleteBackup(filename);
            req.flash('success', `Backup berhasil dihapus: ${filename}`);
            res.redirect('/backup');
        } catch (error) {
            console.error('Delete backup error:', error);
            req.flash('error', error instanceof Error ? error.message : 'Gagal menghapus backup');
            res.redirect('/backup');
        }
    };

    /**
     * Download backup file
     */
    downloadBackup = async (req: Request, res: Response): Promise<void> => {
        try {
            const { filename } = req.params;

            if (!filename) {
                req.flash('error', 'Nama file backup tidak valid');
                res.redirect('/backup');
                return;
            }

            const filepath = this.backupService.getBackupPath(filename);

            if (!fs.existsSync(filepath)) {
                req.flash('error', 'File backup tidak ditemukan');
                res.redirect('/backup');
                return;
            }

            res.download(filepath, filename);
        } catch (error) {
            console.error('Download backup error:', error);
            req.flash('error', error instanceof Error ? error.message : 'Gagal download backup');
            res.redirect('/backup');
        }
    };

    /**
     * Upload dan restore backup
     */
    uploadAndRestore = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.file) {
                req.flash('error', 'File backup tidak ditemukan');
                res.redirect('/backup');
                return;
            }

            const { backupType } = req.body;
            const uploadedFile = req.file;

            // Validasi file type
            if (backupType === 'database' && !uploadedFile.originalname.endsWith('.sql')) {
                fs.unlinkSync(uploadedFile.path);
                req.flash('error', 'File harus berformat .sql untuk backup database');
                res.redirect('/backup');
                return;
            }

            if (backupType === 'source' && !uploadedFile.originalname.endsWith('.zip')) {
                fs.unlinkSync(uploadedFile.path);
                req.flash('error', 'File harus berformat .zip untuk backup source code');
                res.redirect('/backup');
                return;
            }

            // Move file ke backup directory
            const backupDir = path.join(process.cwd(), 'backups');
            const newPath = path.join(backupDir, uploadedFile.originalname);
            
            fs.renameSync(uploadedFile.path, newPath);

            if (backupType === 'database') {
                await this.backupService.restoreDatabase(uploadedFile.originalname);
                req.flash('success', `Database berhasil di-restore dari: ${uploadedFile.originalname}`);
            } else {
                req.flash('success', `File backup berhasil diupload: ${uploadedFile.originalname}. Silakan restore manual untuk source code.`);
            }

            res.redirect('/backup');
        } catch (error) {
            console.error('Upload and restore error:', error);
            req.flash('error', error instanceof Error ? error.message : 'Gagal upload dan restore backup');
            res.redirect('/backup');
        }
    };

    /**
     * API endpoint untuk mendapatkan daftar backup
     */
    getBackupsAPI = async (req: Request, res: Response): Promise<void> => {
        try {
            const backups = await this.backupService.listBackups();
            res.json({
                success: true,
                data: backups
            });
        } catch (error) {
            console.error('Get backups API error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Gagal mendapatkan daftar backup'
            });
        }
    };

    /**
     * API endpoint untuk mendapatkan statistik backup
     */
    getStatsAPI = async (req: Request, res: Response): Promise<void> => {
        try {
            const stats = this.backupService.getBackupStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Get stats API error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Gagal mendapatkan statistik backup'
            });
        }
    };
}

