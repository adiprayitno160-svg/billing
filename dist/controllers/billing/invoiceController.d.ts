import { Request, Response } from 'express';
export declare class InvoiceController {
    /**
     * Get invoice list with filters
     */
    getInvoiceList(req: Request, res: Response): Promise<void>;
    /**
     * Get invoice detail
     */
    getInvoiceDetail(req: Request, res: Response): Promise<void>;
    /**
     * Create manual invoice
     */
    createManualInvoice(req: Request, res: Response): Promise<void>;
    /**
     * Generate bulk invoices (monthly automatic)
     */
    generateBulkInvoices(req: Request, res: Response): Promise<void>;
    generateBulkInvoices_UNUSED(req: Request, res: Response): Promise<void>;
    /**
     * Update invoice status
     */
    updateInvoiceStatus(req: Request, res: Response): Promise<void>;
    /**
     * Send invoice detail via WhatsApp
     */
    sendInvoiceWhatsApp(req: Request, res: Response): Promise<void>;
    /**
     * Delete invoice
     */
    deleteInvoice(req: Request, res: Response): Promise<void>;
    /**
     * Delete bulk invoices
     */
    bulkDeleteInvoices(req: Request, res: Response): Promise<void>;
    /**
     * Update invoice notes
     */
    updateInvoiceNotes(req: Request, res: Response): Promise<void>;
    /**
     * Update invoice due date (Janji Bayar)
     */
    updateDueDate(req: Request, res: Response): Promise<void>;
    /**
     * Check which customers already have invoices for a specific period
     */
    checkInvoicesForPeriod(req: Request, res: Response): Promise<void>;
    /**
     * Generate unique invoice number
     */
    private generateInvoiceNumber;
    /**
     * EMERGENCY: Force Cleanup Invoices for a Period
     * WARNING: This deletes DATA! Use with caution.
     */
    forceCleanupPeriod(req: Request, res: Response): Promise<void>;
    /**
     * Send paid invoice PDF to customer manually
     */
    sendPaidInvoicePdf(req: Request, res: Response): Promise<void>;
    /**
     * Bulk Send Invoice via WhatsApp
     */
    bulkSendInvoiceWhatsApp(req: Request, res: Response): Promise<void>;
    /**
     * Apply downtime discount based on days
     */
    applyDowntimeDiscount(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=invoiceController.d.ts.map