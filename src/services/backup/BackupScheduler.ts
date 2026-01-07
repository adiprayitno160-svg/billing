import cron from 'node-cron';
import { DatabaseBackupService } from './DatabaseBackupService';

export class BackupScheduler {
    static init() {
        console.log('[BackupScheduler] Initializing backup scheduler...');

        // Schedule: weekly on Sunday at 02:00
        cron.schedule('0 2 * * 0', async () => {
            console.log('[BackupScheduler] Running scheduled weekly backup...');
            try {
                const backupService = new DatabaseBackupService();
                await backupService.backupNow();
                console.log('[BackupScheduler] Scheduled weekly backup completed successfully');
            } catch (error) {
                console.error('[BackupScheduler] Scheduled weekly backup failed:', error);
            }
        });

        console.log('[BackupScheduler] Backup scheduled for 02:00 every Sunday (Weekly)');
    }
}
