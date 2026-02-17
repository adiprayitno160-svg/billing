
import { databasePool } from './db/pool';

async function fixTable() {
    console.log('Checking whatsapp_sessions table...');
    try {
        const [rows]: any = await databasePool.query('DESCRIBE whatsapp_sessions');
        const columns = rows.map((r: any) => r.Field);

        if (!columns.includes('updated_at')) {
            console.log('Adding updated_at column...');
            await databasePool.query('ALTER TABLE whatsapp_sessions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
            console.log('✅ Column added.');
        } else {
            console.log('✅ Column already exists.');
        }

        if (!columns.includes('created_at')) {
            console.log('Adding created_at column...');
            await databasePool.query('ALTER TABLE whatsapp_sessions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
            console.log('✅ Column added.');
        }

    } catch (err) {
        console.error('Error fixing table:', err);
    } finally {
        process.exit(0);
    }
}

fixTable();
