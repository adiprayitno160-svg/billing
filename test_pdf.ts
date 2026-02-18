
import { InvoicePdfService } from './src/services/invoice/InvoicePdfService';
import { databasePool } from './src/db/pool';
import { RowDataPacket } from 'mysql2';

async function testPdf() {
    try {
        console.log('Fetching latest invoice...');
        console.log('Using DB Pool:', databasePool.getConfig?.()?.connectionLimit || 'unknown limit');

        console.time('DB Query');
        const [rows] = await databasePool.query<RowDataPacket[]>(
            "SELECT id FROM invoices ORDER BY id DESC LIMIT 1"
        );
        console.timeEnd('DB Query');

        if (rows.length === 0) {
            console.log('No invoices found');
            process.exit(0);
        }
        const invoiceId = rows[0].id;
        console.log(`Generating PDF for invoice ${invoiceId}...`);

        console.time('PDF Generation');
        const path = await InvoicePdfService.generateInvoicePdf(invoiceId);
        console.timeEnd('PDF Generation');

        console.log(`✅ PDF generated at: ${path}`);
        process.exit(0);
    } catch (error) {
        console.error('❌ PDF generation failed:', error);
        process.exit(1);
    }
}

testPdf();
