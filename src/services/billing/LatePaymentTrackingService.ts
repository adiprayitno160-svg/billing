/**
 * Late Payment Tracking Service
 * Handles tracking late payments and auto-migration to prepaid
 */

import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import MigrationService from '../customer/MigrationService';
// WhatsApp service removed

export interface LatePaymentStats {
  late_payment_count: number;
  last_late_payment_date: Date | null;
  consecutive_on_time_payments: number;
  total_late_payments_in_period: number;
}

export class LatePaymentTrackingService {
  /**
   * Track payment and check if it's late
   */
  static async trackPayment(
    invoiceId: number,
    paymentId: number,
    paymentDate: Date,
    dueDate: Date
  ): Promise<{ isLate: boolean; daysLate: number }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get invoice and customer info
      const [invoiceRows] = await connection.query<RowDataPacket[]>(
        `SELECT i.*, c.id as customer_id, c.billing_mode, c.name as customer_name, c.phone
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.id = ?`,
        [invoiceId]
      );

      if (invoiceRows.length === 0) {
        throw new Error('Invoice not found');
      }

      const invoice = invoiceRows[0];

      // Skip tracking if customer is already prepaid
      if (invoice.billing_mode === 'prepaid') {
        await connection.commit();
        return { isLate: false, daysLate: 0 };
      }

      // Check if payment is late
      const paymentDateObj = new Date(paymentDate);
      const dueDateObj = new Date(dueDate);
      const isLate = paymentDateObj > dueDateObj;
      const daysLate = isLate ? Math.floor((paymentDateObj.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Check if tracking table exists before inserting
      const [tableCheck] = await connection.query<RowDataPacket[]>(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customer_late_payment_tracking'
      `);
      
      if (tableCheck.length > 0) {
        // Record in tracking table
        await connection.query(
          `INSERT INTO customer_late_payment_tracking 
           (customer_id, invoice_id, payment_id, due_date, payment_date, is_late, days_late)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            invoice.customer_id,
            invoiceId,
            paymentId,
            dueDate,
            paymentDate,
            isLate,
            daysLate
          ]
        );
      } else {
        console.warn('[LatePaymentTrackingService] customer_late_payment_tracking table does not exist, skipping tracking record');
      }

      // Update customer stats
      if (isLate) {
        // Increment consecutive late payments will be handled by calculateLatePaymentCount
        await this.calculateLatePaymentCount(invoice.customer_id);
        
        // Update last late payment date
        await connection.query(
          `UPDATE customers 
           SET last_late_payment_date = ?, last_payment_date = ?
           WHERE id = ?`,
          [paymentDate, paymentDate, invoice.customer_id]
        );
      } else {
        // Payment is on time - increment consecutive on-time payments
        await connection.query(
          `UPDATE customers 
           SET consecutive_on_time_payments = consecutive_on_time_payments + 1,
               last_payment_date = ?
           WHERE id = ?`,
          [paymentDate, invoice.customer_id]
        );

        // Check if should reset counter
        await this.checkAndResetCounter(invoice.customer_id);
      }

      await connection.commit();

      // Check and trigger migration if needed (after commit)
      if (isLate) {
        await this.checkAndTriggerMigration(invoice.customer_id);
      }

      return { isLate, daysLate };
    } catch (error) {
      await connection.rollback();
      console.error('[LatePaymentTrackingService] Error tracking payment:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Calculate rolling count of late payments for customer
   */
  static async calculateLatePaymentCount(customerId: number, months?: number): Promise<number> {
    const connection = await pool.getConnection();

    try {
      // Check if late_payment_count column exists
      const [columns] = await connection.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME = 'late_payment_count'
      `);
      
      if (columns.length === 0) {
        // Column doesn't exist, return 0
        console.warn('[LatePaymentTrackingService] late_payment_count column does not exist, skipping calculation');
        return 0;
      }

      // Get rolling months from settings
      if (!months) {
        const [settings] = await connection.query<RowDataPacket[]>(
          `SELECT setting_value FROM system_settings WHERE setting_key = 'late_payment_rolling_months'`
        );
        months = settings.length > 0 ? parseInt(settings[0].setting_value) : 12;
      }

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      // Check if tracking table exists
      let count = 0;
      try {
        const [tableCheck] = await connection.query<RowDataPacket[]>(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'customer_late_payment_tracking'
        `);
        
        if (tableCheck.length > 0) {
          // Count late payments in period
          const [countRows] = await connection.query<RowDataPacket[]>(
            `SELECT COUNT(*) as count
             FROM customer_late_payment_tracking
             WHERE customer_id = ? 
               AND is_late = TRUE
               AND payment_date >= ?`,
            [customerId, cutoffDate]
          );

          count = countRows[0]?.count || 0;
        }
      } catch (error) {
        console.warn('[LatePaymentTrackingService] customer_late_payment_tracking table may not exist:', error);
      }

      // Update customer late_payment_count
      await connection.query(
        `UPDATE customers SET late_payment_count = ? WHERE id = ?`,
        [count, customerId]
      );

      return count;
    } catch (error: any) {
      // If error is about missing column, return 0
      if (error.message && error.message.includes('late_payment_count')) {
        console.warn('[LatePaymentTrackingService] late_payment_count column does not exist');
        return 0;
      }
      console.error('[LatePaymentTrackingService] Error calculating count:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check and trigger migration if threshold reached
   */
  static async checkAndTriggerMigration(customerId: number): Promise<boolean> {
    const connection = await pool.getConnection();

    try {
      // Check if auto-migration is enabled
      const [enableRows] = await connection.query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'enable_auto_migrate_late_payment'`
      );
      const enabled = enableRows.length > 0 && enableRows[0].setting_value === '1';

      if (!enabled) {
        return false;
      }

      // Get threshold
      const [thresholdRows] = await connection.query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'late_payment_threshold'`
      );
      const threshold = thresholdRows.length > 0 ? parseInt(thresholdRows[0].setting_value) : 5;

      // Get customer info
      const [customerRows] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM customers WHERE id = ?`,
        [customerId]
      );

      if (customerRows.length === 0) {
        return false;
      }

      const customer = customerRows[0];

      // Skip if already prepaid
      if (customer.billing_mode === 'prepaid') {
        return false;
      }

      // Check late payment count (with safe fallback)
      const lateCount = customer.late_payment_count ?? 0;

      // Send warnings
      if (lateCount === 3) {
        await this.sendLatePaymentWarning(customerId, 3);
      } else if (lateCount === 4) {
        await this.sendLatePaymentWarning(customerId, 4);
      }

      // Trigger migration if threshold reached
      if (lateCount >= threshold) {
        console.log(`[LatePaymentTrackingService] Auto-migrating customer ${customerId} due to ${lateCount} late payments`);

        // Save snapshot before migration
        await this.saveMigrationSnapshot(customerId, lateCount);

        // Trigger migration with retry
        let migrationSuccess = false;
        let retries = 3;

        while (retries > 0 && !migrationSuccess) {
          try {
            await MigrationService.migrateToPrepaid(customerId);
            migrationSuccess = true;

            // Reset counter after successful migration
            await this.resetCounter(customerId, 0, 'Auto-reset: Migrated to prepaid due to late payment');

            // Send notification
            await this.sendMigrationNotification(customerId);

            console.log(`✅ Customer ${customerId} successfully auto-migrated to prepaid`);
          } catch (error) {
            retries--;
            console.error(`❌ Migration failed for customer ${customerId}, retries left: ${retries}`, error);

            if (retries === 0) {
              // Log error and alert admin
              await this.logAudit(
                customerId,
                'migration_failed',
                lateCount,
                lateCount,
                `Auto-migration failed: ${error instanceof Error ? error.message : String(error)}`,
                0
              );
            } else {
              // Wait before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 2000 * (4 - retries)));
            }
          }
        }

        return migrationSuccess;
      }

      return false;
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error checking migration:', error);
      return false;
    } finally {
      connection.release();
    }
  }

  /**
   * Check and reset counter if customer has consecutive on-time payments
   */
  static async checkAndResetCounter(customerId: number): Promise<void> {
    const connection = await pool.getConnection();

    try {
      // Get reset threshold from settings
      const [resetRows] = await connection.query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'consecutive_on_time_reset'`
      );
      const resetThreshold = resetRows.length > 0 ? parseInt(resetRows[0].setting_value) : 3;

      // Check if columns exist first
      const [columns] = await connection.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME IN ('consecutive_on_time_payments', 'late_payment_count')
      `);
      
      const hasColumns = columns.length >= 2;
      
      if (!hasColumns) {
        return; // Skip if columns don't exist
      }

      // Get customer
      const [customerRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(consecutive_on_time_payments, 0) as consecutive_on_time_payments, 
                COALESCE(late_payment_count, 0) as late_payment_count 
         FROM customers WHERE id = ?`,
        [customerId]
      );

      if (customerRows.length === 0) {
        return;
      }

      const customer = customerRows[0];
      const consecutiveOnTime = customer.consecutive_on_time_payments || 0;
      const currentCount = customer.late_payment_count || 0;

      // Reset if threshold reached and has late payment count
      if (consecutiveOnTime >= resetThreshold && currentCount > 0) {
        await this.resetCounter(
          customerId,
          0,
          `Auto-reset: ${consecutiveOnTime} consecutive on-time payments`,
          0
        );

        // Reset consecutive counter
        await connection.query(
          `UPDATE customers SET consecutive_on_time_payments = 0 WHERE id = ?`,
          [customerId]
        );

        console.log(`✅ Reset late payment count for customer ${customerId} due to ${consecutiveOnTime} consecutive on-time payments`);
      }
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error checking reset:', error);
    } finally {
      connection.release();
    }
  }

  /**
   * Get late payment history for customer
   */
  static async getLatePaymentHistory(customerId: number, limit: number = 50): Promise<any[]> {
    try {
      // Check if table exists first
      const [tableCheck] = await pool.query<RowDataPacket[]>(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customer_late_payment_tracking'
      `);
      
      if (tableCheck.length === 0) {
        // Table doesn't exist, return empty array
        console.warn('[LatePaymentTrackingService] customer_late_payment_tracking table does not exist, returning empty history');
        return [];
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          lt.*,
          i.invoice_number,
          i.period,
          p.amount,
          p.payment_method
         FROM customer_late_payment_tracking lt
         JOIN invoices i ON lt.invoice_id = i.id
         JOIN payments p ON lt.payment_id = p.id
         WHERE lt.customer_id = ? AND lt.is_late = TRUE
         ORDER BY lt.payment_date DESC
         LIMIT ?`,
        [customerId, limit]
      );

      return rows as any[];
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error getting history:', error);
      // Return empty array instead of throwing to prevent breaking the page
      return [];
    }
  }

  /**
   * Send late payment warning notification
   */
  static async sendLatePaymentWarning(customerId: number, count: number): Promise<void> {
    try {
      // Check if warning is enabled
      const settingKey = count === 3 ? 'late_payment_warning_at_3' : 'late_payment_warning_at_4';
      const [enabledRows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = ?`,
        [settingKey]
      );

      if (enabledRows.length === 0 || enabledRows[0].setting_value !== '1') {
        return;
      }

      // Get customer info
      const [customerRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM customers WHERE id = ?`,
        [customerId]
      );

      if (customerRows.length === 0 || !customerRows[0].phone) {
        return;
      }

      const customer = customerRows[0];

      // Get threshold
      const [thresholdRows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'late_payment_threshold'`
      );
      const threshold = thresholdRows.length > 0 ? parseInt(thresholdRows[0].setting_value) : 5;

      let message = '';
      if (count === 3) {
        message = `⚠️ PERINGATAN PEMBAYARAN TELAT

Halo *${customer.name}*,

Anda sudah *3x* melakukan pembayaran telat.

Jika mencapai *${threshold}x* pembayaran telat, akun Anda akan otomatis dipindahkan ke sistem PREPAID.

Untuk pembayaran tepat waktu, silakan bayar sebelum tanggal jatuh tempo.

Terima kasih.`;
      } else if (count === 4) {
        message = `🚨 PERINGATAN TERAKHIR PEMBAYARAN TELAT

Halo *${customer.name}*,

Anda sudah *4x* melakukan pembayaran telat.

⚠️ PERINGATAN: *1x lagi* pembayaran telat, akun Anda akan OTOMATIS dipindahkan ke sistem PREPAID.

Harap segera lakukan pembayaran tepat waktu untuk menghindari pemindahan ke sistem prepaid.

Terima kasih.`;
      }

      if (message) {
        // Send via WhatsApp with retry
        let sent = false;
        let retries = 3;

        while (retries > 0 && !sent) {
          try {
            const { WhatsAppService } = await import('../whatsapp/WhatsAppService');
            const result = await WhatsAppService.sendMessage(customer.phone, message, {
              customerId: customerId,
              template: count === 3 ? 'late_payment_warning_3' : 'late_payment_warning_4'
            });
            sent = result.success;
            if (sent) {
              console.log(`✅ Late payment warning sent to customer ${customerId}`);
            }
          } catch (error) {
            retries--;
            if (retries === 0) {
              console.error(`❌ Failed to send warning to customer ${customerId} after 3 retries:`, error);
            } else {
              await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            }
          }
        }
      }
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error sending warning:', error);
    }
  }

  /**
   * Send migration notification
   */
  static async sendMigrationNotification(customerId: number): Promise<void> {
    try {
      // Get customer and portal info
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT c.*, pc.portal_id, pc.portal_pin
         FROM customers c
         LEFT JOIN portal_customers pc ON c.id = pc.customer_id
         WHERE c.id = ?`,
        [customerId]
      );

      if (rows.length === 0 || !rows[0].phone) {
        return;
      }

      const customer = rows[0];

      // Get portal URL from settings
      const [urlRows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'prepaid_portal_url'`
      );
      const portalUrl = urlRows.length > 0 ? urlRows[0].setting_value : 'http://localhost:3000';

      const message = `📢 INFORMASI PEMINDAHAN KE SISTEM PREPAID

Halo *${customer.name}*,

Karena Anda sudah 5x melakukan pembayaran telat, akun Anda telah OTOMATIS dipindahkan ke sistem PREPAID.

Mulai sekarang:
- Anda harus login ke portal prepaid untuk membeli paket internet
${customer.portal_id ? `- Portal ID: *${customer.portal_id}*\n${customer.portal_pin ? `- PIN: *${customer.portal_pin}*` : ''}` : ''}

Silakan login di: ${portalUrl}/prepaid/portal/login

Terima kasih.`;

      // Send via WhatsApp with retry
      let sent = false;
      let retries = 3;

      while (retries > 0 && !sent) {
        try {
          sent = await WhatsAppNotificationService.sendMessage(customer.phone, message);
          if (sent) {
            console.log(`✅ Migration notification sent to customer ${customerId}`);
          }
        } catch (error) {
          retries--;
          if (retries === 0) {
            console.error(`❌ Failed to send migration notification to customer ${customerId} after 3 retries`);
          } else {
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error sending migration notification:', error);
    }
  }

  /**
   * Reset counter (admin or system)
   */
  static async resetCounter(
    customerId: number,
    adminId: number = 0,
    reason: string = 'Manual reset',
    adminName?: string
  ): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check if column exists
      const [columns] = await connection.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME = 'late_payment_count'
      `);
      
      if (columns.length === 0) {
        throw new Error('late_payment_count column does not exist. Please run migration.');
      }

      // Get current count
      const [customerRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(late_payment_count, 0) as late_payment_count FROM customers WHERE id = ?`,
        [customerId]
      );

      if (customerRows.length === 0) {
        throw new Error('Customer not found');
      }

      const oldCount = customerRows[0].late_payment_count || 0;

      // Reset counter (only update columns that exist)
      const [allColumns] = await connection.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME IN ('late_payment_count', 'consecutive_on_time_payments', 'last_late_payment_date')
      `);
      
      const hasLateCount = allColumns.some((col: any) => col.COLUMN_NAME === 'late_payment_count');
      const hasConsecutive = allColumns.some((col: any) => col.COLUMN_NAME === 'consecutive_on_time_payments');
      const hasLastLateDate = allColumns.some((col: any) => col.COLUMN_NAME === 'last_late_payment_date');
      
      const updateParts: string[] = [];
      if (hasLateCount) updateParts.push('late_payment_count = 0');
      if (hasConsecutive) updateParts.push('consecutive_on_time_payments = 0');
      if (hasLastLateDate) updateParts.push('last_late_payment_date = NULL');
      
      if (updateParts.length > 0) {
        await connection.query(
          `UPDATE customers 
           SET ${updateParts.join(', ')}
           WHERE id = ?`,
          [customerId]
        );
      }

      // Log audit
      await this.logAudit(
        customerId,
        'reset',
        oldCount,
        0,
        reason,
        adminId,
        adminName || 'System'
      );

      await connection.commit();
      console.log(`✅ Reset late payment count for customer ${customerId} from ${oldCount} to 0`);
    } catch (error) {
      await connection.rollback();
      console.error('[LatePaymentTrackingService] Error resetting counter:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Adjust counter (admin only)
   */
  static async adjustCounter(
    customerId: number,
    adjustment: number,
    adminId: number,
    reason: string,
    adminName: string
  ): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check if column exists
      const [columns] = await connection.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME = 'late_payment_count'
      `);
      
      if (columns.length === 0) {
        throw new Error('late_payment_count column does not exist. Please run migration.');
      }

      // Get current count
      const [customerRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(late_payment_count, 0) as late_payment_count FROM customers WHERE id = ?`,
        [customerId]
      );

      if (customerRows.length === 0) {
        throw new Error('Customer not found');
      }

      const oldCount = customerRows[0].late_payment_count || 0;
      const newCount = Math.max(0, oldCount + adjustment);

      // Update count
      await connection.query(
        `UPDATE customers SET late_payment_count = ? WHERE id = ?`,
        [newCount, customerId]
      );

      // Log audit
      await this.logAudit(
        customerId,
        'manual_adjust',
        oldCount,
        newCount,
        reason,
        adminId,
        adminName
      );

      await connection.commit();
      console.log(`✅ Adjusted late payment count for customer ${customerId} from ${oldCount} to ${newCount}`);

      // Check migration after adjustment
      if (newCount >= 5) {
        await this.checkAndTriggerMigration(customerId);
      }
    } catch (error) {
      await connection.rollback();
      console.error('[LatePaymentTrackingService] Error adjusting counter:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get customer late payment statistics
   */
  static async getCustomerLatePaymentStats(customerId: number): Promise<LatePaymentStats> {
    try {
      // Check if late_payment_count column exists
      const [columns] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME IN ('late_payment_count', 'last_late_payment_date', 'consecutive_on_time_payments')
      `);
      
      const hasLatePaymentColumns = columns.some((col: any) => col.COLUMN_NAME === 'late_payment_count');
      const hasLastLatePaymentDate = columns.some((col: any) => col.COLUMN_NAME === 'last_late_payment_date');
      const hasConsecutiveOnTime = columns.some((col: any) => col.COLUMN_NAME === 'consecutive_on_time_payments');

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          ${hasLatePaymentColumns ? 'COALESCE(late_payment_count, 0) as late_payment_count,' : '0 as late_payment_count,'}
          ${hasLastLatePaymentDate ? 'last_late_payment_date,' : 'NULL as last_late_payment_date,'}
          ${hasConsecutiveOnTime ? 'COALESCE(consecutive_on_time_payments, 0) as consecutive_on_time_payments' : '0 as consecutive_on_time_payments'}
         FROM customers WHERE id = ?`,
        [customerId]
      );

      if (rows.length === 0) {
        throw new Error('Customer not found');
      }

      const customer = rows[0];

      // Calculate total in period (check if table exists)
      let totalLateInPeriod = 0;
      try {
        const [tableCheck] = await pool.query<RowDataPacket[]>(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'customer_late_payment_tracking'
        `);
        
        if (tableCheck.length > 0) {
          const [periodRows] = await pool.query<RowDataPacket[]>(
            `SELECT setting_value FROM system_settings WHERE setting_key = 'late_payment_rolling_months'`
          );
          const months = periodRows.length > 0 ? parseInt(periodRows[0].setting_value) : 12;
          const cutoffDate = new Date();
          cutoffDate.setMonth(cutoffDate.getMonth() - months);

          const [totalRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total
             FROM customer_late_payment_tracking
             WHERE customer_id = ? AND is_late = TRUE AND payment_date >= ?`,
            [customerId, cutoffDate]
          );
          totalLateInPeriod = totalRows[0]?.total || 0;
        }
      } catch (error) {
        console.warn('[LatePaymentTrackingService] Error getting total late payments, table may not exist:', error);
      }

      return {
        late_payment_count: customer.late_payment_count || 0,
        last_late_payment_date: customer.last_late_payment_date || null,
        consecutive_on_time_payments: customer.consecutive_on_time_payments || 0,
        total_late_payments_in_period: totalLateInPeriod
      };
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error getting stats:', error);
      // Return default stats if error
      return {
        late_payment_count: 0,
        last_late_payment_date: null,
        consecutive_on_time_payments: 0,
        total_late_payments_in_period: 0
      };
    }
  }

  /**
   * Batch reset counter for multiple customers
   */
  static async batchResetCounter(
    customerIds: number[],
    adminId: number,
    reason: string,
    adminName: string
  ): Promise<number> {
    let successCount = 0;

    for (const customerId of customerIds) {
      try {
        await this.resetCounter(customerId, adminId, reason, adminName);
        successCount++;
      } catch (error) {
        console.error(`Failed to reset counter for customer ${customerId}:`, error);
      }
    }

    return successCount;
  }

  /**
   * Export late payment report
   */
  static async exportLatePaymentReport(filters: {
    customerId?: number;
    minCount?: number;
    maxCount?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<any[]> {
    try {
      let query = `
        SELECT 
          c.id,
          c.customer_code,
          c.name,
          c.phone,
          COALESCE(c.late_payment_count, 0) as late_payment_count,
          c.last_late_payment_date,
          COALESCE(c.consecutive_on_time_payments, 0) as consecutive_on_time_payments,
          COALESCE(c.billing_mode, 'postpaid') as billing_mode
        FROM customers c
        WHERE (c.billing_mode IS NULL OR c.billing_mode != 'prepaid')
      `;

      const params: any[] = [];

      if (filters.customerId) {
        query += ' AND c.id = ?';
        params.push(filters.customerId);
      }

      if (filters.minCount !== undefined) {
        query += ' AND COALESCE(c.late_payment_count, 0) >= ?';
        params.push(filters.minCount);
      }

      if (filters.maxCount !== undefined) {
        query += ' AND COALESCE(c.late_payment_count, 0) <= ?';
        params.push(filters.maxCount);
      }

      query += ' ORDER BY COALESCE(c.late_payment_count, 0) DESC, c.name ASC';

      const [rows] = await pool.query<RowDataPacket[]>(query, params);
      return rows as any[];
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error exporting report:', error);
      throw error;
    }
  }

  /**
   * Log audit trail
   */
  private static async logAudit(
    customerId: number,
    action: string,
    oldCount: number,
    newCount: number,
    reason: string,
    performedBy: number = 0,
    performedByName: string = 'System'
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO late_payment_audit_log 
         (customer_id, action, old_count, new_count, reason, performed_by, performed_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [customerId, action, oldCount, newCount, reason, performedBy || null, performedByName]
      );
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error logging audit:', error);
    }
  }

  /**
   * Save migration snapshot before auto-migration
   */
  private static async saveMigrationSnapshot(customerId: number, lateCount: number): Promise<void> {
    try {
      // Get all late payment records
      const history = await this.getLatePaymentHistory(customerId, 100);

      // Get customer info
      const [customerRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM customers WHERE id = ?`,
        [customerId]
      );

      const snapshot = {
        customer_id: customerId,
        late_payment_count: lateCount,
        late_payment_history: history,
        customer_info: customerRows[0],
        migration_reason: 'Auto-migration due to late payment threshold',
        migrated_at: new Date().toISOString()
      };

      // Log in migration_history if table exists
      try {
        await pool.query(
          `INSERT INTO migration_history 
           (customer_id, from_mode, to_mode, migrated_by, notes, created_at)
           VALUES (?, 'postpaid', 'prepaid', 0, ?, NOW())`,
          [
            customerId,
            JSON.stringify(snapshot)
          ]
        );
      } catch (error) {
        // migration_history might not exist or different structure
        console.warn('Could not save migration snapshot to migration_history:', error);
      }
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error saving snapshot:', error);
    }
  }

  /**
   * Daily re-calculation job (to be called by scheduler)
   */
  static async dailyRecalculation(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Get all postpaid customers
      const [customers] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM customers WHERE billing_mode = 'postpaid'`
      );

      for (const customer of customers) {
        try {
          await this.calculateLatePaymentCount(customer.id);
          processed++;
        } catch (error) {
          errors++;
          console.error(`Error recalculating for customer ${customer.id}:`, error);
        }
      }

      console.log(`[LatePaymentTrackingService] Daily recalculation: ${processed} processed, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error in daily recalculation:', error);
      return { processed, errors };
    }
  }
}

export default LatePaymentTrackingService;

