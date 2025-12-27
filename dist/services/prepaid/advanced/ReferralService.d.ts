/**
 * Referral Service
 *
 * Handles referral program:
 * - Generate referral codes
 * - Track referrals
 * - Apply referral rewards
 * - Manage referral commissions
 */
export interface Referral {
    id?: number;
    referrer_customer_id: number;
    referee_customer_id: number;
    referral_code: string;
    referrer_reward_type?: 'credit' | 'discount' | 'free_days' | 'cashback';
    referrer_reward_value?: number;
    referrer_reward_status?: 'pending' | 'claimed' | 'expired';
    referee_reward_type?: 'credit' | 'discount' | 'free_days' | 'cashback';
    referee_reward_value?: number;
    referee_reward_status?: 'pending' | 'claimed' | 'expired';
    status: 'pending' | 'completed' | 'cancelled';
    completed_at?: Date;
}
export interface ReferralReward {
    reward_type: 'credit' | 'discount' | 'free_days' | 'cashback';
    reward_value: number;
}
export declare class ReferralService {
    /**
     * Generate referral code for customer
     */
    generateReferralCode(customerId: number): Promise<string>;
    /**
     * Register referral
     */
    registerReferral(referrerCustomerId: number, refereeCustomerId: number, referralCode: string, referrerReward: ReferralReward, refereeReward: ReferralReward): Promise<number>;
    /**
     * Complete referral (when referee makes purchase)
     */
    completeReferral(refereeCustomerId: number, subscriptionId: number): Promise<boolean>;
    /**
     * Apply referrer reward
     */
    private applyReferrerReward;
    /**
     * Apply referee reward
     */
    private applyRefereeReward;
    /**
     * Get referral by code
     */
    getReferralByCode(code: string): Promise<Referral | null>;
    /**
     * Get referrals by referrer
     */
    getReferralsByReferrer(customerId: number): Promise<Referral[]>;
    /**
     * Get referral statistics for customer
     */
    getReferralStats(customerId: number): Promise<{
        total_referrals: number;
        completed_referrals: number;
        pending_referrals: number;
        total_rewards: number;
        referral_code: string;
    }>;
    /**
     * Map database row to referral object
     */
    private mapRowToReferral;
}
declare const _default: ReferralService;
export default _default;
//# sourceMappingURL=ReferralService.d.ts.map