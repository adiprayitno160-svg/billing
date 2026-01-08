
import { databasePool } from './src/db/pool';

async function fixModelInDB() {
    try {
        console.log('--- Fixing Database Model Setting to 2.5 ---');

        // Force Update
        const targetModel = 'gemini-2.5-flash';
        console.log(`\nUpdating model to: ${targetModel}...`);

        await databasePool.query('UPDATE ai_settings SET model = ?', [targetModel]);

        console.log('✅ Database updated successfully.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await databasePool.end();
        process.exit();
    }
}

fixModelInDB();
