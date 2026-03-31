/**
 * Prepaid Billing Service
 */
export declare class PrepaidService {
    /**
     * Switch customer to prepaid mode
     */
    static switchToPrepaid(customerId: number, initialDays?: number, sendNotification?: boolean): Promise<any>;
    /**
     * Switch customer back to postpaid mode
     */
    static switchToPostpaid(customerId: number): Promise<any>;
    /**
     * Generate payment request
     */
    static generatePaymentRequest(customerId: number, packageId: number, durationDays: number, options?: any): Promise<any>;
    /**
     * Confirm payment
     */
    static confirmPayment(paymentRequestId: number, verifiedBy?: number | null, paymentMethod?: string): Promise<any>;
    /**
     * Top up customer balance
     */
    static topUpBalance(customerId: number, amount: number, method: string, notes?: string, adminId?: number): Promise<number>;
    /**
     * Get expired prepaid customers
     */
    static getExpiredCustomers(): Promise<any[]>;
    /**
     * Process expired prepaid customers (auto isolate)
     */
    static processExpiredCustomers(): Promise<{
        isolatedCount: number;
        errors: any[];
    }>;
    /**
     * Send expiry warnings (H-3 and H-1)
     */
    static sendExpiryWarnings(): Promise<{
        h3Sent: number;
        h1Sent: number;
        errors: any[];
    }>;
}
//# sourceMappingURL=PrepaidService.d.ts.map