
import { DatabaseBackupService } from '../services/backup/DatabaseBackupService';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config();

(async () => {
    try {
        console.log('🚀 Starting FULL system backup process...');
        const backupService = new DatabaseBackupService();

        const result = await backupService.fullSystemBackup();

        console.log('✅ Full Backup successfully completed!');
        console.log(`📂 File path: ${result}`);

        process.exit(0);
    } catch (error: any) {
        console.error('❌ Backup failed:', error.message);
        process.exit(1);
    }
})();
