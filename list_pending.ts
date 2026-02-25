
import { databasePool } from './src/db/pool';

async function listPendingVerifications() {
    try {
        const query = `
            SELECT v.id, v.customer_id, c.name as customer_name, v.extracted_amount, v.status, v.reason, v.created_at
            FROM manual_payment_verifications v
            LEFT JOIN customers c ON v.customer_id = c.id
            WHERE v.status IN ('pending', 'rejected')
            ORDER BY v.created_at DESC
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
listPendingVerifications();
