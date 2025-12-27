"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const backupService_1 = require("../services/backupService");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class BackupController {
    constructor() {
        /**
         * Render halaman backup & restore
         */
        this.getBackupPage = async (req, res, next) => {
            try {
                const backups = await this.backupService.listBackups();
                const stats = this.backupService.getBackupStats();
                res.render('backup/index', {
                    title: 'Backup & Restore',
                    backups,
                    stats,
                    formatSize: (bytes) => this.backupService.formatFileSize(bytes),
                    success: req.flash('success'),
                    error: req.flash('error'),
                    currentPath: req.path
                });
            }
            catch (error) {
                console.error('Get backup page error:', error);
                next(error);
            }
        };
        /**
         * Buat backup database
         */
        this.createDatabaseBackup = async (req, res) => {
            try {
                const filename = await this.backupService.backupDatabase();
                req.flash('success', `Backup database berhasil dibuat: ${filename}`);
                res.redirect('/backup');
            }
            catch (error) {
                console.error('Create database backup error:', error);
                req.flash('error', error instanceof Error ? error.message : 'Gagal membuat backup database');
                res.redirect('/backup');
            }
        };
        /**
         * Buat backup source code
         */
        this.createSourceBackup = async (req, res) => {
            try {
                const filename = await this.backupService.backupSourceCode();
                req.flash('success', `Backup source code berhasil dibuat: ${filename}`);
                res.redirect('/backup');
            }
            catch (error) {
                console.error('Create source backup error:', error);
                req.flash('error', error instanceof Error ? error.message : 'Gagal membuat backup source code');
                res.redirect('/backup');
            }
        };
        /**
         * Buat backup lengkap (database + source code)
         */
        this.createFullBackup = async (req, res) => {
            try {
                const result = await this.backupService.backupFull();
                req.flash('success', `Backup lengkap berhasil dibuat. Database: ${result.database}, Source: ${result.source}`);
                res.redirect('/backup');
            }
            catch (error) {
                console.error('Create full backup error:', error);
                req.flash('error', error instanceof Error ? error.message : 'Gagal membuat backup lengkap');
                res.redirect('/backup');
            }
        };
        /**
         * Restore database dari backup
         */
        this.restoreDatabase = async (req, res) => {
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
            }
            catch (error) {
                console.error('Restore database error:', error);
                req.flash('error', error instanceof Error ? error.message : 'Gagal restore database');
                res.redirect('/backup');
            }
        };
        /**
         * Delete backup file
         */
        this.deleteBackup = async (req, res) => {
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
            }
            catch (error) {
                console.error('Delete backup error:', error);
                req.flash('error', error instanceof Error ? error.message : 'Gagal menghapus backup');
                res.redirect('/backup');
            }
        };
        /**
         * Download backup file
         */
        this.downloadBackup = async (req, res) => {
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
            }
            catch (error) {
                console.error('Download backup error:', error);
                req.flash('error', error instanceof Error ? error.message : 'Gagal download backup');
                res.redirect('/backup');
            }
        };
        /**
         * Upload dan restore backup
         */
        this.uploadAndRestore = async (req, res) => {
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
                }
                else {
                    req.flash('success', `File backup berhasil diupload: ${uploadedFile.originalname}. Silakan restore manual untuk source code.`);
                }
                res.redirect('/backup');
            }
            catch (error) {
                console.error('Upload and restore error:', error);
                req.flash('error', error instanceof Error ? error.message : 'Gagal upload dan restore backup');
                res.redirect('/backup');
            }
        };
        /**
         * API endpoint untuk mendapatkan daftar backup
         */
        this.getBackupsAPI = async (req, res) => {
            try {
                const backups = await this.backupService.listBackups();
                res.json({
                    success: true,
                    data: backups
                });
            }
            catch (error) {
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
        this.getStatsAPI = async (req, res) => {
            try {
                const stats = this.backupService.getBackupStats();
                res.json({
                    success: true,
                    data: stats
                });
            }
            catch (error) {
                console.error('Get stats API error:', error);
                res.status(500).json({
                    success: false,
                    message: error instanceof Error ? error.message : 'Gagal mendapatkan statistik backup'
                });
            }
        };
        this.backupService = new backupService_1.BackupService();
    }
}
exports.BackupController = BackupController;
//# sourceMappingURL=backupController.js.map