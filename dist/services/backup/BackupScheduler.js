"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const DatabaseBackupService_1 = require("./DatabaseBackupService");
class BackupScheduler {
    static init() {
        console.log('[BackupScheduler] Initializing backup scheduler...');
        // Schedule: weekly on Sunday at 02:00
        node_cron_1.default.schedule('0 2 * * 0', async () => {
            console.log('[BackupScheduler] Running scheduled weekly backup...');
            try {
                const backupService = new DatabaseBackupService_1.DatabaseBackupService();
                await backupService.backupNow();
                console.log('[BackupScheduler] Scheduled weekly backup completed successfully');
            }
            catch (error) {
                console.error('[BackupScheduler] Scheduled weekly backup failed:', error);
            }
        });
        console.log('[BackupScheduler] Backup scheduled for 02:00 every Sunday (Weekly)');
    }
}
exports.BackupScheduler = BackupScheduler;
//# sourceMappingURL=BackupScheduler.js.map