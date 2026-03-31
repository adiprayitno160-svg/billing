"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceCleanupService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../../services/logger");
class InvoiceCleanupService {
    /**
     * Run the cleanup process
     */
    static async runCleanup() {
        try {
            if (!fs_1.default.existsSync(this.INVOICE_DIR)) {
                return;
            }
            const files = fs_1.default.readdirSync(this.INVOICE_DIR);
            const now = Date.now();
            let deletedCount = 0;
            for (const file of files) {
                if (!file.endsWith('.pdf'))
                    continue;
                const filePath = path_1.default.join(this.INVOICE_DIR, file);
                const stats = fs_1.default.statSync(filePath);
                const age = now - stats.mtimeMs;
                if (age > this.MAX_AGE_MS) {
                    fs_1.default.unlinkSync(filePath);
                    deletedCount++;
                }
            }
            if (deletedCount > 0) {
                logger_1.logger.info(`🧹 [Cleanup] Deleted ${deletedCount} old invoice PDF files.`);
            }
        }
        catch (error) {
            logger_1.logger.error(`❌ [Cleanup] Error cleaning invoices: ${error.message}`);
        }
    }
    /**
     * Start the scheduler
     */
    static startScheduler() {
        // Run immediately on startup
        this.runCleanup();
        // Run every 1 hour
        setInterval(() => {
            this.runCleanup();
        }, 60 * 60 * 1000);
    }
}
exports.InvoiceCleanupService = InvoiceCleanupService;
InvoiceCleanupService.INVOICE_DIR = path_1.default.join(process.cwd(), 'public', 'invoices');
InvoiceCleanupService.MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
//# sourceMappingURL=InvoiceCleanupService.js.map