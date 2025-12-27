export interface PaymentData {
    invoice_id: number;
    payment_method: string;
    amount: number;
    reference_number?: string;
    gateway_transaction_id?: string;
    gateway_status?: string;
    notes?: string;
}
export declare class PaymentService {
    /**
     * Catat pembayaran
     */
    static recordPayment(paymentData: PaymentData): Promise<number>;
    /**
     * Update status pembayaran invoice
     */
    static updateInvoicePaymentStatus(invoiceId: number): Promise<void>;
    /**
     * Handle pembayaran parsial dan kekurangan
     */
    static handlePartialPayment(invoiceId: number, paymentAmount: number, paymentMethod: string, notes?: string): Promise<{
        paymentId: number;
        carryOverAmount?: number;
    }>;
    /**
     * Get payment history untuk invoice
     */
    static getPaymentHistory(invoiceId: number): Promise<any[]>;
    /**
     * Rekonsiliasi pembayaran gateway
     */
    static reconcileGatewayPayment(transactionId: string, status: string, amount: number): Promise<void>;
    /**
     * Dapatkan daftar pembayaran dengan pagination dan filter
     */
    static getPaymentList(options: {
        page: number;
        limit: number;
        filters: {
            status?: string;
            method?: string;
            date_from?: string;
            date_to?: string;
        };
    }): Promise<{
        data: any[];
        pagination: {
            currentPage: number;
            totalPages: number;
            totalItems: number;
            startIndex: number;
            endIndex: number;
        };
    }>;
    /**
     * Dapatkan statistik pembayaran untuk dashboard
     */
    static getPaymentStats(): Promise<{
        total_payments: number;
        today_payments: number;
        pending_count: number;
        failed_count: number;
    }>;
    /**
     * Track late payment (internal helper)
     */
    private static trackLatePayment;
}
//# sourceMappingURL=paymentService.d.ts.map