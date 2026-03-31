export interface InvoiceDetailData {
    id: number;
    invoice_number: string;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    period: string;
    due_date: string;
    subtotal: number;
    discount_amount: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    status: string;
    partial_payment_allowed: boolean;
    debt_tracking_enabled: boolean;
    last_payment_date?: string;
    payment_installments?: any;
    notes?: string;
    created_at: string;
    updated_at: string;
}
export interface PaymentSessionData {
    invoice_id: number;
    payment_amount: number;
    payment_method: string;
    session_token: string;
    expires_at: string;
}
export interface DebtTrackingData {
    customer_id: number;
    invoice_id: number;
    debt_amount: number;
    debt_reason: string;
    debt_date: string;
    due_date?: string;
    notes?: string;
}
export declare class InvoiceDetailService {
    /**
     * Get invoice detail dengan informasi lengkap
     */
    static getInvoiceDetail(invoiceId: number): Promise<InvoiceDetailData | null>;
    /**
     * Get payment history untuk invoice
     */
    static getPaymentHistory(invoiceId: number): Promise<any[]>;
    /**
     * Get debt tracking untuk customer
     */
    static getDebtTracking(customerId: number): Promise<any[]>;
    /**
     * Create payment session untuk pembayaran
     */
    static createPaymentSession(invoiceId: number, paymentAmount: number, paymentMethod: string): Promise<PaymentSessionData>;
    /**
     * Process payment dari Detail Invoice
     */
    static processPaymentFromDetail(sessionToken: string, paymentData: {
        amount: number;
        payment_method: string;
        reference_number?: string;
        notes?: string;
        proof_file_path?: string;
    }): Promise<{
        success: boolean;
        message: string;
        payment_id?: number;
    }>;
    /**
     * Update invoice payment status
     */
    private static updateInvoicePaymentStatus;
    /**
     * Create debt tracking record
     */
    private static createDebtTracking;
    /**
     * Get payment session by token
     */
    static getPaymentSession(sessionToken: string): Promise<any>;
    /**
     * Clean expired payment sessions
     */
    static cleanExpiredSessions(): Promise<void>;
}
//# sourceMappingURL=invoiceDetailService.d.ts.map