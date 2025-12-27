/**
 * Late Payment Tracking Service
 * Handles tracking late payments and service suspension triggers
 */
export interface LatePaymentStats {
    late_payment_count: number;
    last_late_payment_date: Date | null;
    consecutive_on_time_payments: number;
    total_late_payments_in_period: number;
}
export declare class LatePaymentTrackingService {
    /**
     * Track payment and check if it's late
     */
    static trackPayment(invoiceId: number, paymentId: number, paymentDate: Date, dueDate: Date): Promise<{
        isLate: boolean;
        daysLate: number;
    }>;
    /**
     * Calculate rolling count of late payments for customer
     */
    static calculateLatePaymentCount(customerId: number, months?: number): Promise<number>;
    /**
     * Check and trigger migration if threshold reached
     */
    /**
     * Check and reset counter if customer has consecutive on-time payments
     */
    static checkAndResetCounter(customerId: number): Promise<void>;
    /**
     * Get late payment history for customer
     */
    static getLatePaymentHistory(customerId: number, limit?: number): Promise<any[]>;
    /**
     * Send late payment warning notification
     */
    static sendLatePaymentWarning(customerId: number, count: number): Promise<void>;
    /**
     * Reset counter (admin or system)
     */
    static resetCounter(customerId: number, adminId?: number, reason?: string, adminName?: string): Promise<void>;
    /**
     * Adjust counter (admin only)
     */
    static adjustCounter(customerId: number, adjustment: number, adminId: number, reason: string, adminName: string): Promise<void>;
    /**
     * Get customer late payment statistics
     */
    static getCustomerLatePaymentStats(customerId: number): Promise<LatePaymentStats>;
    /**
     * Batch reset counter for multiple customers
     */
    static batchResetCounter(customerIds: number[], adminId: number, reason: string, adminName: string): Promise<number>;
    /**
     * Export late payment report
     */
    static exportLatePaymentReport(filters: {
        customerId?: number;
        minCount?: number;
        maxCount?: number;
        dateFrom?: Date;
        dateTo?: Date;
    }): Promise<any[]>;
    /**
     * Log audit trail
     */
    private static logAudit;
    /**
     * Daily re-calculation job (to be called by scheduler)
     */
    static dailyRecalculation(): Promise<{
        processed: number;
        errors: number;
    }>;
}
export default LatePaymentTrackingService;
//# sourceMappingURL=LatePaymentTrackingService.d.ts.map