export interface BookkeepingData {
    unpaid: {
        invoices: any[];
        totalAmount: number;
        totalRemaining: number;
        count: number;
    };
    paid: {
        invoices: any[];
        totalAmount: number;
        totalPaid: number;
        count: number;
    };
    summary: {
        totalReceivable: number;
        totalReceived: number;
        totalOutstanding: number;
    };
}
export declare class BookkeepingService {
    /**
     * Get unpaid invoices (hutang/kurang)
     */
    static getUnpaidInvoices(startDate?: string, endDate?: string): Promise<any[]>;
    /**
     * Get paid invoices
     */
    static getPaidInvoices(startDate?: string, endDate?: string): Promise<any[]>;
    /**
     * Get complete bookkeeping data
     */
    static getBookkeepingData(startDate?: string, endDate?: string): Promise<BookkeepingData>;
    /**
     * Get payment details for an invoice
     */
    static getInvoicePayments(invoiceId: number): Promise<any[]>;
}
//# sourceMappingURL=bookkeepingService.d.ts.map