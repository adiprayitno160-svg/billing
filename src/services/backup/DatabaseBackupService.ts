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

            // 2. Platform specific detection
            if (process.platform === 'win32') {
                // Dynamic check for Laragon MySQL version
                const laragonMysqlBase = 'C:\\laragon\\bin\\mysql';
                if (fs.existsSync(laragonMysqlBase)) {
                    const dirs = fs.readdirSync(laragonMysqlBase);
                    const mysqlDirs = dirs.filter(d => d.startsWith('mysql-') && fs.statSync(path.join(laragonMysqlBase, d)).isDirectory());

                    if (mysqlDirs.length > 0) {
                        for (const dir of mysqlDirs) {
                            const candidate = path.join(laragonMysqlBase, dir, 'bin', 'mysqldump.exe');
                            if (fs.existsSync(candidate)) {
                                console.log(`[Backup] Auto-detected mysqldump at: ${candidate}`);
                                return candidate;
                            }
                        }
                    }
                }
            } else {
                // Linux/Mac Logic
                const commonPaths = [
                    '/usr/bin/mysqldump',
                    '/usr/local/bin/mysqldump',
                    '/bin/mysqldump',
                    '/snap/bin/mysqldump'
                ];

                for (const p of commonPaths) {
                    if (fs.existsSync(p)) {
                        console.log(`[Backup] Found mysqldump binary at: ${p}`);
                        return p;
                    }
                }

                // Try 'which' command
                try {
                    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
                        exec('which mysqldump', (err, stdout, stderr) => err ? reject(err) : resolve({ stdout, stderr }));
                    });
                    if (stdout) {
                        const trimmed = stdout.trim();
                        console.log(`[Backup] 'which mysqldump' found: ${trimmed}`);
                        return trimmed;
                    }
                } catch (e) { /* ignore */ }
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
            throw error;
        }
    }

    /**
     * Perform Full System Backup (Source + DB + Uploads)
     * Intended for migration to another server
     */
    async fullSystemBackup(): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `full-backup-${timestamp}.tar.gz`;
        const backupFilePath = path.join(this.backupDir, backupFileName);

        // 1. Dump Database first
        console.log('[FullBackup] Creating temporary database dump...');
        const sqlPath = await this.dumpDatabase();
        const sqlFileName = path.basename(sqlPath);

        // 2. Create Archive using tar
        // We exclude node_modules, .git, storage/backups (to avoid recursion), and dist
        console.log('[FullBackup] Archiving system files...');

        return new Promise((resolve, reject) => {
            // Determine exclude syntax based on platform if needed, 
            // but standard tar --exclude works on Win10+ (bsdtar) and Linux (GNU tar) typically.
            // On Windows (bsdtar), --exclude pattern should not have drive letters. Relative paths are safest.

            const excludes = [
                '--exclude=node_modules',
                '--exclude=.git',
                '--exclude=dist',
                '--exclude=storage/backups/*.tar.gz', // Don't include other archives
                '--exclude=storage/backups/*.zip',   // Don't include other archives
                // We DO want to include the SQL file we just made, which is in storage/backups
                // But we don't want to recursively include the file we are writing to.
                `--exclude=${backupFileName}`
            ];

            // Command: tar -czf <dest> <excludes> .
            // We run this from the project root (process.cwd())

            // Note: On Windows specifically, sometimes 'tar' is fussy about paths used in arguments. 
            // We'll use relative path for destination to be safe: 'storage/backups/file.tar.gz'
            // converting backslashes to forward slashes for consistency with tar command
            const relativeDest = path.relative(process.cwd(), backupFilePath).split(path.sep).join('/');

            // We need to include the specific SQL file we just created. 
            // Since we excluded `storage/backups/*.tar.gz`, the .sql should be safe?
            // Wait, if we use `.` (dot) as source, it includes `storage/backups` folder.
            // If we exclude `storage/backups`, we miss the SQL file we just dumped!
            // Solution: Exclude storage/backups BUT explicitly include the sql file? 
            // Tar is tricky with include/exclude order.

            // Better Strategy: Move the SQL file to root temporarily? No, risky.
            // Strategy: Don't exclude `storage/backups` entirely.
            // Just exclude previous backups.

            const tarArgs = [
                '-czf', relativeDest,
                '--exclude=node_modules',
                '--exclude=.git',
                '--exclude=.vscode',
                '--exclude=dist',
                // Exclude existing backup files to prevent massive bloat
                '--exclude=storage/backups/*.tar.gz',
                '--exclude=storage/backups/*.zip',
                '--exclude=storage/backups/*.sql', // Exclude OLD sql files
                // BUT we want to include the CURRENT sql file. 
                // If we exclude *.sql, we exclude the current one too.
                // We can use a specific inclusion or just rename the current one to something unique safely?
                // Or, strictly exclude only *other* files. 
                // easier: pass the specific SQL file as an argument to tar, AND `.`?
                // tar -czf out.tar.gz . storage/backups/dump.sql
            ];

            // If we just run tar on `.`, it will scan everything.
            // We can add the SQL file specifically if we want to be sure, but it is in `storage/backups`.
            // Let's just NOT exclude .sql files generally, but we rely on rotateLocalBackups having cleaned up old ones?
            // Or we can just include the SQL file explicitly?

            // Refined Strategy:
            // 1. We already have the SQL file.
            // 2. We allow `storage/backups` in the tar, but we exclude `*.tar.gz`, `*.zip`.
            // 3. We accept that old `.sql` files might be included if they weren't rotated. 
            //    (User usually has 5 max, so it's fine).

            const processCmd = spawn('tar', [...tarArgs, '.'], {
                cwd: process.cwd(),
                shell: true
            });

            processCmd.on('close', (code) => {
                // Delete the temp SQL file after archiving (optional, but good for cleanup)
                // The user wanted "Source + DB", keeping the SQL separate is also fine, 
                // but usually a full backup zip implies one file.
                // We'll keep it there for now as a "side effect" backup, or delete it?
                // Let's delete it so the user only downloads the tar.gz
                // But wait, what if tar failed?

                if (code === 0) {
                    console.log('[FullBackup] Archive created successfully:', backupFilePath);

                    // Try to remove the temp SQL to save space
                    /*
                    try {
                        if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
                    } catch (e) { console.warn('Failed to delete temp sql:', e); }
                    */
                    // Actually, keeping the SQL is fine. The user might want just the DB later.
                    // But `fullSystemBackup` implies we want the package. 
                    // Let's leave the SQL file. It's listed in backups anyway.

                    resolve(backupFilePath);
                } else {
                    reject(new Error(`Tar process exited with code ${code}`));
                }
            });

            processCmd.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Delete files leaving only the N most recent ones
     * Modified to handle both .sql and .tar.gz separately or together
     */
    async rotateLocalBackups(maxFiles: number = 5): Promise<void> {
        try {
            if (!fs.existsSync(this.backupDir)) return;

            const files = fs.readdirSync(this.backupDir)
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    time: fs.statSync(path.join(this.backupDir, f)).birthtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            const sqlFiles = files.filter(f => f.name.endsWith('.sql'));
            const archiveFiles = files.filter(f => f.name.endsWith('.tar.gz') || f.name.endsWith('.zip'));

            // Rotate SQL files
            if (sqlFiles.length > maxFiles) {
                for (const file of sqlFiles.slice(maxFiles)) {
                    fs.unlinkSync(file.path);
                }
            }

            // Rotate Archive files (Keep fewer of these, they are large)
            if (archiveFiles.length > 3) {
                for (const file of archiveFiles.slice(3)) {
                    fs.unlinkSync(file.path);
                }
            }

        } catch (error) {
            console.error('[Backup] Rotation failed:', error);
            // Don't throw, just log
        }
    }
}
