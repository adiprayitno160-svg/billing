// src/services/invoice/InvoiceDataService.ts
import { databasePool } from '../../db/pool';
import { logger } from '../../services/logger';

export class InvoiceDataService {
    /**
     * Fetch invoice with customer & items.
     * Returns object suitable for both PDF and thermal templates.
     */
    static async getInvoice(invoiceId: number) {
        // Main invoice + customer
        const [invRows] = await databasePool.query(
            `SELECT i.*, c.name AS customer_name, c.address AS customer_address, c.phone AS customer_phone, c.pppoe_username
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ?`,
            [invoiceId]
        );
        const invoice = (invRows as any)[0];
        if (!invoice) throw new Error('Invoice not found');

        // Invoice items
        const [itemRows] = await databasePool.query(
            `SELECT * FROM invoice_items WHERE invoice_id = ?`,
            [invoiceId]
        );
        invoice.items = itemRows;

        logger.info(`✅ Loaded invoice ${invoiceId} with ${invoice.items.length} items`);
        return invoice;
    }
}
