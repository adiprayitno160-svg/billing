"use strict";
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
const express_1 = require("express");
const invoiceController_1 = require("../controllers/billing/invoiceController");
const paymentController_1 = require("../controllers/billing/paymentController");
const BillingPaymentController_1 = require("../controllers/payment/BillingPaymentController");
const invoiceSchedulerService_1 = require("../services/billing/invoiceSchedulerService");
const LatePaymentController_1 = __importDefault(require("../controllers/billing/LatePaymentController"));
const SystemLogController_1 = require("../controllers/billing/SystemLogController");
const VerificationController_1 = require("../controllers/billing/VerificationController");
const periodHelper_1 = require("../utils/periodHelper");
const router = (0, express_1.Router)();
const invoiceController = new invoiceController_1.InvoiceController();
const paymentController = new paymentController_1.PaymentController();
const gatewayController = new BillingPaymentController_1.BillingPaymentController();
const latePaymentController = LatePaymentController_1.default;
// ========================================
// MANUAL VERIFICATION ROUTES
// ========================================
router.get('/verification', VerificationController_1.VerificationController.index);
router.get('/verification/list', VerificationController_1.VerificationController.getList);
router.get('/verification/detail/:id', VerificationController_1.VerificationController.getDetail);
router.get('/verification/customer-invoices/:customerId', VerificationController_1.VerificationController.getCustomerInvoices);
router.get('/verification/image/:id', VerificationController_1.VerificationController.getImage);
router.post('/verification/process', VerificationController_1.VerificationController.process);
// ========================================
// BILLING ROOT - Redirect to dashboard
// ========================================
router.get('/', (req, res) => res.redirect('/billing/dashboard'));
// ========================================
// BILLING DASHBOARD
// ========================================
router.get('/dashboard', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            // Get invoice statistics
            const [totalInvoices] = await conn.query('SELECT COUNT(*) as count FROM invoices');
            const [paidInvoices] = await conn.query("SELECT COUNT(*) as count FROM invoices WHERE status = 'paid'");
            const [unpaidInvoices] = await conn.query("SELECT COUNT(*) as count FROM invoices WHERE status IN ('draft', 'sent', 'partial')");
            const [overdueInvoices] = await conn.query("SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue' OR (status IN ('draft', 'sent', 'partial') AND due_date < NOW())");
            // Get revenue statistics
            const [totalRevenue] = await conn.query("SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices WHERE status = 'paid'");
            const [monthlyRevenue] = await conn.query("SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices WHERE status = 'paid' AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())");
            const stats = {
                totalInvoices: totalInvoices[0].count || 0,
                paidInvoices: paidInvoices[0].count || 0,
                unpaidInvoices: unpaidInvoices[0].count || 0,
                overdueInvoices: overdueInvoices[0].count || 0,
                totalRevenue: totalRevenue[0].total || 0,
                monthlyRevenue: monthlyRevenue[0].total || 0
            };
            res.render('billing/dashboard', {
                title: 'Dashboard Billing',
                stats
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading billing dashboard:', error);
        res.status(500).render('error', {
            title: 'Error',
            status: 500,
            message: 'Failed to load billing dashboard'
        });
    }
});
// Isolated Customers Page
router.get('/isolated-customers', async (req, res) => {
    res.render('billing/isolated-customers', {
        title: 'Pelanggan Terisolasi',
        layout: 'layouts/main'
    });
});
// ========================================
// INVOICE / TAGIHAN ROUTES
// ========================================
// ========================================
// REPORTS
// ========================================
router.get('/reports', async (req, res) => {
    res.render('billing/reports', { title: 'Laporan Billing' });
});
// Rekap Unpaid PDF
router.get('/rekap/unpaid', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const { period, odc_id, search } = req.query;
            let query = `
                SELECT 
                    i.*, c.name, c.phone, c.address, c.customer_code, o.name as odc_name
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                LEFT JOIN ftth_odc o ON c.odc_id = o.id
                WHERE i.status IN ('unpaid', 'sent', 'partial', 'overdue')
            `;
            const params = [];
            if (period) {
                query += " AND i.period = ?";
                params.push(period);
            }
            if (odc_id) {
                query += " AND c.odc_id = ?";
                params.push(odc_id);
            }
            if (search) {
                query += " AND (c.name LIKE ? OR i.invoice_number LIKE ?)";
                params.push(`%${search}%`, `%${search}%`);
            }
            query += " ORDER BY o.name ASC, c.name ASC";
            const [invoices] = await conn.query(query, params);
            res.render('billing/rekap-unpaid', { title: 'Rekap Belum Bayar', invoices, period, layout: false });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        res.status(500).send('Error');
    }
});
// Rekap Transactions PDF
router.get('/rekap/transactions', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const { search, status } = req.query;
            let query = `
                SELECT 
                    p.*, c.name as customer_name, c.customer_code, i.invoice_number
                FROM payments p
                LEFT JOIN invoices i ON p.invoice_id = i.id
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE 1=1
            `;
            const params = [];
            if (status) {
                query += " AND p.gateway_status = ?";
                params.push(status);
            }
            if (search) {
                query += " AND (c.name LIKE ? OR i.invoice_number LIKE ?)";
                params.push(`%${search}%`, `%${search}%`);
            }
            query += " ORDER BY p.payment_date DESC";
            const [transactions] = await conn.query(query, params);
            res.render('billing/rekap-paid', { title: 'Rekap Pembayaran', transactions, layout: false });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        res.status(500).send('Error');
    }
});
// List all invoices
router.get('/invoices', invoiceController.getInvoiceList.bind(invoiceController));
router.get('/tagihan', invoiceController.getInvoiceList.bind(invoiceController));
router.get('/tagihan/check-duplicates', invoiceController.checkInvoicesForPeriod.bind(invoiceController));
// Create manual invoice
// Create manual invoice
router.get('/tagihan/create/manual', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const [customers] = await conn.query("SELECT id, name, customer_code, connection_type FROM customers WHERE status = 'active' ORDER BY name ASC");
            res.render('billing/tagihan-create', {
                title: 'Buat Tagihan Manual',
                customers
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading manual invoice form:', error);
        res.status(500).send('Error loading form');
    }
});
router.post('/tagihan/create/manual', invoiceController.createManualInvoice.bind(invoiceController));
// Generate bulk invoices (automatic monthly)
router.post('/tagihan/generate-bulk', invoiceController.generateBulkInvoices.bind(invoiceController));
// Emergency Cleanup Route
router.post('/tagihan/force-cleanup', invoiceController.forceCleanupPeriod.bind(invoiceController));
// Apply downtime discount
router.post('/tagihan/apply-downtime-discount', invoiceController.applyDowntimeDiscount.bind(invoiceController));
// Bulk Reminder Route
router.post('/tagihan/bulk-reminder', async (req, res) => {
    try {
        const { invoiceIds } = req.body;
        if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No invoices selected' });
        }
        const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification/UnifiedNotificationService')));
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        let sentCount = 0;
        let errors = 0;
        try {
            // Get invoice details for selected IDs
            const [invoices] = await conn.query(`SELECT i.*, c.name, c.phone 
                 FROM invoices i 
                 JOIN customers c ON i.customer_id = c.id 
                 WHERE i.id IN (?) AND i.status IN ('unpaid', 'partial', 'sent', 'overdue') AND i.period = DATE_FORMAT(CURDATE(), '%Y-%m')`, [invoiceIds]);
            if (invoices.length === 0) {
                return res.json({ success: true, message: 'Tidak ada invoice yang perlu diingatkan (mungkin sudah lunas).' });
            }
            for (const invoice of invoices) {
                if (invoice.phone) {
                    try {
                        await UnifiedNotificationService.queueNotification({
                            customer_id: invoice.customer_id,
                            notification_type: 'invoice_reminder_manual', // Use generic manual reminder
                            channels: ['whatsapp'],
                            variables: {
                                customer_name: invoice.name,
                                invoice_number: invoice.invoice_number,
                                amount: invoice.total_amount, // Use total or remaining? usually remaining if partial
                                remaining_amount: invoice.remaining_amount,
                                due_date: invoice.due_date
                            },
                            priority: 'high'
                        });
                        sentCount++;
                    }
                    catch (e) {
                        console.error('Error queuing reminder for', invoice.id, e);
                        errors++;
                    }
                }
            }
            // Trigger send immediate
            if (sentCount > 0) {
                await UnifiedNotificationService.sendPendingNotifications(10);
            }
            res.json({
                success: true,
                message: `Berhasil mengirim ${sentCount} pengingat.${errors > 0 ? ` Gagal: ${errors}` : ''}`,
                sent: sentCount
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error sending bulk reminders:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to send reminders'
        });
    }
});
// Print invoices for customers WITHOUT ODC/ODP assignment
router.get('/tagihan/print-no-odc', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const { period, format } = req.query;
            // Build query for invoices where customer has NO odc_id
            let invoicesQuery = `
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.customer_id,
                    i.period,
                    i.due_date,
                    i.subtotal,
                    i.discount_amount,
                    i.total_amount,
                    i.paid_amount,
                    i.status,
                    i.created_at,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.address as customer_address,
                    c.customer_code,
                    i.period as raw_period,
                    (SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as total_balance,
                    (SELECT GROUP_CONCAT(period ORDER BY period ASC) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as unpaid_periods
                FROM invoices i
                INNER JOIN customers c ON i.customer_id = c.id
                WHERE (c.odc_id IS NULL OR c.odc_id = 0)
                AND i.status IN ('sent', 'partial', 'overdue')
                AND i.id = (SELECT id FROM invoices WHERE customer_id = i.customer_id AND status IN ('sent', 'partial', 'overdue') ORDER BY period DESC, created_at DESC LIMIT 1)
            `;
            const queryParams = [];
            if (period) {
                invoicesQuery += ' AND i.period = ?';
                queryParams.push(period);
            }
            invoicesQuery += ' ORDER BY c.name ASC';
            const [invoices] = await conn.query(invoicesQuery, queryParams);
            // Get invoice items and discount details for each invoice
            for (const invoice of invoices) {
                // Format period
                if (invoice.period) {
                    invoice.period = (0, periodHelper_1.formatPeriodToMonth)(invoice.period, invoice.due_date);
                }
                const [items] = await conn.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [invoice.id]);
                invoice.items = items || [];
                if (invoice.discount_amount && invoice.discount_amount > 0) {
                    const [discountInfo] = await conn.query(`SELECT reason, discount_type FROM discounts WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1`, [invoice.id]);
                    if (discountInfo && discountInfo.length > 0) {
                        invoice.discount_reason = discountInfo[0].reason || null;
                        invoice.sla_type = discountInfo[0].discount_type === 'sla' ? 'SLA Compensation' : null;
                    }
                }
            }
            // Virtual ODC object for the template
            const virtualOdc = {
                id: 0,
                name: 'Tanpa ODC/ODP',
                location: 'Belum Ditugaskan'
            };
            const viewName = format === 'a4' || format === 'list'
                ? 'billing/tagihan-print-odc-a4'
                : 'billing/tagihan-print-odc';
            res.render(viewName, {
                title: `Print Tagihan - Tanpa ODC/ODP`,
                odc: virtualOdc,
                invoices,
                period: period || 'Semua Periode',
                format: format || 'thermal',
                layout: false
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading no-ODC print:', error);
        res.status(500).send('Error loading invoices without ODC');
    }
});
// Print invoices by ODC area
router.get('/tagihan/print-odc/:odc_id', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const { odc_id } = req.params;
            const { period, format } = req.query;
            // Get ODC info
            const [odcResult] = await conn.query('SELECT * FROM ftth_odc WHERE id = ?', [odc_id]);
            if (odcResult.length === 0) {
                return res.status(404).send('ODC not found');
            }
            const odc = odcResult[0];
            // Build query for invoices with status filter for pending only
            // Include discount information for proper invoice display
            let invoicesQuery = `
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.customer_id,
                    i.period,
                    i.due_date,
                    i.subtotal,
                    i.discount_amount,
                    i.total_amount,
                    i.paid_amount,
                    i.status,
                    i.created_at,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.address as customer_address,
                    c.customer_code,
                    i.period as raw_period,
                    (SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as total_balance,
                    (SELECT GROUP_CONCAT(period ORDER BY period ASC) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as unpaid_periods
                FROM invoices i
                INNER JOIN customers c ON i.customer_id = c.id
                WHERE c.odc_id = ?
                AND i.status IN ('sent', 'partial', 'overdue')
                AND i.id = (SELECT id FROM invoices WHERE customer_id = i.customer_id AND status IN ('sent', 'partial', 'overdue') ORDER BY period DESC, created_at DESC LIMIT 1)
            `;
            const queryParams = [odc_id];
            if (period) {
                invoicesQuery += ' AND i.period = ?';
                queryParams.push(period);
            }
            invoicesQuery += ' ORDER BY c.name ASC';
            const [invoices] = await conn.query(invoicesQuery, queryParams);
            // Get invoice items and discount details for each invoice
            for (const invoice of invoices) {
                // Format period
                if (invoice.period) {
                    invoice.period = (0, periodHelper_1.formatPeriodToMonth)(invoice.period, invoice.due_date);
                }
                // Get invoice items
                const [items] = await conn.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [invoice.id]);
                invoice.items = items || [];
                // Get discount information if exists
                if (invoice.discount_amount && invoice.discount_amount > 0) {
                    const [discountInfo] = await conn.query(`SELECT reason, discount_type FROM discounts WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1`, [invoice.id]);
                    if (discountInfo && discountInfo.length > 0) {
                        invoice.discount_reason = discountInfo[0].reason || null;
                        invoice.sla_type = discountInfo[0].discount_type === 'sla' ? 'SLA Compensation' : null;
                    }
                }
            }
            // Default to thermal format (individual invoices) if not specified
            // Only use A4 format (list) if explicitly requested
            const viewName = format === 'a4' || format === 'list'
                ? 'billing/tagihan-print-odc-a4'
                : 'billing/tagihan-print-odc';
            res.render(viewName, {
                title: `Print Tagihan Area ${odc.name}`,
                odc,
                invoices,
                period: period || 'Semua Periode',
                format: format || 'thermal',
                layout: false
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading ODC print:', error);
        res.status(500).send('Error loading ODC invoices');
    }
});
// Print all invoices
router.get('/tagihan/print-all', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const { status, odc_id, search, period, format, ids } = req.query;
            // Build query - default to pending invoices
            let query = `
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.customer_id,
                    i.period,
                    i.due_date,
                    i.total_amount,
                    i.paid_amount,
                    i.discount_amount,
                    i.status,
                    i.created_at,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.address as customer_address,
                    c.customer_code,
                    c.odc_id,
                    o.name as odc_name,
                    o.location as odc_location,
                    i.period as raw_period,
                    (SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as total_balance,
                    (SELECT GROUP_CONCAT(period ORDER BY period ASC) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as unpaid_periods
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN ftth_odc o ON c.odc_id = o.id
                WHERE 1=1 AND (c.exclude_from_print = 0 OR c.exclude_from_print IS NULL)
            `;
            const queryParams = [];
            // If specific IDs are provided, prioritized them
            if (ids && Array.isArray(ids) && ids.length > 0) {
                query += " AND i.id IN (?) AND i.status != 'paid'";
                queryParams.push(ids);
            }
            else {
                // Default status filter if no IDs provided
                if (status === 'all') {
                    // Do nothing, print everything matches the query
                }
                else if (status && status !== 'paid') {
                    // Handle comma separated statuses
                    const statusList = status.split(',');
                    if (statusList.length > 1) {
                        query += ' AND i.status IN (?)';
                        queryParams.push(statusList);
                    }
                    else {
                        query += ' AND i.status = ?';
                        queryParams.push(status);
                    }
                }
                else if (status === 'paid') {
                    query += " AND i.status = 'paid'";
                }
                else {
                    query += " AND i.status IN ('sent', 'partial', 'overdue')";
                    query += " AND i.period = DATE_FORMAT(CURDATE(), '%Y-%m')"; // 100% fix for Sadida (only current month prints)
                }
                if (odc_id) {
                    query += ' AND c.odc_id = ?';
                    queryParams.push(odc_id);
                }
                if (search) {
                    query += ` AND (
                        c.name LIKE ? OR 
                        c.phone LIKE ? OR 
                        i.invoice_number LIKE ?
                    )`;
                    const searchParam = `%${search}%`;
                    queryParams.push(searchParam, searchParam, searchParam);
                }
                if (period) {
                    query += ' AND i.period = ?';
                    queryParams.push(period);
                }
            }
            const [invoices] = await conn.query(query, queryParams);
            // Optimized FETCH ITEMS for each invoice
            if (invoices.length > 0) {
                const invoiceIds = invoices.map((inv) => inv.id);
                const [allItems] = await conn.query('SELECT * FROM invoice_items WHERE invoice_id IN (?) ORDER BY id', [invoiceIds]);
                const itemsMap = new Map();
                allItems.forEach((item) => {
                    if (!itemsMap.has(item.invoice_id)) {
                        itemsMap.set(item.invoice_id, []);
                    }
                    itemsMap.get(item.invoice_id)?.push(item);
                });
                for (const invoice of invoices) {
                    // Format period
                    if (invoice.period) {
                        invoice.period = (0, periodHelper_1.formatPeriodToMonth)(invoice.period, invoice.due_date);
                    }
                    invoice.items = itemsMap.get(invoice.id) || [];
                }
            }
            // Choose view based on format parameter
            const viewName = format === 'thermal'
                ? 'billing/tagihan-print-all'
                : 'billing/tagihan-print-all-a4';
            res.render(viewName, {
                title: 'Print Semua Tagihan',
                invoices,
                filters: { status, odc_id, search, period },
                format: format || 'thermal',
                layout: false
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading print all invoices:', error);
        res.status(500).send('Error loading invoices');
    }
});
// Export invoices to PDF
router.get('/tagihan/export/pdf', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const { status, odc_id, search, period } = req.query;
            // Build query
            let query = `
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.address as customer_address,
                    c.customer_code,
                    c.odc_id,
                    o.name as odc_name,
                    o.location as odc_location
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN ftth_odc o ON c.odc_id = o.id
                WHERE 1=1
            `;
            const queryParams = [];
            if (status) {
                query += ' AND i.status = ?';
                queryParams.push(status);
            }
            if (odc_id) {
                query += ' AND c.odc_id = ?';
                queryParams.push(odc_id);
            }
            if (search) {
                query += ` AND (
                    c.name LIKE ? OR 
                    c.phone LIKE ? OR 
                    i.invoice_number LIKE ?
                )`;
                const searchParam = `%${search}%`;
                queryParams.push(searchParam, searchParam, searchParam);
            }
            if (period) {
                query += ' AND i.period = ?';
                queryParams.push(period);
            }
            query += ' ORDER BY i.created_at DESC';
            const [invoices] = await conn.query(query, queryParams);
            // Calculate statistics
            const stats = {
                total: invoices.length,
                paid: invoices.filter((inv) => inv.status === 'paid').length,
                unpaid: invoices.filter((inv) => ['draft', 'sent', 'partial'].includes(inv.status)).length,
                overdue: invoices.filter((inv) => inv.status === 'overdue').length,
                totalAmount: invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0),
                paidAmount: invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0),
                unpaidAmount: invoices.filter((inv) => inv.status !== 'paid').reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0) - parseFloat(inv.paid_amount || 0), 0)
            };
            res.render('billing/tagihan-export-pdf', {
                title: 'Export Tagihan ke PDF',
                invoices,
                stats,
                filters: { status, odc_id, search, period },
                exportDate: new Date()
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error exporting invoices to PDF:', error);
        res.status(500).send('Error exporting invoices');
    }
});
// Update invoice status
router.post('/tagihan/:id/status', invoiceController.updateInvoiceStatus.bind(invoiceController));
router.post('/tagihan/:id/notes', invoiceController.updateInvoiceNotes.bind(invoiceController));
router.post('/tagihan/:id/due-date', invoiceController.updateDueDate.bind(invoiceController));
// Print invoice (A4)
router.get('/tagihan/:id/print', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            // Get invoice with customer info
            const [invoices] = await conn.query(`SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.address as customer_address,
                    c.customer_code,
                    i.period as raw_period,
                    (SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as total_balance,
                    (SELECT GROUP_CONCAT(period ORDER BY period ASC) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as unpaid_periods
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?`, [req.params.id]);
            if (invoices.length === 0) {
                return res.status(404).send('Invoice not found');
            }
            const invoice = invoices[0];
            // Format period
            if (invoice.period) {
                invoice.period = (0, periodHelper_1.formatPeriodToMonth)(invoice.period, invoice.due_date);
            }
            // Get invoice items
            const [items] = await conn.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [req.params.id]);
            // Get discounts
            const [discounts] = await conn.query('SELECT * FROM discounts WHERE invoice_id = ?', [req.params.id]);
            invoice.items = items || [];
            invoice.discounts = discounts || [];
            res.render('billing/tagihan-print', {
                title: `Print Invoice ${invoice.invoice_number}`,
                invoice,
                items,
                discounts,
                layout: false
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading print invoice:', error);
        res.status(500).send('Error loading invoice');
    }
});
// Print invoice (Thermal)
router.get('/tagihan/:id/print-thermal', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            // Get invoice with customer info
            const [invoices] = await conn.query(`SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.address as customer_address,
                    c.customer_code,
                    i.period as raw_period,
                    (SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as total_balance,
                    (SELECT GROUP_CONCAT(period ORDER BY period ASC) FROM invoices WHERE customer_id = i.customer_id AND status IN ('unpaid', 'sent', 'partial', 'overdue')) as unpaid_periods
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?`, [req.params.id]);
            if (invoices.length === 0) {
                return res.status(404).send('Invoice not found');
            }
            const invoice = invoices[0];
            // Format period
            if (invoice.period) {
                invoice.period = (0, periodHelper_1.formatPeriodToMonth)(invoice.period, invoice.due_date);
            }
            // Get invoice items
            const [items] = await conn.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [req.params.id]);
            // Get discounts
            const [discounts] = await conn.query('SELECT * FROM discounts WHERE invoice_id = ?', [req.params.id]);
            invoice.items = items || [];
            invoice.discounts = discounts || [];
            res.render('billing/tagihan-print-thermal', {
                title: `Print Thermal ${invoice.invoice_number}`,
                invoice,
                items,
                discounts,
                layout: false
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading thermal print invoice:', error);
        res.status(500).send('Error loading invoice');
    }
});
// Send invoice via WhatsApp
router.post('/tagihan/bulk-send-whatsapp', invoiceController.bulkSendInvoiceWhatsApp.bind(invoiceController));
router.post('/tagihan/:id/send-whatsapp', invoiceController.sendInvoiceWhatsApp.bind(invoiceController));
// Send paid invoice PDF
router.post('/tagihan/:id/send-paid-pdf', invoiceController.sendPaidInvoicePdf.bind(invoiceController));
// Invoice detail (harus di akhir karena :id catch-all)
router.get('/tagihan/:id', invoiceController.getInvoiceDetail.bind(invoiceController));
// Delete bulk invoices
router.post('/tagihan/bulk-delete', invoiceController.bulkDeleteInvoices.bind(invoiceController));
// Delete invoice
router.delete('/tagihan/:id', invoiceController.deleteInvoice.bind(invoiceController));
// ========================================
// CUSTOMER ISOLATION / RESTORE
// ========================================
// Isolate customer
router.post('/customer/isolate', async (req, res) => {
    try {
        const { customerId, reason } = req.body;
        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        const isolationData = {
            customer_id: parseInt(customerId),
            action: 'isolate',
            reason: reason || 'Manual isolation from billing system',
            performed_by: req.session?.user?.username || 'admin'
        };
        const success = await IsolationService.isolateCustomer(isolationData);
        if (success) {
            res.json({
                success: true,
                message: 'Pelanggan berhasil diisolir'
            });
        }
        else {
            res.json({
                success: false,
                message: 'Gagal mengisolir pelanggan. Periksa koneksi MikroTik.'
            });
        }
    }
    catch (error) {
        console.error('Error isolating customer:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan saat mengisolir pelanggan'
        });
    }
});
// Restore customer
router.post('/customer/restore', async (req, res) => {
    try {
        const { customerId, reason } = req.body;
        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Customer ID is required' });
        }
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        const isolationData = {
            customer_id: parseInt(customerId),
            action: 'restore',
            reason: reason || 'Manual restoration from billing system',
            performed_by: req.session?.user?.username || 'admin'
        };
        const success = await IsolationService.isolateCustomer(isolationData);
        if (success) {
            res.json({
                success: true,
                message: 'Pelanggan berhasil dipulihkan'
            });
        }
        else {
            res.json({
                success: false,
                message: 'Gagal memulihkan pelanggan. Periksa koneksi MikroTik.'
            });
        }
    }
    catch (error) {
        console.error('Error restoring customer:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan saat memulihkan pelanggan'
        });
    }
});
// Get isolation statistics
router.get('/customer/isolation/api/stats', async (req, res) => {
    try {
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        const stats = await IsolationService.getStatistics();
        res.json({ success: true, data: stats });
    }
    catch (error) {
        console.error('Error getting isolation stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// Get isolation history
router.get('/customer/isolation/api/history', async (req, res) => {
    try {
        const { customerId, limit } = req.query;
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        const history = await IsolationService.getIsolationHistory(customerId ? parseInt(customerId) : undefined, limit ? parseInt(limit) : 50);
        res.json({ success: true, data: history });
    }
    catch (error) {
        console.error('Error getting isolation history:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// Isolated Customers Page
router.get('/customer/isolation/list', async (req, res) => {
    res.render('billing/isolated-customers', {
        title: 'Pelanggan Terisolasi',
        currentPath: req.baseUrl + req.path
    });
});
// API: Get isolated customers data
router.get('/customer/isolation/api/list', async (req, res) => {
    try {
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        const customers = await IsolationService.getIsolatedCustomers();
        res.json({ success: true, data: customers });
    }
    catch (error) {
        console.error('Error getting isolated customers:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// API: Get whitelisted customers data (exempt from isolation)
router.get('/customer/isolation/api/whitelist', async (req, res) => {
    try {
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        // const customers = await IsolationService.getIsolationWhitelist();
        const customers = []; // Temporary fix for missing method
        res.json({ success: true, data: customers });
    }
    catch (error) {
        console.error('Error getting isolation whitelist:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// API: Remove customer from isolation whitelist (cancel deferment)
router.post('/customer/isolation/api/remove-deferment', async (req, res) => {
    try {
        const { customerId } = req.body;
        if (!customerId)
            return res.status(400).json({ success: false, message: 'Customer ID required' });
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        const username = req.session?.username || 'admin';
        // const success = await IsolationService.removeIsolationDeferment(parseInt(customerId), username);
        const success = false; // Temporary fix for missing method
        // await (IsolationService as any).removeIsolationDeferment?.(parseInt(customerId), username); // Try catch-all if it exists but is poorly typed
        if (success) {
            res.json({ success: true, message: 'Berhasil membatalkan penangguhan.' });
        }
        else {
            res.status(500).json({ success: false, message: 'Gagal membatalkan penangguhan.' });
        }
    }
    catch (error) {
        console.error('Error removing isolation deferment:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// API: Get isolation watchlist (at risk or manual bypass)
router.get('/customer/isolation/api/watchlist', async (req, res) => {
    try {
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        // const watchlist = await IsolationService.getIsolationWatchlist();
        const watchlist = []; // Temporary fix for missing method
        res.json({ success: true, data: watchlist });
    }
    catch (error) {
        console.error('Error getting isolation watchlist:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// Watchlist view
router.get('/isolation-watchlist', async (req, res) => {
    res.render('billing/isolation-watchlist', {
        title: 'Pengecekan Isolasi Otomatis',
        currentPath: req.baseUrl + req.path
    });
});
// Trigger auto isolation manually (for testing)
router.post('/customer/isolation/trigger-auto', async (req, res) => {
    try {
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        const result = await IsolationService.autoIsolateOverdueCustomers();
        res.json({
            success: true,
            message: `Auto-isolation complete: ${result.isolated} isolated, ${result.failed} failed`,
            data: result
        });
    }
    catch (error) {
        console.error('Error triggering auto isolation:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// Trigger auto restore manually (for testing)
router.post('/customer/isolation/trigger-restore', async (req, res) => {
    try {
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        const result = await IsolationService.autoRestorePaidCustomers();
        res.json({
            success: true,
            message: `Auto-restore complete: ${result.restored} restored, ${result.failed} failed`,
            data: result
        });
    }
    catch (error) {
        console.error('Error triggering auto restore:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// API: Bulk restore all isolated customers without notification
router.post('/customer/isolation/bulk-restore-all-silent', async (req, res) => {
    try {
        const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../services/billing/isolationService')));
        const username = req.session?.user?.username || 'admin';
        const result = await IsolationService.bulkRestoreAllSilent(username);
        res.json({
            success: true,
            message: `Berhasil memulihkan ${result.restored} pelanggan tanpa notifikasi.${result.failed > 0 ? ` Gagal: ${result.failed}` : ''}`,
            data: result
        });
    }
    catch (error) {
        console.error('Error in bulk restore all silent:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// ========================================
// PAYMENT / PEMBAYARAN ROUTES
// ========================================
// Payment history
router.get('/payments', paymentController.getPaymentHistory.bind(paymentController));
// Resend notification
router.post('/payments/:id/resend-notification', paymentController.resendNotification.bind(paymentController));
// Payment history view
router.get('/payments/history', async (req, res) => {
    res.render('billing/payment-history', { title: 'Riwayat Pembayaran' });
});
// Payment detail
router.get('/payments/:id', async (req, res) => {
    // Will be implemented with PaymentController
    res.render('billing/payment-detail', { title: 'Detail Pembayaran' });
});
// Create payment form
router.get('/tagihan/:invoiceId/pay', async (req, res) => {
    try {
        console.log('[Payment Form] Loading for invoice ID:', req.params.invoiceId);
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            console.log('[Payment Form] Fetching invoice data...');
            const [invoices] = await conn.query(`SELECT 
                    i.*, 
                    c.id as customer_id, 
                    c.name as customer_name, 
                    c.phone as customer_phone,
                    c.customer_code,
                    c.connection_type, 
                    c.custom_sla_target 
                FROM invoices i 
                LEFT JOIN customers c ON i.customer_id = c.id 
                WHERE i.id = ?`, [req.params.invoiceId]);
            if (invoices.length === 0) {
                console.log('[Payment Form] Invoice not found');
                return res.status(404).send('Invoice not found');
            }
            const invoice = invoices[0];
            console.log('[Payment Form] Invoice found:', invoice.id, 'for customer:', invoice.customer_name);
            // Fetch ALL pending invoices for this customer to support selective multi-payment
            const [allPendingInvoices] = await conn.query(`SELECT i.*, 
                    (IF(i.id = ?, 1, 0)) as is_primary 
                 FROM invoices i 
                 WHERE i.customer_id = ? 
                 AND i.status IN ('sent', 'partial', 'overdue')
                 ORDER BY i.period ASC`, [invoice.id, invoice.customer_id]);
            // Fetch items for the primary invoice to show breakdown
            const [primaryItems] = await conn.query('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [invoice.id]);
            invoice.items = primaryItems || [];
            // Get SLA target from customer or package
            let slaTarget = 90.0; // Default fallback
            console.log('[Payment Form] Getting SLA target for customer:', invoice.customer_id);
            // Priority 1: Custom SLA target for this customer
            if (invoice.custom_sla_target && invoice.custom_sla_target > 0) {
                slaTarget = parseFloat(invoice.custom_sla_target);
                console.log('[Payment Form] Using custom SLA target:', slaTarget);
            }
            else {
                // Priority 2: SLA target from customer's package
                console.log('[Payment Form] Connection type:', invoice.connection_type);
                if (invoice.connection_type === 'pppoe') {
                    // Get package from subscriptions table
                    const [subscriptions] = await conn.query(`
                        SELECT package_id 
                        FROM subscriptions 
                        WHERE customer_id = ? AND status = 'active'
                        LIMIT 1
                    `, [invoice.customer_id]);
                    if (subscriptions.length > 0 && subscriptions[0].package_id) {
                        const [packages] = await conn.query('SELECT sla_target FROM pppoe_packages WHERE id = ? LIMIT 1', [subscriptions[0].package_id]);
                        if (packages.length > 0 && packages[0].sla_target) {
                            slaTarget = parseFloat(packages[0].sla_target);
                            console.log('[Payment Form] Using PPPoE package SLA target:', slaTarget);
                        }
                    }
                }
                else if (invoice.connection_type === 'static_ip') {
                    // Get package from static_ip_clients table
                    const [staticClients] = await conn.query(`
                        SELECT package_id 
                        FROM static_ip_clients 
                        WHERE customer_id = ?
                        LIMIT 1
                    `, [invoice.customer_id]);
                    if (staticClients.length > 0 && staticClients[0].package_id) {
                        const [packages] = await conn.query('SELECT sla_target FROM static_ip_packages WHERE id = ? LIMIT 1', [staticClients[0].package_id]);
                        if (packages.length > 0 && packages[0].sla_target) {
                            slaTarget = parseFloat(packages[0].sla_target);
                            console.log('[Payment Form] Using Static IP package SLA target:', slaTarget);
                        }
                    }
                }
            }
            console.log('[Payment Form] Final SLA target:', slaTarget);
            // Get SLA record for this customer and period
            let slaDiscount = null;
            if (invoice.customer_id && invoice.period) {
                // SLA Constants
                const TARGET_SLA = slaTarget || 90.0;
                const TOTAL_HOURS_MONTH = 720; // 30 days * 24 hours
                // Calculate period for SLA (Previous Month of Invoice Period)
                const invoiceDate = new Date(`${invoice.period}-01`);
                const slaDate = new Date(invoiceDate);
                slaDate.setMonth(slaDate.getMonth() - 1);
                const slaYear = slaDate.getFullYear();
                const slaMonth = (slaDate.getMonth() + 1).toString().padStart(2, '0');
                const slaPeriod = `${slaYear}-${slaMonth}`;
                const slaStartDate = `${slaPeriod}-01 00:00:00`;
                const slaEndDate = new Date(slaYear, slaDate.getMonth() + 1, 0, 23, 59, 59).toISOString().slice(0, 19).replace('T', ' ');
                console.log(`[SLA] Checking tickets for period: ${slaPeriod} (${slaStartDate} to ${slaEndDate}) for Invoice Period: ${invoice.period}`);
                // Query closed tickets in this period
                const [tickets] = await conn.query(`
                    SELECT 
                        id, reported_at, resolved_at
                    FROM tickets
                    WHERE customer_id = ? 
                    AND reported_at >= ? 
                    AND reported_at <= ?
                    AND status IN ('closed', 'resolved')
                    AND resolved_at IS NOT NULL
                `, [invoice.customer_id, slaStartDate, slaEndDate]);
                let totalDowntimeMinutes = 0;
                const incidentCount = tickets.length;
                for (const ticket of tickets) {
                    const reported = new Date(ticket.reported_at);
                    const resolved = new Date(ticket.resolved_at);
                    const diffMs = resolved.getTime() - reported.getTime();
                    if (diffMs > 0) {
                        totalDowntimeMinutes += Math.floor(diffMs / 60000);
                    }
                }
                // Calculate Uptime
                const totalDowntimeHours = totalDowntimeMinutes / 60;
                const uptimeHours = TOTAL_HOURS_MONTH - totalDowntimeHours;
                let uptimePercentage = (uptimeHours / TOTAL_HOURS_MONTH) * 100;
                // Clamp uptime
                if (uptimePercentage > 100)
                    uptimePercentage = 100;
                if (uptimePercentage < 0)
                    uptimePercentage = 0;
                let discountPercentage = 0;
                let discountAmount = 0;
                // Calculate Discount: If Uptime < 90%, Discount = 90% - RealUptime%
                if (uptimePercentage < TARGET_SLA) {
                    discountPercentage = TARGET_SLA - uptimePercentage;
                    discountAmount = Math.round(parseFloat(invoice.total_amount) * (discountPercentage / 100));
                }
                slaDiscount = {
                    uptime_percentage: uptimePercentage,
                    sla_target: TARGET_SLA,
                    sla_met: uptimePercentage >= TARGET_SLA,
                    discount_percentage: discountPercentage,
                    discount_amount: discountAmount,
                    total_downtime_minutes: totalDowntimeMinutes,
                    incident_count: incidentCount,
                    applicable: true, // Always show monitoring even if no discount
                    sla_period: slaPeriod
                };
                console.log('[SLA] Result:', slaDiscount);
            }
            // Default SLA values
            let uptime = 100.0;
            let slaMet = true;
            if (slaDiscount) {
                uptime = slaDiscount.uptime_percentage;
                slaMet = slaDiscount.sla_met;
            }
            console.log('[Payment Form] Rendering view with SLA discount:', slaDiscount);
            // Get total unpaid debt across all invoices for this customer
            const [debtResult] = await conn.query(`SELECT SUM(remaining_amount) as total_debt 
                 FROM invoices 
                 WHERE customer_id = ? AND status IN ('sent', 'partial')`, [invoice.customer_id]);
            const totalDebt = debtResult[0]?.total_debt || 0;
            console.log(`[Payment Form] Customer total debt: ${totalDebt}`);
            return res.render('billing/payment-form', {
                title: 'Pembayaran Tagihan',
                invoice,
                allPendingInvoices,
                totalDebt,
                slaTarget,
                uptime,
                slaStatus: slaMet,
                layout: 'layouts/main',
                user: req.user,
                slaDiscount
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading payment form:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : '';
        console.error('Error details:', { message: errorMessage, stack: errorStack });
        res.status(500).send(`Internal Server Error: ${errorMessage}`);
    }
});
// Process payment via gateway
router.post('/payments/gateway', paymentController.processGatewayPayment.bind(paymentController));
// Process payment - UNIFIED (Handles full, partial, debt, multiple invoices)
router.post('/payments/process', paymentController.processPayment.bind(paymentController));
// Process payment - LEGACY HANDLERS (Consider deprecating)
router.post('/payments/full', paymentController.processPayment.bind(paymentController));
router.post('/payments/partial', paymentController.processPayment.bind(paymentController));
router.post('/payments/debt', paymentController.processPayment.bind(paymentController));
// Upload payment proof
router.post('/payments/:id/upload-proof', paymentController.uploadPaymentProof.bind(paymentController));
// Debt tracking
router.get('/debts', paymentController.getDebtTrackingList.bind(paymentController));
// Debt tracking view
router.get('/debts/view', async (req, res) => {
    res.render('billing/debt-tracking', { title: 'Pelacakan Hutang' });
});
// Debt detail
router.get('/debts/:id', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const [rows] = await conn.query('SELECT invoice_id FROM debt_tracking WHERE id = ?', [req.params.id]);
            if (rows && rows.length > 0) {
                res.redirect(`/billing/tagihan/${rows[0].invoice_id}`);
            }
            else {
                res.status(404).send('Hutang tidak ditemukan');
            }
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error getting debt detail:', error);
        res.status(500).send('Terjadi kesalahan internal');
    }
});
// Resolve debt
router.post('/debts/:id/resolve', paymentController.resolveDebt.bind(paymentController));
// ========================================
// PAYMENT GATEWAY INTEGRATION
// ========================================
// Create payment via gateway
router.post('/gateway/create-payment', gatewayController.createInvoicePayment.bind(gatewayController));
// Get invoice with payment options
router.get('/gateway/invoice/:invoiceId/customer/:customerId/options', gatewayController.getInvoiceWithPaymentOptions.bind(gatewayController));
// Get available payment methods for customer
router.get('/gateway/customer/:customerId/payment-methods', gatewayController.getAvailablePaymentMethods.bind(gatewayController));
// Create payment link
router.post('/gateway/invoice/:invoiceId/customer/:customerId/payment-link', gatewayController.createPaymentLink.bind(gatewayController));
// Payment gateway callback (webhook)
router.post('/gateway/callback/:gateway', async (req, res) => {
    // TODO: Implement gateway-specific callback handlers
    console.log('Payment gateway callback received:', req.params.gateway, req.body);
    res.json({ success: true, message: 'Callback received' });
});
// Get customer payment history via gateway
router.get('/gateway/customer/:customerId/history', gatewayController.getCustomerPaymentHistory.bind(gatewayController));
// Get payment statistics
router.get('/gateway/statistics', gatewayController.getPaymentStatistics.bind(gatewayController));
// ========================================
// SUBSCRIPTION / LANGGANAN ROUTES
// ========================================
// Subscription list
router.get('/subscriptions', async (req, res) => {
    try {
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const { status, search } = req.query;
            // Build query
            let query = `
                SELECT 
                    s.id,
                    s.customer_id,
                    s.package_id,
                    s.package_name,
                    s.price,
                    s.start_date,
                    s.end_date,
                    s.status,
                    s.created_at,
                    s.updated_at,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.address as customer_address,
                    c.connection_type,
                    o.name as odc_name,
                    o.location as odc_location
                FROM subscriptions s
                INNER JOIN customers c ON s.customer_id = c.id
                LEFT JOIN ftth_odc o ON c.odc_id = o.id
                WHERE 1=1
            `;
            const queryParams = [];
            // Filter by status
            if (status && status !== '') {
                query += ' AND s.status = ?';
                queryParams.push(status);
            }
            else {
                // Default: show active only
                query += ' AND s.status = ?';
                queryParams.push('active');
            }
            // Search filter
            if (search) {
                query += ' AND (c.name LIKE ? OR c.customer_code LIKE ? OR c.phone LIKE ? OR s.package_name LIKE ?)';
                const searchPattern = `%${search}%`;
                queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
            }
            query += ' ORDER BY s.created_at DESC';
            const [subscriptions] = await conn.query(query, queryParams);
            // Get statistics
            const [statsResult] = await conn.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
                    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_count,
                    SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_count
                FROM subscriptions
            `);
            const stats = statsResult[0] || { total: 0, active_count: 0, inactive_count: 0, suspended_count: 0 };
            res.render('billing/subscriptions', {
                title: 'Daftar Langganan',
                subscriptions,
                stats,
                filters: {
                    status: status || 'active',
                    search: search || ''
                }
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading subscriptions:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Gagal memuat daftar langganan'
        });
    }
});
// ========================================
// SCHEDULER ROUTES
// ========================================
// Scheduler settings
router.get('/scheduler/settings', async (req, res) => {
    try {
        // Get current scheduler settings
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            const [result] = await conn.query(`
                SELECT * FROM scheduler_settings WHERE task_name = 'invoice_generation'
            `);
            let settings = {
                auto_generate_enabled: true,
                generation_date: 1,
                generation_time: '01:00',
                cron_schedule: '0 1 1 * *',
                due_date_offset: 7,
                whatsapp_reminder_enabled: false,
                reminder_days_before: 3,
                auto_isolir_enabled: false,
                isolir_mode: 'fixed_date',
                isolir_date: 10,
                isolir_days_after_due: 1
            };
            if (result && result.length > 0) {
                const row = result[0];
                let config = {};
                if (typeof row.config === 'string' && row.config.trim()) {
                    try {
                        config = JSON.parse(row.config);
                    }
                    catch (e) {
                        console.error('[BillingRoute] Failed to parse config JSON in GET /scheduler/settings', e);
                        config = {};
                    }
                }
                else if (row.config) {
                    config = row.config;
                }
                // Parse cron to get generation date and time
                const cronParts = (row.cron_schedule || '0 1 1 * *').split(' ');
                const generationDate = parseInt(cronParts[2]) || 1;
                const generationHour = (cronParts[1] || '1').padStart(2, '0');
                const generationMinute = (cronParts[0] || '0').padStart(2, '0');
                settings = {
                    auto_generate_enabled: row.is_enabled === 1,
                    generation_date: generationDate,
                    generation_time: `${generationHour}:${generationMinute}`,
                    cron_schedule: row.cron_schedule || '0 1 1 * *',
                    due_date_offset: config.due_date_offset || 7,
                    whatsapp_reminder_enabled: config.whatsapp_reminder_enabled || false,
                    reminder_days_before: config.reminder_days_before || 3,
                    auto_isolir_enabled: config.auto_isolir_enabled || false,
                    isolir_mode: config.isolir_mode || 'fixed_date',
                    isolir_date: config.isolir_date || 10,
                    isolir_days_after_due: config.isolir_days_after_due || 1
                };
            }
            res.render('billing/scheduler-settings', {
                title: 'Pengaturan Scheduler & Otomasi',
                settings
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error loading scheduler settings:', error);
        // Render with default settings on error
        res.render('billing/scheduler-settings', {
            title: 'Pengaturan Scheduler & Otomasi',
            settings: {
                auto_generate_enabled: true,
                generation_date: 1,
                generation_time: '01:00',
                cron_schedule: '0 1 1 * *',
                due_date_offset: 7,
                whatsapp_reminder_enabled: false,
                reminder_days_before: 3,
                auto_isolir_enabled: false,
                isolir_mode: 'fixed_date',
                isolir_date: 10,
                isolir_days_after_due: 1
            }
        });
    }
});
// Update invoice generation settings
router.post('/scheduler/settings', async (req, res) => {
    try {
        const { auto_generate_enabled, cron_schedule, due_date_offset, enable_due_date, due_date_fixed_day } = req.body;
        await invoiceSchedulerService_1.InvoiceSchedulerService.updateSchedulerSettings({
            auto_generate_enabled: auto_generate_enabled === 'true' || auto_generate_enabled === true,
            cron_schedule,
            due_date_offset: parseInt(due_date_offset),
            due_date_fixed_day: parseInt(due_date_fixed_day),
            enable_due_date: enable_due_date === 'true' || enable_due_date === true
        });
        res.json({ success: true, message: 'Pengaturan tagihan berhasil disimpan' });
    }
    catch (error) {
        console.error('Error updating scheduler settings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// Update WhatsApp reminder settings - REMOVED
// router.post('/scheduler/whatsapp-settings', async (req, res) => {
//     ... WhatsApp settings route removed
// });
// Update auto isolir settings
router.post('/scheduler/isolir-settings', async (req, res) => {
    try {
        const { auto_isolir_enabled, isolir_mode, isolir_date, isolir_execution_time } = req.body;
        const conn = await Promise.resolve().then(() => __importStar(require('../db/pool'))).then(m => m.databasePool.getConnection());
        try {
            // Get current config
            const [result] = await conn.query(`
                SELECT config FROM scheduler_settings WHERE task_name = 'invoice_generation'
            `);
            let currentConfig = {};
            if (result && result.length > 0) {
                let config = result[0].config;
                if (typeof config === 'string' && config.trim()) {
                    try {
                        currentConfig = JSON.parse(config);
                    }
                    catch (e) {
                        console.error('[BillingRoute] Failed to parse config JSON in POST /scheduler/isolir-settings', e);
                        currentConfig = {};
                    }
                }
                else if (config) {
                    currentConfig = config;
                }
            }
            // Update isolir settings
            const newConfig = {
                ...currentConfig,
                auto_isolir_enabled: auto_isolir_enabled === 'true' || auto_isolir_enabled === true,
                isolir_mode,
                isolir_date: parseInt(isolir_date),
                isolir_execution_time: isolir_execution_time || '01:00'
            };
            await conn.execute(`
                UPDATE scheduler_settings 
                SET config = ?, updated_at = NOW()
                WHERE task_name = 'invoice_generation'
            `, [JSON.stringify(newConfig)]);
            // Update the actual scheduler job
            const { SchedulerService } = await Promise.resolve().then(() => __importStar(require('../services/scheduler')));
            const isolateDate = parseInt(isolir_date);
            const [hour, minute] = (isolir_execution_time || '01:00').split(':');
            await SchedulerService.updateAutoIsolationSchedule([isolateDate], auto_isolir_enabled === 'true' || auto_isolir_enabled === true, parseInt(hour), parseInt(minute));
            res.json({ success: true, message: 'Pengaturan auto isolir berhasil disimpan' });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error updating isolir settings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// Trigger manual scheduler run
router.post('/scheduler/run-now', async (req, res) => {
    try {
        const { period } = req.body;
        const result = await invoiceSchedulerService_1.InvoiceSchedulerService.triggerManualGeneration(period);
        res.json(result);
    }
    catch (error) {
        console.error('Error triggering scheduler:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// ========================================
// LATE PAYMENT MANAGEMENT
// ========================================
// Late payment dashboard
router.get('/late-payment', latePaymentController.dashboard.bind(latePaymentController));
// Late payment report
router.get('/late-payment/report', latePaymentController.report.bind(latePaymentController));
// Customer late payment detail
router.get('/late-payment/customer/:customerId', latePaymentController.customerDetail.bind(latePaymentController));
// API: Reset counter
router.post('/late-payment/customer/:customerId/reset', latePaymentController.resetCounter.bind(latePaymentController));
// API: Adjust counter
router.post('/late-payment/customer/:customerId/adjust', latePaymentController.adjustCounter.bind(latePaymentController));
// API: Batch reset
router.post('/late-payment/batch-reset', latePaymentController.batchReset.bind(latePaymentController));
// Export report
router.get('/late-payment/export', latePaymentController.exportReport.bind(latePaymentController));
// ========================================
// SYSTEM LOGS
// ========================================
// System logs page
router.get('/logs', SystemLogController_1.SystemLogController.getLogsPage.bind(SystemLogController_1.SystemLogController));
// API: Get logs
router.get('/logs/api', SystemLogController_1.SystemLogController.getLogs.bind(SystemLogController_1.SystemLogController));
// API: Get log statistics
router.get('/logs/api/statistics', SystemLogController_1.SystemLogController.getLogStatistics.bind(SystemLogController_1.SystemLogController));
// API: Get log details
router.get('/logs/api/:id', SystemLogController_1.SystemLogController.getLogDetails.bind(SystemLogController_1.SystemLogController));
// API: Get anomalies
router.get('/logs/api/anomalies', SystemLogController_1.SystemLogController.getAnomalies.bind(SystemLogController_1.SystemLogController));
// API: Resolve anomaly
router.post('/logs/api/anomalies/:id/resolve', SystemLogController_1.SystemLogController.resolveAnomaly.bind(SystemLogController_1.SystemLogController));
// API: Export logs
router.get('/logs/api/export', SystemLogController_1.SystemLogController.exportLogs.bind(SystemLogController_1.SystemLogController));
// ========================================
// PREPAID MANAGEMENT
// ========================================
const PrepaidAdminController_1 = require("../controllers/billing/PrepaidAdminController");
// Payment Monitoring
router.get('/prepaid/payments', PrepaidAdminController_1.PrepaidAdminController.paymentMonitoring.bind(PrepaidAdminController_1.PrepaidAdminController));
router.get('/prepaid/payments/:id', PrepaidAdminController_1.PrepaidAdminController.viewPaymentRequest.bind(PrepaidAdminController_1.PrepaidAdminController));
router.post('/prepaid/payments/:id/approve', PrepaidAdminController_1.PrepaidAdminController.approvePayment.bind(PrepaidAdminController_1.PrepaidAdminController));
router.post('/prepaid/payments/:id/reject', PrepaidAdminController_1.PrepaidAdminController.rejectPayment.bind(PrepaidAdminController_1.PrepaidAdminController));
// Reports & Analytics
router.get('/prepaid/reports', PrepaidAdminController_1.PrepaidAdminController.reports.bind(PrepaidAdminController_1.PrepaidAdminController));
// Voucher Management
router.get('/prepaid/vouchers', PrepaidAdminController_1.PrepaidAdminController.listVouchers.bind(PrepaidAdminController_1.PrepaidAdminController));
router.post('/prepaid/vouchers', PrepaidAdminController_1.PrepaidAdminController.createVoucher.bind(PrepaidAdminController_1.PrepaidAdminController));
router.put('/prepaid/vouchers/:id', PrepaidAdminController_1.PrepaidAdminController.updateVoucher.bind(PrepaidAdminController_1.PrepaidAdminController));
router.delete('/prepaid/vouchers/:id', PrepaidAdminController_1.PrepaidAdminController.deleteVoucher.bind(PrepaidAdminController_1.PrepaidAdminController));
// Referral Tracking
router.get('/prepaid/referrals', PrepaidAdminController_1.PrepaidAdminController.referralTracking.bind(PrepaidAdminController_1.PrepaidAdminController));
exports.default = router;
//# sourceMappingURL=billing.js.map