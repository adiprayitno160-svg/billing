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
            invoice.period = formatPeriodToMonth(invoice.period, invoice.due_date);
        }

        // Add admin finance info if not present
        invoice.admin_finance = "ADMIN FINANCE";

        // Invoice items
        const [itemRows] = await databasePool.query(
            `SELECT * FROM invoice_items WHERE invoice_id = ?`,
            [invoiceId]
        );
        invoice.items = itemRows;

        // Fetch other unpaid invoices for the same customer (arrears)
        const [arrearsRows] = await databasePool.query<any[]>(
            `SELECT id, invoice_number, period, total_amount, remaining_amount, due_date
             FROM invoices 
             WHERE customer_id = ? 
             AND id != ? 
             AND status IN ('sent', 'partial', 'overdue')
             AND remaining_amount > 0
             ORDER BY period ASC`,
            [invoice.customer_id, invoiceId]
        );
        
        // Format period for each arrear
        invoice.arrears = (arrearsRows || []).map((row: any) => ({
            ...row,
            period: formatPeriodToMonth(row.period, row.due_date)
        }));

        // Invoice discounts
        const [discountRows] = await databasePool.query(
            "SELECT * FROM discounts WHERE invoice_id = ?",
            [invoiceId]
        );
        invoice.discounts = discountRows;

        logger.info(`✅ Loaded invoice ${invoiceId} with ${invoice.items.length} items, ${invoice.discounts.length} discounts, and ${invoice.arrears.length} unpaid invoices.`);
        return invoice;
    }
}
