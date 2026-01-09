
import { databasePool } from './src/db/pool';

async function fixAISettings() {
    try {
        const [result] = await databasePool.query(
            "UPDATE ai_settings SET model = 'gemini-1.5-flash' WHERE id = 1"
        );
        console.log('Updated AI Settings model to gemini-1.5-flash');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixAISettings();
