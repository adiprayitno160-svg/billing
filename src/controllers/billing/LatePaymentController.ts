/**
 * Late Payment Controller
 * Admin interface for managing late payment tracking and auto-migration
 */

import { Request, Response } from 'express';
import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import LatePaymentTrackingService from '../../services/billing/LatePaymentTrackingService';
import * as XLSX from 'xlsx';

export class LatePaymentController {
  /**
   * Show late payment dashboard
   */
  async dashboard(req: Request, res: Response): Promise<void> {
    try {
      // Check if columns exist
      const [columnCheck] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME IN ('billing_mode', 'late_payment_count', 'last_late_payment_date', 'consecutive_on_time_payments')
      `);
      
      const hasBillingMode = columnCheck.some((col: any) => col.COLUMN_NAME === 'billing_mode');
      const hasLatePaymentCount = columnCheck.some((col: any) => col.COLUMN_NAME === 'late_payment_count');
      const hasLastLatePaymentDate = columnCheck.some((col: any) => col.COLUMN_NAME === 'last_late_payment_date');
      const hasConsecutiveOnTime = columnCheck.some((col: any) => col.COLUMN_NAME === 'consecutive_on_time_payments');
      
      const billingModeFilter = hasBillingMode ? "WHERE (billing_mode = 'postpaid' OR billing_mode IS NULL)" : "";

      // Get statistics
      let statsRows: any[] = [{ total_customers: 0, count_3_or_more: 0, count_4: 0, count_5_or_more: 0, high_risk_customers: 0 }];
      
      if (hasLatePaymentCount) {
        [statsRows] = await pool.query<RowDataPacket[]>(`
          SELECT 
            COUNT(*) as total_customers,
            COUNT(CASE WHEN COALESCE(late_payment_count, 0) >= 3 THEN 1 END) as count_3_or_more,
            COUNT(CASE WHEN COALESCE(late_payment_count, 0) = 4 THEN 1 END) as count_4,
            COUNT(CASE WHEN COALESCE(late_payment_count, 0) >= 5 THEN 1 END) as count_5_or_more,
            SUM(CASE WHEN COALESCE(late_payment_count, 0) >= 3 THEN 1 ELSE 0 END) as high_risk_customers
          FROM customers
          ${billingModeFilter}
        `);
      } else {
        // If column doesn't exist, get total customers only
        const [totalRows] = await pool.query<RowDataPacket[]>(`
          SELECT COUNT(*) as total_customers FROM customers ${billingModeFilter}
        `);
        statsRows = [{ 
          total_customers: totalRows[0]?.total_customers || 0,
          count_3_or_more: 0,
          count_4: 0,
          count_5_or_more: 0,
          high_risk_customers: 0
        }];
      }

      // Get customers with high late payment count
      let highRiskCustomers: any[] = [];
      if (hasLatePaymentCount) {
        [highRiskCustomers] = await pool.query<RowDataPacket[]>(`
          SELECT 
            c.id,
            c.customer_code,
            c.name,
            c.phone,
            COALESCE(c.late_payment_count, 0) as late_payment_count,
            ${hasLastLatePaymentDate ? 'c.last_late_payment_date,' : 'NULL as last_late_payment_date,'}
            ${hasConsecutiveOnTime ? 'COALESCE(c.consecutive_on_time_payments, 0) as consecutive_on_time_payments' : '0 as consecutive_on_time_payments'}
          FROM customers c
          WHERE ${hasBillingMode ? "(c.billing_mode = 'postpaid' OR c.billing_mode IS NULL) AND" : ""} 
            COALESCE(c.late_payment_count, 0) >= 3
          ORDER BY COALESCE(c.late_payment_count, 0) DESC, ${hasLastLatePaymentDate ? 'c.last_late_payment_date' : 'NULL'} DESC
          LIMIT 20
        `);
      }

      // Check if late_payment_audit_log table exists
      let recentMigrations: any[] = [];
      try {
        const [tableCheck] = await pool.query<RowDataPacket[]>(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'late_payment_audit_log'
        `);
        
        if (tableCheck.length > 0) {
          const [migrations] = await pool.query<RowDataPacket[]>(`
            SELECT 
              la.customer_id,
              c.customer_code,
              c.name,
              la.created_at,
              la.reason
            FROM late_payment_audit_log la
            JOIN customers c ON la.customer_id = c.id
            WHERE la.action = 'migration_failed' OR la.reason LIKE '%Auto-reset: Migrated to prepaid%'
            ORDER BY la.created_at DESC
            LIMIT 10
          `);
          recentMigrations = migrations;
        }
      } catch (error) {
        console.warn('[LatePaymentController] late_payment_audit_log table not found, skipping recent migrations');
      }

      const stats = statsRows[0] || {};

      res.render('billing/late-payment-dashboard', {
        title: 'Late Payment Management',
        currentPath: '/billing/late-payment',
        stats,
        highRiskCustomers,
        recentMigrations,
        success: req.query.success || null,
        error: req.query.error || null
      });
    } catch (error: any) {
      console.error('[LatePaymentController] Dashboard error:', error);
      console.error('[LatePaymentController] Error details:', error.message, error.stack);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Gagal memuat dashboard late payment: ' + (error.message || 'Unknown error')
      });
    }
  }

  /**
   * Show late payment report
   */
  async report(req: Request, res: Response): Promise<void> {
    try {
      const { 
        customer_id, 
        min_count, 
        max_count, 
        date_from, 
        date_to,
        page = '1',
        limit = '50'
      } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      // Check if columns exist
      const [columnCheck] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME IN ('billing_mode', 'late_payment_count', 'last_late_payment_date', 'consecutive_on_time_payments')
      `);
      
      const hasBillingMode = columnCheck.some((col: any) => col.COLUMN_NAME === 'billing_mode');
      const hasLatePaymentCount = columnCheck.some((col: any) => col.COLUMN_NAME === 'late_payment_count');
      const hasLastLatePaymentDate = columnCheck.some((col: any) => col.COLUMN_NAME === 'last_late_payment_date');
      const hasConsecutiveOnTime = columnCheck.some((col: any) => col.COLUMN_NAME === 'consecutive_on_time_payments');

      // Build filters
      let whereClause = hasBillingMode 
        ? "WHERE (c.billing_mode = 'postpaid' OR c.billing_mode IS NULL)"
        : "WHERE 1=1";
      const params: any[] = [];

      if (customer_id) {
        whereClause += ' AND c.id = ?';
        params.push(customer_id);
      }

      // Only add late_payment_count filters if column exists
      if (hasLatePaymentCount) {
        if (min_count) {
          whereClause += ' AND COALESCE(c.late_payment_count, 0) >= ?';
          params.push(parseInt(min_count as string));
        }

        if (max_count) {
          whereClause += ' AND COALESCE(c.late_payment_count, 0) <= ?';
          params.push(parseInt(max_count as string));
        }
      }

      // Get total count
      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM customers c ${whereClause}`,
        params
      );

      const total = countRows[0]?.total || 0;

      // Get customers
      const [customers] = await pool.query<RowDataPacket[]>(
        `SELECT 
          c.id,
          c.customer_code,
          c.name,
          c.phone,
          ${hasLatePaymentCount ? 'COALESCE(c.late_payment_count, 0) as late_payment_count,' : '0 as late_payment_count,'}
          ${hasLastLatePaymentDate ? 'c.last_late_payment_date,' : 'NULL as last_late_payment_date,'}
          ${hasConsecutiveOnTime ? 'COALESCE(c.consecutive_on_time_payments, 0) as consecutive_on_time_payments,' : '0 as consecutive_on_time_payments,'}
          ${hasBillingMode ? "COALESCE(c.billing_mode, 'postpaid') as billing_mode" : "'postpaid' as billing_mode"}
         FROM customers c
         ${whereClause}
         ORDER BY ${hasLatePaymentCount ? 'COALESCE(c.late_payment_count, 0) DESC,' : ''} c.name ASC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit as string), offset]
      );

      res.render('billing/late-payment-report', {
        title: 'Late Payment Report',
        currentPath: '/billing/late-payment/report',
        customers,
        pagination: {
          currentPage: parseInt(page as string),
          totalPages: Math.ceil(total / parseInt(limit as string)),
          totalItems: total,
          limit: parseInt(limit as string)
        },
        filters: {
          customer_id,
          min_count,
          max_count,
          date_from,
          date_to
        }
      });
    } catch (error: any) {
      console.error('[LatePaymentController] Report error:', error);
      console.error('[LatePaymentController] Error details:', error.message, error.stack);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Gagal memuat laporan late payment: ' + (error.message || 'Unknown error')
      });
    }
  }

  /**
   * Show customer late payment detail
   */
  async customerDetail(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId || '0');
      if (!req.params.customerId || isNaN(customerId)) {
        return res.status(400).json({ success: false, error: 'customerId is required' });
      }

      // Get customer info
      const [customerRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM customers WHERE id = ?`,
        [customerId]
      );

      if (customerRows.length === 0) {
        return res.status(404).render('error', {
          title: 'Not Found',
          message: 'Customer tidak ditemukan'
        });
      }

      // Get stats
      const stats = await LatePaymentTrackingService.getCustomerLatePaymentStats(customerId);

      // Get history
      const history = await LatePaymentTrackingService.getLatePaymentHistory(customerId, 50);

      // Get audit log (check if table exists first)
      let auditLog: any[] = [];
      try {
        const [tableCheck] = await pool.query<RowDataPacket[]>(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'late_payment_audit_log'
        `);
        
        if (tableCheck.length > 0) {
          const [log] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM late_payment_audit_log 
             WHERE customer_id = ? 
             ORDER BY created_at DESC 
             LIMIT 20`,
            [customerId]
          );
          auditLog = log;
        }
      } catch (error) {
        console.warn('[LatePaymentController] late_payment_audit_log table not found, skipping audit log');
      }

      res.render('billing/late-payment-customer-detail', {
        title: `Late Payment - ${customerRows[0].name}`,
        currentPath: '/billing/late-payment',
        customer: customerRows[0],
        stats,
        history,
        auditLog,
        success: req.query.success || null,
        error: req.query.error || null
      });
    } catch (error: any) {
      console.error('[LatePaymentController] Customer detail error:', error);
      console.error('[LatePaymentController] Error details:', error.message, error.stack);
      res.status(500).render('error', {
        title: 'Error',
        message: 'Gagal memuat detail customer: ' + (error.message || 'Unknown error')
      });
    }
  }

  /**
   * Reset counter API
   */
  async resetCounter(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId || '0');
      if (!req.params.customerId || isNaN(customerId)) {
        return res.status(400).json({ success: false, error: 'customerId is required' });
      }
      const { reason } = req.body;
      const adminId = (req.session as any).userId || 0;
      const adminName = (req.session as any).username || 'Admin';

      await LatePaymentTrackingService.resetCounter(
        customerId,
        adminId,
        reason || 'Manual reset by admin',
        adminName
      );

      res.json({
        success: true,
        message: 'Counter berhasil direset'
      });
    } catch (error) {
      console.error('[LatePaymentController] Reset counter error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal reset counter'
      });
    }
  }

  /**
   * Adjust counter API
   */
  async adjustCounter(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId || '0');
      if (!req.params.customerId || isNaN(customerId)) {
        res.status(400).json({ success: false, error: 'customerId is required' });
        return;
      }
      const { adjustment, reason } = req.body;
      const adminId = (req.session as any).userId || 0;
      const adminName = (req.session as any).username || 'Admin';

      if (!adjustment || isNaN(parseInt(adjustment))) {
        res.status(400).json({
          success: false,
          message: 'Adjustment harus berupa angka'
        });
        return;
      }

      await LatePaymentTrackingService.adjustCounter(
        customerId,
        parseInt(adjustment),
        adminId,
        reason || 'Manual adjustment by admin',
        adminName
      );

      res.json({
        success: true,
        message: 'Counter berhasil disesuaikan'
      });
    } catch (error) {
      console.error('[LatePaymentController] Adjust counter error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal adjust counter'
      });
    }
  }

  /**
   * Batch reset counter
   */
  async batchReset(req: Request, res: Response): Promise<void> {
    try {
      const { customer_ids, reason } = req.body;
      const adminId = (req.session as any).userId || 0;
      const adminName = (req.session as any).username || 'Admin';

      if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Pilih minimal 1 customer'
        });
        return;
      }

      const customerIds = customer_ids.map((id: any) => parseInt(id));
      const successCount = await LatePaymentTrackingService.batchResetCounter(
        customerIds,
        adminId,
        reason || 'Batch reset by admin',
        adminName
      );

      res.json({
        success: true,
        message: `${successCount} dari ${customerIds.length} counter berhasil direset`,
        processed: successCount,
        total: customerIds.length
      });
    } catch (error) {
      console.error('[LatePaymentController] Batch reset error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal batch reset'
      });
    }
  }

  /**
   * Export report to Excel
   */
  async exportReport(req: Request, res: Response): Promise<void> {
    try {
      const { customer_id, min_count, max_count } = req.query;

      const filters: any = {};
      if (customer_id) filters.customerId = parseInt(customer_id as string);
      if (min_count) filters.minCount = parseInt(min_count as string);
      if (max_count) filters.maxCount = parseInt(max_count as string);

      const data = await LatePaymentTrackingService.exportLatePaymentReport(filters);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Prepare Excel data
      const excelData = data.map((customer: any) => ({
        'Kode Customer': customer.customer_code,
        'Nama': customer.name,
        'Telepon': customer.phone,
        'Late Payment Count': customer.late_payment_count,
        'Tanggal Late Payment Terakhir': customer.last_late_payment_date || '-',
        'Consecutive On-Time Payments': customer.consecutive_on_time_payments,
        'Billing Mode': customer.billing_mode
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, 'Late Payment Report');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="late_payment_report.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error('[LatePaymentController] Export error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal export laporan'
      });
    }
  }
}

export default new LatePaymentController();

