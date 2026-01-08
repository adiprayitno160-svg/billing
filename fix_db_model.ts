
import { databasePool } from './src/db/pool';

async function fixModelInDB() {
    try {
        console.log('--- Fixing Database Model Setting ---');

        // Check current
        const [rows] = await databasePool.query('SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1');
        console.log('Current DB State:', rows[0]);

        // Force Update
        const targetModel = 'gemini-2.0-flash';
        console.log(`\nUpdating model to: ${targetModel}...`);

        await databasePool.query('UPDATE ai_settings SET model = ?', [targetModel]);

        console.log('✅ Database updated successfully.');

        // Verify
        const [rowsNew] = await databasePool.query('SELECT * FROM ai_settings ORDER BY id DESC LIMIT 1');
        console.log('New DB State:', rowsNew[0]);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await databasePool.end();
        process.exit();
    }
}

fixModelInDB();
