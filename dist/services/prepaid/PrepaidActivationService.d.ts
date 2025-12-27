interface ActivationResult {
    success: boolean;
    subscription_id?: number;
    message: string;
    error?: string;
}
/**
 * Service untuk aktivasi dan deaktivasi paket prepaid
 * Handle full workflow dari purchase sampai aktif di MikroTik
 */
declare class PrepaidActivationService {
    /**
     * Activate prepaid package for customer
     */
    activatePackage(data: {
        customer_id: number;
        package_id: number;
        invoice_id?: number;
        purchase_price: number;
        auto_renew?: boolean;
        custom_download_mbps?: number;
        custom_upload_mbps?: number;
    }): Promise<ActivationResult>;
    /**
     * Activate customer in MikroTik
     */
    private activateInMikrotik;
    /**
     * Deactivate/suspend customer package
     */
    deactivatePackage(subscriptionId: number, reason?: string): Promise<boolean>;
    /**
     * Get active subscription for customer
     */
    getActiveSubscription(customerId: number): Promise<any | null>;
    /**
     * Get subscription history for customer
     */
    getSubscriptionHistory(customerId: number, limit?: number): Promise<any[]>;
    /**
     * Check if customer needs redirect to portal
     */
    needsPortalRedirect(customerId: number): Promise<boolean>;
    /**
     * Extend subscription (add more days)
     */
    extendSubscription(subscriptionId: number, additionalDays: number): Promise<boolean>;
    /**
     * Activate package after payment verified
     * Called after manual transfer verification or payment gateway callback
     */
    activateFromTransaction(transactionId: number): Promise<ActivationResult>;
}
declare const _default: PrepaidActivationService;
export default _default;
//# sourceMappingURL=PrepaidActivationService.d.ts.map