"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaCleanupService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class MediaCleanupService {
    /**
     * Start the cleanup scheduler
     */
    static startScheduler(maxAgeDays = 90) {
        if (this.timer)
            return; // Already running
        console.log(`[MediaCleanup] Scheduler started. Cleaning files older than ${maxAgeDays} days.`);
        // Run immediately on startup (with slight delay to let app boot)
        setTimeout(() => this.runCleanup(maxAgeDays), 60000); // 1 minute delay
        // Schedule periodic run
        this.timer = setInterval(() => {
            this.runCleanup(maxAgeDays);
        }, this.CLEANUP_INTERVAL_MS);
    }
    /**
     * Stop scheduler
     */
    static stopScheduler() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    /**
     * Execute cleanup logic
     */
    static async runCleanup(maxAgeDays) {
        console.log('[MediaCleanup] Starting cleanup process...');
        try {
            if (!fs_1.default.existsSync(this.UPLOAD_DIR)) {
                console.log('[MediaCleanup] Upload directory not found, skipping.');
                return;
            }
            const files = fs_1.default.readdirSync(this.UPLOAD_DIR);
            const now = Date.now();
            const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
            let deletedCount = 0;
            let errors = 0;
            for (const file of files) {
                // Skip .gitignore or system files if any
                if (file.startsWith('.'))
                    continue;
                const filePath = path_1.default.join(this.UPLOAD_DIR, file);
                try {
                    const stats = fs_1.default.statSync(filePath);
                    const fileAge = now - stats.mtimeMs;
                    if (fileAge > maxAgeMs) {
                        fs_1.default.unlinkSync(filePath);
                        deletedCount++;
                        // console.log(`[MediaCleanup] Deleted old file: ${file}`);
                    }
                }
                catch (err) {
                    console.error(`[MediaCleanup] Failed to process file ${file}:`, err.message);
                    errors++;
                }
            }
            console.log(`[MediaCleanup] Cleanup complete. Deleted ${deletedCount} files. Errors: ${errors}.`);
        }
        catch (error) {
            console.error('[MediaCleanup] Fatal error during cleanup:', error);
        }
    }
}
exports.MediaCleanupService = MediaCleanupService;
MediaCleanupService.CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Check every 24 hours
MediaCleanupService.MAX_AGE_DAYS = 90; // Default 90 days
MediaCleanupService.UPLOAD_DIR = path_1.default.join(process.cwd(), 'public', 'uploads', 'whatsapp');
MediaCleanupService.timer = null;
//# sourceMappingURL=MediaCleanupService.js.map