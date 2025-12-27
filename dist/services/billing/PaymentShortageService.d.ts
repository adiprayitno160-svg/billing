/**
 * Payment Shortage Service
 * Handles notifications for customers with partial payments or overdue payments
 */
export declare class PaymentShortageService {
    /**
     * Check and send notifications for payment shortages
     * @param daysThreshold Number of days after due date to send warning (default: 14 days = 2 weeks)
     */
    static checkAndNotifyShortages(daysThreshold?: number): Promise<{
        checked: number;
        notified: number;
        failed: number;
    }>;
}
//# sourceMappingURL=PaymentShortageService.d.ts.map