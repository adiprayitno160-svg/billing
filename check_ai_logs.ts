
import { databasePool } from './src/db/pool';

async function checkAILogs() {
    try {
        const query = `
            SELECT l.*, c.name as customer_name, c.phone as customer_phone
            FROM ai_verification_logs l
            JOIN customers c ON l.customer_id = c.id
            WHERE c.name LIKE '%Wildan%' OR c.name LIKE '%Yeni%'
               OR l.reason LIKE '%Wildan%' OR l.reason LIKE '%Yeni%'
            ORDER BY l.created_at DESC
            LIMIT 20
        `;
        const [rows] = await databasePool.query(query) as any;
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
checkAILogs();
