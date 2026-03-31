export declare class InvoicePdfService {
    /**
     * Generate PDF (A4) for given invoice id.
     * Returns Buffer containing PDF data.
     *
     * NOTE: We use a Hybrid Approach (Screenshot -> PDFKit) because
     * Chromium's native 'printToPDF' is unstable on some Windows environments
     * and frequently throws 'Target closed' protocol errors.
     */
    static generatePdf(invoiceId: number, retryCount?: number): Promise<Buffer>;
    /**
     * Generate PDF and save to filesystem.
     * Returns absolute path to the generated PDF file.
     */
    static generateInvoicePdf(invoiceId: number): Promise<string>;
}
//# sourceMappingURL=InvoicePdfService.d.ts.map