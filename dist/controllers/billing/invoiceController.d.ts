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
    /**
     * Update invoice status
     */
    updateInvoiceStatus(req: Request, res: Response): Promise<void>;
    /**
     * Delete invoice
     */
    deleteInvoice(req: Request, res: Response): Promise<void>;
    /**
     * Generate unique invoice number
     */
    private generateInvoiceNumber;
}
//# sourceMappingURL=invoiceController.d.ts.map