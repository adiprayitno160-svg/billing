import { databasePool } from '../src/db/pool';
import { IsolationService } from '../src/services/billing/isolationService';
import { RowDataPacket } from 'mysql2';

async function massRestore() {
    console.log('--- MASS RESTORE START ---');
    const connection = await databasePool.getConnection();
    
    try {
        // Find all isolated customers
        const [customers] = await connection.query<RowDataPacket[]>(
            'SELECT id, name, customer_code FROM customers WHERE is_isolated = 1'
        );
        
        // Update custom_payment_deadline to 28 for all isolated customers
        console.log('[MassRestore] Updating custom_payment_deadline to 28 for isolated customers...');
        await connection.query(
            'UPDATE customers SET custom_payment_deadline = 28 WHERE is_isolated = 1'
        );
        
        console.log(`[MassRestore] Found ${customers.length} isolated customers.`);
        
        for (const customer of customers) {
            console.log(`[MassRestore] Attempting restore for: ${customer.name} (ID: ${customer.id})`);
            try {
                // Perform restoration using IsolationService
                const result = await IsolationService.isolateCustomer({
                    customer_id: customer.id,
                    action: 'restore',
                    reason: 'Forced Mass Restore: Due date shift to March 28',
                    performed_by: 'Admin'
                }, connection);
                console.log(`[MassRestore] Result for ${customer.name}: ${result ? 'SUCCESS' : 'FAILED'}`);
            } catch (err: any) {
                console.error(`[MassRestore] Error restoring ${customer.name}:`, err.message);
            }
        }
        
    } catch (error) {
        console.error('[MassRestore] Global Error:', error);
    } finally {
        connection.release();
        console.log('--- MASS RESTORE END ---');
        process.exit(0);
    }
}

massRestore();
