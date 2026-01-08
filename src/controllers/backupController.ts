import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { DatabaseBackupService } from '../services/backup/DatabaseBackupService';
import { GoogleDriveService } from '../services/backup/GoogleDriveService';

export class BackupController {

    static async index(req: Request, res: Response) {
        try {
            const backupService = new DatabaseBackupService();
            const driveService = new GoogleDriveService();

            const mysqldumpPath = await backupService.getMysqldumpPath();
            const hasDriveKey = driveService.hasCredentials();

            res.render('settings/backup', {
                title: 'Backup & Restore',
                currentPath: '/settings/backup',
                mysqldumpPath,
                hasDriveKey
            });
        } catch (error: any) {
            console.error('Backup Page Error:', error);
            res.render('settings/backup', {
                title: 'Backup & Restore',
                currentPath: '/settings/backup',
                mysqldumpPath: '',
                hasDriveKey: false,
                error: error.message
            });
        }
    }

    static async saveConfig(req: Request, res: Response) {
        try {
            const { mysqldumpPath } = req.body;
            const backupService = new DatabaseBackupService();
            await backupService.saveConfiguration(mysqldumpPath);
            req.flash('success', 'Konfigurasi path mysqldump disimpan');
            res.redirect('/settings/backup');
        } catch (error: any) {
            req.flash('error', error.message);
            res.redirect('/settings/backup');
        }
    }

    static async uploadKey(req: Request, res: Response) {
        try {
            if (!req.file) {
                req.flash('error', 'File JSON tidak ditemukan');
                return res.redirect('/settings/backup');
            }

            const targetPath = path.join(process.cwd(), 'storage', 'credentials', 'google-drive-key.json');
            const targetDir = path.dirname(targetPath);

            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            fs.writeFileSync(targetPath, req.file.buffer); // Multer memory storage

            req.flash('success', 'Google Drive Key berhasil diupload');
            res.redirect('/settings/backup');
        } catch (error: any) {
            console.error('Upload Key Error:', error);
            req.flash('error', 'Gagal upload key: ' + error.message);
            res.redirect('/settings/backup');
        }
    }

    static async runBackup(req: Request, res: Response) {
        try {
            const backupService = new DatabaseBackupService();
            const result = await backupService.backupNow();
            req.flash('success', result.message);
            res.redirect('/settings/backup');
        } catch (error: any) {
            console.error('Manual Backup Error:', error);
            req.flash('error', 'Backup Gagal: ' + error.message);
            res.redirect('/settings/backup');
        }
    }

    static async runLocalBackup(req: Request, res: Response) {
        try {
            const backupService = new DatabaseBackupService();
            // We only need the dump part, not the upload
            const filePath = await backupService.dumpDatabase();
            const fileName = path.basename(filePath);

            req.flash('success', `Backup Lokal Berhasil! File disimpan: ${fileName}`);
            res.redirect('/settings/backup');
        } catch (error: any) {
            console.error('Local Backup Error:', error);
            req.flash('error', 'Backup Lokal Gagal: ' + error.message);
            res.redirect('/settings/backup');
        }
    }

    static async listBackups(req: Request, res: Response) {
        try {
            const backupDir = path.join(process.cwd(), 'storage', 'backups');
            if (!fs.existsSync(backupDir)) {
                return res.json([]);
            }

            const files = await fs.promises.readdir(backupDir);

            const fileStats = await Promise.all(
                files
                    .filter(f => f.endsWith('.sql'))
                    .map(async f => {
                        const stats = await fs.promises.stat(path.join(backupDir, f));
                        return {
                            filename: f,
                            size: stats.size,
                            createdAt: stats.birthtime
                        };
                    })
            );

            res.json(fileStats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async downloadBackup(req: Request, res: Response) {
        try {
            const { filename } = req.params;
            const filePath = path.join(process.cwd(), 'storage', 'backups', filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).send('File tidak ditemukan');
            }

            const stat = fs.statSync(filePath);

            res.writeHead(200, {
                'Content-Type': 'application/x-download',
                'Content-Length': stat.size,
                'Content-Disposition': `attachment; filename="${filename}"`
            });

            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
        } catch (error: any) {
            console.error('Download Error:', error);
            if (!res.headersSent) {
                res.status(500).send(error.message);
            }
        }
    }

    static async restoreBackup(req: Request, res: Response) {
        try {
            const { filename } = req.params;
            const filePath = path.join(process.cwd(), 'storage', 'backups', filename);
            const backupService = new DatabaseBackupService();

            await backupService.restoreDatabase(filePath);

            req.flash('success', 'Database berhasil direstore');
            res.redirect('/settings/backup');
        } catch (error: any) {
            console.error('Restore Error:', error);
            req.flash('error', 'Restore Gagal: ' + error.message);
            res.redirect('/settings/backup');
        }
    }

    static async restoreFromUpload(req: Request, res: Response) {
        try {
            if (!req.file) {
                req.flash('error', 'File SQL tidak ditemukan');
                return res.redirect('/settings/backup');
            }

            // We relax the check because sometimes downloads lose extension (the random filename issue)
            const isSqlExtension = req.file.originalname.endsWith('.sql');
            const isBinary = req.file.mimetype === 'application/octet-stream';

            // If it doesn't have .sql and isn't octet-stream, we warn but might still try if user persists?
            // For now, let's just log it and proceed, assuming user knows what they uploaded.
            // But we should rename it to .sql for proper handling

            // Move uploaded file from buffer/temp to storage/backups
            const backupDir = path.join(process.cwd(), 'storage', 'backups');
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            // Clean originalname to be safe or use a generic name if it looks like a mess (UUID)
            let safeName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
            if (!safeName.endsWith('.sql')) safeName += '.sql'; // Append .sql if missing

            const filename = `restore-upload-${timestamp}-${safeName}`;
            const targetPath = path.join(backupDir, filename);

            if (req.file.path) {
                // Disk storage case (Large files)
                // Move/Rename the temp file to the target backup directory
                fs.renameSync(req.file.path, targetPath);
            } else if (req.file.buffer) {
                // Memory storage case (Small files)
                fs.writeFileSync(targetPath, req.file.buffer);
            } else {
                throw new Error('File upload failed: No data received');
            }

            // Perform restore
            const backupService = new DatabaseBackupService();
            await backupService.restoreDatabase(targetPath);

            // Clean up temp file
            if (fs.existsSync(targetPath)) {
                try { fs.unlinkSync(targetPath); } catch (e) { }
            }

            res.json({ success: true, message: 'Database berhasil direstore' });

        } catch (error: any) {
            console.error('Restore Upload Error:', error);
            // Cleanup temp file if it exists and wasn't moved
            if (req.file && req.file.path && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) { }
            }
            res.status(500).json({ success: false, error: 'Restore Gagal: ' + error.message });
        }
    }

    static async deleteBackup(req: Request, res: Response) {
        try {
            const { filename } = req.params;
            const filePath = path.join(process.cwd(), 'storage', 'backups', filename);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                req.flash('success', 'File backup berhasil dihapus');
            } else {
                req.flash('error', 'File tidak ditemukan');
            }

            res.redirect('/settings/backup');
        } catch (error: any) {
            console.error('Delete Backup Error:', error);
            req.flash('error', 'Gagal menghapus file: ' + error.message);
            res.redirect('/settings/backup');
        }
    }
}
