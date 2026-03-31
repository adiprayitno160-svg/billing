import { databasePool } from '../src/db/pool';

async function cleanupAndOptimize() {
    console.log('--- CLEANUP AND OPTIMIZE START ---');
    const connection = await databasePool.getConnection();
    
    try {
        // 1. Clear WhatsApp notification queue
        console.log('[Cleanup] Clearing unified_notifications_queue...');
        await connection.query('DELETE FROM unified_notifications_queue');
        await connection.query('ALTER TABLE unified_notifications_queue AUTO_INCREMENT = 1');

        // 2. Add missing indices for performance
        console.log('[Optimize] Adding indices if missing...');
        
        const tables = [
            { table: 'invoices', column: 'status', index: 'idx_invoices_status' },
            { table: 'invoices', column: 'due_date', index: 'idx_invoices_due_date' },
            { table: 'invoices', column: 'period', index: 'idx_invoices_period' },
            { table: 'customers', column: 'is_isolated', index: 'idx_customers_isolated' },
            { table: 'customers', column: 'status', index: 'idx_customers_status' },
            { table: 'isolation_logs', column: 'customer_id', index: 'idx_isolation_logs_customer' }
        ];

        for (const item of tables) {
            try {
                // Check if index exists
                const [indices] = await connection.query(`SHOW INDEX FROM ${item.table} WHERE Key_name = ?`, [item.index]);
                if ((indices as any[]).length === 0) {
                    console.log(`Adding index ${item.index} to ${item.table}...`);
                    await connection.query(`ALTER TABLE ${item.table} ADD INDEX ${item.index} (${item.column})`);
                }
            } catch (err: any) {
                console.warn(`Could not add index ${item.index}: ${err.message}`);
            }
        }

        // 3. One more check: Ensure all March invoices have due_date = 2026-03-25
        console.log('[Fix] Re-verifying March invoice due dates...');
        await connection.query(
            "UPDATE invoices SET due_date = '2026-03-25' WHERE status != 'paid' AND period = '2026-03' AND (due_date IS NULL OR due_date < '2026-03-25')"
        );

        console.log('[Cleanup] Done!');
    } catch (error) {
        console.error('[Cleanup] Global Error:', error);
    } finally {
        connection.release();
        process.exit(0);
    }
}

cleanupAndOptimize();
