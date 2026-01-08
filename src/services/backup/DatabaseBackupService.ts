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
            // 1. Check database setting first
            const [rows] = await databasePool.query<RowDataPacket[]>(
                'SELECT setting_value FROM app_settings WHERE setting_key = ?',
                ['backup_mysqldump_path']
            );
            if (rows.length > 0 && rows[0].setting_value) {
                const dbPath = rows[0].setting_value;
                // AntiGravity Fix: Detect OS mismatch (e.g. User restored Windows DB on Linux)
                // If we are on Linux (non-Windows) but path looks like Windows (C:\...), ignore it.
                const isWindowsPath = dbPath.includes('\\') || /^[a-zA-Z]:/.test(dbPath);
                const isRunningOnWindows = process.platform === 'win32';

                if (isRunningOnWindows || !isWindowsPath) {
                    return dbPath;
                }
                console.warn(`[Backup] Ignoring configured path '${dbPath}' due to OS mismatch. using default.`);
            }

            // 2. Dynamic check for Laragon MySQL version
            const laragonMysqlBase = 'C:\\laragon\\bin\\mysql';
            if (fs.existsSync(laragonMysqlBase)) {
                const dirs = fs.readdirSync(laragonMysqlBase);
                // Filter for directories starting with mysql- and sort to get latest/likely active
                const mysqlDirs = dirs.filter(d => d.startsWith('mysql-') && fs.statSync(path.join(laragonMysqlBase, d)).isDirectory());

                if (mysqlDirs.length > 0) {
                    // Sort descending might give newer version, but usually there's only one active or one folder.
                    // Just pick the first one valid that has bin/mysqldump.exe
                    for (const dir of mysqlDirs) {
                        const candidate = path.join(laragonMysqlBase, dir, 'bin', 'mysqldump.exe');
                        if (fs.existsSync(candidate)) {
                            console.log(`[Backup] Auto-detected mysqldump at: ${candidate}`);
                            return candidate;
                        }
                    }
                }
            }

            // 3. Fallback to system PATH
            return 'mysqldump';
        } catch (error) {
            console.error('[Backup] Path detection error:', error);
            return 'mysqldump';
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

        // Construct command with robust options for cross-platform compatibility
        // --add-drop-table: Ensures tables are reset before restore (Good for overwriting)
        // --hex-blob: Handles binary data correctly
        // --default-character-set=utf8mb4: Ensures encoding compatibility
        const passwordPart = DB_PASSWORD ? `-p"${DB_PASSWORD}"` : '';
        const command = `"${mysqldumpCmd}" --add-drop-table --hex-blob --default-character-set=utf8mb4 --ignore-table=${DB_NAME || 'billing'}.system_logs --ignore-table=${DB_NAME || 'billing'}.whatsapp_qr_codes --ignore-table=${DB_NAME || 'billing'}.whatsapp_connection_logs -h ${DB_HOST || 'localhost'} -u ${DB_USER || 'root'} ${passwordPart} ${DB_NAME || 'billing'} > "${filePath}"`;

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

                // Auto-rotate backups (Keep max 5)
                try {
                    await this.rotateLocalBackups(5);
                } catch (rotError) {
                    console.warn('[Backup] Warning: Failed to rotate backups:', rotError);
                }

                resolve(filePath);
            });
        });
    }

    /**
     * Delete files leaving only the N most recent ones
     */
    async rotateLocalBackups(maxFiles: number = 5): Promise<void> {
        try {
            if (!fs.existsSync(this.backupDir)) return;

            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.endsWith('.sql'))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    time: fs.statSync(path.join(this.backupDir, f)).birthtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            if (files.length > maxFiles) {
                const filesToDelete = files.slice(maxFiles);
                for (const file of filesToDelete) {
                    fs.unlinkSync(file.path);
                    console.log(`[Backup] Rotated/Deleted old backup: ${file.name}`);
                }
            }
        } catch (error) {
            console.error('[Backup] Rotation failed:', error);
            throw error;
        }
    }

    /**
     * Perform Database Restore
     */
    /**
     * Perform Database Restore
     */
    async restoreDatabase(filePath: string): Promise<void> {
        if (!fs.existsSync(filePath)) {
            throw new Error('Backup file not found at: ' + filePath);
        }

        const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
        const mysqldumpCmd = await this.getMysqldumpPath();

        // --- 1. Determine MySQL Command Path ---
        let mysqlCmd = 'mysql'; // Default for Linux

        // Naive but effective check: if we are NOT on Windows, just force 'mysql'
        // This obeys the user's request to prioritize Ubuntu server logic
        if (process.platform !== 'win32') {
            mysqlCmd = 'mysql';
        } else {
            // Windows logic (Keep existing for dev envs)
            if (mysqldumpCmd.toLowerCase().endsWith('mysqldump.exe')) {
                mysqlCmd = mysqldumpCmd.replace(/mysqldump\.exe$/i, 'mysql.exe');
            } else if (mysqldumpCmd.endsWith('mysqldump')) {
                mysqlCmd = mysqldumpCmd.replace(/mysqldump$/, 'mysql');
            }
        }

        console.log(`[Restore] Target Database: ${DB_NAME} on ${DB_HOST}`);
        console.log(`[Restore] Using Tool: ${mysqlCmd}`);

        // --- 2. Construct Command & Env ---
        // Use MYSQL_PWD env var prevents special character issues in password
        // and keeps it slightly more secure from command line logging
        const env = { ...process.env, MYSQL_PWD: DB_PASSWORD };

        // Command strictly uses env for auth
        // Added --force to ignore errors and continue? No, we want to fail on criticals.
        // Added --verbose for debugging log? Too noisy.
        const command = `"${mysqlCmd}" -h ${DB_HOST || 'localhost'} -u ${DB_USER || 'root'} ${DB_NAME || 'billing'} < "${filePath}"`;

        return new Promise((resolve, reject) => {
            exec(command, { env, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    const errStr = (stderr || error.message || '').toString();

                    console.error('[Restore] Failure Trace:', errStr);

                    // Analyze Common Errors to give user friendly feedback
                    if (errStr.includes('Access denied')) {
                        return reject(new Error('Akses Ditolak (Access Denied). Cek username/password database di file .env'));
                    }
                    if (errStr.includes('Unknown database')) {
                        return reject(new Error(`Database '${DB_NAME}' tidak ditemukan. Pastikan nama database benar.`));
                    }
                    if (errStr.includes('command not found') || errStr.includes('is not recognized')) {
                        // Fallback attempt is still good to keep, but let's make it smarter
                        // Logic below tries global 'mysql' if the specific path failed
                        if (mysqlCmd !== 'mysql') {
                            console.warn('[Restore] Custom path failed. Retrying with global "mysql"...');
                            const fbCommand = `mysql -h ${DB_HOST || 'localhost'} -u ${DB_USER || 'root'} ${DB_NAME || 'billing'} < "${filePath}"`;

                            exec(fbCommand, { env }, (fbErr, fbOut, fbStderr) => {
                                if (fbErr) {
                                    return reject(new Error(`Gagal restore (Fallback): ${fbStderr}`));
                                }
                                resolve();
                            });
                            return;
                        }
                        return reject(new Error('Perintah MySQL tidak ditemukan di server. Pastikan mysql-client terinstall (apt install mysql-client).'));
                    }

                    return reject(new Error(`MySQL Error: ${errStr.substring(0, 200)}...`));
                }

                console.log('[Restore] Success');
                resolve();
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
            console.log('[Backup] Dump success at:', filePath);

            // If drive creds don't exist, we still have the local backup
            if (!this.driveService.hasCredentials()) {
                console.warn('[Backup] Google Drive credentials not configured. Skipping upload.');
                return {
                    success: true,
                    message: 'Backup lokal berhasil, namun gagal upload ke Drive karena kredensial belum diatur.',
                    localPath: filePath
                };
            }

            console.log('[Backup] Uploading to Drive...');
            const fileName = path.basename(filePath);
            const uploadResult = await this.driveService.uploadFile(filePath, fileName);

            console.log('[Backup] Upload success:', uploadResult.id);

            return {
                success: true,
                message: 'Backup berhasil dicadangkan ke lokal dan Google Drive',
                fileId: uploadResult.id,
                webViewLink: uploadResult.webViewLink
            };

        } catch (error: any) {
            console.error('[Backup] Process failed:', error.message);
            // We DON'T delete the local file here because it might be useful even if upload failed
            // Only delete if it's empty (handled in dumpDatabase)
            throw error;
        }
    }
}
