import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { databasePool } from '../../db/pool';
import { GoogleDriveService } from './GoogleDriveService';
import { RowDataPacket } from 'mysql2';

export class DatabaseBackupService {
    private backupDir: string;
    private driveService: GoogleDriveService;

    constructor() {
        this.backupDir = path.join(process.cwd(), 'storage', 'backups');
        if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
        this.driveService = new GoogleDriveService();
    }

    /**
     * Get configured mysqldump path from DB
     */
    async getMysqldumpPath(): Promise<string> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT setting_value FROM app_settings WHERE setting_key = ?',
                ['backup_mysqldump_path']
            );
            if (rows.length > 0 && rows[0].setting_value) {
                return rows[0].setting_value;
            }
            // Default fallback assumption for Laragon (user might need to adjust)
            return 'C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64\\bin\\mysqldump.exe';
        } catch (error) {
            return 'mysqldump'; // Hope it's in PATH
        }
    }

    /**
     * Save configuration
     */
    async saveConfiguration(mysqldumpPath: string): Promise<void> {
        await databasePool.query(
            'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            ['backup_mysqldump_path', mysqldumpPath, mysqldumpPath]
        );
    }

    /**
     * Perform Database Dump
     */
    async dumpDatabase(): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup-${timestamp}.sql`;
        const filePath = path.join(this.backupDir, fileName);

        const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
        const mysqldumpCmd = await this.getMysqldumpPath();

        // Construct command
        // Note: DB_PASSWORD logic handles empty password
        const passwordPart = DB_PASSWORD ? `-p"${DB_PASSWORD}"` : '';
        const command = `"${mysqldumpCmd}" -h ${DB_HOST || 'localhost'} -u ${DB_USER || 'root'} ${passwordPart} ${DB_NAME || 'billing'} > "${filePath}"`;

        return new Promise((resolve, reject) => {
            exec(command, async (error, stdout, stderr) => {
                if (error) {
                    // Check if file was created and is empty (common failure mode)
                    if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
                        fs.unlinkSync(filePath);
                    }
                    console.error('[Backup] Dump Error:', stderr);
                    return reject(new Error(`Mysqldump failed: ${stderr || error.message}. Check path configuration.`));
                }
                resolve(filePath);
            });
        });
    }

    /**
     * Orchestrate Backup: Dump -> Upload -> Clean
     */
    async backupNow(): Promise<any> {
        let filePath: string | null = null;
        try {
            console.log('[Backup] Starting database dump...');
            filePath = await this.dumpDatabase();

            console.log('[Backup] Dump success, uploading to Drive...');
            // Check if drive creds exist
            if (!this.driveService.hasCredentials()) {
                throw new Error('Google Drive credentials not configured');
            }

            const fileName = path.basename(filePath);
            const uploadResult = await this.driveService.uploadFile(filePath, fileName);

            console.log('[Backup] Upload success:', uploadResult.id);

            /* Keeping local file for manual download as well
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            */

            return {
                success: true,
                message: 'Backup completed and uploaded to Google Drive',
                fileId: uploadResult.id,
                webViewLink: uploadResult.webViewLink
            };

        } catch (error: any) {
            console.error('[Backup] Process failed:', error);
            // Cleanup on error
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw error;
        }
    }
}
