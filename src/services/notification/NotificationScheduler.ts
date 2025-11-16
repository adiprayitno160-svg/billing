/**
 * Notification Scheduler
 * Automatically processes and sends pending notifications
 */

import * as cron from 'node-cron';
import { UnifiedNotificationService } from './UnifiedNotificationService';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export class NotificationScheduler {
  private static cronJob: cron.ScheduledTask | null = null;
  private static isRunning = false;
  
  /**
   * Initialize scheduler
   */
  static initialize(): void {
    if (this.cronJob) {
      console.log('Notification scheduler already initialized');
      return;
    }
    
    // Run every 2 minutes to process pending notifications
    this.cronJob = cron.schedule('*/2 * * * *', async () => {
      if (this.isRunning) {
        console.log('[NotificationScheduler] Already running, skipping...');
        return;
      }
      
      this.isRunning = true;
      
      try {
        const result = await UnifiedNotificationService.sendPendingNotifications(50);
        console.log(`[NotificationScheduler] Processed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
      } catch (error) {
        console.error('[NotificationScheduler] Error processing notifications:', error);
      } finally {
        this.isRunning = false;
      }
    });
    
    // Also run daily at 8 AM to check for overdue invoices
    cron.schedule('0 8 * * *', async () => {
      try {
        await this.checkOverdueInvoices();
      } catch (error) {
        console.error('[NotificationScheduler] Error checking overdue invoices:', error);
      }
    });
    
    // Run daily at 9 AM to check for expiring packages
    cron.schedule('0 9 * * *', async () => {
      try {
        await this.checkExpiringPackages();
      } catch (error) {
        console.error('[NotificationScheduler] Error checking expiring packages:', error);
      }
    });
    
    console.log('✅ Notification scheduler initialized');
  }
  
  /**
   * Check and notify overdue invoices
   */
  private static async checkOverdueInvoices(): Promise<void> {
    const connection = await databasePool.getConnection();
    
    try {
      // Get invoices that are overdue and haven't been notified today
      const [invoices] = await connection.query<RowDataPacket[]>(
        `SELECT i.id, i.customer_id, i.invoice_number, i.due_date, i.remaining_amount
         FROM invoices i
         WHERE i.status IN ('sent', 'partial', 'overdue')
           AND i.due_date < CURDATE()
           AND i.remaining_amount > 0
           AND NOT EXISTS (
             SELECT 1 FROM unified_notifications_queue unq
             WHERE unq.invoice_id = i.id
               AND unq.notification_type = 'invoice_overdue'
               AND DATE(unq.created_at) = CURDATE()
           )
         LIMIT 100`
      );
      
      console.log(`[NotificationScheduler] Found ${invoices.length} overdue invoices to notify`);
      
      for (const invoice of invoices) {
        try {
          await UnifiedNotificationService.notifyInvoiceOverdue(invoice.id);
        } catch (error) {
          console.error(`[NotificationScheduler] Error notifying invoice ${invoice.id}:`, error);
        }
      }
    } finally {
      connection.release();
    }
  }
  
  /**
   * Check and schedule notifications for expiring packages
   */
  private static async checkExpiringPackages(): Promise<void> {
    const connection = await databasePool.getConnection();
    
    try {
      // Get active subscriptions that will expire in the next 7 days
      const [subscriptions] = await connection.query<RowDataPacket[]>(
        `SELECT ps.id, ps.customer_id, ps.expiry_date
         FROM prepaid_package_subscriptions ps
         WHERE ps.status = 'active'
           AND ps.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
           AND NOT EXISTS (
             SELECT 1 FROM unified_notifications_queue unq
             WHERE unq.subscription_id = ps.id
               AND unq.notification_type = 'package_expiring'
               AND DATE(unq.created_at) = CURDATE()
           )
         LIMIT 100`
      );
      
      console.log(`[NotificationScheduler] Found ${subscriptions.length} expiring packages to schedule`);
      
      for (const subscription of subscriptions) {
        try {
          await UnifiedNotificationService.schedulePackageExpiryNotifications(subscription.id);
        } catch (error) {
          console.error(`[NotificationScheduler] Error scheduling notifications for subscription ${subscription.id}:`, error);
        }
      }
    } finally {
      connection.release();
    }
  }
  
  /**
   * Stop scheduler
   */
  static stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Notification scheduler stopped');
    }
  }
  
  /**
   * Manually trigger notification processing
   */
  static async processNow(): Promise<{
    sent: number;
    failed: number;
    skipped: number;
  }> {
    return await UnifiedNotificationService.sendPendingNotifications(100);
  }
}





