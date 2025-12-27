
import { databasePool } from '../db/pool';
import fs from 'fs';
import path from 'path';

async function forceUpdate() {
    try {
        const version = '2.1.31';
        console.log(`🚀 Forcing update to version ${version}...`);

        // 1. Update Database
        await databasePool.query(
            "UPDATE system_settings SET setting_value = ? WHERE setting_key = 'app_version'",
            [version]
        );
        console.log('✅ Database version updated in system_settings.');

        // 2. Update VERSION files
        const rootDir = path.join(__dirname, '../../');
        fs.writeFileSync(path.join(rootDir, 'VERSION'), version);
        fs.writeFileSync(path.join(rootDir, 'VERSION_MAJOR'), version);
        console.log('✅ VERSION files updated on disk.');

        console.log('✨ Force update complete! Please run npm run build and pm2 restart.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Force update failed:', e);
        process.exit(1);
    }
}

forceUpdate();
