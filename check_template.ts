
import { databasePool } from './src/db/pool';

async function checkTemplate() {
    console.log('Checking templates...');
    try {
        const [rows] = await databasePool.query(
            "SELECT * FROM notification_templates WHERE notification_type = 'customer_created'"
        );
        console.log('Templates found:', JSON.stringify(rows, null, 2));
    } catch (error: any) {
        console.error('Check failed:', error.message);
    } finally {
        process.exit(0);
    }
}

checkTemplate();
