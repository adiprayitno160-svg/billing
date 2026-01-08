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
    /**
     * Helper to detect mysql binary on Linux/Unix
     */
    async detectMysqlBinary(): Promise<string> {
        if (process.platform === 'win32') {
            // Windows logic: Try configured path or fallback
            const configured = await this.getMysqldumpPath();
            if (configured.toLowerCase().endsWith('mysqldump.exe')) {
                return configured.replace(/mysqldump\.exe$/i, 'mysql.exe');
            }
            return 'mysql';
        }

        // Linux/Mac Logic
        const commonPaths = [
            '/usr/bin/mysql',
            '/usr/local/bin/mysql',
            '/bin/mysql',
            '/snap/bin/mysql' // Snap installs
        ];

        for (const p of commonPaths) {
            if (fs.existsSync(p)) {
                console.log(`[Restore] Found MySQL binary at: ${p}`);
                return p;
            }
        }

        // Try 'which' command as last resort
        try {
            const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
                exec('which mysql', (err, stdout, stderr) => err ? reject(err) : resolve({ stdout, stderr }));
            });
            if (stdout) {
                const trimmed = stdout.trim();
                console.log(`[Restore] 'which mysql' found: ${trimmed}`);
                return trimmed;
            }
        } catch (e) { /* ignore */ }

        console.warn('[Restore] Could not find mysql binary in common paths. Defaulting to "mysql" and hoping it is in PATH.');
        return 'mysql';
    }

    /**
     * Perform Database Restore
     */
    async restoreDatabase(filePath: string): Promise<void> {
        if (!fs.existsSync(filePath)) {
            throw new Error('Backup file not found at: ' + filePath);
        }

        // ERROR PREVENTION: Ensure file is readable by the process (and potentially mysql user if local)
        try {
            fs.chmodSync(filePath, 0o644);
        } catch (e) {
            console.warn('[Restore] Failed to chmod backup file, hoping permissions are okay:', e);
        }

        const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

        // 1. Detect Binary
        const mysqlCmd = await this.detectMysqlBinary();

        console.log(`[Restore] Target Database: ${DB_NAME} on ${DB_HOST}`);
        console.log(`[Restore] Using Tool: ${mysqlCmd}`);

        // 2. Construct Command & Env
        // Use MYSQL_PWD env var for security and handling special chars
        const env = { ...process.env, MYSQL_PWD: DB_PASSWORD };

        // Note: Using 'cat file | mysql' can sometimes be more robust vs '< file' regarding shell permissions, 
        // strictly if the user running node is different from user running mysql, 
        // but 'mysql < file' is standard. Let's stick to standard but add verbose flag if needed? No, silent is better.
        const command = `"${mysqlCmd}" -h ${DB_HOST || 'localhost'} -u ${DB_USER || 'root'} ${DB_NAME || 'billing'} < "${filePath}"`;

        return new Promise((resolve, reject) => {
            exec(command, { env, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
                if (error) {
                    const errStr = (stderr || error.message || '').toString();
                    console.error('[Restore] Failure Trace:', errStr);

                    // User Friendly Diagnostic
                    let friendlyMsg = `System Error: ${errStr.substring(0, 150)}`;

                    if (errStr.includes('Access denied')) {
                        friendlyMsg = 'Login Database Gagal. Cek password DB di .env';
                    } else if (errStr.includes('Unknown database')) {
                        friendlyMsg = `Database '${DB_NAME}' tidak ada.`;
                    } else if (errStr.includes('not found') || errStr.includes('no such file')) {
                        friendlyMsg = `Tool MySQL tidak ditemukan di server (${mysqlCmd}). Jalankan 'apt install mysql-client'.`;
                    }

                    return reject(new Error(friendlyMsg + ` | [Debug: ${mysqlCmd}]`));
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
