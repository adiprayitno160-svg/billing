export interface DefermentRequest {
    customer_id: number;
    invoice_id?: number;
    deferred_until_date: string;
    reason: string;
    requested_by?: string;
}
export declare class DefermentService {
    /**
     * Check how many deferments a customer had this year
     */
    static getDefermentCountThisYear(customerId: number): Promise<number>;
    /**
     * Request a payment deferment
     */
    static requestDeferment(data: DefermentRequest): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Check and process expired deferments
     * Should be called periodically (CRON)
     * Rule: If deferred until date is passed, block on the night of (deferred + 1)
     * e.g. Deferred until 6th, if no payment, block on 7th night.
     */
    static processExpiredDeferments(): Promise<{
        processed: number;
    }>;
    private static sendDefermentapprovedNotification;
    private static sendDefermentLimitReachedNotification;
}
//# sourceMappingURL=DefermentService.d.ts.map