import { databasePool } from '../src/db/pool';
import { RowDataPacket } from 'mysql2';

async function checkCustomers() {
    const names = ['YUDI', 'LALAK', 'NINA'];
    const connection = await databasePool.getConnection();
    try {
        for (const name of names) {
            console.log(`\n--- Checking: ${name} ---`);
            const [customers] = await connection.query<RowDataPacket[]>(
                "SELECT id, name, is_isolated, custom_payment_deadline FROM customers WHERE name LIKE ?",
                [`%${name}%`]
            );
            
            for (const customer of customers) {
                console.log(`Found: ${customer.name} (ID: ${customer.id}, Isolated: ${customer.is_isolated}, Deadline: ${customer.custom_payment_deadline})`);
                const [invoices] = await connection.query<RowDataPacket[]>(
                    "SELECT period, due_date, status, remaining_amount FROM invoices WHERE customer_id = ? ORDER BY period DESC LIMIT 5",
                    [customer.id]
                );
                console.table(invoices);
                
                const [logs] = await connection.query<RowDataPacket[]>(
                    "SELECT action, reason, created_at FROM isolation_logs WHERE customer_id = ? ORDER BY created_at DESC LIMIT 3",
                    [customer.id]
                );
                console.log('Recent Isolation Logs:');
                console.table(logs);
            }
        }
    } finally {
        connection.release();
        process.exit(0);
    }
}

checkCustomers();
