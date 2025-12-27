/**
 * Unified Notification Service
 * Centralized notification service for all billing events
 * Integrated with WhatsApp and other channels
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { NotificationTemplateService } from './NotificationTemplateService';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import { UrlConfigService } from '../../utils/urlConfigService';

export type NotificationType =
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_overdue'
  | 'invoice_reminder'
  | 'payment_received'
  | 'payment_partial'
  | 'payment_failed'

  | 'referral_reward'
  | 'maintenance_scheduled'
  | 'service_restored'
  | 'service_blocked'
  | 'service_unblocked'
  | 'customer_created'
  | 'customer_deleted'

  | 'customer_migrated_to_postpaid'
  | 'payment_debt'
  | 'isolation_warning'
  | 'payment_shortage_warning';

export type NotificationChannel = 'whatsapp' | 'email' | 'sms' | 'push';

export interface NotificationData {
  customer_id: number;
  subscription_id?: number;
  invoice_id?: number;
  payment_id?: number;
  notification_type: NotificationType;
  variables: Record<string, any>;
  channels?: NotificationChannel[];
  scheduled_for?: Date;
  priority?: 'low' | 'normal' | 'high';
}

export class UnifiedNotificationService {
  /**
   * Queue notification for sending
   */
  static async queueNotification(data: NotificationData): Promise<number[]> {
    console.log(`[UnifiedNotification] 📥 Queueing notification:`, {
      customer_id: data.customer_id,
      notification_type: data.notification_type,
      channels: data.channels || ['whatsapp']
    });

    const connection = await databasePool.getConnection();
    const notificationIds: number[] = [];

    try {
      // Determine channels
      const channels = data.channels || ['whatsapp'];

      // Get customer info
      const [customerRows] = await connection.query<RowDataPacket[]>(
        'SELECT name, phone, email FROM customers WHERE id = ?',
        [data.customer_id]
      );

      if (customerRows.length === 0) {
        throw new Error(`Customer ${data.customer_id} not found`);
      }

      const customer = customerRows[0]!;

      // Prepare variables with customer info
      const allVariables = {
        customer_name: customer.name || 'Pelanggan',
        customer_phone: customer.phone || '',
        customer_email: customer.email || '',
        ...data.variables
      };

      // Process each channel
      for (const channel of channels) {
        // Get template for this notification type and channel
        const template = await NotificationTemplateService.getTemplate(
          data.notification_type,
          channel
        );

        if (!template) {
          // Check if template exists but is inactive
          const [inactiveRows] = await connection.query<RowDataPacket[]>(
            `SELECT template_code, is_active FROM notification_templates 
             WHERE notification_type = ? AND channel = ?`,
            [data.notification_type, channel]
          );

          if (inactiveRows.length > 0 && !inactiveRows[0]!.is_active) {
            console.error(`[UnifiedNotification] ❌ Template found but is INACTIVE: ${inactiveRows[0]!.template_code} for ${data.notification_type} on ${channel}. Please activate it in the notification templates page.`);
            throw new Error(`Template ${inactiveRows[0]!.template_code} exists but is inactive. Please activate it in the notification templates page.`);
          } else {
            console.error(`[UnifiedNotification] ❌ No template found for ${data.notification_type} on ${channel}. Please create a template in the notification templates page.`);
            throw new Error(`No template found for ${data.notification_type} on ${channel}. Please create a template in the notification templates page.`);
          }
        }

        // Replace variables in template
        let title = NotificationTemplateService.replaceVariables(
          template.title_template,
          allVariables
        );

        let message = NotificationTemplateService.replaceVariables(
          template.message_template,
          allVariables
        );

        // Insert into queue
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO unified_notifications_queue 
           (customer_id, subscription_id, invoice_id, payment_id, notification_type,
            template_code, channel, title, message, status, priority, scheduled_for)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [
            data.customer_id,
            data.subscription_id || null,
            data.invoice_id || null,
            data.payment_id || null,
            data.notification_type,
            template.template_code,
            channel,
            title,
            message,
            data.priority || template.priority,
            data.scheduled_for || null
          ]
        );

        notificationIds.push(result.insertId);
        console.log(`[UnifiedNotification] ✅ Notification queued (ID: ${result.insertId}) for ${channel}`, {
          customer_id: data.customer_id,
          notification_type: data.notification_type,
          template_code: template.template_code
        });
      }

      console.log(`[UnifiedNotification] 📊 Total notifications queued: ${notificationIds.length}`, {
        notification_ids: notificationIds
      });

      return notificationIds;
    } catch (error: any) {
      console.error(`[UnifiedNotification] ❌ Fatal error in queueNotification:`, {
        error: error.message,
        stack: error.stack,
        customer_id: data.customer_id,
        notification_type: data.notification_type
      });
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Send pending notifications
   */
  static async sendPendingNotifications(limit: number = 50): Promise<{
    sent: number;
    failed: number;
    skipped: number;
  }> {
    console.log(`[UnifiedNotification] 🔄 Processing pending notifications (limit: ${limit})...`);

    const connection = await databasePool.getConnection();

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    try {
      // Get pending notifications that are due
      const [notifications] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM unified_notifications_queue 
         WHERE status = 'pending' 
           AND (scheduled_for IS NULL OR scheduled_for <= NOW())
         ORDER BY 
           CASE priority 
             WHEN 'high' THEN 1 
             WHEN 'normal' THEN 2 
             WHEN 'low' THEN 3 
           END,
           created_at ASC
         LIMIT ?`,
        [limit]
      );

      console.log(`[UnifiedNotification] 📋 Found ${notifications.length} pending notifications to process`);

      if (notifications.length === 0) {
        console.log(`[UnifiedNotification] ℹ️ No pending notifications to process`);
        return { sent: 0, failed: 0, skipped: 0 };
      }

      for (const notif of notifications) {
        console.log(`[UnifiedNotification] 🔍 Processing notification ID: ${notif.id}`, {
          customer_id: notif.customer_id,
          notification_type: notif.notification_type,
          channel: notif.channel,
          status: notif.status
        });
        try {
          // Check if customer has required contact info for channel
          const [customerRows] = await connection.query<RowDataPacket[]>(
            'SELECT phone, email FROM customers WHERE id = ?',
            [notif.customer_id]
          );

          if (customerRows.length === 0) {
            await this.markAsFailed(notif.id, 'Customer not found');
            failed++;
            continue;
          }

          const customer = customerRows[0]!;

          // Check channel requirements
          if (notif.channel === 'whatsapp' && !customer.phone) {
            await this.markAsSkipped(notif.id, 'No phone number');
            skipped++;
            continue;
          }

          if (notif.channel === 'email' && !customer.email) {
            await this.markAsSkipped(notif.id, 'No email address');
            skipped++;
            continue;
          }

          // Send notification
          console.log(`[UnifiedNotification] 🚀 Attempting to send notification ID: ${notif.id}`);

          // Try to send - this will throw error if fails
          await this.sendNotification(notif, customer);

          // Only mark as sent if sendNotification completed without error
          // This means WhatsApp/email/etc actually sent successfully
          await connection.query(
            `UPDATE unified_notifications_queue 
             SET status = 'sent', sent_at = NOW(), error_message = NULL
             WHERE id = ?`,
            [notif.id]
          );

          console.log(`[UnifiedNotification] ✅ Notification ID: ${notif.id} marked as sent (actually sent successfully)`);
          sent++;
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error';
          console.error(`[UnifiedNotification] ❌ Error processing notification ID: ${notif.id}:`, {
            error: errorMessage,
            stack: error.stack,
            customer_id: notif.customer_id,
            notification_type: notif.notification_type,
            channel: notif.channel
          });

          const retryCount = (notif.retry_count || 0) + 1;
          const maxRetries = notif.max_retries || 3;

          if (retryCount < maxRetries) {
            // Retry - keep status as pending for retry
            console.log(`[UnifiedNotification] 🔄 Retrying notification ID: ${notif.id} (attempt ${retryCount}/${maxRetries})`);
            await connection.query(
              `UPDATE unified_notifications_queue 
               SET retry_count = ?, error_message = ?, status = 'pending'
               WHERE id = ?`,
              [retryCount, errorMessage, notif.id]
            );
            // Don't increment failed yet - will retry
          } else {
            // Mark as failed after max retries
            console.error(`[UnifiedNotification] ❌ Notification ID: ${notif.id} failed after ${maxRetries} attempts`);
            await this.markAsFailed(notif.id, errorMessage);
            failed++;
          }
        }
      }

      console.log(`[UnifiedNotification] 📊 Processing complete: ${sent} sent, ${failed} failed, ${skipped} skipped`);
      return { sent, failed, skipped };
    } catch (error: any) {
      console.error(`[UnifiedNotification] ❌ Fatal error in sendPendingNotifications:`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Send notification via appropriate channel
   */
  private static async sendNotification(notification: any, customer: any): Promise<void> {
    const fullMessage = `${notification.title}\n\n${notification.message}`;

    console.log(`[UnifiedNotification] 📤 Sending ${notification.channel} notification to customer ${notification.customer_id}...`);
    console.log(`[UnifiedNotification] 📋 Details:`, {
      notification_id: notification.id,
      template_code: notification.template_code,
      notification_type: notification.notification_type,
      customer_phone: customer.phone ? `${customer.phone.substring(0, 3)}***` : 'N/A',
      message_length: fullMessage.length
    });

    switch (notification.channel) {
      case 'whatsapp':
        if (!customer.phone) {
          console.error(`[UnifiedNotification] ❌ No phone number for customer ${notification.customer_id}`);
          throw new Error('Customer phone number not found');
        }

        // Check WhatsApp client status before sending
        const whatsappStatus = WhatsAppService.getStatus();
        console.log(`[UnifiedNotification] 📱 WhatsApp Status:`, whatsappStatus);

        if (!whatsappStatus.ready) {
          const errorMsg = whatsappStatus.hasQRCode
            ? 'WhatsApp client is not ready. QR code needs to be scanned. Please check WhatsApp status.'
            : 'WhatsApp client is not ready. Please initialize WhatsApp service first.';

          console.error(`[UnifiedNotification] ❌ WhatsApp not ready:`, {
            ready: whatsappStatus.ready,
            initialized: whatsappStatus.initialized,
            authenticated: whatsappStatus.authenticated,
            hasQRCode: whatsappStatus.hasQRCode,
            phone: customer.phone,
            notification_id: notification.id
          });

          throw new Error(errorMsg);
        }

        console.log(`[UnifiedNotification] 📱 Sending WhatsApp to ${customer.phone}...`);
        console.log(`[UnifiedNotification] 📝 Message preview (first 100 chars):`, fullMessage.substring(0, 100));

        const whatsappResult = await WhatsAppService.sendMessage(
          customer.phone,
          fullMessage,
          {
            customerId: notification.customer_id,
            template: notification.template_code || 'unified_notification'
          }
        );

        if (!whatsappResult.success) {
          const errorMsg = whatsappResult.error || 'WhatsApp send failed';
          console.error(`[UnifiedNotification] ❌ WhatsApp send failed:`, {
            error: errorMsg,
            phone: customer.phone,
            notification_id: notification.id,
            template_code: notification.template_code,
            customer_id: notification.customer_id
          });
          throw new Error(errorMsg);
        }

        console.log(`[UnifiedNotification] ✅ WhatsApp sent successfully to ${customer.phone}`, {
          messageId: whatsappResult.messageId,
          notification_id: notification.id
        });
        break;

      case 'email':
        // TODO: Implement email sending
        console.log(`[Email] Would send to ${customer.email}: ${notification.title}`);
        break;

      case 'sms':
        // TODO: Implement SMS sending
        console.log(`[SMS] Would send to ${customer.phone}: ${notification.title}`);
        break;

      case 'push':
        // TODO: Implement push notification
        console.log(`[Push] Would send to customer ${notification.customer_id}: ${notification.title}`);
        break;

      default:
        throw new Error(`Unsupported channel: ${notification.channel}`);
    }
  }

  /**
   * Mark notification as failed
   */
  private static async markAsFailed(notificationId: number, errorMessage: string): Promise<void> {
    const connection = await databasePool.getConnection();
    try {
      await connection.query(
        `UPDATE unified_notifications_queue 
         SET status = 'failed', error_message = ? 
         WHERE id = ?`,
        [errorMessage, notificationId]
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Mark notification as skipped
   */
  private static async markAsSkipped(notificationId: number, reason: string): Promise<void> {
    const connection = await databasePool.getConnection();
    try {
      await connection.query(
        `UPDATE unified_notifications_queue 
         SET status = 'skipped', error_message = ? 
         WHERE id = ?`,
        [reason, notificationId]
      );
    } finally {
      connection.release();
    }
  }

  /**
   * Send invoice created notification
   */
  static async notifyInvoiceCreated(invoiceId: number): Promise<void> {
    const connection = await databasePool.getConnection();

    try {
      const [invoiceRows] = await connection.query<RowDataPacket[]>(
        `SELECT i.*, c.name as customer_name, c.phone, c.email
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.id = ?`,
        [invoiceId]
      );

      if (invoiceRows.length === 0) {
        return;
      }

      const invoice = invoiceRows[0]!;
      const dueDate = new Date(invoice.due_date);

      await this.queueNotification({
        customer_id: invoice.customer_id,
        invoice_id: invoiceId,
        notification_type: 'invoice_created',
        variables: {
          invoice_number: invoice.invoice_number,
          amount: NotificationTemplateService.formatCurrency(parseFloat(invoice.total_amount)),
          due_date: NotificationTemplateService.formatDate(dueDate),
          period: invoice.period
        }
      });
    } finally {
      connection.release();
    }
  }

  /**
   * Send invoice overdue notification
   */
  static async notifyInvoiceOverdue(invoiceId: number): Promise<void> {
    const connection = await databasePool.getConnection();

    try {
      const [invoiceRows] = await connection.query<RowDataPacket[]>(
        `SELECT i.*, c.name as customer_name
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.id = ?`,
        [invoiceId]
      );

      if (invoiceRows.length === 0) {
        return;
      }

      const invoice = invoiceRows[0]!;
      const dueDate = new Date(invoice.due_date);
      const now = new Date();
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      await this.queueNotification({
        customer_id: invoice.customer_id,
        invoice_id: invoiceId,
        notification_type: 'invoice_overdue',
        priority: 'high',
        variables: {
          invoice_number: invoice.invoice_number,
          amount: NotificationTemplateService.formatCurrency(parseFloat(invoice.remaining_amount)),
          due_date: NotificationTemplateService.formatDate(dueDate),
          days_overdue: daysOverdue
        }
      });
    } finally {
      connection.release();
    }
  }

  /**
   * Send payment received notification
   */
  static async notifyPaymentReceived(paymentId: number): Promise<void> {
    const connection = await databasePool.getConnection();

    try {
      const [paymentRows] = await connection.query<RowDataPacket[]>(
        `SELECT p.*, i.invoice_number, i.customer_id, i.total_amount, i.remaining_amount,
                c.name as customer_name
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         JOIN customers c ON i.customer_id = c.id
         WHERE p.id = ?`,
        [paymentId]
      );

      if (paymentRows.length === 0) {
        return;
      }

      const payment = paymentRows[0]!;
      const paymentDate = new Date(payment.payment_date);
      const remainingAmount = parseFloat(payment.remaining_amount || '0');

      // Determine notification type
      const notificationType = remainingAmount > 0 ? 'payment_partial' : 'payment_received';

      await this.queueNotification({
        customer_id: payment.customer_id,
        invoice_id: payment.invoice_id,
        payment_id: paymentId,
        notification_type: notificationType as NotificationType,
        variables: {
          invoice_number: payment.invoice_number,
          amount: NotificationTemplateService.formatCurrency(parseFloat(payment.amount)),
          paid_amount: NotificationTemplateService.formatCurrency(parseFloat(payment.amount)),
          remaining_amount: NotificationTemplateService.formatCurrency(remainingAmount),
          payment_method: payment.payment_method || 'Tunai',
          payment_date: NotificationTemplateService.formatDate(paymentDate)
        }
      });
    } finally {
      connection.release();
    }
  }




  /**
   * Get notification statistics
   */
  static async getStatistics(days: number = 30): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    skipped: number;
    by_type: Record<string, number>;
    by_channel: Record<string, number>;
  }> {
    const connection = await databasePool.getConnection();

    try {
      const [statsRows] = await connection.query<RowDataPacket[]>(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
         FROM unified_notifications_queue
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days]
      );

      const [typeRows] = await connection.query<RowDataPacket[]>(
        `SELECT notification_type, COUNT(*) as count
         FROM unified_notifications_queue
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY notification_type`,
        [days]
      );

      const [channelRows] = await connection.query<RowDataPacket[]>(
        `SELECT channel, COUNT(*) as count
         FROM unified_notifications_queue
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY channel`,
        [days]
      );

      const stats = (statsRows[0] || {}) as any;
      const by_type: Record<string, number> = {};
      const by_channel: Record<string, number> = {};

      typeRows.forEach((row: any) => {
        by_type[row.notification_type] = parseInt(row.count);
      });

      channelRows.forEach((row: any) => {
        by_channel[row.channel] = parseInt(row.count);
      });

      return {
        total: parseInt(stats.total || '0'),
        sent: parseInt(stats.sent || '0'),
        failed: parseInt(stats.failed || '0'),
        pending: parseInt(stats.pending || '0'),
        skipped: parseInt(stats.skipped || '0'),
        by_type,
        by_channel
      };
    } finally {
      connection.release();
    }
  }
}


