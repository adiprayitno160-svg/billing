"use strict";
/**
 * Referral Service
 *
 * Handles referral program:
 * - Generate referral codes
 * - Track referrals
 * - Apply referral rewards
 * - Manage referral commissions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralService = void 0;
const pool_1 = require("../../../db/pool");
class ReferralService {
    /**
     * Generate referral code for customer
     */
    async generateReferralCode(customerId) {
        // Generate code based on customer ID + timestamp
        const code = `REF-${customerId}-${Date.now().toString(36).toUpperCase()}`;
        // Check if code already exists (unlikely but check anyway)
        const existing = await this.getReferralByCode(code);
        if (existing) {
            return this.generateReferralCode(customerId); // Retry with new timestamp
        }
        return code;
    }
    /**
     * Register referral
     */
    async registerReferral(referrerCustomerId, refereeCustomerId, referralCode, referrerReward, refereeReward) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            // Validate referral code
            if (referralCode) {
                const existing = await this.getReferralByCode(referralCode);
                if (existing && existing.referrer_customer_id !== referrerCustomerId) {
                    throw new Error('Invalid referral code');
                }
            }
            // Check if referee already has referral
            const [existingRefs] = await connection.query(`SELECT * FROM prepaid_referrals 
         WHERE referee_customer_id = ? AND status != 'cancelled'`, [refereeCustomerId]);
            if (existingRefs.length > 0) {
                throw new Error('Customer already has a referral');
            }
            const [result] = await connection.query(`INSERT INTO prepaid_referrals (
          referrer_customer_id, referee_customer_id, referral_code,
          referrer_reward_type, referrer_reward_value, referrer_reward_status,
          referee_reward_type, referee_reward_value, referee_reward_status,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                referrerCustomerId,
                refereeCustomerId,
                referralCode || await this.generateReferralCode(referrerCustomerId),
                referrerReward.reward_type,
                referrerReward.reward_value,
                'pending',
                refereeReward.reward_type,
                refereeReward.reward_value,
                'pending',
                'pending'
            ]);
            return result.insertId;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Complete referral (when referee makes purchase)
     */
    async completeReferral(refereeCustomerId, subscriptionId) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.beginTransaction();
            // Find pending referral
            const [referralRows] = await connection.query(`SELECT * FROM prepaid_referrals 
         WHERE referee_customer_id = ? AND status = 'pending'`, [refereeCustomerId]);
            if (referralRows.length === 0) {
                return false; // No referral found
            }
            const referral = referralRows[0];
            // Update referral status
            await connection.query(`UPDATE prepaid_referrals 
         SET status = 'completed',
             completed_at = NOW(),
             referrer_reward_status = 'claimed',
             referee_reward_status = 'claimed'
         WHERE id = ?`, [referral.id]);
            // Apply rewards
            await this.applyReferrerReward(referral.referrer_customer_id, referral);
            await this.applyRefereeReward(refereeCustomerId, referral, subscriptionId);
            await connection.commit();
            return true;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Apply referrer reward
     */
    async applyReferrerReward(referrerCustomerId, referral) {
        const rewardType = referral.referrer_reward_type;
        const rewardValue = parseFloat(referral.referrer_reward_value || 0);
        if (rewardType === 'credit') {
            // Add credit to customer balance/deposit
            await pool_1.databasePool.query(`INSERT INTO prepaid_customer_deposits (customer_id, balance, last_updated)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           balance = balance + ?,
           last_updated = NOW()`, [referrerCustomerId, rewardValue, rewardValue]);
            // Log transaction
            await pool_1.databasePool.query(`INSERT INTO prepaid_deposit_transactions (
          customer_id, transaction_type, amount, description,
          balance_before, balance_after
        ) VALUES (?, 'deposit', ?, ?, 
          (SELECT balance FROM prepaid_customer_deposits WHERE customer_id = ?) - ?,
          (SELECT balance FROM prepaid_customer_deposits WHERE customer_id = ?)
        )`, [
                referrerCustomerId,
                rewardValue,
                `Referral reward for referral code: ${referral.referral_code}`,
                referrerCustomerId,
                rewardValue,
                referrerCustomerId
            ]);
        }
        else if (rewardType === 'discount') {
            // Discount would be applied on next purchase
            // Store in customer metadata or separate discount table
            console.log(`Discount reward ${rewardValue} for referrer ${referrerCustomerId}`);
        }
    }
    /**
     * Apply referee reward
     */
    async applyRefereeReward(refereeCustomerId, referral, subscriptionId) {
        const rewardType = referral.referee_reward_type;
        const rewardValue = parseFloat(referral.referee_reward_value || 0);
        // Referee reward is typically applied during subscription purchase
        // This would be handled in the subscription activation process
        if (rewardType === 'credit') {
            await pool_1.databasePool.query(`INSERT INTO prepaid_customer_deposits (customer_id, balance, last_updated)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           balance = balance + ?,
           last_updated = NOW()`, [refereeCustomerId, rewardValue, rewardValue]);
        }
    }
    /**
     * Get referral by code
     */
    async getReferralByCode(code) {
        const [rows] = await pool_1.databasePool.query('SELECT * FROM prepaid_referrals WHERE referral_code = ?', [code]);
        if (rows.length === 0) {
            return null;
        }
        return this.mapRowToReferral(rows[0]);
    }
    /**
     * Get referrals by referrer
     */
    async getReferralsByReferrer(customerId) {
        const [rows] = await pool_1.databasePool.query(`SELECT * FROM prepaid_referrals 
       WHERE referrer_customer_id = ?
       ORDER BY created_at DESC`, [customerId]);
        return rows.map(row => this.mapRowToReferral(row));
    }
    /**
     * Get referral statistics for customer
     */
    async getReferralStats(customerId) {
        const referrals = await this.getReferralsByReferrer(customerId);
        const completed = referrals.filter(r => r.status === 'completed');
        const pending = referrals.filter(r => r.status === 'pending');
        const totalRewards = completed.reduce((sum, r) => {
            return sum + (parseFloat(r.referrer_reward_value?.toString() || '0'));
        }, 0);
        // Get or generate referral code
        let referralCode = referrals.length > 0 ? referrals[0].referral_code : null;
        if (!referralCode) {
            referralCode = await this.generateReferralCode(customerId);
        }
        return {
            total_referrals: referrals.length,
            completed_referrals: completed.length,
            pending_referrals: pending.length,
            total_rewards: totalRewards,
            referral_code: referralCode
        };
    }
    /**
     * Map database row to referral object
     */
    mapRowToReferral(row) {
        return {
            id: row.id,
            referrer_customer_id: row.referrer_customer_id,
            referee_customer_id: row.referee_customer_id,
            referral_code: row.referral_code,
            referrer_reward_type: row.referrer_reward_type,
            referrer_reward_value: row.referrer_reward_value ? parseFloat(row.referrer_reward_value) : undefined,
            referrer_reward_status: row.referrer_reward_status,
            referee_reward_type: row.referee_reward_type,
            referee_reward_value: row.referee_reward_value ? parseFloat(row.referee_reward_value) : undefined,
            referee_reward_status: row.referee_reward_status,
            status: row.status,
            completed_at: row.completed_at ? new Date(row.completed_at) : undefined
        };
    }
}
exports.ReferralService = ReferralService;
exports.default = new ReferralService();
//# sourceMappingURL=ReferralService.js.map