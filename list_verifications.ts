
import { databasePool } from './src/db/pool';

async function listVerifications() {
    try {
        const query = `
            SELECT 
                mpv.id, mpv.created_at, mpv.status, 
                mpv.extracted_amount, mpv.expected_amount, 
                mpv.reason, mpv.notes,
                c.name as customer_name
            FROM manual_payment_verifications mpv
            LEFT JOIN customers c ON mpv.customer_id = c.id
            ORDER BY mpv.created_at DESC
            LIMIT 50
        `;
        const [rows] = await databasePool.query(query);
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
listVerifications();
