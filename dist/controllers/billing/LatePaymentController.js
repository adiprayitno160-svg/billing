"use strict";
/**
 * Late Payment Controller
 * Admin interface for managing late payment tracking
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LatePaymentController = void 0;
const pool_1 = __importDefault(require("../../db/pool"));
const LatePaymentTrackingService_1 = __importDefault(require("../../services/billing/LatePaymentTrackingService"));
const XLSX = __importStar(require("xlsx"));
class LatePaymentController {
    /**
     * Show late payment dashboard
     */
    async dashboard(req, res) {
        try {
            // Check if columns exist
            const [columnCheck] = await pool_1.default.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME IN ('late_payment_count', 'last_late_payment_date', 'consecutive_on_time_payments')
      `);
            const hasLatePaymentCount = columnCheck.some((col) => col.COLUMN_NAME === 'late_payment_count');
            const hasLastLatePaymentDate = columnCheck.some((col) => col.COLUMN_NAME === 'last_late_payment_date');
            const hasConsecutiveOnTime = columnCheck.some((col) => col.COLUMN_NAME === 'consecutive_on_time_payments');
            // Get statistics
            let statsRows = [{ total_customers: 0, count_3_or_more: 0, count_4: 0, count_5_or_more: 0, high_risk_customers: 0 }];
            if (hasLatePaymentCount) {
                [statsRows] = await pool_1.default.query(`
          SELECT 
            COUNT(*) as total_customers,
            COUNT(CASE WHEN COALESCE(late_payment_count, 0) >= 3 THEN 1 END) as count_3_or_more,
            COUNT(CASE WHEN COALESCE(late_payment_count, 0) = 4 THEN 1 END) as count_4,
            COUNT(CASE WHEN COALESCE(late_payment_count, 0) >= 5 THEN 1 END) as count_5_or_more,
            SUM(CASE WHEN COALESCE(late_payment_count, 0) >= 3 THEN 1 ELSE 0 END) as high_risk_customers
          FROM customers
        `);
            }
            else {
                // If column doesn't exist, get total customers only
                const [totalRows] = await pool_1.default.query(`
          SELECT COUNT(*) as total_customers FROM customers
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
            let highRiskCustomers = [];
            if (hasLatePaymentCount) {
                [highRiskCustomers] = await pool_1.default.query(`
          SELECT 
            c.id,
            c.customer_code,
            c.name,
            c.phone,
            COALESCE(c.late_payment_count, 0) as late_payment_count,
            ${hasLastLatePaymentDate ? 'c.last_late_payment_date,' : 'NULL as last_late_payment_date,'}
            ${hasConsecutiveOnTime ? 'COALESCE(c.consecutive_on_time_payments, 0) as consecutive_on_time_payments' : '0 as consecutive_on_time_payments'}
          FROM customers c
          WHERE COALESCE(c.late_payment_count, 0) >= 3
          ORDER BY COALESCE(c.late_payment_count, 0) DESC, ${hasLastLatePaymentDate ? 'c.last_late_payment_date' : 'NULL'} DESC
          LIMIT 20
        `);
            }
            const stats = statsRows[0] || {};
            res.render('billing/late-payment-dashboard', {
                title: 'Late Payment Management',
                currentPath: '/billing/late-payment',
                stats,
                highRiskCustomers,
                success: req.query.success || null,
                error: req.query.error || null
            });
        }
        catch (error) {
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
    async report(req, res) {
        try {
            const { customer_id, min_count, max_count, date_from, date_to, page = '1', limit = '50' } = req.query;
            const offset = (parseInt(page) - 1) * parseInt(limit);
            // Check if columns exist
            const [columnCheck] = await pool_1.default.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'customers' 
        AND COLUMN_NAME IN ('late_payment_count', 'last_late_payment_date', 'consecutive_on_time_payments')
      `);
            const hasLatePaymentCount = columnCheck.some((col) => col.COLUMN_NAME === 'late_payment_count');
            const hasLastLatePaymentDate = columnCheck.some((col) => col.COLUMN_NAME === 'last_late_payment_date');
            const hasConsecutiveOnTime = columnCheck.some((col) => col.COLUMN_NAME === 'consecutive_on_time_payments');
            // Build filters
            let whereClause = "WHERE 1=1";
            const params = [];
            if (customer_id) {
                whereClause += ' AND c.id = ?';
                params.push(customer_id);
            }
            // Only add late_payment_count filters if column exists
            if (hasLatePaymentCount) {
                if (min_count) {
                    whereClause += ' AND COALESCE(c.late_payment_count, 0) >= ?';
                    params.push(parseInt(min_count));
                }
                if (max_count) {
                    whereClause += ' AND COALESCE(c.late_payment_count, 0) <= ?';
                    params.push(parseInt(max_count));
                }
            }
            // Get total count
            const [countRows] = await pool_1.default.query(`SELECT COUNT(*) as total FROM customers c ${whereClause}`, params);
            const total = countRows[0]?.total || 0;
            // Get customers
            const [customers] = await pool_1.default.query(`SELECT 
          c.id,
          c.customer_code,
          c.name,
          c.phone,
          ${hasLatePaymentCount ? 'COALESCE(c.late_payment_count, 0) as late_payment_count,' : '0 as late_payment_count,'}
          ${hasLastLatePaymentDate ? 'c.last_late_payment_date,' : 'NULL as last_late_payment_date,'}
          ${hasConsecutiveOnTime ? 'COALESCE(c.consecutive_on_time_payments, 0) as consecutive_on_time_payments,' : '0 as consecutive_on_time_payments,'}
          'postpaid' as billing_mode
         FROM customers c
         ${whereClause}
         ORDER BY ${hasLatePaymentCount ? 'COALESCE(c.late_payment_count, 0) DESC,' : ''} c.name ASC
         LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
            res.render('billing/late-payment-report', {
                title: 'Late Payment Report',
                currentPath: '/billing/late-payment/report',
                customers,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalItems: total,
                    limit: parseInt(limit)
                },
                filters: {
                    customer_id,
                    min_count,
                    max_count,
                    date_from,
                    date_to
                }
            });
        }
        catch (error) {
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
    async customerDetail(req, res) {
        try {
            const customerId = parseInt(req.params.customerId || '0');
            if (!req.params.customerId || isNaN(customerId)) {
                return res.status(400).json({ success: false, error: 'customerId is required' });
            }
            // Get customer info
            const [customerRows] = await pool_1.default.query(`SELECT * FROM customers WHERE id = ?`, [customerId]);
            if (customerRows.length === 0) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Customer tidak ditemukan'
                });
            }
            // Get stats
            const stats = await LatePaymentTrackingService_1.default.getCustomerLatePaymentStats(customerId);
            // Get history
            const history = await LatePaymentTrackingService_1.default.getLatePaymentHistory(customerId, 50);
            // Get audit log (check if table exists first)
            let auditLog = [];
            try {
                const [tableCheck] = await pool_1.default.query(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'late_payment_audit_log'
        `);
                if (tableCheck.length > 0) {
                    const [log] = await pool_1.default.query(`SELECT * FROM late_payment_audit_log 
             WHERE customer_id = ? 
             ORDER BY created_at DESC 
             LIMIT 20`, [customerId]);
                    auditLog = log;
                }
            }
            catch (error) {
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
        }
        catch (error) {
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
    async resetCounter(req, res) {
        try {
            const customerId = parseInt(req.params.customerId || '0');
            if (!req.params.customerId || isNaN(customerId)) {
                return res.status(400).json({ success: false, error: 'customerId is required' });
            }
            const { reason } = req.body;
            const adminId = req.session.userId || 0;
            const adminName = req.session.username || 'Admin';
            await LatePaymentTrackingService_1.default.resetCounter(customerId, adminId, reason || 'Manual reset by admin', adminName);
            res.json({
                success: true,
                message: 'Counter berhasil direset'
            });
        }
        catch (error) {
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
    async adjustCounter(req, res) {
        try {
            const customerId = parseInt(req.params.customerId || '0');
            if (!req.params.customerId || isNaN(customerId)) {
                res.status(400).json({ success: false, error: 'customerId is required' });
                return;
            }
            const { adjustment, reason } = req.body;
            const adminId = req.session.userId || 0;
            const adminName = req.session.username || 'Admin';
            if (!adjustment || isNaN(parseInt(adjustment))) {
                res.status(400).json({
                    success: false,
                    message: 'Adjustment harus berupa angka'
                });
                return;
            }
            await LatePaymentTrackingService_1.default.adjustCounter(customerId, parseInt(adjustment), adminId, reason || 'Manual adjustment by admin', adminName);
            res.json({
                success: true,
                message: 'Counter berhasil disesuaikan'
            });
        }
        catch (error) {
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
    async batchReset(req, res) {
        try {
            const { customer_ids, reason } = req.body;
            const adminId = req.session.userId || 0;
            const adminName = req.session.username || 'Admin';
            if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Pilih minimal 1 customer'
                });
                return;
            }
            const customerIds = customer_ids.map((id) => parseInt(id));
            const successCount = await LatePaymentTrackingService_1.default.batchResetCounter(customerIds, adminId, reason || 'Batch reset by admin', adminName);
            res.json({
                success: true,
                message: `${successCount} dari ${customerIds.length} counter berhasil direset`,
                processed: successCount,
                total: customerIds.length
            });
        }
        catch (error) {
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
    async exportReport(req, res) {
        try {
            const { customer_id, min_count, max_count } = req.query;
            const filters = {};
            if (customer_id)
                filters.customerId = parseInt(customer_id);
            if (min_count)
                filters.minCount = parseInt(min_count);
            if (max_count)
                filters.maxCount = parseInt(max_count);
            const data = await LatePaymentTrackingService_1.default.exportLatePaymentReport(filters);
            // Create workbook
            const wb = XLSX.utils.book_new();
            // Prepare Excel data
            const excelData = data.map((customer) => ({
                'Kode Customer': customer.customer_code,
                'Nama': customer.name,
                'Telepon': customer.phone,
                'Late Payment Count': customer.late_payment_count,
                'Tanggal Late Payment Terakhir': customer.last_late_payment_date || '-',
                'Consecutive On-Time Payments': customer.consecutive_on_time_payments,
                'Billing Mode': 'postpaid'
            }));
            const ws = XLSX.utils.json_to_sheet(excelData);
            XLSX.utils.book_append_sheet(wb, ws, 'Late Payment Report');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="late_payment_report.xlsx"');
            res.send(buffer);
        }
        catch (error) {
            console.error('[LatePaymentController] Export error:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal export laporan'
            });
        }
    }
}
exports.LatePaymentController = LatePaymentController;
exports.default = new LatePaymentController();
//# sourceMappingURL=LatePaymentController.js.map