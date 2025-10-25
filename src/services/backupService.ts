import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { databasePool } from '../db/pool';

const execPromise = promisify(exec);

export interface BackupInfo {
    filename: string;
    type: 'database' | 'source' | 'full';
    size: number;
    date: Date;
    path: string;
}

export class BackupService {
    private backupDir: string;

    constructor() {
        this.backupDir = path.join(process.cwd(), 'backups');
        this.ensureBackupDir();
    }

    private ensureBackupDir(): void {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    private getTimestamp(): string {
        const now = new Date();
        return now.toISOString()
            .replace(/[:-]/g, '')
            .replace(/\..+/, '')
            .replace('T', '_');
    }

    private async getDatabaseConfig() {
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
    async backupDatabase(): Promise<string> {
        const timestamp = this.getTimestamp();
        const filename = `database_backup_${timestamp}.sql`;
        const filepath = path.join(this.backupDir, filename);
        
        const config = await this.getDatabaseConfig();
        
        // Command mysqldump
        let command = `mysqldump -h ${config.host} -P ${config.port} -u ${config.user}`;
        
        if (config.password) {
            command += ` -p${config.password}`;
        }
        
        command += ` ${config.database} > "${filepath}"`;

        try {
            await execPromise(command);
            console.log(`Database backup created: ${filename}`);
            return filename;
        } catch (error) {
            console.error('Database backup error:', error);
            throw new Error(`Gagal membuat backup database: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Backup source code (zip folder project)
     */
    async backupSourceCode(): Promise<string> {
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
        } catch (error) {
            console.error('Source backup error:', error);
            throw new Error(`Gagal membuat backup source code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Backup lengkap (database + source code)
     */
    async backupFull(): Promise<{ database: string; source: string }> {
        try {
            const [database, source] = await Promise.all([
                this.backupDatabase(),
                this.backupSourceCode()
            ]);

            return { database, source };
        } catch (error) {
            throw new Error(`Gagal membuat backup lengkap: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Dapatkan daftar backup yang tersedia
     */
    async listBackups(): Promise<BackupInfo[]> {
        const files = fs.readdirSync(this.backupDir);
        const backups: BackupInfo[] = [];

        for (const file of files) {
            const filepath = path.join(this.backupDir, file);
            const stats = fs.statSync(filepath);

            if (stats.isFile()) {
                let type: 'database' | 'source' | 'full';
                
                if (file.startsWith('database_backup_')) {
                    type = 'database';
                } else if (file.startsWith('source_backup_')) {
                    type = 'source';
                } else if (file.startsWith('billing_backup_')) {
                    type = 'full';
                } else {
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
    async restoreDatabase(filename: string): Promise<void> {
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
        } catch (error) {
            console.error('Database restore error:', error);
            throw new Error(`Gagal restore database: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete backup file
     */
    async deleteBackup(filename: string): Promise<void> {
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
    getBackupPath(filename: string): string {
        return path.join(this.backupDir, filename);
    }

    /**
     * Get backup file stats
     */
    getBackupStats(): { totalBackups: number; totalSize: number; oldestBackup: Date | null; newestBackup: Date | null } {
        const files = fs.readdirSync(this.backupDir);
        let totalSize = 0;
        let oldestBackup: Date | null = null;
        let newestBackup: Date | null = null;

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
    formatFileSize(bytes: number): string {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}
