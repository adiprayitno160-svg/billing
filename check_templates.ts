
import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

async function checkTemplates() {
    try {
        const [rows] = await databasePool.query<RowDataPacket[]>(
            "SELECT notification_type, channel, is_active, template_code FROM notification_templates WHERE notification_type IN ('payment_received', 'payment_partial')"
        );
        console.log('--- Notification Templates ---');
        console.table(rows);
        process.exit(0);
    } catch (error) {
        console.error('Error checking templates:', error);
        process.exit(1);
    }
}

checkTemplates();
