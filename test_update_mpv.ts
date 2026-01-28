
import { databasePool } from './src/db/pool';

async function testUpdate() {
    const conn = await databasePool.getConnection();
    try {
        // 1. Insert dummy (using expected_amount)
        const [res] = await conn.query<any>('INSERT INTO manual_payment_verifications (customer_id, expected_amount, status) VALUES (1, 50000, "pending")');
        const id = res.insertId;
        console.log('Inserted ID:', id);

        // 2. Update with verified_by
        await conn.query(
            `UPDATE manual_payment_verifications 
             SET status = 'rejected', verified_by = ?, verified_at = NOW(), notes = ?
             WHERE id = ?`,
            [1, 'Testing update', id]
        );
        console.log('Update Successful!');

        // 3. Clean up
        await conn.query('DELETE FROM manual_payment_verifications WHERE id = ?', [id]);
        console.log('Cleaned up.');

    } catch (error) {
        console.error('Update Failed:', error);
    } finally {
        conn.release();
        process.exit();
    }
}

testUpdate();
