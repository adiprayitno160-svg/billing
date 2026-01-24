import simpleGit from 'simple-git';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);
const git = simpleGit();

export class SystemUpdateService {

    /**
     * Check for updates from remote repository
     */
    static async checkForUpdates() {
        try {
            console.log('[SystemUpdate] Fetching updates...');
            await git.fetch();

            const status = await git.status();
            const log = await git.log(['HEAD..origin/main']); // Assuming main branch

            const behindCount = status.behind;
            const newCommits = log.total;

            return {
                hasUpdate: newCommits > 0,
                behind: behindCount || newCommits,
                commits: log.all.map(c => ({
                    hash: c.hash.substring(0, 7),
                    date: c.date,
                    message: c.message,
                    author: c.author_name
                }))
            };
        } catch (error) {
            console.error('[SystemUpdate] Check failed:', error);
            throw new Error('Gagal mengecek update git');
        }
    }

    /**
     * Perform update: Pull, Install, Build, Restart
     */
    static async performUpdate() {
        try {
            console.log('[SystemUpdate] Starting update process...');

            // 1. Force Sync with Remote (Reset Hard to avoid merge conflicts)
            console.log('[SystemUpdate] Fetching and Resetting...');
            await git.fetch();
            await git.reset(['--hard', 'origin/main']);

            // 2. Install Dependencies
            console.log('[SystemUpdate] Installing dependencies...');
            try {
                // Increase buffer size for large output
                await execAsync('npm install --omit=dev', { maxBuffer: 1024 * 1024 * 5 });
            } catch (e: any) {
                console.warn('[SystemUpdate] npm install warning (continuing):', e.stderr || e.message);
            }

            // 3. Build (Typescript)
            console.log('[SystemUpdate] Building project...');
            try {
                // Increase buffer size
                await execAsync('npm run build', { maxBuffer: 1024 * 1024 * 5 });
            } catch (e: any) {
                const errMsg = e.stderr || e.message;
                console.error('[SystemUpdate] Build failed:', errMsg);
                // Check for permission error hint
                if (errMsg.includes('EACCES')) {
                    throw new Error('Build gagal karena izin akses ditolak (Permission Denied). Silakan jalankan "sudo chown -R $USER:www-data /var/www/billing" di terminal server.');
                }
                throw new Error(`Build gagal: ${errMsg.substring(0, 200)}...`);
            }

            // 4. Restart (PM2)
            console.log('[SystemUpdate] Restarting application...');

            // Allow time for response to be sent to client
            setTimeout(() => {
                // Try PM2 restart first if available globally, OR just exit and let PM2 autostart
                // We use process.exit(0) effectively mostly.
                process.exit(0);
            }, 2000);

            return { success: true, message: 'Update berhasil. Sistem akan restart dalam beberapa detik.' };

        } catch (error: any) {
            console.error('[SystemUpdate] Update failed:', error);
            throw new Error(error.message || 'Update gagal');
        }
    }
}
