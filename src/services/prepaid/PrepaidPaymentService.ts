/**
 * Prepaid Payment Service
 * Handles payment processing for prepaid packages
 * Supports manual transfer and payment gateway
 */

import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import path from 'path';
import fs from 'fs/promises';

export interface PaymentTransaction {
  id?: number;
  customer_id: number;
  package_id: number;
  amount: number;
  payment_method: 'manual_transfer' | 'payment_gateway' | 'cash' | 'admin_credit';
  payment_status: 'pending' | 'verified' | 'rejected' | 'paid' | 'expired';
  payment_proof_url?: string;
  payment_gateway_reference?: string;
  payment_gateway_type?: string;
  payment_notes?: string;
  verified_at?: Date;
  verified_by?: number;
  rejected_reason?: string;
  expired_at?: Date;
}

export interface PaymentSettings {
  bank_transfer_enabled: boolean;
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  transfer_instructions: string;
  payment_gateway_enabled: boolean;
  payment_gateway_provider: string;
  auto_expire_pending_hours: number;
}

export class PrepaidPaymentService {
  /**
   * Create new payment transaction
   */
  static async createTransaction(data: PaymentTransaction): Promise<number> {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO prepaid_transactions (
          customer_id, package_id, amount, payment_method, payment_status,
          payment_proof_url, payment_gateway_reference, payment_gateway_type, payment_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.customer_id,
          data.package_id,
          data.amount,
          data.payment_method,
          data.payment_status,
          data.payment_proof_url || null,
          data.payment_gateway_reference || null,
          data.payment_gateway_type || null,
          data.payment_notes || null,
        ]
      );

      console.log(
        `[PrepaidPaymentService] Transaction created: ID ${result.insertId}, Customer ${data.customer_id}, Amount ${data.amount}`
      );

      return result.insertId;
    } catch (error) {
      console.error('[PrepaidPaymentService] Error creating transaction:', error);
      throw new Error('Failed to create payment transaction');
    }
  }

  /**
   * Get transaction by ID
   */
  static async getTransactionById(transactionId: number): Promise<PaymentTransaction | null> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM prepaid_transactions WHERE id = ?`,
        [transactionId]
      );

      return rows.length > 0 ? (rows[0] as PaymentTransaction) : null;
    } catch (error) {
      console.error('[PrepaidPaymentService] Error fetching transaction:', error);
      throw new Error('Failed to fetch transaction');
    }
  }

  /**
   * Update transaction status
   */
  static async updateTransactionStatus(
    transactionId: number,
    status: 'pending' | 'verified' | 'rejected' | 'paid' | 'expired',
    additionalData?: {
      verified_by?: number;
      rejected_reason?: string;
      payment_gateway_reference?: string;
    }
  ): Promise<void> {
    try {
      const updateData: any = {
        payment_status: status,
      };

      if (status === 'verified' || status === 'paid') {
        updateData.verified_at = new Date();
        if (additionalData?.verified_by) {
          updateData.verified_by = additionalData.verified_by;
        }
      }

      if (status === 'rejected' && additionalData?.rejected_reason) {
        updateData.rejected_reason = additionalData.rejected_reason;
      }

      if (status === 'expired') {
        updateData.expired_at = new Date();
      }

      if (additionalData?.payment_gateway_reference) {
        updateData.payment_gateway_reference = additionalData.payment_gateway_reference;
      }

      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClause = fields.map((field) => `${field} = ?`).join(', ');

      await pool.query(
        `UPDATE prepaid_transactions SET ${setClause} WHERE id = ?`,
        [...values, transactionId]
      );

      console.log(`[PrepaidPaymentService] Transaction ${transactionId} status updated to: ${status}`);
    } catch (error) {
      console.error('[PrepaidPaymentService] Error updating transaction status:', error);
      throw new Error('Failed to update transaction status');
    }
  }

  /**
   * Get pending transactions (for admin verification)
   */
  static async getPendingTransactions(): Promise<any[]> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          t.id,
          t.customer_id,
          c.name as customer_name,
          c.phone as customer_phone,
          t.package_id,
          p.name as package_name,
          t.amount,
          t.payment_method,
          t.payment_proof_url,
          t.payment_notes,
          t.created_at,
          TIMESTAMPDIFF(HOUR, t.created_at, NOW()) as hours_pending
        FROM prepaid_transactions t
        INNER JOIN customers c ON t.customer_id = c.id
        INNER JOIN prepaid_packages p ON t.package_id = p.id
        WHERE t.payment_status = 'pending'
          AND t.payment_method = 'manual_transfer'
        ORDER BY t.created_at ASC`
      );

      return rows;
    } catch (error) {
      console.error('[PrepaidPaymentService] Error fetching pending transactions:', error);
      throw new Error('Failed to fetch pending transactions');
    }
  }

  /**
   * Verify manual transfer payment (Admin action)
   */
  static async verifyPayment(transactionId: number, adminId: number, notes?: string): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Update transaction status
      await connection.query(
        `UPDATE prepaid_transactions 
         SET payment_status = 'verified', verified_at = NOW(), verified_by = ?
         WHERE id = ?`,
        [adminId, transactionId]
      );

      // Log verification
      await connection.query(
        `INSERT INTO prepaid_payment_verification_log 
         (transaction_id, admin_id, action, notes, ip_address)
         VALUES (?, ?, 'approve', ?, ?)`,
        [transactionId, adminId, notes || null, null] // IP can be added from req.ip
      );

      await connection.commit();

      console.log(`[PrepaidPaymentService] Payment verified: Transaction ${transactionId} by Admin ${adminId}`);
    } catch (error) {
      await connection.rollback();
      console.error('[PrepaidPaymentService] Error verifying payment:', error);
      throw new Error('Failed to verify payment');
    } finally {
      connection.release();
    }
  }

  /**
   * Reject manual transfer payment (Admin action)
   */
  static async rejectPayment(
    transactionId: number,
    adminId: number,
    reason: string
  ): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Update transaction status
      await connection.query(
        `UPDATE prepaid_transactions 
         SET payment_status = 'rejected', rejected_reason = ?
         WHERE id = ?`,
        [reason, transactionId]
      );

      // Log rejection
      await connection.query(
        `INSERT INTO prepaid_payment_verification_log 
         (transaction_id, admin_id, action, notes, ip_address)
         VALUES (?, ?, 'reject', ?, ?)`,
        [transactionId, adminId, reason, null]
      );

      await connection.commit();

      console.log(`[PrepaidPaymentService] Payment rejected: Transaction ${transactionId} by Admin ${adminId}`);
    } catch (error) {
      await connection.rollback();
      console.error('[PrepaidPaymentService] Error rejecting payment:', error);
      throw new Error('Failed to reject payment');
    } finally {
      connection.release();
    }
  }

  /**
   * Save payment proof file
   */
  static async savePaymentProof(
    file: Express.Multer.File,
    transactionId: number
  ): Promise<string> {
    try {
      const uploadDir = path.join(__dirname, '../../../public/uploads/payment-proofs');

      // Create directory if not exists
      try {
        await fs.access(uploadDir);
      } catch {
        await fs.mkdir(uploadDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `proof_${transactionId}_${timestamp}${ext}`;
      const filepath = path.join(uploadDir, filename);

      // Save file
      await fs.writeFile(filepath, file.buffer);

      // Return relative URL
      const relativeUrl = `/uploads/payment-proofs/${filename}`;

      // Update transaction
      await pool.query(
        'UPDATE prepaid_transactions SET payment_proof_url = ? WHERE id = ?',
        [relativeUrl, transactionId]
      );

      console.log(`[PrepaidPaymentService] Payment proof saved: ${relativeUrl}`);

      return relativeUrl;
    } catch (error) {
      console.error('[PrepaidPaymentService] Error saving payment proof:', error);
      throw new Error('Failed to save payment proof');
    }
  }

  /**
   * Get payment settings from database
   */
  static async getPaymentSettings(): Promise<PaymentSettings> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT setting_key, setting_value 
         FROM prepaid_payment_settings 
         WHERE is_active = 1`
      );

      const settings: any = {};
      rows.forEach((row) => {
        const key = row.setting_key;
        const value = row.setting_value;

        // Parse boolean values
        if (value === 'true') {
          settings[key] = true;
        } else if (value === 'false') {
          settings[key] = false;
        } else {
          settings[key] = value;
        }
      });

      return {
        bank_transfer_enabled: settings.bank_transfer_enabled || false,
        bank_name: settings.bank_name || '',
        bank_account_number: settings.bank_account_number || '',
        bank_account_name: settings.bank_account_name || '',
        transfer_instructions: settings.transfer_instructions || '',
        payment_gateway_enabled: settings.payment_gateway_enabled || false,
        payment_gateway_provider: settings.payment_gateway_provider || 'midtrans',
        auto_expire_pending_hours: parseInt(settings.auto_expire_pending_hours) || 24,
      };
    } catch (error) {
      console.error('[PrepaidPaymentService] Error fetching payment settings:', error);
      throw new Error('Failed to fetch payment settings');
    }
  }

  /**
   * Auto-expire old pending payments (called by scheduler)
   */
  static async expirePendingPayments(): Promise<number> {
    try {
      const settings = await this.getPaymentSettings();
      const expireHours = settings.auto_expire_pending_hours;

      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE prepaid_transactions
         SET payment_status = 'expired', expired_at = NOW()
         WHERE payment_status = 'pending'
           AND payment_method = 'manual_transfer'
           AND TIMESTAMPDIFF(HOUR, created_at, NOW()) >= ?`,
        [expireHours]
      );

      if (result.affectedRows > 0) {
        console.log(`[PrepaidPaymentService] Expired ${result.affectedRows} pending payment(s)`);
      }

      return result.affectedRows;
    } catch (error) {
      console.error('[PrepaidPaymentService] Error expiring payments:', error);
      return 0;
    }
  }

  /**
   * Get payment statistics (for admin dashboard)
   */
  static async getPaymentStatistics(dateFrom?: Date, dateTo?: Date): Promise<any> {
    try {
      const dateFilter = dateFrom && dateTo 
        ? `AND created_at BETWEEN ? AND ?`
        : '';

      const params = dateFrom && dateTo ? [dateFrom, dateTo] : [];

      const [stats] = await pool.query<RowDataPacket[]>(
        `SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN payment_status = 'verified' OR payment_status = 'paid' THEN 1 ELSE 0 END) as verified_count,
          SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN payment_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
          SUM(CASE WHEN payment_status = 'expired' THEN 1 ELSE 0 END) as expired_count,
          SUM(CASE WHEN payment_status IN ('verified', 'paid') THEN amount ELSE 0 END) as total_revenue,
          AVG(CASE WHEN payment_status = 'verified' THEN TIMESTAMPDIFF(MINUTE, created_at, verified_at) ELSE NULL END) as avg_verification_minutes
        FROM prepaid_transactions
        WHERE 1=1 ${dateFilter}`,
        params
      );

      return stats[0];
    } catch (error) {
      console.error('[PrepaidPaymentService] Error fetching payment statistics:', error);
      throw new Error('Failed to fetch payment statistics');
    }
  }
}

export default PrepaidPaymentService;

