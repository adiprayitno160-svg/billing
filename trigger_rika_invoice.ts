import { InvoiceService } from './src/services/billing/invoiceService';
import { databasePool } from './src/db/pool';

async function trigger() {
    try {
        const period = '2026-02';
        const [countResult] = await databasePool.query('SELECT COUNT(*) as count FROM invoices WHERE period = ?', [period]);
        console.log('Current invoice count for 2026-02:', (countResult as any)[0].count);

        const [maxResult] = await databasePool.query('SELECT invoice_number FROM invoices WHERE period = ? ORDER BY id DESC LIMIT 1', [period]);
        if ((maxResult as any).length > 0) {
            console.log('Last invoice number:', (maxResult as any)[0].invoice_number);
        }

        console.log('Initiating manual invoice check for Rika Brombong (ID 215)...');
        const invoiceIds = await InvoiceService.generateMonthlyInvoices(period, 215, true);
        console.log(`Generated ${invoiceIds.length} invoices. IDs:`, invoiceIds);
        process.exit(0);
    } catch (err) {
        console.error('Error triggering invoice:', err);
        process.exit(1);
    }
}

trigger();
