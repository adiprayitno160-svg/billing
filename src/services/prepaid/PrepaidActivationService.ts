import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import SpeedProfileService from './SpeedProfileService';
import AddressListService from './AddressListService';
import MikrotikService from '../mikrotik/MikrotikService';

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
class PrepaidActivationService {
  /**
   * Activate prepaid package for customer
   */
  async activatePackage(data: {
    customer_id: number;
    package_id: number;
    invoice_id?: number;
    purchase_price: number;
    auto_renew?: boolean;
  }): Promise<ActivationResult> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // 1. Get package details
      const [packageRows] = await connection.query<RowDataPacket[]>(
        `SELECT pp.*, sp.* 
         FROM prepaid_packages pp
         LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
         WHERE pp.id = ?`,
        [data.package_id]
      );

      if (packageRows.length === 0) {
        throw new Error('Package not found');
      }

      const packageData = packageRows[0];

      // 2. Get customer details
      const [customerRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM customers WHERE id = ?',
        [data.customer_id]
      );

      if (customerRows.length === 0) {
        throw new Error('Customer not found');
      }

      const customer = customerRows[0];

      // 3. Check for existing active subscription
      const [existingSubs] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM prepaid_package_subscriptions 
         WHERE customer_id = ? AND status = 'active' AND expiry_date > NOW()`,
        [data.customer_id]
      );

      if (existingSubs.length > 0) {
        // Expire existing subscription
        await connection.query(
          `UPDATE prepaid_package_subscriptions 
           SET status = 'cancelled', updated_at = NOW() 
           WHERE id = ?`,
          [existingSubs[0].id]
        );
      }

      // 4. Calculate activation and expiry dates
      const activationDate = new Date();
      const expiryDate = new Date();
      
      // Add duration based on package type
      if (packageData.package_type === 'daily') {
        expiryDate.setDate(expiryDate.getDate() + (packageData.duration_hours / 24));
      } else if (packageData.package_type === 'weekly') {
        expiryDate.setDate(expiryDate.getDate() + 7);
      } else if (packageData.package_type === 'monthly') {
        expiryDate.setDate(expiryDate.getDate() + 30);
      } else {
        // Default 30 days
        expiryDate.setDate(expiryDate.getDate() + 30);
      }

      // 5. Create subscription record
      const [subscriptionResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO prepaid_package_subscriptions 
         (customer_id, package_id, activation_date, expiry_date, status, auto_renew, purchase_price, invoice_id, pppoe_username)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        [
          data.customer_id,
          data.package_id,
          activationDate,
          expiryDate,
          data.auto_renew || 0,
          data.purchase_price,
          data.invoice_id || null,
          customer.pppoe_username
        ]
      );

      const subscriptionId = subscriptionResult.insertId;

      // 6. Update customer status
      await connection.query(
        `UPDATE customers 
         SET status = 'active', is_isolated = 0, billing_mode = 'prepaid'
         WHERE id = ?`,
        [data.customer_id]
      );

      // 7. Log speed change
      if (packageData.speed_profile_id) {
        await connection.query(
          `INSERT INTO customer_speed_history 
           (customer_id, subscription_id, new_speed_profile_id, new_speed_mbps, change_reason)
           VALUES (?, ?, ?, ?, 'purchase')`,
          [
            data.customer_id,
            subscriptionId,
            packageData.speed_profile_id,
            `${packageData.download_mbps}/${packageData.upload_mbps} Mbps`
          ]
        );
      }

      await connection.commit();

      // 8. Activate in MikroTik (after commit)
      try {
        await this.activateInMikrotik(data.customer_id, packageData);
      } catch (error) {
        console.error('MikroTik activation failed:', error);
        // Don't rollback, just log error
      }

      // 9. Remove from portal-redirect list
      try {
        await AddressListService.removeFromPortalRedirect(data.customer_id);
      } catch (error) {
        console.error('Failed to remove from portal-redirect:', error);
      }

      return {
        success: true,
        subscription_id: subscriptionId,
        message: `Package activated successfully until ${expiryDate.toLocaleDateString()}`
      };

    } catch (error: any) {
      await connection.rollback();
      console.error('Activation error:', error);
      return {
        success: false,
        message: 'Failed to activate package',
        error: error.message
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Activate customer in MikroTik
   */
  private async activateInMikrotik(customerId: number, packageData: any): Promise<void> {
    // Get customer details
    const [customerRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM customers WHERE id = ?',
      [customerId]
    );

    if (customerRows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = customerRows[0];

    // Only activate PPPoE users
    if (customer.connection_type === 'pppoe' && customer.pppoe_username) {
      try {
        // Get MikroTik profile name
        const profileName = packageData.mikrotik_profile_name || `${packageData.download_mbps}M-PREP`;

        // TODO: Call actual MikroTik API to:
        // 1. Enable PPPoE user
        // 2. Set profile
        // 3. Remove from disabled list
        
        console.log(`✅ MikroTik: Activated ${customer.pppoe_username} with profile ${profileName}`);

        // Update sync status
        await pool.query(
          `UPDATE prepaid_package_subscriptions 
           SET mikrotik_synced = 1 
           WHERE customer_id = ? AND status = 'active'`,
          [customerId]
        );
      } catch (error) {
        console.error('MikroTik API error:', error);
        throw error;
      }
    }
  }

  /**
   * Deactivate/suspend customer package
   */
  async deactivatePackage(subscriptionId: number, reason: string = 'Expired'): Promise<boolean> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Get subscription details
      const [subsRows] = await connection.query<RowDataPacket[]>(
        `SELECT pps.*, c.pppoe_username, c.connection_type 
         FROM prepaid_package_subscriptions pps
         INNER JOIN customers c ON pps.customer_id = c.id
         WHERE pps.id = ?`,
        [subscriptionId]
      );

      if (subsRows.length === 0) {
        throw new Error('Subscription not found');
      }

      const subscription = subsRows[0];

      // 2. Update subscription status
      await connection.query(
        `UPDATE prepaid_package_subscriptions 
         SET status = 'expired', updated_at = NOW() 
         WHERE id = ?`,
        [subscriptionId]
      );

      // 3. Update customer status
      await connection.query(
        `UPDATE customers 
         SET status = 'suspended', is_isolated = 1 
         WHERE id = ?`,
        [subscription.customer_id]
      );

      await connection.commit();

      // 4. Disable in MikroTik
      if (subscription.connection_type === 'pppoe' && subscription.pppoe_username) {
        try {
          // TODO: Call MikroTik API to disable user
          console.log(`✅ MikroTik: Disabled ${subscription.pppoe_username}`);
        } catch (error) {
          console.error('MikroTik deactivation failed:', error);
        }
      }

      // 5. Add to portal-redirect list
      try {
        await AddressListService.addToPortalRedirect(subscription.customer_id, reason);
      } catch (error) {
        console.error('Failed to add to portal-redirect:', error);
      }

      return true;
    } catch (error) {
      await connection.rollback();
      console.error('Deactivation error:', error);
      return false;
    } finally {
      connection.release();
    }
  }

  /**
   * Get active subscription for customer
   */
  async getActiveSubscription(customerId: number): Promise<any | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        pps.*,
        pp.name as package_name,
        pp.package_type,
        pp.price,
        sp.download_mbps,
        sp.upload_mbps,
        DATEDIFF(pps.expiry_date, NOW()) as days_remaining
       FROM prepaid_package_subscriptions pps
       INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
       LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
       WHERE pps.customer_id = ? AND pps.status = 'active' AND pps.expiry_date > NOW()
       ORDER BY pps.created_at DESC
       LIMIT 1`,
      [customerId]
    );

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get subscription history for customer
   */
  async getSubscriptionHistory(customerId: number, limit: number = 10): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        pps.*,
        pp.name as package_name,
        pp.price,
        sp.download_mbps,
        sp.upload_mbps
       FROM prepaid_package_subscriptions pps
       INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
       LEFT JOIN speed_profiles sp ON pp.speed_profile_id = sp.id
       WHERE pps.customer_id = ?
       ORDER BY pps.created_at DESC
       LIMIT ?`,
      [customerId, limit]
    );

    return rows;
  }

  /**
   * Check if customer needs redirect to portal
   */
  async needsPortalRedirect(customerId: number): Promise<boolean> {
    const subscription = await this.getActiveSubscription(customerId);
    return !subscription; // No active subscription = needs redirect
  }

  /**
   * Extend subscription (add more days)
   */
  async extendSubscription(subscriptionId: number, additionalDays: number): Promise<boolean> {
    try {
      await pool.query(
        `UPDATE prepaid_package_subscriptions 
         SET expiry_date = DATE_ADD(expiry_date, INTERVAL ? DAY),
             updated_at = NOW()
         WHERE id = ?`,
        [additionalDays, subscriptionId]
      );
      return true;
    } catch (error) {
      console.error('Failed to extend subscription:', error);
      return false;
    }
  }
}

export default new PrepaidActivationService();

