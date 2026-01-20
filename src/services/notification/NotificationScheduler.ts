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

    // Also run daily at 8 AM to check for overdue invoices
    cron.schedule('0 8 * * *', async () => {
      try {
        await this.checkOverdueInvoices();
      } catch (error) {
        console.error('[NotificationScheduler] Error checking overdue invoices:', error);
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






