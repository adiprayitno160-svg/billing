
import { DatabaseBackupService } from '../services/backup/DatabaseBackupService';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config();

(async () => {
    try {
        console.log('🚀 Starting backup process...');
        const backupService = new DatabaseBackupService();

        const result = await backupService.backupNow();

        console.log('✅ Backup successfully completed!');
        if (result.localPath) {
            console.log(`📂 Local file: ${result.localPath}`);
        }
        if (result.webViewLink) {
            console.log(`☁️ Google Drive: ${result.webViewLink}`);
        }

        process.exit(0);
    } catch (error: any) {
        console.error('❌ Backup failed:', error.message);
        process.exit(1);
    }
})();
