/**
 * Late Payment Tracking Service
 * Handles tracking late payments and service suspension triggers
 */
import { Pool, PoolConnection } from 'mysql2/promise';
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
    static calculateLatePaymentCount(customerId: number, months?: number, existingConnection?: PoolConnection | Pool): Promise<number>;
    /**
     * Check if customer should be isolated due to late payment count
     */
    static checkAndApplyIsolation(customerId: number, count: number, existingConnection?: PoolConnection | Pool): Promise<void>;
    /**
     * Check and reset counter if customer has consecutive on-time payments
     */
    static checkAndResetCounter(customerId: number, existingConnection?: PoolConnection | Pool): Promise<void>;
    /**
     * Reset counter (admin or system)
     */
    static resetCounter(customerId: number, adminId?: number, reason?: string, adminName?: string, existingConnection?: PoolConnection | Pool): Promise<void>;
    /**
     * Run daily recalculation for all active customers
     */
    static dailyRecalculation(): Promise<{
        processed: number;
        errors: number;
    }>;
    /**
     * Get late payment stats for a customer
     */
    static getCustomerLatePaymentStats(customerId: number): Promise<LatePaymentStats>;
    /**
     * Get late payment history for a customer
     */
    static getLatePaymentHistory(customerId: number, limit?: number): Promise<any[]>;
    /**
     * Adjust counter manually
     */
    static adjustCounter(customerId: number, adjustment: number, adminId?: number, reason?: string, adminName?: string): Promise<void>;
    /**
     * Batch reset counter
     */
    static batchResetCounter(customerIds: number[], adminId?: number, reason?: string, adminName?: string): Promise<number>;
    /**
     * Export report data
     */
    static exportLatePaymentReport(filters?: any): Promise<any[]>;
    /**
     * Log audit trail
     */
    private static logAudit;
}
export default LatePaymentTrackingService;
//# sourceMappingURL=LatePaymentTrackingService.d.ts.map