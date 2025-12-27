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
exports.BackupService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execPromise = (0, util_1.promisify)(child_process_1.exec);
class BackupService {
    constructor() {
        this.backupDir = path.join(process.cwd(), 'backups');
        this.ensureBackupDir();
    }
    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }
    getTimestamp() {
        const now = new Date();
        return now.toISOString()
            .replace(/[:-]/g, '')
            .replace(/\..+/, '')
            .replace('T', '_');
    }
    async getDatabaseConfig() {
        // Ambil config dari environment
        return {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'billing',
            port: process.env.DB_PORT || '3306'
        };
    }
    /**
     * Backup database menggunakan mysqldump
     */
    async backupDatabase() {
        const timestamp = this.getTimestamp();
        // Use gzip compression by default
        const filename = `database_backup_${timestamp}.sql.gz`;
        const filepath = path.join(this.backupDir, filename);
        const config = await this.getDatabaseConfig();
        // Command mysqldump
        let command = `mysqldump -h ${config.host} -P ${config.port} -u ${config.user}`;
        if (config.password) {
            command += ` -p${config.password}`;
        }
        // Pipe to gzip for compression
        command += ` ${config.database} | gzip > "${filepath}"`;
        try {
            await execPromise(command);
            console.log(`Database backup created: ${filename}`);
            return filename;
        }
        catch (error) {
            console.error('Database backup error:', error);
            throw new Error(`Gagal membuat backup database: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Remove backups older than given retention days
     */
    async cleanOldBackups(retentionDays) {
        const now = Date.now();
        const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
        let deleted = 0;
        const files = fs.readdirSync(this.backupDir);
        for (const file of files) {
            if (!file.startsWith('database_backup_') && !file.startsWith('source_backup_') && !file.startsWith('billing_backup_')) {
                continue;
            }
            const full = path.join(this.backupDir, file);
            try {
                const stat = fs.statSync(full);
                if (stat.isFile() && (now - stat.mtime.getTime()) > maxAgeMs) {
                    fs.unlinkSync(full);
                    deleted += 1;
                }
            }
            catch {
                // ignore single file errors
            }
        }
        return deleted;
    }
    /**
     * Backup source code (zip folder project)
     */
    async backupSourceCode() {
        const timestamp = this.getTimestamp();
        const filename = `source_backup_${timestamp}.zip`;
        const filepath = path.join(this.backupDir, filename);
        const projectRoot = process.cwd();
        // Gunakan PowerShell untuk compress (Windows)
        // Exclude node_modules, backups, logs, dist, dan file-file temporary
        const excludeDirs = [
            'node_modules',
            'backups',
            'logs',
            'dist',
            'whatsapp-session',
            'test-session',
            '.git'
        ].join(',');
        try {
            // PowerShell command untuk compress
            const command = `powershell -Command "Get-ChildItem -Path '${projectRoot}' -Exclude ${excludeDirs} | Compress-Archive -DestinationPath '${filepath}' -CompressionLevel Optimal -Force"`;
            await execPromise(command);
            console.log(`Source code backup created: ${filename}`);
            return filename;
        }
        catch (error) {
            console.error('Source backup error:', error);
            throw new Error(`Gagal membuat backup source code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Backup lengkap (database + source code)
     */
    async backupFull() {
        try {
            const [database, source] = await Promise.all([
                this.backupDatabase(),
                this.backupSourceCode()
            ]);
            return { database, source };
        }
        catch (error) {
            throw new Error(`Gagal membuat backup lengkap: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Dapatkan daftar backup yang tersedia
     */
    async listBackups() {
        const files = fs.readdirSync(this.backupDir);
        const backups = [];
        for (const file of files) {
            const filepath = path.join(this.backupDir, file);
            const stats = fs.statSync(filepath);
            if (stats.isFile()) {
                let type;
                if (file.startsWith('database_backup_')) {
                    type = 'database';
                }
                else if (file.startsWith('source_backup_')) {
                    type = 'source';
                }
                else if (file.startsWith('billing_backup_')) {
                    type = 'full';
                }
                else {
                    continue; // Skip files yang bukan backup
                }
                backups.push({
                    filename: file,
                    type,
                    size: stats.size,
                    date: stats.mtime,
                    path: filepath
                });
            }
        }
        // Sort by date descending (terbaru dulu)
        return backups.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
    /**
     * Restore database dari file backup
     */
    async restoreDatabase(filename) {
        const filepath = path.join(this.backupDir, filename);
        if (!fs.existsSync(filepath)) {
            throw new Error('File backup tidak ditemukan');
        }
        const config = await this.getDatabaseConfig();
        // Command mysql untuk restore
        let command = `mysql -h ${config.host} -P ${config.port} -u ${config.user}`;
        if (config.password) {
            command += ` -p${config.password}`;
        }
        command += ` ${config.database} < "${filepath}"`;
        try {
            await execPromise(command);
            console.log(`Database restored from: ${filename}`);
        }
        catch (error) {
            console.error('Database restore error:', error);
            throw new Error(`Gagal restore database: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Delete backup file
     */
    async deleteBackup(filename) {
        const filepath = path.join(this.backupDir, filename);
        if (!fs.existsSync(filepath)) {
            throw new Error('File backup tidak ditemukan');
        }
        fs.unlinkSync(filepath);
        console.log(`Backup deleted: ${filename}`);
    }
    /**
     * Download backup file
     */
    getBackupPath(filename) {
        return path.join(this.backupDir, filename);
    }
    /**
     * Get backup file stats
     */
    getBackupStats() {
        const files = fs.readdirSync(this.backupDir);
        let totalSize = 0;
        let oldestBackup = null;
        let newestBackup = null;
        for (const file of files) {
            const filepath = path.join(this.backupDir, file);
            const stats = fs.statSync(filepath);
            if (stats.isFile()) {
                totalSize += stats.size;
                if (!oldestBackup || stats.mtime < oldestBackup) {
                    oldestBackup = stats.mtime;
                }
                if (!newestBackup || stats.mtime > newestBackup) {
                    newestBackup = stats.mtime;
                }
            }
        }
        return {
            totalBackups: files.length,
            totalSize,
            oldestBackup,
            newestBackup
        };
    }
    /**
     * Format ukuran file ke human readable
     */
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0)
            return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}
exports.BackupService = BackupService;
//# sourceMappingURL=backupService.js.map