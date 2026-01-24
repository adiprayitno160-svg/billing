/**
 * Notification Scheduler
 * Automatically processes and sends pending notifications
 */

import * as cron from 'node-cron';
import { UnifiedNotificationService } from './UnifiedNotificationService';
import NetworkMonitoringService from '../monitoring/NetworkMonitoringService';
import { AIDiagnosticsService } from '../ai/AIDiagnosticsService';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export class NotificationScheduler {
  private static cronJob: cron.ScheduledTask | null = null;
  private static isRunning = false;
  private static lastRunTime: number = 0;

  /**
   * Initialize scheduler
   */
  static initialize(): void {
    if (this.cronJob) {
      console.log('Notification scheduler already initialized');
      return;
    }

    // Run every 30 seconds to process pending notifications (High Frequency)
    this.cronJob = cron.schedule('*/30 * * * * *', async () => {
      if (this.isRunning) {
        // If running for more than 2 minutes, force reset (zombie check)
        const diff = Date.now() - (this.lastRunTime || 0);
        if (diff > 120000 && this.lastRunTime > 0) {
          console.warn('[NotificationScheduler] ⚠️ Force resetting stuck scheduler (stalled for >2m)');
          this.isRunning = false;
        } else {
          // console.log('[NotificationScheduler] Already running, skipping...');
          return;
        }
      }

      this.isRunning = true;
      this.lastRunTime = Date.now();

      try {
        const result = await UnifiedNotificationService.sendPendingNotifications(50);
        if (result.sent > 0 || result.failed > 0) {
          console.log(`[NotificationScheduler] 📨 Processed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
        }
      } catch (error) {
        console.error('[NotificationScheduler] ❌ Error processing notifications:', error);
      } finally {
        this.isRunning = false;
      }
    });

    // Run Cleanup Daily 3 AM
    cron.schedule('0 3 * * *', async () => {
      await this.cleanupOldLogs();
    });

    // Run Network Monitoring Check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await NetworkMonitoringService.checkAutoOutageJobs();
        // Check for Auto-Complaint Escalations
        await AIDiagnosticsService.processEscalations();
      } catch (error) {
        console.error('[NotificationScheduler] Error in monitoring check:', error);
      }
    });

    // Run daily at 8 AM to check for overdue invoices
    cron.schedule('0 8 * * *', async () => {
      try {
        await this.checkOverdueInvoices();
      } catch (error) {
        console.error('[NotificationScheduler] Error checking overdue invoices:', error);
      }
    });

    // Run Monthly on 20th at 9 AM for Payment Reminders
    cron.schedule('0 9 20 * *', async () => {
      try {
        console.log('[NotificationScheduler] Running monthly payment reminders (20th)...');
        await this.checkMonthlyInvoiceReminders();
      } catch (error) {
        console.error('[NotificationScheduler] Error sending monthly reminders:', error);
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
   * Check and notify monthly reminders (20th)
   */
  private static async checkMonthlyInvoiceReminders(): Promise<void> {
    const connection = await databasePool.getConnection();

    try {
      // Get unpaid invoices
      const [invoices] = await connection.query<RowDataPacket[]>(
        `SELECT i.id
         FROM invoices i
         WHERE i.status IN ('sent', 'partial')
           AND i.remaining_amount > 0
           AND NOT EXISTS (
             SELECT 1 FROM unified_notifications_queue unq
             WHERE unq.invoice_id = i.id
               AND unq.notification_type = 'invoice_reminder'
               AND DATE(unq.created_at) = CURDATE()
           )`
      );

      console.log(`[NotificationScheduler] Found ${invoices.length} invoices for monthly reminder`);

      for (const invoice of invoices) {
        try {
          await UnifiedNotificationService.notifyInvoiceReminder(invoice.id);
        } catch (error) {
          console.error(`[NotificationScheduler] Error notifying reminder for invoice ${invoice.id}:`, error);
        }
      }
    } finally {
      connection.release();
    }
  }



  /**
   * Cleanup old notification logs
   */
  private static async cleanupOldLogs(): Promise<void> {
    console.log('[NotificationScheduler] 🧹 Starting notification cleanup...');
    const connection = await databasePool.getConnection();
    try {
      const [result] = await connection.query(
        "DELETE FROM unified_notifications_queue WHERE created_at < DATE_SUB(NOW(), INTERVAL 60 DAY) AND status IN ('sent', 'skipped')"
      );
      console.log(`[NotificationScheduler] 🧹 Cleaned up ${(result as any).affectedRows} old notifications`);
    } catch (error) {
      console.error('[NotificationScheduler] ❌ Cleanup failed:', error);
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






