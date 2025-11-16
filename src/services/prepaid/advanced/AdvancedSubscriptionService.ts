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

import { databasePool } from '../../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import AdvancedPackageService from './AdvancedPackageService';
import { MikrotikService } from '../../mikrotik/MikrotikService';
import { getMikrotikConfig } from '../../../utils/mikrotikConfigHelper';

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

export class AdvancedSubscriptionService {
  /**
   * Activate subscription
   */
  async activateSubscription(request: ActivationRequest): Promise<ActivationResult> {
    const connection = await databasePool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. Get package details
      const pkg = await AdvancedPackageService.getPackageById(request.package_id);
      if (!pkg) {
        throw new Error('Package not found');
      }
      
      // 2. Get customer details
      const [customerRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [request.customer_id]
      );
      
      if (customerRows.length === 0) {
        throw new Error('Customer not found');
      }
      
      const customer = customerRows[0];
      
      // 3. Deactivate existing active subscriptions
      await connection.query(
        `UPDATE prepaid_subscriptions_v2 
         SET status = 'cancelled', cancelled_at = NOW()
         WHERE customer_id = ? AND status IN ('active', 'paused')`,
        [request.customer_id]
      );
      
      // 4. Calculate dates and pricing
      const activationDate = new Date();
      const expiryDate = new Date(activationDate);
      expiryDate.setDate(expiryDate.getDate() + pkg.duration_days);
      expiryDate.setHours(expiryDate.getHours() + (pkg.duration_hours || 0));
      
      // Calculate final price (will handle voucher in separate step)
      const pricing = AdvancedPackageService.calculateFinalPrice(pkg);
      const finalPrice = pricing.finalPrice;
      
      // 5. Generate subscription code
      const subscriptionCode = await this.generateSubscriptionCode();
      
      // 6. Create subscription
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO prepaid_subscriptions_v2 (
          customer_id, package_id, subscription_code,
          activation_date, expiry_date,
          duration_days, duration_hours,
          purchase_price, discount_amount, final_price,
          data_quota_gb, data_remaining_gb,
          status, auto_renew, deposit_amount,
          payment_transaction_id, invoice_id,
          referral_code, voucher_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          request.customer_id,
          request.package_id,
          subscriptionCode,
          activationDate,
          expiryDate,
          pkg.duration_days,
          pkg.duration_hours || 0,
          pricing.basePrice,
          pricing.discount,
          finalPrice,
          pkg.data_quota_gb || null,
          pkg.data_quota_gb || null,
          'active',
          request.auto_renew ? 1 : 0,
          request.deposit_amount || 0,
          request.payment_transaction_id || null,
          request.invoice_id || null,
          request.referral_code || null,
          request.voucher_code || null
        ]
      );
      
      const subscriptionId = result.insertId;
      
      // 7. Apply MikroTik configuration
      try {
        await this.applyMikrotikConfiguration(customer, pkg, subscriptionCode);
        
        // Update subscription with MikroTik config
        await connection.query(
          `UPDATE prepaid_subscriptions_v2 
           SET mikrotik_profile_applied = ?, mikrotik_queue_applied = ?, address_list_applied = ?
           WHERE id = ?`,
          [
            pkg.mikrotik_profile_name || null,
            pkg.parent_download_queue || null,
            'prepaid-active',
            subscriptionId
          ]
        );
      } catch (mikrotikError: any) {
        console.error('MikroTik configuration error:', mikrotikError);
        // Continue even if MikroTik fails - will be handled separately
      }
      
      await connection.commit();
      
      // Send activation notification
      try {
        const { UnifiedNotificationService } = await import('../../notification/UnifiedNotificationService');
        await UnifiedNotificationService.notifyPackageActivated(subscriptionId);
        // Schedule expiry notifications
        await UnifiedNotificationService.schedulePackageExpiryNotifications(subscriptionId);
      } catch (notifError) {
        console.error('Error sending activation notification:', notifError);
        // Don't fail activation if notification fails
      }
      
      return {
        success: true,
        subscription_id: subscriptionId,
        subscription_code: subscriptionCode,
        message: 'Subscription activated successfully'
      };
      
    } catch (error: any) {
      await connection.rollback();
      return {
        success: false,
        message: 'Failed to activate subscription',
        error: error.message
      };
    } finally {
      connection.release();
    }
  }
  
  /**
   * Deactivate subscription
   */
  async deactivateSubscription(
    subscriptionId: number,
    reason?: string
  ): Promise<boolean> {
    const connection = await databasePool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get subscription
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }
      
      // Get customer
      const [customerRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [subscription.customer_id]
      );
      
      if (customerRows.length === 0) {
        throw new Error('Customer not found');
      }
      
      const customer = customerRows[0];
      
      // Revert MikroTik configuration
      try {
        await this.revertMikrotikConfiguration(customer);
      } catch (error) {
        console.error('MikroTik revert error:', error);
      }
      
      // Update subscription status
      await connection.query(
        `UPDATE prepaid_subscriptions_v2 
         SET status = 'cancelled', 
             cancelled_at = NOW(),
             cancellation_reason = ?
         WHERE id = ?`,
        [reason || 'Manually cancelled', subscriptionId]
      );
      
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
   * Pause subscription
   */
  async pauseSubscription(subscriptionId: number, resumeDate?: Date): Promise<boolean> {
    const connection = await databasePool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription || subscription.status !== 'active') {
        throw new Error('Subscription not found or not active');
      }
      
      const pausedAt = new Date();
      const pausedUntil = resumeDate || null;
      
      // Calculate extended expiry
      let extendedExpiry = new Date(subscription.expiry_date);
      if (pausedUntil) {
        const pauseDuration = pausedUntil.getTime() - pausedAt.getTime();
        extendedExpiry = new Date(extendedExpiry.getTime() + pauseDuration);
      }
      
      await connection.query(
        `UPDATE prepaid_subscriptions_v2 
         SET status = 'paused',
             paused_at = ?,
             paused_until = ?,
             expiry_date = ?
         WHERE id = ?`,
        [pausedAt, pausedUntil, extendedExpiry, subscriptionId]
      );
      
      // Revert MikroTik (pause internet access)
      try {
        const [customerRows] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM customers WHERE id = ?',
          [subscription.customer_id]
        );
        if (customerRows.length > 0) {
          await this.revertMikrotikConfiguration(customerRows[0]);
        }
      } catch (error) {
        console.error('MikroTik pause error:', error);
      }
      
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
   * Resume subscription
   */
  async resumeSubscription(subscriptionId: number): Promise<boolean> {
    const connection = await databasePool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription || subscription.status !== 'paused') {
        throw new Error('Subscription not found or not paused');
      }
      
      // Get package
      const pkg = await AdvancedPackageService.getPackageById(subscription.package_id);
      if (!pkg) {
        throw new Error('Package not found');
      }
      
      // Calculate remaining time
      const now = new Date();
      const pausedDuration = subscription.paused_at 
        ? now.getTime() - new Date(subscription.paused_at).getTime()
        : 0;
      
      const newExpiry = new Date(subscription.expiry_date.getTime() + pausedDuration);
      
      await connection.query(
        `UPDATE prepaid_subscriptions_v2 
         SET status = 'active',
             paused_at = NULL,
             paused_until = NULL,
             expiry_date = ?
         WHERE id = ?`,
        [newExpiry, subscriptionId]
      );
      
      // Re-apply MikroTik configuration
      try {
        const [customerRows] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM customers WHERE id = ?',
          [subscription.customer_id]
        );
        if (customerRows.length > 0) {
          await this.applyMikrotikConfiguration(
            customerRows[0],
            pkg,
            subscription.subscription_code
          );
        }
      } catch (error) {
        console.error('MikroTik resume error:', error);
      }
      
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
   * Get active subscription for customer
   */
  async getActiveSubscription(customerId: number): Promise<Subscription | null> {
    const [rows] = await databasePool.query<RowDataPacket[]>(
      `SELECT * FROM prepaid_subscriptions_v2 
       WHERE customer_id = ? AND status = 'active' 
       ORDER BY activation_date DESC LIMIT 1`,
      [customerId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToSubscription(rows[0]);
  }
  
  /**
   * Get subscription by ID
   */
  async getSubscriptionById(id: number): Promise<Subscription | null> {
    const [rows] = await databasePool.query<RowDataPacket[]>(
      'SELECT * FROM prepaid_subscriptions_v2 WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToSubscription(rows[0]);
  }
  
  /**
   * Get subscriptions by customer
   */
  async getCustomerSubscriptions(
    customerId: number,
    status?: Subscription['status']
  ): Promise<Subscription[]> {
    let query = `SELECT * FROM prepaid_subscriptions_v2 WHERE customer_id = ?`;
    const params: any[] = [customerId];
    
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY activation_date DESC`;
    
    const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
    
    return (rows as any[]).map(row => this.mapRowToSubscription(row));
  }
  
  /**
   * Check and handle expired subscriptions
   */
  async checkExpiredSubscriptions(): Promise<number> {
    const connection = await databasePool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get expired active subscriptions
      const [expiredSubs] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM prepaid_subscriptions_v2 
         WHERE status = 'active' AND expiry_date < NOW()`
      );
      
      let processed = 0;
      
      for (const sub of expiredSubs as any[]) {
        try {
          // Try auto-renewal if enabled
          if (sub.auto_renew) {
            const renewed = await this.attemptAutoRenewal(sub.id);
            if (renewed) {
              processed++;
              continue;
            }
          }
          
          // Expire subscription
          await this.deactivateSubscription(sub.id, 'Expired automatically');
          processed++;
        } catch (error) {
          console.error(`Error processing expired subscription ${sub.id}:`, error);
        }
      }
      
      await connection.commit();
      return processed;
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Attempt auto-renewal
   */
  private async attemptAutoRenewal(subscriptionId: number): Promise<boolean> {
    // Implementation for auto-renewal
    // This would check deposit balance and renew if sufficient
    // For now, return false
    return false;
  }
  
  /**
   * Apply MikroTik configuration
   */
  private async applyMikrotikConfiguration(
    customer: any,
    pkg: any,
    subscriptionCode: string
  ): Promise<void> {
    const config = await getMikrotikConfig();
    if (!config) {
      throw new Error('MikroTik configuration not found');
    }
    
    const mikrotikService = new MikrotikService({
      host: config.host,
      port: config.port || config.api_port || 8728,
      username: config.username,
      password: config.password
    });
    
    // For PPPoE
    if (pkg.mikrotik_profile_name && customer.pppoe_username) {
      await mikrotikService.updatePPPoEUser(customer.pppoe_username, {
        profile: pkg.mikrotik_profile_name
      });
    }
    
    // For Static IP
    if (pkg.parent_download_queue && customer.ip_address) {
      // Move to active address list
      // Implementation depends on your MikroTik service
    }
  }
  
  /**
   * Revert MikroTik configuration
   */
  private async revertMikrotikConfiguration(customer: any): Promise<void> {
    const config = await getMikrotikConfig();
    if (!config) {
      return;
    }
    
    const mikrotikService = new MikrotikService({
      host: config.host,
      port: config.port || config.api_port || 8728,
      username: config.username,
      password: config.password
    });
    
    // Revert to no-package profile/list
    if (customer.pppoe_username) {
      await mikrotikService.updatePPPoEUser(customer.pppoe_username, {
        profile: 'prepaid-no-package'
      });
    }
  }
  
  /**
   * Generate unique subscription code
   */
  private async generateSubscriptionCode(): Promise<string> {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SUB-${timestamp}-${random}`;
  }
  
  /**
   * Map database row to subscription object
   */
  private mapRowToSubscription(row: any): Subscription {
    return {
      id: row.id,
      customer_id: row.customer_id,
      package_id: row.package_id,
      subscription_code: row.subscription_code,
      activation_date: new Date(row.activation_date),
      expiry_date: new Date(row.expiry_date),
      paused_at: row.paused_at ? new Date(row.paused_at) : undefined,
      paused_until: row.paused_until ? new Date(row.paused_until) : undefined,
      duration_days: row.duration_days,
      duration_hours: row.duration_hours || 0,
      purchase_price: parseFloat(row.purchase_price) || 0,
      discount_amount: row.discount_amount ? parseFloat(row.discount_amount) : undefined,
      final_price: parseFloat(row.final_price) || 0,
      data_quota_gb: row.data_quota_gb ? parseFloat(row.data_quota_gb) : undefined,
      data_used_gb: row.data_used_gb ? parseFloat(row.data_used_gb) : 0,
      data_remaining_gb: row.data_remaining_gb ? parseFloat(row.data_remaining_gb) : undefined,
      rollover_quota_gb: row.rollover_quota_gb ? parseFloat(row.rollover_quota_gb) : 0,
      rollover_expiry_date: row.rollover_expiry_date ? new Date(row.rollover_expiry_date) : undefined,
      status: row.status,
      auto_renew: row.auto_renew === 1,
      deposit_amount: row.deposit_amount ? parseFloat(row.deposit_amount) : 0,
      payment_transaction_id: row.payment_transaction_id || undefined,
      invoice_id: row.invoice_id || undefined,
      referral_code: row.referral_code || undefined,
      voucher_code: row.voucher_code || undefined
    };
  }
}

export default new AdvancedSubscriptionService();




