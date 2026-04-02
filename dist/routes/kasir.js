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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const kasirController_1 = require("../controllers/kasirController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const periodHelper_1 = require("../utils/periodHelper");
const router = (0, express_1.Router)();
const kasirController = new kasirController_1.KasirController();
const authMiddleware = new authMiddleware_1.AuthMiddleware();
// Middleware to force kasir layout for all kasir routes (except print pages)
const forceKasirLayout = (req, res, next) => {
    // Skip layout for print pages
    if (!req.path.startsWith('/print-checklist') &&
        !req.path.startsWith('/receipt') &&
        !req.path.startsWith('/print-invoice') &&
        !req.path.startsWith('/payment-records/print')) {
        res.locals.layout = 'layouts/kasir';
    }
    next();
};
// Kasir login routes
router.get('/login', authMiddleware.redirectIfAuthenticated, kasirController.loginForm.bind(kasirController));
router.post('/login', kasirController.login.bind(kasirController));
router.get('/logout', kasirController.logout.bind(kasirController));
// Protected kasir routes - auth first, then force layout
router.use(authMiddleware.requireAuth.bind(authMiddleware));
router.use(authMiddleware.requireKasir.bind(authMiddleware));
router.use(forceKasirLayout);
// Dashboard
router.get('/dashboard', kasirController.dashboard.bind(kasirController));
// Transactions
router.get('/transactions', kasirController.transactions.bind(kasirController));
router.post('/transactions', kasirController.processPayment.bind(kasirController));
// Payments
router.get('/payments', kasirController.payments.bind(kasirController));
router.post('/payments', kasirController.processPayment.bind(kasirController));
// Manual Verification
router.get('/manual-verifications', kasirController.manualVerifications.bind(kasirController));
router.post('/manual-verifications/:id/approve', kasirController.approveManualVerification.bind(kasirController));
router.post('/manual-verifications/:id/reject', kasirController.rejectManualVerification.bind(kasirController));
router.get('/api/manual-verifications', kasirController.getManualVerifications.bind(kasirController));
// Customer Detail (Premium Admin-like feature)
router.get('/customers/:id', kasirController.customerDetail.bind(kasirController));
// Search customer for payment
router.get('/api/search-customer', kasirController.searchCustomer.bind(kasirController));
router.get('/api/customer/:id/invoices', kasirController.getCustomerInvoices.bind(kasirController));
router.get('/api/payment/:id', kasirController.getPaymentDetail.bind(kasirController));
router.post('/api/deferment', kasirController.requestDeferment.bind(kasirController));
// Reports
router.get('/reports', kasirController.reports.bind(kasirController));
router.get('/reports/export', kasirController.exportReports.bind(kasirController));
// Debt list
router.get('/debt', kasirController.debtList.bind(kasirController));
// Action Desk: send payment notification
router.post('/api/send-notification/:paymentId', kasirController.sendPaymentNotificationAction.bind(kasirController));
router.post('/api/send-invoice-notification/:customerId', kasirController.sendInvoiceNotificationAction.bind(kasirController));
// Print routes
router.get('/print-group', kasirController.printGroup.bind(kasirController));
router.get('/print-checklist/:odc_id', kasirController.printChecklist.bind(kasirController));
// Print ODC - proxy to billing route with auth
router.get('/print-odc/:odc_id', async (req, res) => {
    try {
        const { databasePool } = await Promise.resolve().then(() => __importStar(require('../db/pool')));
        const conn = await databasePool.getConnection();
        try {
            const { odc_id } = req.params;
            const { period, format } = req.query;
            let odc;
            let invoicesQuery;
            const queryParams = [];
            if (odc_id === 'wireless') {
                odc = {
                    id: 'wireless',
                    name: 'Wireless / Tanpa ODP',
                    location: 'Area Wireless (Non-Fiber)',
                };
                invoicesQuery = `
                    SELECT 
                        i.id,
                        i.invoice_number,
                        i.customer_id,
                        i.period,
                        i.due_date,
                        i.total_amount,
                        i.paid_amount,
                        i.status,
                        i.created_at,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        c.address as customer_address,
                        c.customer_code
                    FROM invoices i
                    INNER JOIN customers c ON i.customer_id = c.id
                    WHERE c.odc_id IS NULL
                    AND (c.exclude_from_print = 0 OR c.exclude_from_print IS NULL)
                    AND i.status IN ('sent', 'partial', 'overdue')
                `;
            }
            else {
                // Get ODC info
                const [odcResult] = await conn.query('SELECT * FROM ftth_odc WHERE id = ?', [odc_id]);
                if (odcResult.length === 0) {
                    return res.status(404).send('ODC not found');
                }
                odc = odcResult[0];
                // Get invoices for this ODC
                invoicesQuery = `
                    SELECT 
                        i.id,
                        i.invoice_number,
                        i.customer_id,
                        i.period,
                        i.due_date,
                        i.total_amount,
                        i.paid_amount,
                        i.status,
                        i.created_at,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        c.address as customer_address,
                        c.customer_code
                    FROM invoices i
                    INNER JOIN customers c ON i.customer_id = c.id
                    WHERE c.odc_id = ?
                    AND (c.exclude_from_print = 0 OR c.exclude_from_print IS NULL)
                    AND i.status IN ('sent', 'partial', 'overdue')
                `;
                queryParams.push(odc_id);
            }
            if (period) {
                invoicesQuery += ' AND i.period = ?';
                queryParams.push(period);
            }
            invoicesQuery += ' ORDER BY c.name ASC';
            const [invoices] = await conn.query(invoicesQuery, queryParams);
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
            // Choose view based on format
            let viewName;
            if (odc_id === 'wireless') {
                // Wireless – tidak ada ODC, gunakan template khusus
                viewName = format === 'thermal'
                    ? 'invoice/template-wireless' // thermal 58mm
                    : 'invoice/template-a4'; // PDF A4 (sama dengan standar)
            }
            else {
                viewName = format === 'thermal'
                    ? 'invoice/template-thermal' // ODC thermal
                    : 'invoice/template-a4'; // ODC PDF A4
            }
            res.render(viewName, {
                title: odc_id === 'wireless' ? 'Print Tagihan Wireless' : `Print Tagihan Area ${odc.name}`,
                odc,
                invoices,
                period: period || 'Semua Periode',
                format: format || 'thermal',
                layout: false // No layout for print pages
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
// Print all - proxy to billing route with auth
router.get('/print-all', async (req, res) => {
    try {
        const { databasePool } = await Promise.resolve().then(() => __importStar(require('../db/pool')));
        const conn = await databasePool.getConnection();
        try {
            const { status, odc_id, search, period, format } = req.query;
            // Build query
            let query = `
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.customer_id,
                    i.period,
                    i.due_date,
                    i.total_amount,
                    i.paid_amount,
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
                WHERE i.status IN ('sent', 'partial', 'overdue')
                AND (c.exclude_from_print = 0 OR c.exclude_from_print IS NULL)
                AND i.period = DATE_FORMAT(CURDATE(), '%Y-%m')
            `;
            const queryParams = [];
            if (status && status !== 'paid') {
                query = query.replace("WHERE i.status IN ('sent', 'partial')", 'WHERE i.status = ?');
                queryParams.push(status);
            }
            else if (status === 'paid') {
                // Return empty if specifically asking for paid in bulk print
                query = query.replace("WHERE i.status IN ('sent', 'partial')", 'WHERE 1=0');
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
            else {
                // Default to current month if no period specified to exclude old month invoices like Sadida
                query += " AND i.period = DATE_FORMAT(CURDATE(), '%Y-%m')";
            }
            query += ' ORDER BY o.name ASC, c.name ASC';
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
            // Choose view based on format
            const viewName = format === 'thermal'
                ? 'billing/tagihan-print-all'
                : 'billing/tagihan-print-all-a4';
            res.render(viewName, {
                title: 'Print Semua Tagihan',
                invoices,
                filters: { status, odc_id, search, period },
                format: format || 'thermal',
                layout: false // No layout for print pages
            });
        }
        finally {
            conn.release();
        }
    }
    catch (error) {
        console.error('Error printing all invoices:', error);
        res.status(500).send('Error loading invoices');
    }
});
// Print receipt after payment
router.get('/receipt/:paymentId', kasirController.printReceipt.bind(kasirController));
// Print invoice individual
router.get('/print-invoice/:invoiceId', kasirController.printInvoice.bind(kasirController));
// Export and print payment records
router.get('/payment-records/export', kasirController.exportPaymentRecords.bind(kasirController));
router.get('/payment-records/print/:paymentId', kasirController.printPaymentRecord.bind(kasirController));
exports.default = router;
//# sourceMappingURL=kasir.js.map