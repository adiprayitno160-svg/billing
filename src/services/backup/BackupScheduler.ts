import cron from 'node-cron';
import { DatabaseBackupService } from './DatabaseBackupService';

export class BackupScheduler {
    static init() {
        console.log('[BackupScheduler] Initializing backup scheduler...');

        // Schedule: daily at 02:00
        cron.schedule('0 2 * * *', async () => {
            console.log('[BackupScheduler] Running scheduled backup...');
            try {
                const backupService = new DatabaseBackupService();
                await backupService.backupNow();
                console.log('[BackupScheduler] Scheduled backup completed successfully');
            } catch (error) {
                console.error('[BackupScheduler] Scheduled backup failed:', error);
            }
        });

        console.log('[BackupScheduler] Backup scheduled for 02:00 daily');
    }
}
