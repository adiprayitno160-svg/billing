
import { databasePool } from './src/db/pool';

async function checkAISettings() {
    try {
        const [rows] = await databasePool.query('SELECT * FROM ai_settings') as any;
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
checkAISettings();
