export interface PrintData {
    invoice_id: number;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    invoice_number: string;
    period: string;
    due_date: string;
    items: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        total_price: number;
    }>;
    subtotal: number;
    discount_amount: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    payment_url?: string;
}
export declare class PrintingService {
    private static printer;
    /**
     * Initialize printer
     */
    static initializePrinter(printerName?: string): Promise<void>;
    /**
     * Print single invoice
     */
    static printInvoice(printData: PrintData): Promise<boolean>;
    /**
     * Print batch invoices by ODC
     */
    static printBatchByOdc(odcId: number, period: string): Promise<{
        printed: number;
        failed: number;
    }>;
    /**
     * Test printer connection
     */
    static testPrinter(printerName?: string): Promise<boolean>;
    /**
     * Get printer status
     */
    static getPrinterStatus(): Promise<{
        connected: boolean;
        error?: string;
    }>;
    /**
     * Generate PDF fallback (if printer not available)
     */
    static generatePdfInvoice(printData: PrintData): Promise<Buffer>;
}
//# sourceMappingURL=printingService.d.ts.map