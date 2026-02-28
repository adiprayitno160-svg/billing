// src/services/invoice/InvoiceDataService.ts
import { databasePool } from '../../db/pool';
import { logger } from '../../services/logger';
import { formatPeriodToMonth } from '../../utils/periodHelper';

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

        // Format period
        if (invoice.period) {
            invoice.original_period = invoice.period;
            invoice.period = formatPeriodToMonth(invoice.period);
        }

        // Add admin finance info if not present
        invoice.admin_finance = "ADMIN FINANCE";

        // Invoice items
        const [itemRows] = await databasePool.query(
            `SELECT * FROM invoice_items WHERE invoice_id = ?`,
            [invoiceId]
        );
        invoice.items = itemRows;

        // Fetch discounts (from discounts table)
        const [discountRows] = await databasePool.query(
            `SELECT * FROM discounts WHERE invoice_id = ?`,
            [invoiceId]
        );
        invoice.discounts = discountRows;

        logger.info(`✅ Loaded invoice ${invoiceId} with ${invoice.items.length} items and ${(invoice.discounts as any).length} discounts`);
        return invoice;
    }
}
