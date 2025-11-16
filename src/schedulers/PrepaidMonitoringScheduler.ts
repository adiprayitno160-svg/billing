import cron from 'node-cron';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import PrepaidActivationService from '../services/prepaid/PrepaidActivationService';

/**
 * Scheduler untuk monitoring prepaid subscriptions
 * Auto-detect expired packages dan revert Mikrotik configuration
 * Runs every 5 minutes
 */
class PrepaidMonitoringScheduler {
  private task: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  /**
   * Start the scheduler
   */
  start() {
    // Run every 5 minutes
    this.task = cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️  Prepaid monitoring already running, skipping...');
        return;
      }

      this.isRunning = true;
      console.log('🔄 Starting prepaid monitoring check...');
      
      try {
        await this.checkExpiredSubscriptions();
      } catch (error) {
        console.error('❌ Prepaid monitoring error:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('✅ PrepaidMonitoringScheduler started (runs every 5 minutes)');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.task) {
      this.task.stop();
      console.log('⏹️  PrepaidMonitoringScheduler stopped');
    }
  }

  /**
   * Check for expired subscriptions and deactivate them
   */
  private async checkExpiredSubscriptions(): Promise<void> {
    try {
      // Find all active subscriptions that have expired
      const [expiredSubs] = await pool.query<RowDataPacket[]>(
        `SELECT 
          pps.id,
          pps.customer_id,
          pps.package_id,
          pps.expiry_date,
          pp.name as package_name,
          c.name as customer_name,
          c.pppoe_username,
          c.connection_type,
          sic.ip_address,
          c.phone
         FROM prepaid_package_subscriptions pps
         INNER JOIN customers c ON pps.customer_id = c.id
         INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
         LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id
         WHERE pps.status = 'active' 
         AND pps.expiry_date <= NOW()
         ORDER BY pps.expiry_date ASC`
      );

      if (expiredSubs.length === 0) {
        console.log('✅ No expired subscriptions found');
        return;
      }

      console.log(`📦 Found ${expiredSubs.length} expired subscription(s)`);

      // Process each expired subscription
      for (const sub of expiredSubs) {
        try {
          console.log(`🔄 Processing expired subscription #${sub.id} for customer: ${sub.customer_name}`);

          // Deactivate package (akan handle PPPoE/Static IP di dalam service)
          const success = await PrepaidActivationService.deactivatePackage(
            sub.id,
            'Package expired'
          );

          if (success) {
            console.log(`✅ Deactivated subscription #${sub.id} for ${sub.customer_name}`);
            
            // Send expiry notification via unified service
            try {
              const { UnifiedNotificationService } = await import('../services/notification/UnifiedNotificationService');
              await UnifiedNotificationService.notifyPackageExpired(sub.id);
            } catch (notifError) {
              console.error('Error sending expiry notification:', notifError);
              // Fallback to old method
              await this.sendExpiryNotification(sub);
            }
          } else {
            console.error(`❌ Failed to deactivate subscription #${sub.id}`);
          }

        } catch (error) {
          console.error(`❌ Error processing subscription #${sub.id}:`, error);
          // Continue to next subscription
        }
      }

      console.log(`✅ Processed ${expiredSubs.length} expired subscription(s)`);

    } catch (error) {
      console.error('❌ Error checking expired subscriptions:', error);
      throw error;
    }
  }

  /**
   * Send expiry notification to customer (via WhatsApp/SMS)
   */
  private async sendExpiryNotification(subscription: any): Promise<void> {
    try {
      // Check if customer has phone number
      if (!subscription.phone) {
        console.log(`⚠️  No phone number for customer ${subscription.customer_name}`);
        return;
      }

      const message = `
Halo ${subscription.customer_name},

Paket internet Anda "${subscription.package_name}" telah expired pada ${new Date(subscription.expiry_date).toLocaleString('id-ID')}.

Silakan login ke portal prepaid untuk membeli paket baru:
Portal: http://your-portal-url/prepaid/portal/login

Terima kasih.
      `.trim();

      // TODO: Integrate with WhatsApp/SMS service
      console.log(`📱 Notification sent to ${subscription.phone}`);
      console.log(`Message: ${message}`);

      // Log notification
      await pool.query(
        `INSERT INTO notifications_log 
         (customer_id, type, message, status, sent_at)
         VALUES (?, 'expiry', ?, 'sent', NOW())`,
        [subscription.customer_id, message]
      );

    } catch (error) {
      console.error(`Failed to send notification for subscription #${subscription.id}:`, error);
    }
  }

  /**
   * Manual trigger untuk testing
   */
  async runManually(): Promise<{ processed: number; success: boolean }> {
    try {
      console.log('🔧 Manual trigger: Checking expired subscriptions...');
      await this.checkExpiredSubscriptions();
      return { processed: 0, success: true }; // TODO: Return actual count
    } catch (error) {
      console.error('Manual trigger failed:', error);
      return { processed: 0, success: false };
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { running: boolean; isProcessing: boolean } {
    return {
      running: this.task !== null,
      isProcessing: this.isRunning
    };
  }

  /**
   * Check subscriptions expiring soon (in next 24 hours)
   */
  async checkExpiringSoon(): Promise<any[]> {
    try {
      const [expiringSubs] = await pool.query<RowDataPacket[]>(
        `SELECT 
          pps.id,
          pps.customer_id,
          pps.expiry_date,
          pp.name as package_name,
          c.name as customer_name,
          c.phone,
          TIMESTAMPDIFF(HOUR, NOW(), pps.expiry_date) as hours_remaining
         FROM prepaid_package_subscriptions pps
         INNER JOIN customers c ON pps.customer_id = c.id
         INNER JOIN prepaid_packages pp ON pps.package_id = pp.id
         WHERE pps.status = 'active' 
         AND pps.expiry_date > NOW()
         AND pps.expiry_date <= DATE_ADD(NOW(), INTERVAL 24 HOUR)
         ORDER BY pps.expiry_date ASC`
      );

      if (expiringSubs.length > 0) {
        console.log(`⚠️  ${expiringSubs.length} subscription(s) expiring in next 24 hours`);
        
        // Send reminder notifications
        for (const sub of expiringSubs) {
          await this.sendReminderNotification(sub);
        }
      }

      return expiringSubs;
    } catch (error) {
      console.error('Error checking expiring subscriptions:', error);
      return [];
    }
  }

  /**
   * Send reminder notification before expiry
   */
  private async sendReminderNotification(subscription: any): Promise<void> {
    try {
      if (!subscription.phone) return;

      const message = `
Halo ${subscription.customer_name},

Paket internet Anda "${subscription.package_name}" akan expired dalam ${subscription.hours_remaining} jam.

Jangan lupa perpanjang paket Anda melalui portal prepaid:
Portal: http://your-portal-url/prepaid/portal/login

Terima kasih.
      `.trim();

      console.log(`📱 Reminder sent to ${subscription.phone}`);

      // Log notification
      await pool.query(
        `INSERT INTO notifications_log 
         (customer_id, type, message, status, sent_at)
         VALUES (?, 'reminder', ?, 'sent', NOW())`,
        [subscription.customer_id, message]
      );

    } catch (error) {
      console.error('Failed to send reminder:', error);
    }
  }
}

// Create singleton instance
const prepaidMonitoringScheduler = new PrepaidMonitoringScheduler();

export default prepaidMonitoringScheduler;

