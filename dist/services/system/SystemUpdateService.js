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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemUpdateService = void 0;
const simple_git_1 = __importDefault(require("simple-git"));
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execAsync = util_1.default.promisify(child_process_1.exec);
const git = (0, simple_git_1.default)();
class SystemUpdateService {
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
        }
        catch (error) {
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
            // Notify Admins about update start
            try {
                const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
                await UnifiedNotificationService.broadcastToAdmins(`⚙️ *SYSTEM UPDATE INITIATED*\n\n` +
                    `Sistem akan memulai proses pembaruan. Aplikasi mungkin akan restart sebentar.`);
            }
            catch (e) {
                console.warn('Failed to notify admins about update start:', e);
            }
            // 1. Force Sync with Remote (Reset Hard to avoid merge conflicts)
            console.log('[SystemUpdate] Fetching and Resetting...');
            await git.fetch();
            await git.reset(['--hard', 'origin/main']);
            // 2. Install Dependencies
            console.log('[SystemUpdate] Installing dependencies...');
            try {
                // Increase buffer size for large output
                await execAsync('npm install --omit=dev', { maxBuffer: 1024 * 1024 * 5 });
            }
            catch (e) {
                console.warn('[SystemUpdate] npm install warning (continuing):', e.stderr || e.message);
            }
            // 3. Build (Typescript)
            console.log('[SystemUpdate] Building project...');
            try {
                // Increase buffer size
                await execAsync('npm run build', { maxBuffer: 1024 * 1024 * 5 });
            }
            catch (e) {
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
            // Notify Admins about update success
            try {
                const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
                await UnifiedNotificationService.broadcastToAdmins(`🚀 *SYSTEM UPDATE SUCCESS*\n\n` +
                    `Sistem berhasil diperbarui ke versi terbaru di branch main.\n` +
                    `Aplikasi sedang melakukan restart otomatis.`);
            }
            catch (e) {
                console.warn('Failed to notify admins about update success:', e);
            }
            // Allow time for response to be sent to client
            setTimeout(() => {
                // Try PM2 restart first if available globally, OR just exit and let PM2 autostart
                // We use process.exit(0) effectively mostly.
                process.exit(0);
            }, 5000);
            return { success: true, message: 'Update berhasil. Sistem akan restart dalam beberapa detik.' };
        }
        catch (error) {
            console.error('[SystemUpdate] Update failed:', error);
            // Notify Admins about update failure
            try {
                const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
                await UnifiedNotificationService.broadcastToAdmins(`❌ *SYSTEM UPDATE FAILED*\n\n` +
                    `Pembaruan sistem gagal dengan error: ${error.message || 'Unknown error'}.`);
            }
            catch (e) {
                console.warn('Failed to notify admins about update failure:', e);
            }
            throw new Error(error.message || 'Update gagal');
        }
    }
}
exports.SystemUpdateService = SystemUpdateService;
//# sourceMappingURL=SystemUpdateService.js.map