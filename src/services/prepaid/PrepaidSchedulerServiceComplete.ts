import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { MikrotikService } from '../mikrotik/MikrotikService';
import WhatsAppNotificationService from '../whatsapp/WhatsAppNotificationService';

/**
 * Complete Prepaid Scheduler Service
 * Auto check expiry, send notifications, deactivate expired subscriptions
 */
class PrepaidSchedulerServiceComplete {
  private isRunning: boolean = false;
  private interval: NodeJS.Timeout | null = null;

  /**
   * Initialize scheduler - runs every 1 hour
   */
  initialize() {
    console.log('🕐 Prepaid Scheduler initialized');
    
    // Run immediately on start
    this.runScheduler();

    // Then run every 1 hour
    this.interval = setInterval(() => {
      this.runScheduler();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Stop scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('🛑 Prepaid Scheduler stopped');
    }
  }

  /**
   * Main scheduler function
   */
  async runScheduler() {
    if (this.isRunning) {
      console.log('⏭️  Scheduler already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Running Prepaid Scheduler...');

    try {
      // 1. Check and deactivate expired subscriptions
      const expiredCount = await this.deactivateExpiredSubscriptions();
      console.log(`  ✅ Deactivated ${expiredCount} expired subscriptions`);

      // 2. Send expiry notifications (7 days, 3 days, 1 day before)
      const notifiedCount = await this.sendExpiryNotifications();
      console.log(`  ✅ Sent ${notifiedCount} expiry notifications`);

      // 3. Remove customers from portal-redirect if they renewed
      const restoredCount = await this.restoreRenewedCustomers();
      console.log(`  ✅ Restored ${restoredCount} renewed customers`);

      console.log('✅ Prepaid Scheduler completed successfully');
    } catch (error) {
      console.error('❌ Scheduler error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Deactivate expired subscriptions
   */
  private async deactivateExpiredSubscriptions(): Promise<number> {
    try {
      // Find all expired subscriptions
      const [expired] = await pool.query<RowDataPacket[]>(
        `SELECT pps.*, c.pppoe_username, c.customer_code, c.name,
                c.phone, c.connection_type, sic.ip_address
         FROM prepaid_package_subscriptions pps
         JOIN customers c ON pps.customer_id = c.id
         LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
         WHERE pps.status = 'active' AND pps.expiry_date < NOW()`
      );

      let count = 0;

      for (const sub of expired) {
        try {
          // Update subscription status
          await pool.query(
            'UPDATE prepaid_package_subscriptions SET status = "expired" WHERE id = ?',
            [sub.id]
          );

          // Deactivate in MikroTik
          if (sub.connection_type === 'pppoe' && sub.pppoe_username) {
            await this.deactivateInMikrotik(sub);
          }

          // Send WhatsApp notification
          if (sub.phone) {
            await this.sendExpiredNotification(sub);
          }

          count++;
          console.log(`  📴 Deactivated: ${sub.customer_code} - ${sub.name}`);
        } catch (error) {
          console.error(`  ❌ Failed to deactivate ${sub.id}:`, error);
        }
      }

      return count;
    } catch (error) {
      console.error('Deactivate expired error:', error);
      return 0;
    }
  }

  /**
   * Send expiry notifications
   */
  private async sendExpiryNotifications(): Promise<number> {
    try {
      // Find subscriptions expiring in 7, 3, or 1 days
      const [expiringSoon] = await pool.query<RowDataPacket[]>(
        `SELECT pps.*, c.phone, c.customer_code, c.name, pp.name as package_name,
                DATEDIFF(pps.expiry_date, NOW()) as days_remaining
         FROM prepaid_package_subscriptions pps
         JOIN customers c ON pps.customer_id = c.id
         JOIN prepaid_packages pp ON pps.package_id = pp.id
         WHERE pps.status = 'active' 
           AND DATEDIFF(pps.expiry_date, NOW()) IN (7, 3, 1)
           AND (pps.last_notified_at IS NULL 
                OR DATE(pps.last_notified_at) < CURDATE())`
      );

      let count = 0;

      for (const sub of expiringSoon) {
        try {
          if (!sub.phone) continue;

          // Send WhatsApp notification
          const message = this.createExpiryReminderMessage(sub);
          await WhatsAppNotificationService.sendMessage(sub.phone, message);

          // Update last notified
          await pool.query(
            'UPDATE prepaid_package_subscriptions SET last_notified_at = NOW() WHERE id = ?',
            [sub.id]
          );

          count++;
          console.log(`  📱 Notified: ${sub.customer_code} (${sub.days_remaining} days left)`);
        } catch (error) {
          console.error(`  ❌ Failed to notify ${sub.id}:`, error);
        }
      }

      return count;
    } catch (error) {
      console.error('Send notifications error:', error);
      return 0;
    }
  }

  /**
   * Restore renewed customers (remove from portal-redirect)
   */
  private async restoreRenewedCustomers(): Promise<number> {
    try {
      // Find customers with active subscription but still in portal-redirect
      const [toRestore] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT mal.*, c.pppoe_username, c.customer_code
         FROM mikrotik_address_list_items mal
         JOIN customers c ON mal.customer_id = c.id
         JOIN prepaid_package_subscriptions pps ON c.id = pps.customer_id
         WHERE mal.list_name = 'portal-redirect'
           AND pps.status = 'active'
           AND pps.expiry_date > NOW()`
      );

      let count = 0;

      for (const item of toRestore) {
        try {
          // Remove from address list
          await this.removeFromPortalRedirect(item);

          // Enable PPPoE user
          if (item.pppoe_username) {
            await this.enablePPPoEUser(item.pppoe_username);
          }

          count++;
          console.log(`  🔓 Restored: ${item.customer_code}`);
        } catch (error) {
          console.error(`  ❌ Failed to restore ${item.id}:`, error);
        }
      }

      return count;
    } catch (error) {
      console.error('Restore customers error:', error);
      return 0;
    }
  }

  /**
   * Deactivate customer in MikroTik
   */
  private async deactivateInMikrotik(subscription: any): Promise<void> {
    try {
      const [settings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (settings.length === 0) return;

      const mikrotik = new MikrotikService({
        host: settings[0].host,
        username: settings[0].username,
        password: settings[0].password,
        port: settings[0].api_port || 8728
      });

      // Disable PPPoE user
      await mikrotik.updatePPPoEUser({
        name: subscription.pppoe_username,
        disabled: true
      });

      // Add to address list portal-redirect
      if (subscription.ip_address) {
        await mikrotik.addToAddressList({
          address: subscription.ip_address,
          list: 'portal-redirect',
          comment: `Expired: ${subscription.customer_code}`
        });

        // Save to database
        await pool.query(
          `INSERT INTO mikrotik_address_list_items 
           (customer_id, list_name, ip_address, comment, sync_status)
           VALUES (?, 'portal-redirect', ?, ?, 'synced')`,
          [subscription.customer_id, subscription.ip_address, `Expired: ${subscription.customer_code}`]
        );
      }

      console.log(`    🔒 MikroTik deactivated: ${subscription.pppoe_username}`);
    } catch (error) {
      console.error('MikroTik deactivation error:', error);
    }
  }

  /**
   * Remove from portal redirect
   */
  private async removeFromPortalRedirect(item: any): Promise<void> {
    try {
      const [settings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (settings.length === 0) return;

      const mikrotik = new MikrotikService({
        host: settings[0].host,
        username: settings[0].username,
        password: settings[0].password,
        port: settings[0].api_port || 8728
      });

      // Remove from MikroTik
      await mikrotik.removeFromAddressList({
        list: 'portal-redirect',
        address: item.ip_address
      });

      // Remove from database
      await pool.query(
        'DELETE FROM mikrotik_address_list_items WHERE id = ?',
        [item.id]
      );
    } catch (error) {
      console.error('Remove from portal redirect error:', error);
    }
  }

  /**
   * Enable PPPoE user in MikroTik
   */
  private async enablePPPoEUser(username: string): Promise<void> {
    try {
      const [settings] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM mikrotik_settings WHERE is_active = 1 LIMIT 1'
      );

      if (settings.length === 0) return;

      const mikrotik = new MikrotikService({
        host: settings[0].host,
        username: settings[0].username,
        password: settings[0].password,
        port: settings[0].api_port || 8728
      });

      await mikrotik.updatePPPoEUser({
        name: username,
        disabled: false
      });
    } catch (error) {
      console.error('Enable PPPoE error:', error);
    }
  }

  /**
   * Send expired notification via WhatsApp
   */
  private async sendExpiredNotification(subscription: any): Promise<void> {
    try {
      const message = `🔴 *PAKET ANDA TELAH BERAKHIR*

Halo ${subscription.name},

Paket internet prepaid Anda telah berakhir.

Untuk melanjutkan layanan, silakan perpanjang paket Anda melalui:
👉 Portal Prepaid: http://portal.billing.local/prepaid

Terima kasih atas kepercayaan Anda! 🙏`;

      await WhatsAppNotificationService.sendMessage(subscription.phone, message);
    } catch (error) {
      console.error('Send WhatsApp error:', error);
    }
  }

  /**
   * Create expiry reminder message
   */
  private createExpiryReminderMessage(subscription: any): string {
    const { days_remaining, name, package_name } = subscription;

    let urgency = '';
    if (days_remaining === 1) urgency = '⚠️ *BESOK*';
    else if (days_remaining === 3) urgency = '⏰ *3 HARI LAGI*';
    else if (days_remaining === 7) urgency = '📅 *7 HARI LAGI*';

    return `${urgency} - Paket Akan Berakhir

Halo ${name},

Paket internet Anda akan segera berakhir:
📦 Paket: ${package_name}
📅 Berakhir: ${days_remaining} hari lagi

Perpanjang sekarang agar internet tidak terputus:
👉 http://portal.billing.local/prepaid

Terima kasih! 🙏`;
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    try {
      const [stats] = await pool.query<RowDataPacket[]>(
        `SELECT 
          (SELECT COUNT(*) FROM prepaid_package_subscriptions WHERE status = 'active') as active_customers,
          (SELECT COUNT(*) FROM prepaid_package_subscriptions WHERE status = 'expired') as expired_customers,
          (SELECT COUNT(*) FROM prepaid_package_subscriptions 
           WHERE status = 'active' AND expiry_date <= DATE_ADD(NOW(), INTERVAL 7 DAY)) as expiring_soon,
          (SELECT COALESCE(SUM(total_amount), 0) FROM invoices 
           WHERE invoice_number LIKE 'INV/PREP/%' AND status = 'paid' 
           AND DATE(created_at) = CURDATE()) as total_revenue_today`
      );

      return stats[0];
    } catch (error) {
      console.error('Get statistics error:', error);
      return {
        active_customers: 0,
        expired_customers: 0,
        expiring_soon: 0,
        total_revenue_today: 0
      };
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManually() {
    console.log('🔧 Manual trigger activated');
    await this.runScheduler();
    return {
      success: true,
      message: 'Scheduler executed successfully'
    };
  }
}

export default new PrepaidSchedulerServiceComplete();

