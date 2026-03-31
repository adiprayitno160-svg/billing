import { databasePool } from './src/db/pool';

async function check() {
    try {
        const [rows] = await databasePool.query<any[]>('SELECT id, name FROM customers LIMIT 5');
        console.log('Found customers count:', rows.length);
        console.log('Customers:', JSON.stringify(rows, null, 2));
        
        const [inv847] = await databasePool.query<any[]>('SELECT id, customer_id FROM invoices WHERE id = 847');
        console.log('Invoice 847:', JSON.stringify(inv847, null, 2));

        process.exit(0);
    } catch (e: any) {
        console.error('Check failed:', e.message);
        process.exit(1);
    }
}

check();
