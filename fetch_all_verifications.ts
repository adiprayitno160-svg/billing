
import { databasePool } from './src/db/pool';

async function fetchAllVerifications() {
    try {
        const query = `
            SELECT * FROM manual_payment_verifications 
            WHERE status IN ('pending', 'rejected') 
            ORDER BY created_at DESC
        `;
        const [rows] = await databasePool.query(query) as any;
        // Exclude image_data
        const sanitized = rows.map((r: any) => {
            const { image_data, ...rest } = r;
            return rest;
        });
        console.log(JSON.stringify(sanitized, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
fetchAllVerifications();
