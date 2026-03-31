import { databasePool } from '../src/db/pool';
import { IsolationService } from '../src/services/billing/isolationService';
import { RowDataPacket } from 'mysql2';

async function massRestoreV3() {
    console.log('--- MASS RESTORE V3 START (Date: 2026-03-13, Deadline -> 1) ---');
    const connection = await databasePool.getConnection();
    
    try {
        // Find all customers isolated on 2026-03-13
        // We use DATE(isolated_at) to match the day
        const [customers] = await connection.query<RowDataPacket[]>(
            'SELECT id, name, customer_code FROM customers WHERE is_isolated = 1 AND DATE(isolated_at) = "2026-03-13"'
        );
        
        console.log(`[MassRestoreV3] Found ${customers.length} customers isolated on 2026-03-13.`);
        
        if (customers.length > 0) {
            const customerIds = customers.map(c => c.id);
            console.log(`[MassRestoreV3] Updating custom_payment_deadline to 1 for ${customers.length} customers...`);
            
            await connection.query(
                'UPDATE customers SET custom_payment_deadline = 1 WHERE id IN (?)',
                [customerIds]
            );

            for (const customer of customers) {
                console.log(`[MassRestoreV3] Attempting restore for: ${customer.name} (ID: ${customer.id})`);
                try {
                    const result = await IsolationService.isolateCustomer({
                        customer_id: customer.id,
                        action: 'restore',
                        reason: 'User request: Shift isolated today (13/3) to deadline 1 and unblock',
                        performed_by: 'Admin'
                    }, connection);
                    console.log(`[MassRestoreV3] Result for ${customer.name}: ${result ? 'SUCCESS' : 'FAILED'}`);
                } catch (err: any) {
                    console.error(`[MassRestoreV3] Error restoring ${customer.name}:`, err.message);
                }
            }
        }
        
    } catch (error) {
        console.error('[MassRestoreV3] Global Error:', error);
    } finally {
        connection.release();
        console.log('--- MASS RESTORE V3 END ---');
        process.exit(0);
    }
}

massRestoreV3();
