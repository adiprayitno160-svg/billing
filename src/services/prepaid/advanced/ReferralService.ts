/**
 * Referral Service
 * 
 * Handles referral program:
 * - Generate referral codes
 * - Track referrals
 * - Apply referral rewards
 * - Manage referral commissions
 */

import { databasePool } from '../../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

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

export class ReferralService {
  /**
   * Generate referral code for customer
   */
  async generateReferralCode(customerId: number): Promise<string> {
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
  async registerReferral(
    referrerCustomerId: number,
    refereeCustomerId: number,
    referralCode: string,
    referrerReward: ReferralReward,
    refereeReward: ReferralReward
  ): Promise<number> {
    const connection = await databasePool.getConnection();
    
    try {
      // Validate referral code
      if (referralCode) {
        const existing = await this.getReferralByCode(referralCode);
        if (existing && existing.referrer_customer_id !== referrerCustomerId) {
          throw new Error('Invalid referral code');
        }
      }
      
      // Check if referee already has referral
      const [existingRefs] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM prepaid_referrals 
         WHERE referee_customer_id = ? AND status != 'cancelled'`,
        [refereeCustomerId]
      );
      
      if (existingRefs.length > 0) {
        throw new Error('Customer already has a referral');
      }
      
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO prepaid_referrals (
          referrer_customer_id, referee_customer_id, referral_code,
          referrer_reward_type, referrer_reward_value, referrer_reward_status,
          referee_reward_type, referee_reward_value, referee_reward_status,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
        ]
      );
      
      return result.insertId;
      
    } finally {
      connection.release();
    }
  }
  
  /**
   * Complete referral (when referee makes purchase)
   */
  async completeReferral(
    refereeCustomerId: number,
    subscriptionId: number
  ): Promise<boolean> {
    const connection = await databasePool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Find pending referral
      const [referralRows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM prepaid_referrals 
         WHERE referee_customer_id = ? AND status = 'pending'`,
        [refereeCustomerId]
      );
      
      if (referralRows.length === 0) {
        return false; // No referral found
      }
      
      const referral = referralRows[0];
      
      // Update referral status
      await connection.query(
        `UPDATE prepaid_referrals 
         SET status = 'completed',
             completed_at = NOW(),
             referrer_reward_status = 'claimed',
             referee_reward_status = 'claimed'
         WHERE id = ?`,
        [referral.id]
      );
      
      // Apply rewards
      await this.applyReferrerReward(referral.referrer_customer_id, referral);
      await this.applyRefereeReward(refereeCustomerId, referral, subscriptionId);
      
      await connection.commit();
      return true;
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Apply referrer reward
   */
  private async applyReferrerReward(
    referrerCustomerId: number,
    referral: any
  ): Promise<void> {
    const rewardType = referral.referrer_reward_type;
    const rewardValue = parseFloat(referral.referrer_reward_value || 0);
    
    if (rewardType === 'credit') {
      // Add credit to customer balance/deposit
      await databasePool.query(
        `INSERT INTO prepaid_customer_deposits (customer_id, balance, last_updated)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           balance = balance + ?,
           last_updated = NOW()`,
        [referrerCustomerId, rewardValue, rewardValue]
      );
      
      // Log transaction
      await databasePool.query(
        `INSERT INTO prepaid_deposit_transactions (
          customer_id, transaction_type, amount, description,
          balance_before, balance_after
        ) VALUES (?, 'deposit', ?, ?, 
          (SELECT balance FROM prepaid_customer_deposits WHERE customer_id = ?) - ?,
          (SELECT balance FROM prepaid_customer_deposits WHERE customer_id = ?)
        )`,
        [
          referrerCustomerId,
          rewardValue,
          `Referral reward for referral code: ${referral.referral_code}`,
          referrerCustomerId,
          rewardValue,
          referrerCustomerId
        ]
      );
    } else if (rewardType === 'discount') {
      // Discount would be applied on next purchase
      // Store in customer metadata or separate discount table
      console.log(`Discount reward ${rewardValue} for referrer ${referrerCustomerId}`);
    }
  }
  
  /**
   * Apply referee reward
   */
  private async applyRefereeReward(
    refereeCustomerId: number,
    referral: any,
    subscriptionId: number
  ): Promise<void> {
    const rewardType = referral.referee_reward_type;
    const rewardValue = parseFloat(referral.referee_reward_value || 0);
    
    // Referee reward is typically applied during subscription purchase
    // This would be handled in the subscription activation process
    
    if (rewardType === 'credit') {
      await databasePool.query(
        `INSERT INTO prepaid_customer_deposits (customer_id, balance, last_updated)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
           balance = balance + ?,
           last_updated = NOW()`,
        [refereeCustomerId, rewardValue, rewardValue]
      );
    }
  }
  
  /**
   * Get referral by code
   */
  async getReferralByCode(code: string): Promise<Referral | null> {
    const [rows] = await databasePool.query<RowDataPacket[]>(
      'SELECT * FROM prepaid_referrals WHERE referral_code = ?',
      [code]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToReferral(rows[0]);
  }
  
  /**
   * Get referrals by referrer
   */
  async getReferralsByReferrer(customerId: number): Promise<Referral[]> {
    const [rows] = await databasePool.query<RowDataPacket[]>(
      `SELECT * FROM prepaid_referrals 
       WHERE referrer_customer_id = ?
       ORDER BY created_at DESC`,
      [customerId]
    );
    
    return (rows as any[]).map(row => this.mapRowToReferral(row));
  }
  
  /**
   * Get referral statistics for customer
   */
  async getReferralStats(customerId: number): Promise<{
    total_referrals: number;
    completed_referrals: number;
    pending_referrals: number;
    total_rewards: number;
    referral_code: string;
  }> {
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
  private mapRowToReferral(row: any): Referral {
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

export default new ReferralService();




