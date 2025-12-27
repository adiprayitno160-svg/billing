export interface InvoiceData {
    customer_id: number;
    subscription_id?: number;
    period: string;
    due_date: string;
    subtotal: number;
    discount_amount?: number;
    total_amount: number;
    notes?: string;
}
export interface InvoiceItem {
    description: string;
    quantity?: number;
    unit_price: number;
    total_price: number;
}
export declare class InvoiceService {
    /**
     * Generate nomor invoice unik
     */
    static generateInvoiceNumber(period: string): Promise<string>;
    /**
     * Buat invoice baru
     */
    static createInvoice(invoiceData: InvoiceData, items: InvoiceItem[]): Promise<number>;
    /**
     * Handle partial payment dengan debt tracking
     */
    static handlePartialPayment(invoiceId: number, paymentAmount: number, paymentMethod: string, notes?: string): Promise<{
        success: boolean;
        message: string;
        remainingAmount?: number;
    }>;
    /**
     * Get next period for carry over
     */
    private static getNextPeriod;
    /**
     * Generate invoice otomatis untuk semua subscription aktif dengan carry over
     */
    static generateMonthlyInvoices(period: string): Promise<number[]>;
    /**
     * Update status invoice
     */
    static updateInvoiceStatus(invoiceId: number, status: string): Promise<void>;
    /**
     * Get invoice by ID
     */
    static getInvoiceById(invoiceId: number): Promise<any>;
    /**
     * Get invoice items
     */
    static getInvoiceItems(invoiceId: number): Promise<any[]>;
    /**
     * Get invoices dengan filter
     */
    static getInvoices(filters?: {
        status?: string;
        period?: string;
        odc_id?: number;
        customer_id?: number;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    /**
     * Mark invoice as sent
     */
    static markAsSent(invoiceId: number): Promise<void>;
    /**
     * Get overdue invoices
     */
    static getOverdueInvoices(): Promise<any[]>;
    /**
     * Bulk delete invoices
     */
    static bulkDeleteInvoices(invoiceIds: number[]): Promise<{
        deleted: number;
        failed: number;
        errors: string[];
    }>;
    /**
     * Delete single invoice
     */
    static deleteInvoice(invoiceId: number): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=invoiceService.d.ts.map