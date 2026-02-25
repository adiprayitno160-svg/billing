
import { databasePool } from './src/db/pool';

async function queryPending() {
    try {
        const query = `
            SELECT 
                mpv.id, mpv.created_at, mpv.status, 
                mpv.extracted_amount, mpv.expected_amount, 
                mpv.reason, mpv.notes,
                c.name as customer_name, c.phone as customer_phone
            FROM manual_payment_verifications mpv
            LEFT JOIN customers c ON mpv.customer_id = c.id
            WHERE mpv.status = 'pending' OR mpv.status = 'rejected'
            ORDER BY mpv.created_at DESC
            LIMIT 10
        `;
        const [rows] = await databasePool.query(query);
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
queryPending();
