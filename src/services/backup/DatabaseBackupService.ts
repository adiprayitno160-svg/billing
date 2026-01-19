import { exec, spawn } from 'child_process';
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

        // Security: Create a temporary cnf file for credentials
        // This avoids passing password in command line and handles special characters safely
        const tempCnfPath = path.join(this.backupDir, `.temp-dump-${Date.now()}.cnf`);
        const cnfContent = `[client]
user="${DB_USER || 'root'}"
password="${DB_PASSWORD || ''}"
host="${DB_HOST || 'localhost'}"
`;

        try {
            // Ensure strictly private permissions for security (600)
            fs.writeFileSync(tempCnfPath, cnfContent, { mode: 0o600 });
        } catch (e) {
            console.error('[Backup] Failed to write temp config file:', e);
            throw new Error('Gagal menyiapkan kredensial database sementara.');
        }

        console.log(`[Backup] Starting dump with tool: ${mysqldumpCmd}`);

        return new Promise((resolve, reject) => {
            // Construct arguments: mysqldump --defaults-extra-file=... [options] dbname
            const args = [
                `--defaults-extra-file=${tempCnfPath}`,
                '--add-drop-table',
                '--hex-blob',
                '--default-character-set=utf8mb4',
                `--ignore-table=${DB_NAME || 'billing'}.system_logs`,
                `--ignore-table=${DB_NAME || 'billing'}.whatsapp_qr_codes`,
                `--ignore-table=${DB_NAME || 'billing'}.whatsapp_connection_logs`,
                DB_NAME || 'billing'
            ];

            // Use spawn instead of exec for better stream handling and security
            const child = spawn(mysqldumpCmd, args);
            const writeStream = fs.createWriteStream(filePath);

            let stderrData = '';

            // Pipe stdout directly to file
            child.stdout.pipe(writeStream);

            child.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            child.on('error', (err) => {
                if (fs.existsSync(tempCnfPath)) fs.unlinkSync(tempCnfPath);
                reject(new Error(`Failed to start mysqldump process: ${err.message}`));
            });

            child.on('close', async (code) => {
                // Clean up temp file immediately
                if (fs.existsSync(tempCnfPath)) fs.unlinkSync(tempCnfPath);

                if (code === 0) {
                    // Check if file is empty (common silent failure)
                    if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
                        fs.unlinkSync(filePath);
                        return reject(new Error('Backup file created but empty.'));
                    }

                    // Auto-rotate backups (Keep max 5)
                    try {
                        await this.rotateLocalBackups(5);
                    } catch (rotError) {
                        console.warn('[Backup] Warning: Failed to rotate backups:', rotError);
                    }

                    resolve(filePath);
                } else {
                    console.error('[Backup] Dump Process exited with code', code);
                    console.error('[Backup] Stderr:', stderrData);

                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Delete partial file
                    reject(new Error(`Mysqldump failed (Code ${code}): ${stderrData}`));
                }
            });

            writeStream.on('error', (err) => {
                if (fs.existsSync(tempCnfPath)) fs.unlinkSync(tempCnfPath);
                reject(new Error(`File write error: ${err.message}`));
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

        // 2. Security: Create a temporary cnf file for credentials
        // This avoids passing password in command line (unsafe) or env var (sometimes unreliable)
        const timestamp = Date.now();
        const cnfPath = path.join(this.backupDir, `.temp-restore-${timestamp}.cnf`);

        // Ensure strictly private permissions for security
        const cnfContent = `[client]
user="${DB_USER || 'root'}"
password="${DB_PASSWORD || ''}"
host="${DB_HOST || 'localhost'}"
`;
        try {
            fs.writeFileSync(cnfPath, cnfContent, { mode: 0o600 });
        } catch (e) {
            console.error('[Restore] Failed to write temp config file:', e);
            throw new Error('Gagal menyiapkan kredensial database sementara.');
        }

        console.log(`[Restore] Starting restore using config file integration...`);
        console.log(`[Restore] Target DB: ${DB_NAME}`);
        console.log(`[Restore] Using Tool: ${mysqlCmd}`);

        try {
            // 3. Use spawn for better stdio handling and large file support
            // spawn is imported from top level

            // Construct arguments: mysql --defaults-extra-file=... dbname
            // Note: We cannot easily do "< file" in spawn args. We must stream it to stdin.
            const fileStream = fs.createReadStream(filePath);

            await new Promise<void>((resolve, reject) => {
                const child = spawn(mysqlCmd, [
                    `--defaults-extra-file=${cnfPath}`,
                    DB_NAME || 'billing' // Database name must be last arg usually
                ]);

                // Pipe the SQL file to stdin of the mysql process
                fileStream.pipe(child.stdin);

                let stderrData = '';

                child.stderr.on('data', (data: any) => {
                    stderrData += data.toString();
                });

                child.on('error', (err: any) => {
                    reject(new Error(`Failed to start subprocess: ${err.message}`));
                });

                child.on('close', (code: number) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        console.error(`[Restore] MySQL Process exited with code ${code}. Stderr: ${stderrData}`);

                        // Analyze error for friendly message
                        let friendlyMsg = stderrData;
                        if (stderrData.includes('Access denied')) {
                            friendlyMsg = 'Akses Ditolak (Access Denied). Cek username/password di .env dan pastikan user memiliki akses.';
                        } else if (stderrData.includes('Unknown database')) {
                            friendlyMsg = `Database '${DB_NAME}' tidak ditemukan.`;
                        } else if (stderrData.includes('command not found')) {
                            friendlyMsg = `Tool '${mysqlCmd}' tidak ditemukan. Mohon install mysql-client.`;
                        }

                        reject(new Error(`Restore Failed (Code ${code}): ${friendlyMsg}`));
                    }
                });
            });

            console.log('[Restore] Success');
        } catch (error) {
            console.error('[Restore] Error:', error);
            throw error;
        } finally {
            // 4. Cleanup security file
            if (fs.existsSync(cnfPath)) {
                fs.unlinkSync(cnfPath);
            }
        }

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
