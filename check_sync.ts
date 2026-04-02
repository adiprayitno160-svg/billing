
import { databasePool } from './src/db/pool';

async function check() {
    try {
        const [countRows] = await databasePool.query('SELECT COUNT(*) as count FROM customers') as [any[], any];
        console.log(`Total Customers: ${countRows[0].count}`);

        const [rows] = await databasePool.query('SELECT id, name, pppoe_username, customer_code FROM customers') as [any[], any];
        console.log('--- ALL CUSTOMERS ---');
        // Filter in JS to be safe
        const matches = rows.filter(r => 
            (r.name && (r.name.toLowerCase().includes('kokom') || r.name.toLowerCase().includes('agus'))) ||
            (r.pppoe_username && (r.pppoe_username.toLowerCase().includes('kokom') || r.pppoe_username.toLowerCase().includes('agus')))
        );
        console.log('Matches:', JSON.stringify(matches, null, 2));
        
        if (matches.length === 0) {
           console.log('First 100 names:');
           console.log(rows.slice(0, 100).map(r => r.name).join(', '));
        }

        for (const m of matches) {
             const [invoices] = await databasePool.query('SELECT * FROM invoices WHERE customer_id = ?', [m.id]) as [any[], any];
             console.log(`\nInvoices for ${m.name}:`, JSON.stringify(invoices, null, 2));
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

check();
