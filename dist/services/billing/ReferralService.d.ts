/**
 * Referral Service
 * Handles customer referral program
 */
export interface CustomerReferral {
    id: number;
    referrer_id: number;
    referred_id: number;
    referral_code: string;
    status: 'pending' | 'completed' | 'rewarded';
    referrer_reward_days: number;
    referred_discount_percent: number;
    rewarded_at?: Date;
    created_at: Date;
}
export declare class ReferralService {
    /**
     * Generate unique referral code for customer
     */
    static generateReferralCode(customerId: number, customerName: string): Promise<string>;
    /**
     * Get customer's referral code
     */
    static getCustomerReferralCode(customerId: number): Promise<string | null>;
    /**
     * Validate referral code
     */
    static validateReferralCode(code: string, referredCustomerId: number): Promise<{
        valid: boolean;
        message: string;
        referrerId?: number;
        discountPercent?: number;
    }>;
    /**
     * Create referral record
     */
    static createReferral(referrerId: number, referredId: number, referralCode: string): Promise<number | null>;
    /**
     * Mark referral as completed and reward referrer
     */
    static completeReferral(referralId: number): Promise<boolean>;
    /**
     * Get referral stats for customer
     */
    static getReferralStats(customerId: number): Promise<{
        total_referrals: number;
        successful_referrals: number;
        pending_referrals: number;
        total_days_earned: number;
        referred_customers: any[];
    }>;
    /**
     * Get referral by referred customer ID
     */
    static getReferralByReferredId(referredId: number): Promise<CustomerReferral | null>;
    /**
     * Check if customer can use referral (new customer only)
     */
    static canUseReferral(customerId: number): Promise<boolean>;
}
//# sourceMappingURL=ReferralService.d.ts.map