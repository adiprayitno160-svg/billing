/**
 * Late Payment Tracking Service
 * Handles tracking late payments and service suspension triggers
 */

import pool from '../../db/pool';
import { Pool, PoolConnection } from 'mysql2/promise';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { IsolationService } from './isolationService';

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

      // Check if late
      const isLate = paymentDate > dueDate;
      const daysLate = Math.max(0, Math.ceil((paymentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Get invoice details
      const [invoiceRows] = await connection.query<RowDataPacket[]>(
        `SELECT customer_id FROM invoices WHERE id = ?`,
        [invoiceId]
      );

      if (invoiceRows.length === 0) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const invoice = invoiceRows[0];

      // Insert or update tracking record
      // Check if table exists
      const [tableExists] = await connection.query<RowDataPacket[]>(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customer_late_payment_tracking'
      `);

      if (tableExists.length > 0) {
        await connection.execute(
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
        // Increment late payment count
        await this.calculateLatePaymentCount(invoice.customer_id, undefined, connection);

        // Update last late payment date
        await connection.query(
          `UPDATE customers 
           SET last_late_payment_date = ?, last_payment_date = ?, consecutive_on_time_payments = 0
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
        await this.checkAndResetCounter(invoice.customer_id, connection);
      }

      await connection.commit();
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
  static async calculateLatePaymentCount(customerId: number, months?: number, existingConnection?: PoolConnection | Pool): Promise<number> {
    const connection = existingConnection || await pool.getConnection();
    const isLocalConnection = !existingConnection;

    try {
      // Check if late_payment_count column exists
      const [columns] = await (connection as Pool).query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME = 'late_payment_count'
      `);

      if (columns.length === 0) {
        return 0;
      }

      // Get rolling months from settings
      if (!months) {
        const [settings] = await (connection as Pool).query<RowDataPacket[]>(
          `SELECT setting_value FROM system_settings WHERE setting_key = 'late_payment_rolling_months'`
        );
        months = settings.length > 0 ? parseInt(settings[0].setting_value) : 12;
      }

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      // Check if tracking table exists
      let count = 0;
      const [tableCheck] = await (connection as Pool).query<RowDataPacket[]>(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customer_late_payment_tracking'
      `);

      if (tableCheck.length > 0) {
        // Count late payments in period
        const [countRows] = await connection.query<RowDataPacket[]>(
          `SELECT COUNT(*) as late_count 
           FROM customer_late_payment_tracking 
           WHERE customer_id = ? AND is_late = TRUE AND payment_date >= ?`,
          [customerId, cutoffDate]
        );
        count = countRows.length > 0 ? parseInt(countRows[0].late_count) : 0;
      }

      // Update customer count
      await connection.execute(
        `UPDATE customers SET late_payment_count = ? WHERE id = ?`,
        [count, customerId]
      );

      // Check if should isolate
      await this.checkAndApplyIsolation(customerId, count, connection);

      return count;
    } catch (error: any) {
      console.error('[LatePaymentTrackingService] Error calculating count:', error);
      throw error;
    } finally {
      if (isLocalConnection) (connection as PoolConnection).release();
    }
  }

  /**
   * Check if customer should be isolated due to late payment count
   */
  static async checkAndApplyIsolation(customerId: number, count: number, existingConnection?: PoolConnection | Pool): Promise<void> {
    const connection = existingConnection || pool;
    try {
      // Get threshold from settings
      const [settings] = await (connection as Pool).query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'late_payment_threshold'`
      );
      const threshold = settings.length > 0 ? parseInt(settings[0].setting_value) : 3;

      if (count >= threshold) {
        // Check current isolation status
        const [customerRows] = await (connection as Pool).query<RowDataPacket[]>(
          `SELECT is_isolated, name FROM customers WHERE id = ?`,
          [customerId]
        );

        if (customerRows.length > 0 && !customerRows[0].is_isolated) {
          // Trigger isolation
          console.log(`[LatePaymentTrackingService] 🔒 Customer ${customerRows[0].name} (ID: ${customerId}) exceeded late payment threshold (${count}/${threshold}). Triggering isolation.`);

          await IsolationService.isolateCustomer({
            customer_id: customerId,
            action: 'isolate',
            reason: `Auto-locking: Terlalu banyak pembayaran telat (${count}x)`,
            performed_by: 'system'
          }, (connection as any));
        }
      }
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error checking isolation:', error);
    }
  }

  /**
   * Check and reset counter if customer has consecutive on-time payments
   */
  static async checkAndResetCounter(customerId: number, existingConnection?: PoolConnection | Pool): Promise<void> {
    const connection = existingConnection || await pool.getConnection();
    const isLocalConnection = !existingConnection;

    try {
      // Get reset setting
      const [settings] = await (connection as Pool).query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'consecutive_on_time_reset'`
      );
      const resetThreshold = settings.length > 0 ? parseInt(settings[0].setting_value) : 6;

      // Check current consecutive count
      const [customerRows] = await (connection as Pool).query<RowDataPacket[]>(
        `SELECT COALESCE(consecutive_on_time_payments, 0) as consecutive, COALESCE(late_payment_count, 0) as late_count 
         FROM customers WHERE id = ?`,
        [customerId]
      );

      if (customerRows.length > 0) {
        const { consecutive, late_count } = customerRows[0];
        if (consecutive >= resetThreshold && late_count > 0) {
          console.log(`[LatePaymentTrackingService] 🔓 Customer ID ${customerId} reached ${consecutive} consecutive on-time payments. Resetting late payment counter.`);

          await this.resetCounter(
            customerId,
            0,
            `Auto-reset: ${consecutive} pembayaran tepat waktu berturut-turut`,
            'System',
            connection
          );
        }
      }
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error checking reset counter:', error);
    } finally {
      if (isLocalConnection) (connection as PoolConnection).release();
    }
  }

  /**
   * Reset counter (admin or system)
   */
  static async resetCounter(
    customerId: number,
    adminId: number = 0,
    reason: string = 'Manual reset',
    adminName?: string,
    existingConnection?: PoolConnection | Pool
  ): Promise<void> {
    const connection = existingConnection || await pool.getConnection();
    const isLocalConnection = !existingConnection;

    try {
      if (isLocalConnection) await (connection as PoolConnection).beginTransaction();

      // Get current count for audit
      const [customerRows] = await (connection as Pool).query<RowDataPacket[]>(
        `SELECT COALESCE(late_payment_count, 0) as late_count FROM customers WHERE id = ?`,
        [customerId]
      );

      const oldCount = customerRows.length > 0 ? customerRows[0].late_count : 0;

      // Reset
      await connection.execute(
        `UPDATE customers SET late_payment_count = 0, consecutive_on_time_payments = 0 WHERE id = ?`,
        [customerId]
      );

      // Log audit
      await this.logAudit(customerId, 'reset', oldCount, 0, reason, adminId, adminName || 'System', connection);

      if (isLocalConnection) await (connection as PoolConnection).commit();
    } catch (error) {
      if (isLocalConnection) await (connection as PoolConnection).rollback();
      throw error;
    } finally {
      if (isLocalConnection) (connection as PoolConnection).release();
    }
  }

  /**
   * Run daily recalculation for all active customers
   */
  static async dailyRecalculation(): Promise<{ processed: number; errors: number }> {
    const connection = await pool.getConnection();
    let processed = 0;
    let errors = 0;

    try {
      // 1. Get rolling months window from settings
      const [settings] = await connection.query<RowDataPacket[]>(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'late_payment_rolling_months'`
      );
      const months = settings.length > 0 ? parseInt(settings[0].setting_value) : 12;

      // 2. Identify customers who have overdue invoices currently
      const [overdueCustomers] = await connection.query<RowDataPacket[]>(
        `SELECT DISTINCT customer_id FROM invoices WHERE status = 'overdue' AND remaining_amount > 0`
      );

      console.log(`[LatePaymentTrackingService] Starting daily recalculation for ${overdueCustomers.length} customers with overdue invoices`);

      for (const row of overdueCustomers) {
        try {
          await this.calculateLatePaymentCount(row.customer_id, months, connection);
          processed++;
        } catch (err) {
          console.error(`[LatePaymentTrackingService] Error processing customer ID ${row.customer_id}:`, err);
          errors++;
        }
      }

      return { processed, errors };
    } catch (error) {
      console.error('[LatePaymentTrackingService] Critical error in dailyRecalculation:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get late payment stats for a customer
   */
  static async getCustomerLatePaymentStats(customerId: number): Promise<LatePaymentStats> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COALESCE(late_payment_count, 0) as late_payment_count, 
        last_late_payment_date, 
        COALESCE(consecutive_on_time_payments, 0) as consecutive_on_time_payments 
       FROM customers WHERE id = ?`,
      [customerId]
    );

    const customer = rows[0] || { late_payment_count: 0, last_late_payment_date: null, consecutive_on_time_payments: 0 };

    return {
      late_payment_count: customer.late_payment_count,
      last_late_payment_date: customer.last_late_payment_date,
      consecutive_on_time_payments: customer.consecutive_on_time_payments,
      total_late_payments_in_period: customer.late_payment_count // Simplified
    };
  }

  /**
   * Get late payment history for a customer
   */
  static async getLatePaymentHistory(customerId: number, limit: number = 20): Promise<any[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, i.invoice_number 
       FROM customer_late_payment_tracking t
       JOIN invoices i ON t.invoice_id = i.id
       WHERE t.customer_id = ?
       ORDER BY t.payment_date DESC, t.id DESC
       LIMIT ?`,
      [customerId, limit]
    );

    return rows;
  }

  /**
   * Adjust counter manually
   */
  static async adjustCounter(
    customerId: number,
    adjustment: number,
    adminId: number = 0,
    reason: string = 'Manual adjustment',
    adminName?: string
  ): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get current count
      const [customerRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(late_payment_count, 0) as late_count FROM customers WHERE id = ?`,
        [customerId]
      );

      const oldCount = customerRows.length > 0 ? customerRows[0].late_count : 0;
      const newCount = Math.max(0, oldCount + adjustment);

      // Update
      await connection.execute(
        `UPDATE customers SET late_payment_count = ? WHERE id = ?`,
        [newCount, customerId]
      );

      // Log audit
      await this.logAudit(customerId, 'adjust', oldCount, newCount, reason, adminId, adminName || 'System', connection);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Batch reset counter
   */
  static async batchResetCounter(
    customerIds: number[],
    adminId: number = 0,
    reason: string = 'Batch reset',
    adminName?: string
  ): Promise<number> {
    let successCount = 0;
    for (const id of customerIds) {
      try {
        await this.resetCounter(id, adminId, reason, adminName);
        successCount++;
      } catch (err) {
        console.error(`[LatePaymentTrackingService] Failed to reset counter for customer ${id}:`, err);
      }
    }
    return successCount;
  }

  /**
   * Export report data
   */
  static async exportLatePaymentReport(filters: any = {}): Promise<any[]> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.minCount !== undefined) {
      whereClause += ' AND COALESCE(c.late_payment_count, 0) >= ?';
      params.push(filters.minCount);
    }

    if (filters.maxCount !== undefined) {
      whereClause += ' AND COALESCE(c.late_payment_count, 0) <= ?';
      params.push(filters.maxCount);
    }

    if (filters.customerId) {
      whereClause += ' AND c.id = ?';
      params.push(filters.customerId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        c.customer_code,
        c.name,
        c.phone,
        COALESCE(c.late_payment_count, 0) as late_payment_count,
        c.last_late_payment_date,
        COALESCE(c.consecutive_on_time_payments, 0) as consecutive_on_time_payments
       FROM customers c
       ${whereClause}
       ORDER BY c.late_payment_count DESC`,
      params
    );

    return rows;
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
    performedByName: string = 'System',
    existingConnection?: PoolConnection | Pool
  ): Promise<void> {
    const connection = existingConnection || pool;
    try {
      await connection.execute(
        `INSERT INTO late_payment_audit_log (customer_id, action, old_count, new_count, reason, performed_by, performed_by_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [customerId, action, oldCount, newCount, reason, performedBy, performedByName]
      );
    } catch (error) {
      console.error('[LatePaymentTrackingService] Error logging audit:', error);
    }
  }
}

export default LatePaymentTrackingService;
