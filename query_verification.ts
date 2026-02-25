
import { databasePool } from './src/db/pool';

async function queryVerification() {
    try {
        const query = `
            SELECT 
                mpv.id, mpv.created_at, mpv.status, 
                mpv.extracted_amount, mpv.expected_amount, 
                mpv.reason, mpv.notes,
                c.name as customer_name, c.phone as customer_phone
            FROM manual_payment_verifications mpv
            LEFT JOIN customers c ON mpv.customer_id = c.id
            WHERE c.name LIKE '%Wildan Wakhid%' OR c.name LIKE '%Yeni Mayasari%'
            ORDER BY mpv.created_at DESC
        `;
        const [rows] = await databasePool.query(query);
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
queryVerification();
