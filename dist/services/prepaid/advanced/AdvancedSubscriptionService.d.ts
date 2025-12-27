/**
 * Advanced Prepaid Subscription Service
 *
 * Handles subscription lifecycle with advanced features:
 * - Activation/Deactivation
 * - Pause/Resume
 * - Auto-renewal
 * - Rollover quota
 * - Usage tracking integration
 */
export interface Subscription {
    id?: number;
    customer_id: number;
    package_id: number;
    subscription_code: string;
    activation_date: Date;
    expiry_date: Date;
    paused_at?: Date;
    paused_until?: Date;
    duration_days: number;
    duration_hours?: number;
    purchase_price: number;
    discount_amount?: number;
    final_price: number;
    data_quota_gb?: number;
    data_used_gb?: number;
    data_remaining_gb?: number;
    rollover_quota_gb?: number;
    rollover_expiry_date?: Date;
    status: 'active' | 'paused' | 'expired' | 'suspended' | 'cancelled' | 'depleted';
    auto_renew?: boolean;
    deposit_amount?: number;
    payment_transaction_id?: number;
    invoice_id?: number;
    referral_code?: string;
    voucher_code?: string;
}
export interface ActivationRequest {
    customer_id: number;
    package_id: number;
    payment_transaction_id?: number;
    invoice_id?: number;
    voucher_code?: string;
    referral_code?: string;
    auto_renew?: boolean;
    deposit_amount?: number;
}
export interface ActivationResult {
    success: boolean;
    subscription_id?: number;
    subscription_code?: string;
    message: string;
    error?: string;
}
export declare class AdvancedSubscriptionService {
    /**
     * Activate subscription
     */
    activateSubscription(request: ActivationRequest): Promise<ActivationResult>;
    /**
     * Deactivate subscription
     */
    deactivateSubscription(subscriptionId: number, reason?: string): Promise<boolean>;
    /**
     * Pause subscription
     */
    pauseSubscription(subscriptionId: number, resumeDate?: Date): Promise<boolean>;
    /**
     * Resume subscription
     */
    resumeSubscription(subscriptionId: number): Promise<boolean>;
    /**
     * Get active subscription for customer
     */
    getActiveSubscription(customerId: number): Promise<Subscription | null>;
    /**
     * Get subscription by ID
     */
    getSubscriptionById(id: number): Promise<Subscription | null>;
    /**
     * Get subscriptions by customer
     */
    getCustomerSubscriptions(customerId: number, status?: Subscription['status']): Promise<Subscription[]>;
    /**
     * Check and handle expired subscriptions
     */
    checkExpiredSubscriptions(): Promise<number>;
    /**
     * Attempt auto-renewal
     */
    private attemptAutoRenewal;
    /**
     * Apply MikroTik configuration
     */
    private applyMikrotikConfiguration;
    /**
     * Revert MikroTik configuration
     */
    private revertMikrotikConfiguration;
    /**
     * Generate unique subscription code
     */
    private generateSubscriptionCode;
    /**
     * Map database row to subscription object
     */
    private mapRowToSubscription;
}
declare const _default: AdvancedSubscriptionService;
export default _default;
//# sourceMappingURL=AdvancedSubscriptionService.d.ts.map