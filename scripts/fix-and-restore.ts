import { databasePool } from '../src/db/pool';
import { IsolationService } from '../src/services/billing/isolationService';
import { RowDataPacket } from 'mysql2';

async function performUserRequest() {
    console.log('--- PERFORM USER REQUEST START ---');
    const connection = await databasePool.getConnection();
    
    try {
        // 1. Set custom_payment_deadline to 28 and billing_mode to postpaid (Request: "default jangan prabayar", "jatuh tempo 28")
        console.log('[Fix] Setting custom_payment_deadline = 28 and billing_mode = postpaid for all customers...');
        await connection.query("UPDATE customers SET custom_payment_deadline = 28, billing_mode = 'postpaid'");

        // 2. Extend due_date for March invoices to March 28th
        console.log('[Fix] Extending due_date to 2026-03-28 for unpaid March invoices...');
        await connection.query(
            "UPDATE invoices SET due_date = '2026-03-28' WHERE status != 'paid' AND period = '2026-03'"
        );

        // 3. Find and restore all isolated customers (Sync DB -> Mikrotik)
        const [isolated] = await connection.query<RowDataPacket[]>(
            'SELECT id, name FROM customers WHERE is_isolated = 1'
        );
        
        console.log(`[Fix] Found ${isolated.length} isolated customers in DB to ensure isolated in Mikrotik.`);

        // 4. Force sync for Nina (ID 133 and 226) and others who should be active
        const [shouldBeActive] = await connection.query<RowDataPacket[]>(
            'SELECT id, name FROM customers WHERE is_isolated = 0 AND status = "active"'
        );
        console.log(`[Fix] Found ${shouldBeActive.length} customers who should be active. Syncing to Mikrotik...`);

        const allToSync = [...isolated.map(c => ({...(c as any), action: 'isolate' as const})), 
                           ...shouldBeActive.map(c => ({...(c as any), action: 'restore' as const}))];

        for (const customer of allToSync) {
            console.log(`[Fix] Syncing ${customer.name} (ID: ${customer.id}) -> ${customer.action}...`);
            try {
                await IsolationService.isolateCustomer({
                    customer_id: customer.id,
                    action: customer.action,
                    reason: 'System sync: Ensure DB and Mikrotik are consistent',
                    performed_by: 'Admin'
                }, connection);
            } catch (err: any) {
                console.error(`[Fix] Error syncing ${customer.id}:`, err.message);
            }
        }
        
        console.log('[Fix] Done!');
    } catch (error) {
        console.error('[Fix] Global Error:', error);
    } finally {
        connection.release();
        process.exit(0);
    }
}

performUserRequest();
