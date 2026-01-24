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

            // 1. Pull
            console.log('[SystemUpdate] Pulling changes...');
            await git.pull('origin', 'main');

            // 2. Install Dependencies (if package.json changed)
            // For safety, we always run install in production update
            console.log('[SystemUpdate] Installing dependencies...');
            await execAsync('npm install --omit=dev');

            // 3. Build (Typescript)
            console.log('[SystemUpdate] Building project...');
            await execAsync('npm run build');

            // 4. Restart (PM2)
            console.log('[SystemUpdate] Restarting application...');
            // This might kill the current process, so we return a status before this if possible,
            // but usually the caller (API) will timeout. 
            // We use a detached process or rely on PM2 to restart us if we exit.

            // Allow time for response to be sent to client
            setTimeout(() => {
                process.exit(0); // If running under PM2, this restarts the app
            }, 2000);

            return { success: true, message: 'Update berhasil. Sistem akan restart dalam beberapa detik.' };

        } catch (error) {
            console.error('[SystemUpdate] Update failed:', error);
            throw error;
        }
    }
}
