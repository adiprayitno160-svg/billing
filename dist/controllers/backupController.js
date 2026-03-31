"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DatabaseBackupService_1 = require("../services/backup/DatabaseBackupService");
const GoogleDriveService_1 = require("../services/backup/GoogleDriveService");
class BackupController {
    static async index(req, res) {
        try {
            const backupService = new DatabaseBackupService_1.DatabaseBackupService();
            const driveService = new GoogleDriveService_1.GoogleDriveService();
            const mysqldumpPath = await backupService.getMysqldumpPath();
            const hasDriveKey = driveService.hasCredentials();
            res.render('settings/backup', {
                title: 'Backup & Restore',
                currentPath: '/settings/backup',
                mysqldumpPath,
                hasDriveKey
            });
        }
        catch (error) {
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
    static async saveConfig(req, res) {
        try {
            const { mysqldumpPath } = req.body;
            const backupService = new DatabaseBackupService_1.DatabaseBackupService();
            await backupService.saveConfiguration(mysqldumpPath);
            req.flash('success', 'Konfigurasi path mysqldump disimpan');
            res.redirect('/settings/backup');
        }
        catch (error) {
            req.flash('error', error.message);
            res.redirect('/settings/backup');
        }
    }
    static async uploadKey(req, res) {
        try {
            if (!req.file) {
                req.flash('error', 'File JSON tidak ditemukan');
                return res.redirect('/settings/backup');
            }
            const targetPath = path_1.default.join(process.cwd(), 'storage', 'credentials', 'google-drive-key.json');
            const targetDir = path_1.default.dirname(targetPath);
            if (!fs_1.default.existsSync(targetDir))
                fs_1.default.mkdirSync(targetDir, { recursive: true });
            fs_1.default.writeFileSync(targetPath, req.file.buffer); // Multer memory storage
            req.flash('success', 'Google Drive Key berhasil diupload');
            res.redirect('/settings/backup');
        }
        catch (error) {
            console.error('Upload Key Error:', error);
            req.flash('error', 'Gagal upload key: ' + error.message);
            res.redirect('/settings/backup');
        }
    }
    static async runBackup(req, res) {
        try {
            const backupService = new DatabaseBackupService_1.DatabaseBackupService();
            const result = await backupService.backupNow();
            req.flash('success', result.message);
            res.redirect('/settings/backup');
        }
        catch (error) {
            console.error('Manual Backup Error:', error);
            req.flash('error', 'Backup Gagal: ' + error.message);
            res.redirect('/settings/backup');
        }
    }
    static async runLocalBackup(req, res) {
        try {
            const backupService = new DatabaseBackupService_1.DatabaseBackupService();
            // We only need the dump part, not the upload
            const filePath = await backupService.dumpDatabase();
            const fileName = path_1.default.basename(filePath);
            req.flash('success', `Backup Lokal Berhasil! File disimpan: ${fileName}`);
            res.redirect('/settings/backup');
        }
        catch (error) {
            console.error('Local Backup Error:', error);
            req.flash('error', 'Backup Lokal Gagal: ' + error.message);
            res.redirect('/settings/backup');
        }
    }
    static async runFullBackup(req, res) {
        try {
            // Increase timeout for this request if possible, or run async
            // Use standard node timeout?
            const backupService = new DatabaseBackupService_1.DatabaseBackupService();
            // This might take a while, depending on project size.
            // Ideally we'd run this background, but for simplicity we await it.
            const archivePath = await backupService.fullSystemBackup();
            const fileName = path_1.default.basename(archivePath);
            req.flash('success', `Full System Backup Berhasil! File: ${fileName}. Siap didownload.`);
            res.redirect('/settings/backup');
        }
        catch (error) {
            console.error('Full Backup Error:', error);
            req.flash('error', 'Full Backup Gagal: ' + error.message);
            res.redirect('/settings/backup');
        }
    }
    static async listBackups(req, res) {
        try {
            const backupDir = path_1.default.join(process.cwd(), 'storage', 'backups');
            if (!fs_1.default.existsSync(backupDir)) {
                return res.json([]);
            }
            const files = await fs_1.default.promises.readdir(backupDir);
            const fileStats = await Promise.all(files
                .filter(f => f.endsWith('.sql') || f.endsWith('.tar.gz') || f.endsWith('.zip'))
                .map(async (f) => {
                const stats = await fs_1.default.promises.stat(path_1.default.join(backupDir, f));
                return {
                    filename: f,
                    size: stats.size,
                    createdAt: stats.birthtime
                };
            }));
            res.json(fileStats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async downloadBackup(req, res) {
        try {
            const { filename } = req.params;
            const filePath = path_1.default.join(process.cwd(), 'storage', 'backups', filename);
            if (!fs_1.default.existsSync(filePath)) {
                return res.status(404).send('File tidak ditemukan');
            }
            const stat = fs_1.default.statSync(filePath);
            res.writeHead(200, {
                'Content-Type': 'application/x-download',
                'Content-Length': stat.size,
                'Content-Disposition': `attachment; filename="${filename}"`
            });
            const readStream = fs_1.default.createReadStream(filePath);
            readStream.pipe(res);
        }
        catch (error) {
            console.error('Download Error:', error);
            if (!res.headersSent) {
                res.status(500).send(error.message);
            }
        }
    }
    static async restoreBackup(req, res) {
        try {
            const { filename } = req.params;
            const filePath = path_1.default.join(process.cwd(), 'storage', 'backups', filename);
            const backupService = new DatabaseBackupService_1.DatabaseBackupService();
            await backupService.restoreDatabase(filePath);
            req.flash('success', 'Database berhasil direstore');
            res.redirect('/settings/backup');
        }
        catch (error) {
            console.error('Restore Error:', error);
            req.flash('error', 'Restore Gagal: ' + error.message);
            res.redirect('/settings/backup');
        }
    }
    static async restoreFromUpload(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'File SQL tidak ditemukan' });
            }
            // We relax the check because sometimes downloads lose extension (the random filename issue)
            const isSqlExtension = req.file.originalname.endsWith('.sql');
            const isBinary = req.file.mimetype === 'application/octet-stream';
            // If it doesn't have .sql and isn't octet-stream, we warn but might still try if user persists?
            // For now, let's just log it and proceed, assuming user knows what they uploaded.
            // But we should rename it to .sql for proper handling
            // Move uploaded file from buffer/temp to storage/backups
            const backupDir = path_1.default.join(process.cwd(), 'storage', 'backups');
            if (!fs_1.default.existsSync(backupDir))
                fs_1.default.mkdirSync(backupDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            // Clean originalname to be safe or use a generic name if it looks like a mess (UUID)
            let safeName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
            if (!safeName.endsWith('.sql'))
                safeName += '.sql'; // Append .sql if missing
            const filename = `restore-upload-${timestamp}-${safeName}`;
            const targetPath = path_1.default.join(backupDir, filename);
            if (req.file.path) {
                // Disk storage case (Large files)
                // Move/Rename the temp file to the target backup directory
                fs_1.default.renameSync(req.file.path, targetPath);
            }
            else if (req.file.buffer) {
                // Memory storage case (Small files)
                fs_1.default.writeFileSync(targetPath, req.file.buffer);
            }
            else {
                throw new Error('File upload failed: No data received');
            }
            // Perform restore
            const backupService = new DatabaseBackupService_1.DatabaseBackupService();
            await backupService.restoreDatabase(targetPath);
            // Clean up temp file? NO. Keep it as a record in storage/backups since it's a valid backup now.
            // if (fs.existsSync(targetPath)) {
            //    try { fs.unlinkSync(targetPath); } catch (e) { }
            // }
            res.json({ success: true, message: 'Database berhasil direstore' });
        }
        catch (error) {
            console.error('Restore Upload Error:', error);
            // Cleanup temp file if it exists and wasn't moved
            if (req.file && req.file.path && fs_1.default.existsSync(req.file.path)) {
                try {
                    fs_1.default.unlinkSync(req.file.path);
                }
                catch (e) { }
            }
            res.status(500).json({ success: false, error: 'Restore Gagal: ' + error.message });
        }
    }
    static async deleteBackup(req, res) {
        try {
            const { filename } = req.params;
            const filePath = path_1.default.join(process.cwd(), 'storage', 'backups', filename);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
                req.flash('success', 'File backup berhasil dihapus');
            }
            else {
                req.flash('error', 'File tidak ditemukan');
            }
            res.redirect('/settings/backup');
        }
        catch (error) {
            console.error('Delete Backup Error:', error);
            req.flash('error', 'Gagal menghapus file: ' + error.message);
            res.redirect('/settings/backup');
        }
    }
}
exports.BackupController = BackupController;
//# sourceMappingURL=backupController.js.map