
import { databasePool } from '../db/pool';
import dotenv from 'dotenv';

dotenv.config();

async function migrateGenieacsSettings() {
    console.log('🔄 Migrating GenieACS settings to database...');

    try {
        const settings = [
            { key: 'genieacs_host', value: '192.168.239.154', desc: 'GenieACS Server IP' },
            { key: 'genieacs_port', value: '7557', desc: 'GenieACS API Port' }
        ];

        for (const setting of settings) {
            await databasePool.query(`
                INSERT INTO system_settings (setting_key, setting_value, description) 
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            `, [setting.key, setting.value, setting.desc]);
            console.log(`✅ Set ${setting.key} = ${setting.value}`);
        }

        console.log('✨ GenieACS settings migration completed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateGenieacsSettings();
