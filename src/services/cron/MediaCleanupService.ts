
import fs from 'fs';
import path from 'path';
import { databasePool } from '../../db/pool';

export class MediaCleanupService {
    private static readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Check every 24 hours
    private static readonly MAX_AGE_DAYS = 90; // Default 90 days
    private static readonly UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'whatsapp');

    private static timer: NodeJS.Timeout | null = null;

    /**
     * Start the cleanup scheduler
     */
    static startScheduler(maxAgeDays: number = 90): void {
        if (this.timer) return; // Already running

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
    static stopScheduler(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Execute cleanup logic
     */
    static async runCleanup(maxAgeDays: number): Promise<void> {
        console.log('[MediaCleanup] Starting cleanup process...');
        try {
            if (!fs.existsSync(this.UPLOAD_DIR)) {
                console.log('[MediaCleanup] Upload directory not found, skipping.');
                return;
            }

            const files = fs.readdirSync(this.UPLOAD_DIR);
            const now = Date.now();
            const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
            let deletedCount = 0;
            let errors = 0;

            for (const file of files) {
                // Skip .gitignore or system files if any
                if (file.startsWith('.')) continue;

                const filePath = path.join(this.UPLOAD_DIR, file);
                try {
                    const stats = fs.statSync(filePath);
                    const fileAge = now - stats.mtimeMs;

                    if (fileAge > maxAgeMs) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                        // console.log(`[MediaCleanup] Deleted old file: ${file}`);
                    }
                } catch (err: any) {
                    console.error(`[MediaCleanup] Failed to process file ${file}:`, err.message);
                    errors++;
                }
            }

            console.log(`[MediaCleanup] Cleanup complete. Deleted ${deletedCount} files. Errors: ${errors}.`);

        } catch (error) {
            console.error('[MediaCleanup] Fatal error during cleanup:', error);
        }
    }
}
