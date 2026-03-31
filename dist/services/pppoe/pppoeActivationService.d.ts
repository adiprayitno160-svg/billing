export declare class PPPoEActivationService {
    private mikrotikService;
    private notificationService;
    constructor();
    private getMikrotikService;
    /**
     * Send reminders for upcoming PPPoE blocks (Point 3)
     */
    sendReminders(): Promise<void>;
    /**
     * Send H-7 reminders for upcoming PPPoE blocks
     */
    sendH7Reminders(): Promise<void>;
    /**
     * Activate PPPoE subscription manually
     * @param subscriptionId
     * @param userId
     * @returns
     */
    activateSubscription(subscriptionId: number, userId: number, customActivationDate?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Send activation invoice
     */
    sendActivationInvoice(subscriptionId: number, userId: number): Promise<{
        success: boolean;
        message: string;
        invoiceId?: number;
    }>;
    /**
     * Deactivate PPPoE subscription
     * @param subscriptionId
     * @param userId
     * @param reason
     * @returns
     */
    deactivateSubscription(subscriptionId: number, userId: number, reason: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Check and process automatic blocking based on activation date
     */
    processAutoBlocking(): Promise<void>;
    /**
     * Reset next block date when customer pays
     * @param customerId
     */
    resetNextBlockDate(customerId: number): Promise<void>;
    private createPPPoEAccountInMikrotik;
    private removePPPoEAccountFromMikrotik;
}
export declare const pppoeActivationService: PPPoEActivationService;
//# sourceMappingURL=pppoeActivationService.d.ts.map