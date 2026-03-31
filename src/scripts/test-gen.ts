import { InvoiceService } from '../services/billing/invoiceService';
import { databasePool } from '../db/pool';

async function run() {
    try {
        console.log('Starting manual generation for 2026-03...');
        const ids = await InvoiceService.generateMonthlyInvoices('2026-03', undefined, true);
        console.log(`Success! Created ${ids.length} invoices.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

run();
