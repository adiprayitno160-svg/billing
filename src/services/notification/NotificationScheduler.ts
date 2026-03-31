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

interface ProcessResult {
  sent: number;
  failed: number;
  skipped: number;
}

export class NotificationScheduler {
  private static cronJob: cron.ScheduledTask | null = null;
  private static isRunning = false;
  private static lastRunTime: number = 0;

  // Anti-spam work/rest cycle: 3 minutes active, 2 minutes pause
  private static readonly WORK_DURATION_MS = 3 * 60 * 1000;  // 3 minutes active
  private static readonly REST_DURATION_MS = 2 * 60 * 1000;  // 2 minutes pause
  private static cycleStartTime: number = Date.now();
  private static isResting: boolean = false;
  private static restStartTime: number = 0;
  private static totalSentInCycle: number = 0;

  /**
   * Check if the scheduler is in rest period (anti-spam)
   */
  private static checkWorkRestCycle(): boolean {
    const now = Date.now();

    if (this.isResting) {
      const restElapsed = now - this.restStartTime;
      if (restElapsed >= this.REST_DURATION_MS) {
        // Rest period over, start new work cycle
        this.isResting = false;
        this.cycleStartTime = now;
        this.totalSentInCycle = 0;
        console.log(`[NotificationScheduler] ✅ Rest period over (${Math.round(restElapsed / 1000)}s). Resuming notification delivery...`);
        return true; // Can work
      }
      // Still resting
      return false;
    }

    // Currently working - check if work period exceeded
    const workElapsed = now - this.cycleStartTime;
    if (workElapsed >= this.WORK_DURATION_MS && this.totalSentInCycle > 0) {
      // Work period over, start rest
      this.isResting = true;
      this.restStartTime = now;
      console.log(`[NotificationScheduler] 😴 Anti-spam pause activated. Sent ${this.totalSentInCycle} in ${Math.round(workElapsed / 1000)}s. Pausing for ${this.REST_DURATION_MS / 1000}s...`);
      return false;
    }

    return true; // Can work
  }

  /**
   * Initialize scheduler
   */
  static initialize(): void {
    if (this.cronJob) {
      console.log('Notification scheduler already initialized');
      return;
    }

    // Run every 1 minute to process pending notifications
    // User requested 5 messages per minute max with 12s interval
    this.cronJob = cron.schedule('0 * * * * *', async () => {
      if (this.isRunning) {
        // If running for more than 5 minutes, force reset (zombie check)
        const diff = Date.now() - (this.lastRunTime || 0);
        if (diff > 300000 && this.lastRunTime > 0) {
          console.warn('[NotificationScheduler] ⚠️ Force resetting stuck scheduler (stalled for >5m)');
          this.isRunning = false;
        } else {
          return;
        }
      }

      // Anti-spam: Check work/rest cycle
      if (!this.checkWorkRestCycle()) {
        return; // In rest period, skip this tick
      }

      this.isRunning = true;
      this.lastRunTime = Date.now();

      try {
        // Limit 5 messages per minute as requested
        const result = await UnifiedNotificationService.sendPendingNotifications(5);
        if (result.sent > 0 || result.failed > 0) {
          this.totalSentInCycle += result.sent;
          console.log(`[NotificationScheduler] 📨 Processed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped (cycle total: ${this.totalSentInCycle})`);
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

    // DISABLED per user request to stop monitoring notifications
    // // Run Network Monitoring Check every 5 minutes
    // cron.schedule('*/5 * * * *', async () => {
    //   try {
    //     await NetworkMonitoringService.checkAutoOutageJobs();
    //     // Check for Auto-Complaint Escalations
    //     await AIDiagnosticsService.processEscalations();
    //   } catch (error) {
    //     console.error('[NotificationScheduler] Error in monitoring check:', error);
    //   }
    // });

    // DISABLED per user request - only isolation notifications are active
    // Run daily at 8 AM to check for overdue invoices
    // cron.schedule('0 8 * * *', async () => {
    //   try {
    //     await this.checkOverdueInvoices();
    //   } catch (error) {
    //     console.error('[NotificationScheduler] Error checking overdue invoices:', error);
    //   }
    // });

    // DISABLED per user request - only isolation notifications are active
    // Run Monthly on 20th at 9 AM for Payment Reminders
    // cron.schedule('0 9 20 * *', async () => {
    //   try {
    //     console.log('[NotificationScheduler] Running monthly payment reminders (20th)...');
    //     await this.checkMonthlyInvoiceReminders();
    //   } catch (error) {
    //     console.error('[NotificationScheduler] Error sending monthly reminders:', error);
    //   }
    // });

    // Auto-retry failed notifications every hour (only those with retry_count < max_retries)
    cron.schedule('0 * * * *', async () => {
      try {
        console.log('[NotificationScheduler] 🔄 Auto-retrying failed notifications...');
        await this.retryFailedNotifications();
      } catch (error) {
        console.error('[NotificationScheduler] Error retrying failed notifications:', error);
      }
    });

    console.log('✅ Notification scheduler initialized');
  }

  /**
   * Check and notify overdue invoices
   */
    private static async checkOverdueInvoices(): Promise<void> {
    const todayDay = new Date().getDate();
    if (todayDay < 20) {
      console.log(`[NotificationScheduler] ⏸️ Skipping checkOverdueInvoices because today (${todayDay}) is before the 20th.`);
      return;
    }

    const connection = await databasePool.getConnection();

    try {
      // Get invoices that are overdue and haven't been notified today
      const [invoices] = await connection.query<RowDataPacket[]>(
        `SELECT i.id, i.customer_id, i.invoice_number, i.due_date, i.remaining_amount
         FROM invoices i
         WHERE i.status IN ('sent', 'overdue')
           AND i.due_date < CURDATE()
           AND CAST(i.remaining_amount AS DECIMAL(10,2)) > 100
           AND DATEDIFF(CURDATE(), i.due_date) IN (1, 3, 7, 14, 21, 28)
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
         WHERE i.status IN ('sent')
           AND CAST(i.remaining_amount AS DECIMAL(10,2)) > 100
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
   * Retry failed notifications that haven't exceeded max retries
   */
  private static async retryFailedNotifications(): Promise<void> {
    const connection = await databasePool.getConnection();
    try {
      // Reset failed notifications where retry_count < max_retries
      const [result] = await connection.query<any>(
        `UPDATE unified_notifications_queue 
         SET status = 'pending', 
             retry_count = retry_count + 1,
             error_message = CONCAT(IFNULL(error_message, ''), ' [Auto-retry at ', NOW(), ']'),
             updated_at = NOW()
         WHERE status = 'failed' 
         AND retry_count < max_retries
         AND customer_id IS NOT NULL`
      );

      if (result.affectedRows > 0) {
        console.log(`[NotificationScheduler] ✅ Reset ${result.affectedRows} failed notifications for retry`);
      }
    } catch (error) {
      console.error('[NotificationScheduler] ❌ Failed to retry notifications:', error);
    } finally {
      connection.release();
    }
  }

  /**
   * Manually trigger notification processing
   */
  static async processNow(): Promise<ProcessResult> {
    return await UnifiedNotificationService.sendPendingNotifications(100);
  }
}
