"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceDataService = void 0;
// src/services/invoice/InvoiceDataService.ts
const pool_1 = require("../../db/pool");
const logger_1 = require("../../services/logger");
class InvoiceDataService {
    /**
     * Fetch invoice with customer & items.
     * Returns object suitable for both PDF and thermal templates.
     */
    static async getInvoice(invoiceId) {
        // Main invoice + customer
        const [invRows] = await pool_1.databasePool.query(`SELECT i.*, c.name AS customer_name, c.address AS customer_address, c.phone AS customer_phone
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ?`, [invoiceId]);
        const invoice = invRows[0];
        if (!invoice)
            throw new Error('Invoice not found');
        // Invoice items
        const [itemRows] = await pool_1.databasePool.query(`SELECT * FROM invoice_items WHERE invoice_id = ?`, [invoiceId]);
        invoice.items = itemRows;
        logger_1.logger.info(`✅ Loaded invoice ${invoiceId} with ${invoice.items.length} items`);
        return invoice;
    }
}
exports.InvoiceDataService = InvoiceDataService;
