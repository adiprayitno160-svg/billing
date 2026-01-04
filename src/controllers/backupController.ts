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

            req.flash('success', `Backup Berhasil! File ID: ${result.fileId}`);
            res.redirect('/settings/backup');
        } catch (error: any) {
            console.error('Manual Backup Error:', error);
            req.flash('error', 'Backup Gagal: ' + error.message);
            res.redirect('/settings/backup');
        }
    }

    static async listBackups(req: Request, res: Response) {
        try {
            const backupDir = path.join(process.cwd(), 'storage', 'backups');
            if (!fs.existsSync(backupDir)) {
                return res.json([]);
            }

            const files = fs.readdirSync(backupDir)
                .filter(f => f.endsWith('.sql'))
                .map(f => {
                    const stats = fs.statSync(path.join(backupDir, f));
                    return {
                        filename: f,
                        size: stats.size,
                        createdAt: stats.birthtime
                    };
                })
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            res.json(files);
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

            res.download(filePath);
        } catch (error: any) {
            res.status(500).send(error.message);
        }
    }
}
