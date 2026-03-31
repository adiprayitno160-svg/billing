import fs from 'fs';
import path from 'path';
import { logger } from '../../services/logger';

export class InvoiceCleanupService {
    private static readonly INVOICE_DIR = path.join(process.cwd(), 'public', 'invoices');
    private static readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

    /**
     * Run the cleanup process
     */
    static async runCleanup(): Promise<void> {
        try {
            if (!fs.existsSync(this.INVOICE_DIR)) {
                return;
            }

            const files = fs.readdirSync(this.INVOICE_DIR);
            const now = Date.now();
            let deletedCount = 0;

            for (const file of files) {
                if (!file.endsWith('.pdf')) continue;

                const filePath = path.join(this.INVOICE_DIR, file);
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;

                if (age > this.MAX_AGE_MS) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                logger.info(`🧹 [Cleanup] Deleted ${deletedCount} old invoice PDF files.`);
            }
        } catch (error: any) {
            logger.error(`❌ [Cleanup] Error cleaning invoices: ${error.message}`);
        }
    }
    /**
     * Start the scheduler
     */
    static startScheduler(): void {
        // Run immediately on startup
        this.runCleanup();

        // Run every 1 hour
        setInterval(() => {
            this.runCleanup();
        }, 60 * 60 * 1000);
    }
}
