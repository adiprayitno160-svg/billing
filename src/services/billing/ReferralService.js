"use strict";
/**
 * Referral Service
 * Handles customer referral program
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralService = void 0;
const pool_1 = require("../../db/pool");
class ReferralService {
    /**
     * Generate unique referral code for customer
     */
    static async generateReferralCode(customerId, customerName) {
        try {
            // Generate code: First 3 letters of name + 4 digit ID
            const namePrefix = customerName
                .replace(/[^a-zA-Z]/g, '')
                .substring(0, 3)
                .toUpperCase()
                .padEnd(3, 'X');
            const code = `${namePrefix}${customerId.toString().padStart(4, '0')}`;
            // Update customer with referral code
            await pool_1.databasePool.query(`UPDATE customers SET referral_code = ? WHERE id = ?`, [code, customerId]);
            return code;
        }
        catch (error) {
            console.error('Error generating referral code:', error);
            throw error;
        }
    }
    /**
     * Get customer's referral code
     */
    static async getCustomerReferralCode(customerId) {
        try {
            const [customers] = await pool_1.databasePool.query(`SELECT referral_code, name FROM customers WHERE id = ?`, [customerId]);
            if (customers.length === 0) {
                return null;
            }
            const customer = customers[0];
            // Generate if not exists
            if (!customer.referral_code) {
                return await this.generateReferralCode(customerId, customer.name);
            }
            return customer.referral_code;
        }
        catch (error) {
            console.error('Error getting referral code:', error);
            return null;
        }
    }
    /**
     * Validate referral code
     */
    static async validateReferralCode(code, referredCustomerId) {
        try {
            // Get referrer by code
            const [referrers] = await pool_1.databasePool.query(`SELECT id, name, billing_mode FROM customers WHERE referral_code = ?`, [code.toUpperCase()]);
            if (referrers.length === 0) {
                return {
                    valid: false,
                    message: 'Kode referral tidak valid'
                };
            }
            const referrer = referrers[0];
            // Check if same customer
            if (referrer.id === referredCustomerId) {
                return {
                    valid: false,
                    message: 'Anda tidak bisa menggunakan kode referral sendiri'
                };
            }
            // Check if already used this referral
            const [existing] = await pool_1.databasePool.query(`SELECT id FROM customer_referrals WHERE referrer_id = ? AND referred_id = ?`, [referrer.id, referredCustomerId]);
            if (existing.length > 0) {
                return {
                    valid: false,
                    message: 'Anda sudah pernah menggunakan kode referral ini'
                };
            }
            return {
                valid: true,
                message: 'Kode referral valid! Dapatkan diskon 10%',
                referrerId: referrer.id,
                discountPercent: 10
            };
        }
        catch (error) {
            console.error('Error validating referral code:', error);
            return {
                valid: false,
                message: 'Terjadi kesalahan saat memvalidasi kode referral'
            };
        }
    }
    /**
     * Create referral record
     */
    static async createReferral(referrerId, referredId, referralCode) {
        try {
            const [result] = await pool_1.databasePool.query(`INSERT INTO customer_referrals 
                (referrer_id, referred_id, referral_code, status, referrer_reward_days, referred_discount_percent) 
                VALUES (?, ?, ?, 'pending', 3, 10)`, [referrerId, referredId, referralCode.toUpperCase()]);
            return result.insertId;
        }
        catch (error) {
            console.error('Error creating referral:', error);
            return null;
        }
    }
    /**
     * Mark referral as completed and reward referrer
     */
    static async completeReferral(referralId) {
        try {
            // Get referral details
            const [referrals] = await pool_1.databasePool.query(`SELECT * FROM customer_referrals WHERE id = ? AND status = 'pending'`, [referralId]);
            if (referrals.length === 0) {
                return false;
            }
            const referral = referrals[0];
            // Give reward to referrer (extend expiry date)
            const rewardDays = referral.referrer_reward_days || 3;
            await pool_1.databasePool.query(`UPDATE customers 
                SET expiry_date = DATE_ADD(COALESCE(
                    CASE 
                        WHEN expiry_date > CURDATE() THEN expiry_date 
                        ELSE CURDATE() 
                    END, 
                    CURDATE()
                ), INTERVAL ? DAY)
                WHERE id = ?`, [rewardDays, referral.referrer_id]);
            // Update referral status
            await pool_1.databasePool.query(`UPDATE customer_referrals 
                SET status = 'rewarded', rewarded_at = NOW() 
                WHERE id = ?`, [referralId]);
            return true;
        }
        catch (error) {
            console.error('Error completing referral:', error);
            return false;
        }
    }
    /**
     * Get referral stats for customer
     */
    static async getReferralStats(customerId) {
        try {
            // Get all referrals
            const [referrals] = await pool_1.databasePool.query(`SELECT 
                    cr.*,
                    c.name as referred_name,
                    c.phone as referred_phone,
                    c.status as referred_status
                FROM customer_referrals cr
                LEFT JOIN customers c ON cr.referred_id = c.id
                WHERE cr.referrer_id = ?
                ORDER BY cr.created_at DESC`, [customerId]);
            const successful = referrals.filter((r) => r.status === 'rewarded');
            const pending = referrals.filter((r) => r.status === 'pending');
            const totalDaysEarned = successful.reduce((sum, r) => sum + (r.referrer_reward_days || 0), 0);
            return {
                total_referrals: referrals.length,
                successful_referrals: successful.length,
                pending_referrals: pending.length,
                total_days_earned: totalDaysEarned,
                referred_customers: referrals
            };
        }
        catch (error) {
            console.error('Error getting referral stats:', error);
            return {
                total_referrals: 0,
                successful_referrals: 0,
                pending_referrals: 0,
                total_days_earned: 0,
                referred_customers: []
            };
        }
    }
    /**
     * Get referral by referred customer ID
     */
    static async getReferralByReferredId(referredId) {
        try {
            const [referrals] = await pool_1.databasePool.query(`SELECT * FROM customer_referrals WHERE referred_id = ? LIMIT 1`, [referredId]);
            return referrals.length > 0 ? referrals[0] : null;
        }
        catch (error) {
            console.error('Error getting referral:', error);
            return null;
        }
    }
    /**
     * Check if customer can use referral (new customer only)
     */
    static async canUseReferral(customerId) {
        try {
            // Check if already used a referral
            const [existing] = await pool_1.databasePool.query(`SELECT id FROM customer_referrals WHERE referred_id = ?`, [customerId]);
            if (existing.length > 0) {
                return false;
            }
            // Check if new customer (< 7 days)
            const [customers] = await pool_1.databasePool.query(`SELECT created_at FROM customers WHERE id = ?`, [customerId]);
            if (customers.length === 0) {
                return false;
            }
            const daysSinceRegistration = Math.floor((Date.now() - new Date(customers[0].created_at).getTime()) / (1000 * 60 * 60 * 24));
            return daysSinceRegistration <= 7;
        }
        catch (error) {
            console.error('Error checking referral eligibility:', error);
            return false;
        }
    }
}
exports.ReferralService = ReferralService;
