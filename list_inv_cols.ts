
import { databasePool } from './src/db/pool';

async function listInvoicesCols() {
    try {
        const [cols] = await databasePool.query('SHOW COLUMNS FROM invoices');
        (cols as any[]).forEach(c => console.log(c.Field));
        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

listInvoicesCols();
