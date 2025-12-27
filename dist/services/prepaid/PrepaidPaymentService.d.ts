/**
 * Prepaid Payment Service
 * Handles payment processing for prepaid packages
 * Supports manual transfer and payment gateway
 */
export interface PaymentTransaction {
    id?: number;
    customer_id: number;
    package_id: number;
    amount: number;
    payment_method: 'manual_transfer' | 'payment_gateway' | 'cash' | 'admin_credit';
    payment_status: 'pending' | 'verified' | 'rejected' | 'paid' | 'expired';
    payment_proof_url?: string;
    payment_gateway_reference?: string;
    payment_gateway_type?: string;
    payment_notes?: string;
    verified_at?: Date;
    verified_by?: number;
    rejected_reason?: string;
    expired_at?: Date;
}
export interface PaymentSettings {
    bank_transfer_enabled: boolean;
    bank_name: string;
    bank_account_number: string;
    bank_account_name: string;
    transfer_instructions: string;
    payment_gateway_enabled: boolean;
    payment_gateway_provider: string;
    auto_expire_pending_hours: number;
}
export declare class PrepaidPaymentService {
    /**
     * Create new payment transaction
     */
    static createTransaction(data: PaymentTransaction): Promise<number>;
    /**
     * Get transaction by ID
     */
    static getTransactionById(transactionId: number): Promise<PaymentTransaction | null>;
    /**
     * Update transaction status
     */
    static updateTransactionStatus(transactionId: number, status: 'pending' | 'verified' | 'rejected' | 'paid' | 'expired', additionalData?: {
        verified_by?: number;
        rejected_reason?: string;
        payment_gateway_reference?: string;
    }): Promise<void>;
    /**
     * Get pending transactions (for admin verification)
     */
    static getPendingTransactions(): Promise<any[]>;
    /**
     * Verify manual transfer payment (Admin action)
     */
    static verifyPayment(transactionId: number, adminId: number, notes?: string): Promise<void>;
    /**
     * Reject manual transfer payment (Admin action)
     */
    static rejectPayment(transactionId: number, adminId: number, reason: string): Promise<void>;
    /**
     * Save payment proof file
     */
    static savePaymentProof(file: Express.Multer.File, transactionId: number): Promise<string>;
    /**
     * Get payment settings from database
     */
    static getPaymentSettings(): Promise<PaymentSettings>;
    /**
     * Auto-expire old pending payments (called by scheduler)
     */
    static expirePendingPayments(): Promise<number>;
    /**
     * Get payment statistics (for admin dashboard)
     */
    static getPaymentStatistics(dateFrom?: Date, dateTo?: Date): Promise<any>;
}
export default PrepaidPaymentService;
//# sourceMappingURL=PrepaidPaymentService.d.ts.map