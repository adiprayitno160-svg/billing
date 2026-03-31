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
exports.KasirController = void 0;
const userService_1 = require("../services/userService");
const pool_1 = require("../db/pool");
const XLSX = __importStar(require("xlsx"));
const periodHelper_1 = require("../utils/periodHelper");
const isolationService_1 = require("../services/billing/isolationService");
class KasirController {
    constructor() {
        this.userService = new userService_1.UserService();
    }
    // Halaman login kasir
    async loginForm(req, res) {
        try {
            // Tangkap pesan dari query string
            const successMessage = req.query.success;
            const errorMessage = req.query.error;
            // Set flash message jika ada
            if (successMessage) {
                req.flash('success', successMessage);
            }
            if (errorMessage) {
                req.flash('error', errorMessage);
            }
            res.render('kasir/login', {
                title: 'Login Kasir',
                currentPath: '/kasir/login',
                layout: false // Tidak menggunakan layout untuk halaman login
            });
        }
        catch (error) {
            console.error('Error loading kasir login form:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman login kasir'
            });
        }
    }
    // Proses login kasir
    async login(req, res) {
        try {
            const { username, password } = req.body;
            // Validasi input
            if (!username || !password) {
                req.flash('error', 'Username dan password harus diisi');
                res.redirect('/kasir/login');
                return;
            }
            // Cari user berdasarkan username
            const user = await this.userService.getUserByUsername(username);
            if (!user) {
                req.flash('error', 'Username atau password salah');
                res.redirect('/kasir/login');
                return;
            }
            // Cek apakah user aktif
            if (!user.is_active) {
                req.flash('error', 'Akun tidak aktif');
                res.redirect('/kasir/login');
                return;
            }
            // Cek role kasir
            if (user.role !== 'kasir') {
                req.flash('error', 'Akses ditolak. Hanya kasir yang dapat login');
                res.redirect('/kasir/login');
                return;
            }
            // Verifikasi password
            const isValidPassword = await this.userService.verifyPassword(user.id, password);
            if (!isValidPassword) {
                req.flash('error', 'Username atau password salah');
                res.redirect('/kasir/login');
                return;
            }
            // Set session
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.username = user.username;
            req.flash('success', `Selamat datang, ${user.full_name}!`);
            res.redirect('/kasir/dashboard');
        }
        catch (error) {
            console.error('Error during kasir login:', error);
            req.flash('error', 'Terjadi kesalahan saat login');
            res.redirect('/kasir/login');
        }
    }
    // Logout kasir
    async logout(req, res) {
        try {
            // Simpan pesan flash sebelum destroy session
            const userId = req.session?.userId;
            const username = req.session?.username;
            // Log untuk tracking
            if (userId) {
                console.log(`Kasir ${username} (ID: ${userId}) logged out at ${new Date().toISOString()}`);
            }
            // Destroy session
            req.session?.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                    res.redirect('/kasir/login?error=Gagal logout, silakan coba lagi');
                    return;
                }
                // Clear cookie
                res.clearCookie('billing_sid');
                // Redirect ke login dengan pesan sukses
                res.redirect('/kasir/login?success=Anda telah berhasil logout');
            });
        }
        catch (error) {
            console.error('Error during logout:', error);
            res.redirect('/kasir/login?error=Terjadi kesalahan saat logout');
        }
    }
    // Dashboard kasir
    async dashboard(req, res) {
        try {
            // Ambil data statistik untuk dashboard kasir
            const stats = await this.getKasirStats();
            res.render('kasir/dashboard', {
                title: 'Dashboard Kasir',
                currentPath: '/kasir/dashboard',
                user: req.user,
                stats: stats,
                layout: 'layouts/kasir'
            });
        }
        catch (error) {
            console.error('Error loading kasir dashboard:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat dashboard kasir'
            });
        }
    }
    // Halaman transaksi kasir
    async transactions(req, res) {
        try {
            const { page = 1, limit = 10, search = '', status = '' } = req.query;
            // Ambil data transaksi dengan pagination
            const transactions = await this.getTransactions(parseInt(page), parseInt(limit), search, status);
            res.render('kasir/transactions', {
                title: 'Transaksi Kasir',
                currentPath: '/kasir/transactions',
                user: req.user,
                transactions: transactions.data,
                pagination: transactions.pagination,
                search: search,
                status: status,
                layout: 'layouts/kasir'
            });
        }
        catch (error) {
            console.error('Error loading kasir transactions:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat data transaksi'
            });
        }
    }
    // Halaman pembayaran kasir
    async payments(req, res) {
        try {
            const conn = await pool_1.databasePool.getConnection();
            try {
                // Get all active customers with their invoice status
                const [recentCustomers] = await conn.query(`
                    SELECT 
                        c.id,
                        c.customer_code,
                        c.name,
                        c.phone,
                        c.address,
                        c.status,
                        COALESCE(c.is_isolated, 0) as is_isolated,
                        c.pppoe_profile_id,
                        c.created_at,
                        c.updated_at,
                        pp.name as package_name,
                        (SELECT COUNT(*) FROM invoices 
                         WHERE customer_id = c.id 
                         AND status IN ('sent', 'partial', 'overdue')) as pending_count,
                        (SELECT GROUP_CONCAT(period SEPARATOR ', ') FROM invoices 
                         WHERE customer_id = c.id 
                         AND status IN ('sent', 'partial', 'overdue')) as pending_periods,
                        (SELECT SUM(total_amount - paid_amount) FROM invoices 
                         WHERE customer_id = c.id 
                         AND status IN ('sent', 'partial', 'overdue')) as total_pending,
                        (SELECT COUNT(*) FROM payment_verifications pv
                         WHERE pv.customer_id = c.id 
                         AND pv.status = 'approved' 
                         AND pv.confidence_score >= 80) > 0 as ai_verified
                    FROM customers c
                    LEFT JOIN pppoe_profiles pp ON c.pppoe_profile_id = pp.id
                    WHERE (SELECT COUNT(*) FROM invoices 
                           WHERE customer_id = c.id 
                           AND status IN ('sent', 'partial', 'overdue')) > 0
                    ORDER BY 
                        CASE 
                            WHEN c.is_isolated = 1 THEN 1
                            ELSE 2
                        END,
                        c.updated_at DESC
                    LIMIT 100
                `);
                res.render('kasir/payments', {
                    title: 'Proses Pembayaran',
                    currentPath: '/kasir/payments',
                    user: req.user,
                    recentCustomers: recentCustomers,
                    layout: 'layouts/kasir'
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error loading kasir payments:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman pembayaran'
            });
        }
    }
    // Search customer API
    async searchCustomer(req, res) {
        try {
            const { q } = req.query;
            if (!q || typeof q !== 'string') {
                res.json({ success: false, message: 'Query tidak valid' });
                return;
            }
            const conn = await pool_1.databasePool.getConnection();
            try {
                const [customers] = await conn.query(`
                    SELECT 
                        c.*,
                        pp.name as package_name,
                        (SELECT COUNT(*) FROM invoices 
                         WHERE customer_id = c.id 
                         AND status IN ('sent', 'partial', 'overdue')) as pending_count,
                        (SELECT GROUP_CONCAT(period SEPARATOR ', ') FROM invoices 
                         WHERE customer_id = c.id 
                         AND status IN ('sent', 'partial', 'overdue')) as pending_periods
                    FROM customers c
                    LEFT JOIN pppoe_profiles pp ON c.pppoe_profile_id = pp.id
                    WHERE (c.customer_code LIKE ? 
                       OR c.name LIKE ? 
                       OR c.phone LIKE ?
                       OR c.pppoe_username LIKE ?)
                       AND (SELECT COUNT(*) FROM invoices 
                            WHERE customer_id = c.id 
                            AND status IN ('sent', 'partial', 'overdue')) > 0
                    LIMIT 20
                `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
                res.json({ success: true, data: customers });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error searching customer:', error);
            res.json({ success: false, message: 'Gagal mencari pelanggan' });
        }
    }
    // Get customer invoices API
    async getCustomerInvoices(req, res) {
        try {
            const { id } = req.params;
            const { status, includeItems, sort } = req.query;
            const conn = await pool_1.databasePool.getConnection();
            try {
                let query = `
                    SELECT id, invoice_number, customer_id, subscription_id, period, due_date, subtotal, discount_amount, total_amount, paid_amount, remaining_amount, status, notes, created_at, updated_at FROM invoices
                    WHERE customer_id = ?
                `;
                const params = [id];
                if (status === 'paid') {
                    query += " AND status = 'paid'";
                }
                else if (status === 'all') {
                    // No filter
                }
                else {
                    query += " AND status IN ('sent', 'partial', 'overdue')";
                }
                // Default to DESC (newest first) but support ASC (oldest first for payment selection)
                const sortDir = sort === 'asc' ? 'ASC' : 'DESC';
                query += ` ORDER BY period ${sortDir}`;
                const [invoices] = await conn.query(query, params);
                // Fetch items if requested
                if (includeItems === 'true' && invoices.length > 0) {
                    const invoiceIds = invoices.map(i => i.id);
                    const [items] = await conn.query('SELECT * FROM invoice_items WHERE invoice_id IN (?)', [invoiceIds]);
                    // Group items by invoice_id
                    const itemsMap = {};
                    items.forEach(item => {
                        if (!itemsMap[item.invoice_id])
                            itemsMap[item.invoice_id] = [];
                        itemsMap[item.invoice_id].push(item);
                    });
                    // Add items to invoices
                    invoices.forEach(inv => {
                        inv.items = itemsMap[inv.id] || [];
                    });
                }
                res.json({ success: true, data: invoices });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error getting customer invoices:', error);
            res.json({ success: false, message: 'Gagal mengambil data tagihan' });
        }
    }
    // Get payment detail API
    async getPaymentDetail(req, res) {
        try {
            const { id } = req.params;
            const conn = await pool_1.databasePool.getConnection();
            try {
                const [payments] = await conn.query(`
                    SELECT 
                        p.*,
                        c.customer_code,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        c.address,
                        i.invoice_number,
                        i.period,
                        i.total_amount as invoice_total,
                        u.full_name as kasir_name
                    FROM payments p
                    LEFT JOIN invoices i ON p.invoice_id = i.id
                    LEFT JOIN customers c ON i.customer_id = c.id
                    LEFT JOIN users u ON p.created_by = u.id
                    WHERE p.id = ?
                `, [id]);
                if (payments && payments.length > 0) {
                    res.json({ success: true, data: payments[0] });
                }
                else {
                    res.json({ success: false, message: 'Data payment tidak ditemukan' });
                }
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error getting payment detail:', error);
            res.json({ success: false, message: 'Gagal mengambil detail payment' });
        }
    }
    // Customer Detail for Kasir (Premium Feature)
    async customerDetail(req, res) {
        try {
            const { id } = req.params;
            const customerId = parseInt(id);
            if (!customerId || isNaN(customerId)) {
                return res.status(404).render('error', {
                    title: 'Not Found',
                    message: 'Pelanggan tidak ditemukan'
                });
            }
            const conn = await pool_1.databasePool.getConnection();
            try {
                // Get customer with related data
                const [customers] = await conn.query(`
                    SELECT 
                        c.*,
                        sic.ip_address as static_ip_address,
                        sic.interface as static_ip_interface,
                        s.package_name as postpaid_package_name,
                        s.price as subscription_price,
                        sp.name as static_ip_package_name,
                        sp.price as static_ip_package_price,
                        pp.name as pppoe_package_name,
                        pp.price as pppoe_package_price,
                        olt.name as olt_name,
                        odc.name as odc_name,
                        odp.name as odp_name
                    FROM customers c
                    LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
                    LEFT JOIN pppoe_packages pp ON c.pppoe_profile_id = pp.id 
                    LEFT JOIN static_ip_clients sic ON c.id = sic.customer_id AND c.connection_type = 'static_ip'
                    LEFT JOIN static_ip_packages sp ON sic.package_id = sp.id
                    LEFT JOIN ftth_odc odc ON c.odc_id = odc.id
                    LEFT JOIN ftth_odp odp ON c.odp_id = odp.id
                    LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
                    WHERE c.id = ?
                    LIMIT 1
                `, [customerId]);
                if (!customers || customers.length === 0) {
                    return res.status(404).render('error', {
                        title: 'Not Found',
                        message: 'Pelanggan tidak ditemukan'
                    });
                }
                const customer = customers[0];
                // Ensure basic properties exist to prevent EJS crashes
                customer.status = customer.status || 'inactive';
                customer.connection_type = customer.connection_type || 'unknown';
                customer.customer_code = customer.customer_code || 'N/A';
                customer.name = customer.name || 'Unknown Pelanggan';
                // Get customer invoices
                const [invoices] = await conn.query("SELECT * FROM invoices WHERE customer_id = ? ORDER BY period DESC LIMIT 24", [customerId]);
                // Get recent payments for this customer (payments links to customers via invoices)
                const [payments] = await conn.query(`
                    SELECT p.*, i.invoice_number, i.period
                    FROM payments p
                    JOIN invoices i ON p.invoice_id = i.id
                    WHERE i.customer_id = ?
                    ORDER BY p.created_at DESC
                    LIMIT 10
                `, [customerId]);
                // Calculate total debt
                const [debtResult] = await conn.query("SELECT SUM(total_amount - paid_amount) as total_debt FROM invoices WHERE customer_id = ? AND status IN ('sent', 'partial', 'overdue')", [customerId]);
                const totalDebt = debtResult[0]?.total_debt || 0;
                res.render('kasir/customer-detail', {
                    title: `Profil: ${customer.name}`,
                    currentPath: '/kasir/payments',
                    user: req.user,
                    customer: customer,
                    invoices: invoices,
                    payments: payments,
                    totalDebt: totalDebt,
                    layout: 'layouts/kasir'
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error loading kasir customer detail:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat detail pelanggan'
            });
        }
    }
    // Halaman print individual
    async printIndividual(req, res) {
        try {
            res.render('kasir/print', {
                title: 'Print Tagihan Individual',
                currentPath: '/kasir/print',
                user: req.user,
                layout: 'layouts/kasir'
            });
        }
        catch (error) {
            console.error('Error loading print individual:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman print'
            });
        }
    }
    // Halaman print kelompok
    async printGroup(req, res) {
        try {
            const conn = await pool_1.databasePool.getConnection();
            try {
                // Get list of ODC with customer count
                const [odcList] = await conn.query(`
                    SELECT 
                        o.*,
                        COUNT(DISTINCT c.id) as customer_count,
                        COUNT(DISTINCT i.id) as pending_invoice_count
                    FROM ftth_odc o
                    LEFT JOIN customers c ON c.odc_id = o.id
                    LEFT JOIN invoices i ON i.customer_id = c.id 
                        AND i.status IN ('sent', 'partial', 'overdue')
                    GROUP BY o.id
                    ORDER BY o.name ASC
                `);
                // Get wireless stats (No ODC)
                const [wirelessStats] = await conn.query(`
                    SELECT 
                        COUNT(DISTINCT c.id) as customer_count,
                        COUNT(DISTINCT i.id) as pending_invoice_count
                    FROM customers c
                    LEFT JOIN invoices i ON i.customer_id = c.id 
                        AND i.status IN ('sent', 'partial', 'overdue')
                    WHERE c.odc_id IS NULL AND c.status = 'active'
                `);
                const wireless = wirelessStats[0];
                if (wireless && wireless.customer_count > 0) {
                    odcList.push({
                        id: 'wireless',
                        olt_id: null,
                        name: 'Wireless / Tanpa ODP',
                        location: 'N/A',
                        latitude: null,
                        longitude: null,
                        total_ports: 0,
                        used_ports: 0,
                        notes: 'Pelanggan tanpa alokasi ODP',
                        created_at: new Date(),
                        updated_at: new Date(),
                        customer_count: wireless.customer_count,
                        pending_invoice_count: wireless.pending_invoice_count
                    });
                }
                // Get invoice statistics
                const [stats] = await conn.query(`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as pending,
                        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
                        SUM(total_amount - paid_amount) as total_amount
                    FROM invoices
                    WHERE status IN ('sent', 'partial', 'overdue')
                `);
                res.render('kasir/print-group', {
                    title: 'Print Tagihan Kelompok',
                    currentPath: '/kasir/print-group',
                    user: req.user,
                    odcList: odcList,
                    stats: stats[0] || {},
                    layout: 'layouts/kasir'
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error loading print group:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman print kelompok'
            });
        }
    }
    // Print checklist for ODC
    async printChecklist(req, res) {
        try {
            console.log('=== PRINT CHECKLIST CALLED ===');
            const { odc_id } = req.params;
            const { format = 'a4' } = req.query; // Default to A4
            console.log('ODC ID:', odc_id, 'Format:', format);
            const conn = await pool_1.databasePool.getConnection();
            try {
                let odc;
                let customers = [];
                if (odc_id === 'wireless') {
                    odc = {
                        id: 'wireless',
                        name: 'Wireless / Tanpa ODP',
                        location: '-',
                        latitude: null,
                        longitude: null,
                        total_ports: 0,
                        used_ports: 0,
                        notes: 'Area pelanggan tanpa ODP'
                    };
                    const [wirelessCustomers] = await conn.query(`
                        SELECT 
                            c.id,
                            c.customer_code,
                            c.name,
                            c.phone,
                            c.address,
                            c.status,
                            i.invoice_number,
                            i.period,
                            i.total_amount,
                            i.paid_amount,
                            i.status as invoice_status,
                            i.due_date,
                            COALESCE(i.total_amount - i.paid_amount, 0) as remaining_amount
                        FROM customers c
                        LEFT JOIN invoices i ON i.customer_id = c.id 
                            AND i.status IN ('sent', 'partial', 'overdue')
                        WHERE c.odc_id IS NULL
                        ORDER BY c.name ASC
                    `);
                    customers = wirelessCustomers;
                }
                else {
                    // Get ODC info
                    const [odcResult] = await conn.query('SELECT id, olt_id, name, location, latitude, longitude, total_ports, used_ports, notes, created_at, updated_at FROM ftth_odc WHERE id = ?', [odc_id]);
                    if (odcResult.length === 0) {
                        res.status(404).send('ODC tidak ditemukan');
                        return;
                    }
                    odc = odcResult[0];
                    // Get customers with invoices in this ODC
                    const [odcCustomers] = await conn.query(`
                        SELECT 
                            c.id,
                            c.customer_code,
                            c.name,
                            c.phone,
                            c.address,
                            c.status,
                            i.invoice_number,
                            i.period,
                            i.total_amount,
                            i.paid_amount,
                            i.status as invoice_status,
                            i.due_date,
                            COALESCE(i.total_amount - i.paid_amount, 0) as remaining_amount
                        FROM customers c
                        LEFT JOIN invoices i ON i.customer_id = c.id 
                            AND i.status IN ('sent', 'partial', 'overdue')
                        WHERE c.odc_id = ?
                        ORDER BY c.name ASC
                    `, [odc_id]);
                    customers = odcCustomers;
                }
                const printDate = new Date().toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
                // Choose template based on format
                const template = format === 'thermal' ? 'kasir/print-checklist-thermal' : 'kasir/print-checklist';
                res.render(template, {
                    title: `Checklist Tagihan - ${odc.name}`,
                    odc: odc,
                    customers: customers,
                    printDate: printDate,
                    layout: false // No layout for print page
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error generating checklist:', error);
            res.status(500).send('Gagal membuat checklist');
        }
    }
    // Print receipt
    async printReceipt(req, res) {
        try {
            const { paymentId } = req.params;
            const conn = await pool_1.databasePool.getConnection();
            try {
                // Get the main payment
                const [payments] = await conn.query(`
                    SELECT 
                        p.*,
                        c.id as customer_id,
                        c.customer_code,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        c.address,
                        i.invoice_number,
                        i.period,
                        i.due_date,
                        i.total_amount as invoice_total,
                        pp.name as package_name,
                        u.full_name as kasir_name
                    FROM payments p
                    LEFT JOIN invoices i ON p.invoice_id = i.id
                    LEFT JOIN customers c ON i.customer_id = c.id
                    LEFT JOIN pppoe_profiles pp ON c.pppoe_profile_id = pp.id
                    LEFT JOIN users u ON p.created_by = u.id
                    WHERE p.id = ?
                `, [paymentId]);
                if (!payments || payments.length === 0) {
                    res.status(404).render('error', {
                        title: 'Error',
                        message: 'Data pembayaran tidak ditemukan'
                    });
                    return;
                }
                const mainPayment = payments[0];
                // Find other payments for the same customer made by the same kasir within the last 2 minutes
                // This will catch multi-invoice payments initiated at once
                const [sessionPayments] = await conn.query(`
                    SELECT p.*, i.period, i.due_date, i.invoice_number 
                    FROM payments p
                    JOIN invoices i ON p.invoice_id = i.id
                    WHERE i.customer_id = ? 
                    AND p.created_by = ?
                    AND p.created_at >= DATE_SUB(?, INTERVAL 2 MINUTE)
                    AND p.created_at <= DATE_ADD(?, INTERVAL 2 MINUTE)
                    ORDER BY i.period ASC
                `, [mainPayment.customer_id, mainPayment.created_by, mainPayment.created_at, mainPayment.created_at]);
                // Summarize paid periods
                const summary = sessionPayments.map(p => {
                    const month = (0, periodHelper_1.formatPeriodToMonth)(p.period, p.due_date);
                    return {
                        period: month,
                        amount: p.amount,
                        invoice_number: p.invoice_number
                    };
                });
                const totalPaidAmount = summary.reduce((sum, item) => sum + parseFloat(item.amount), 0);
                // Get remaining debts
                const [debts] = await conn.query(`
                    SELECT period, due_date, remaining_amount, invoice_number 
                    FROM invoices 
                    WHERE customer_id = ? 
                    AND status IN ('sent', 'partial', 'overdue')
                    ORDER BY period ASC
                `, [mainPayment.customer_id]);
                const debtSummary = debts.map(d => ({
                    period: (0, periodHelper_1.formatPeriodToMonth)(d.period, d.due_date),
                    amount: d.remaining_amount,
                    invoice_number: d.invoice_number
                }));
                res.render('kasir/receipt', {
                    title: `Receipt #${paymentId}`,
                    payment: mainPayment,
                    allPayments: summary,
                    totalPaid: totalPaidAmount,
                    debts: debtSummary,
                    layout: false
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error printing receipt:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal mencetak receipt'
            });
        }
    }
    // Halaman laporan kasir
    async reports(req, res) {
        try {
            const { startDate, endDate, type = 'daily' } = req.query;
            // Ambil data laporan
            const reports = await this.getKasirReports(startDate, endDate, type);
            res.render('kasir/reports', {
                title: 'Laporan Kasir',
                currentPath: '/kasir/reports',
                user: req.user,
                reports: reports,
                startDate: startDate,
                endDate: endDate,
                type: type,
                layout: 'layouts/kasir'
            });
        }
        catch (error) {
            console.error('Error loading kasir reports:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat laporan'
            });
        }
    }
    // Export laporan kasir ke Excel
    async exportReports(req, res) {
        try {
            const { startDate, endDate, type = 'daily' } = req.query;
            // Ambil data laporan
            const reports = await this.getKasirReports(startDate, endDate, type);
            // Prepare data for Excel
            const summary = reports.summary || {};
            const details = reports.details || [];
            // Create workbook
            const wb = XLSX.utils.book_new();
            // Summary sheet
            const summaryData = [
                ['LAPORAN TRANSAKSI KASIR'],
                ['Periode:', `${reports.startDate} s/d ${reports.endDate}`],
                [],
                ['Ringkasan'],
                ['Total Transaksi', summary.total_transactions || 0],
                ['Total Pendapatan', `Rp ${new Intl.NumberFormat('id-ID').format(summary.total_revenue || 0)}`],
                ['Pembayaran Tunai', `Rp ${new Intl.NumberFormat('id-ID').format(summary.cash_total || 0)}`],
                ['Pembayaran Transfer', `Rp ${new Intl.NumberFormat('id-ID').format(summary.transfer_total || 0)}`],
                ['Pembayaran Gateway', `Rp ${new Intl.NumberFormat('id-ID').format(summary.gateway_total || 0)}`],
                ['Jumlah Hari', summary.days_count || 0],
                [],
                ['Rata-rata per Transaksi', `Rp ${new Intl.NumberFormat('id-ID').format(summary.total_transactions > 0 ? summary.total_revenue / summary.total_transactions : 0)}`],
                ['Rata-rata per Hari', (summary.days_count > 0 ? (summary.total_transactions / summary.days_count).toFixed(1) : 0) + ' transaksi']
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
            // Details sheet
            const detailsData = [
                ['Tanggal', 'Transaksi', 'Tunai (Rp)', 'Transfer (Rp)', 'Gateway (Rp)', 'Total (Rp)']
            ];
            details.forEach((detail) => {
                const detailDate = new Date(detail.date);
                detailsData.push([
                    detailDate.toLocaleDateString('id-ID'),
                    detail.transactions || 0,
                    detail.cash || 0,
                    detail.transfer || 0,
                    detail.gateway || 0,
                    detail.revenue || 0
                ]);
            });
            // Add totals row
            detailsData.push([
                'TOTAL',
                summary.total_transactions || 0,
                summary.cash_total || 0,
                summary.transfer_total || 0,
                summary.gateway_total || 0,
                summary.total_revenue || 0
            ]);
            const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
            XLSX.utils.book_append_sheet(wb, wsDetails, 'Detail Harian');
            // Generate buffer
            const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            // Set headers for download
            const filename = `Laporan_Kasir_${reports.startDate}_${reports.endDate}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            // Send file
            res.send(excelBuffer);
        }
        catch (error) {
            console.error('Error exporting kasir reports:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengekspor laporan'
            });
        }
    }
    // Proses pembayaran
    async processPayment(req, res) {
        try {
            const { customerId, amount, paymentMethod, notes, paymentType, useBalance } = req.body;
            // Validasi input
            if (!customerId || !paymentType) {
                req.flash('error', 'Data pembayaran tidak lengkap');
                return res.redirect('/kasir/payments');
            }
            // Validate payment type
            if (!['full', 'partial', 'debt'].includes(paymentType)) {
                req.flash('error', 'Jenis pembayaran tidak valid');
                return res.redirect('/kasir/payments');
            }
            // Validate amount for partial payment
            if (paymentType === 'partial') {
                if (!amount || parseFloat(amount) <= 0) {
                    req.flash('error', 'Jumlah pembayaran tidak valid untuk cicilan');
                    return res.redirect('/kasir/payments');
                }
            }
            // Validate payment method (not required for debt)
            if (paymentType !== 'debt' && !paymentMethod && !useBalance) {
                req.flash('error', 'Metode pembayaran harus dipilih');
                return res.redirect('/kasir/payments');
            }
            // Proses pembayaran
            const paymentResult = await this.processPaymentTransaction(parseInt(customerId), parseFloat(amount) || 0, paymentMethod || 'cash', notes || '', req.user.id, paymentType, useBalance === 'true' || useBalance === true, req.body.selectedInvoiceIds);
            if (paymentResult.success) {
                // Redirect to print receipt page
                if (paymentResult.paymentId) {
                    return res.redirect(`/kasir/receipt/${paymentResult.paymentId}`);
                }
                req.flash('success', 'Pembayaran berhasil diproses');
                res.redirect('/kasir/payments');
            }
            else {
                req.flash('error', paymentResult.message || 'Gagal memproses pembayaran');
                res.redirect('/kasir/payments');
            }
        }
        catch (error) {
            console.error('Error processing payment:', error);
            req.flash('error', 'Terjadi kesalahan saat memproses pembayaran');
            res.redirect('/kasir/payments');
        }
    }
    // Helper methods
    async getKasirStats() {
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Get today's statistics
            const [todayStats] = await conn.query(`
                SELECT 
                    COUNT(*) as todayTransactions,
                    COALESCE(SUM(amount), 0) as todayRevenue
                FROM payments 
                WHERE DATE(payment_date) = CURDATE()
            `);
            // Get total statistics
            const [totalStats] = await conn.query(`
                SELECT 
                    COUNT(*) as totalTransactions,
                    COALESCE(SUM(amount), 0) as totalRevenue
                FROM payments
            `);
            // Get pending invoices count
            const [pendingStats] = await conn.query(`
                SELECT COUNT(*) as pendingPayments
                FROM invoices 
                WHERE status IN ('sent', 'partial', 'overdue')
            `);
            // Get payment method breakdown for today
            const [methodStats] = await conn.query(`
                SELECT 
                    payment_method,
                    COUNT(*) as count,
                    COALESCE(SUM(amount), 0) as total
                FROM payments 
                WHERE DATE(payment_date) = CURDATE()
                GROUP BY payment_method
            `);
            return {
                totalTransactions: totalStats[0]?.totalTransactions || 0,
                totalRevenue: totalStats[0]?.totalRevenue || 0,
                todayTransactions: todayStats[0]?.todayTransactions || 0,
                todayRevenue: todayStats[0]?.todayRevenue || 0,
                pendingPayments: pendingStats[0]?.pendingPayments || 0,
                paymentMethods: methodStats || []
            };
        }
        catch (error) {
            console.error('Error getting kasir stats:', error);
            return {
                totalTransactions: 0,
                totalRevenue: 0,
                todayTransactions: 0,
                todayRevenue: 0,
                pendingPayments: 0,
                paymentMethods: []
            };
        }
        finally {
            conn.release();
        }
    }
    async getTransactions(page, limit, search, status) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            const offset = (page - 1) * limit;
            // Build WHERE clause
            let whereClause = 'WHERE 1=1';
            const params = [];
            if (search) {
                whereClause += ` AND (
                    c.customer_code LIKE ? OR 
                    c.name LIKE ? OR 
                    c.phone LIKE ? OR
                    i.invoice_number LIKE ?
                )`;
                const searchParam = `%${search}%`;
                params.push(searchParam, searchParam, searchParam, searchParam);
            }
            if (status) {
                whereClause += ` AND p.gateway_status = ?`;
                params.push(status);
            }
            // Get transactions
            const query = `
                SELECT 
                    p.*,
                    c.customer_code,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    i.invoice_number,
                    i.period,
                    i.total_amount as invoice_total,
                    u.full_name as kasir_name,
                    pp.proof_file_path as payment_proof_url
                FROM payments p
                LEFT JOIN invoices i ON p.invoice_id = i.id
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN users u ON p.created_by = u.id
                LEFT JOIN payment_proofs pp ON p.id = pp.payment_id
                ${whereClause}
                ORDER BY p.payment_date DESC, p.created_at DESC
                LIMIT ? OFFSET ?
            `;
            const [transactions] = await conn.query(query, [...params, limit, offset]);
            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM payments p
                LEFT JOIN invoices i ON p.invoice_id = i.id
                LEFT JOIN customers c ON i.customer_id = c.id
                ${whereClause}
            `;
            const [countResult] = await conn.query(countQuery, params);
            const total = countResult[0]?.total || 0;
            const pages = Math.ceil(total / limit);
            return {
                data: transactions,
                pagination: {
                    page: page,
                    limit: limit,
                    total: total,
                    pages: pages
                }
            };
        }
        catch (error) {
            console.error('Error getting transactions:', error);
            return {
                data: [],
                pagination: {
                    page: page,
                    limit: limit,
                    total: 0,
                    pages: 0
                }
            };
        }
        finally {
            conn.release();
        }
    }
    async getKasirReports(startDate, endDate, type) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Set default dates if not provided
            const end = endDate || new Date().toISOString().split('T')[0];
            const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            // Get summary statistics
            const [summary] = await conn.query(`
                SELECT 
                    COUNT(*) as total_transactions,
                    COALESCE(SUM(amount), 0) as total_revenue,
                    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash_total,
                    COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN amount ELSE 0 END), 0) as transfer_total,
                    COALESCE(SUM(CASE WHEN payment_method = 'gateway' THEN amount ELSE 0 END), 0) as gateway_total,
                    COUNT(DISTINCT DATE(payment_date)) as days_count
                FROM payments
                WHERE DATE(payment_date) BETWEEN ? AND ?
            `, [start, end]);
            // Get daily breakdown
            const [details] = await conn.query(`
                SELECT 
                    DATE(payment_date) as date,
                    COUNT(*) as transactions,
                    COALESCE(SUM(amount), 0) as revenue,
                    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash,
                    COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN amount ELSE 0 END), 0) as transfer,
                    COALESCE(SUM(CASE WHEN payment_method = 'gateway' THEN amount ELSE 0 END), 0) as gateway
                FROM payments
                WHERE DATE(payment_date) BETWEEN ? AND ?
                GROUP BY DATE(payment_date)
                ORDER BY DATE(payment_date) DESC
            `, [start, end]);
            return {
                summary: summary[0] || {},
                details: details || [],
                startDate: start,
                endDate: end
            };
        }
        catch (error) {
            console.error('Error getting kasir reports:', error);
            return {
                summary: {},
                details: [],
                startDate: startDate,
                endDate: endDate
            };
        }
        finally {
            conn.release();
        }
    }
    async processPaymentTransaction(customerId, amount, paymentMethod, notes, kasirId, paymentType, useBalance = false, selectedInvoiceIds) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            // Get customer info
            const [customerRows] = await conn.query('SELECT id, customer_code, name, phone, email, address, odc_id, odp_id, connection_type, status, latitude, longitude, pppoe_username, pppoe_password, area, odc_location, custom_payment_deadline, custom_isolate_days_after_deadline, balance, late_payment_count, created_at, updated_at FROM customers WHERE id = ?', [customerId]);
            if (!customerRows || customerRows.length === 0) {
                await conn.rollback();
                return { success: false, message: 'Pelanggan tidak ditemukan' };
            }
            const customer = customerRows[0];
            let currentBalance = parseFloat(customer.balance || 0);
            // Get ALL pending invoices for this customer
            let invoiceQuery = `
                SELECT id, invoice_number, customer_id, subscription_id, period, due_date, subtotal, discount_amount, total_amount, paid_amount, remaining_amount, status, notes, created_at, updated_at FROM invoices 
                WHERE customer_id = ? 
                AND status IN ('sent', 'partial', 'overdue')
            `;
            const queryParams = [customerId];
            if (selectedInvoiceIds && selectedInvoiceIds.length > 0) {
                invoiceQuery += ` AND id IN (?)`;
                queryParams.push(selectedInvoiceIds);
            }
            invoiceQuery += ` ORDER BY period ASC`;
            const [invoices] = await conn.query(invoiceQuery, queryParams);
            if (!invoices || invoices.length === 0) {
                await conn.rollback();
                return { success: false, message: 'Tidak ada tagihan yang perlu dibayar' };
            }
            let totalPaymentBuffer = (paymentType === 'debt') ? 0 : amount;
            let firstPaymentId;
            let appliedInvoices = [];
            let processedInvoicesData = [];
            let totalAppliedCash = 0;
            let totalAppliedBalance = 0;
            // If paymentType is 'full', we set buffer to the total remaining across all invoices
            if (paymentType === 'full') {
                const totalDebt = invoices.reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || inv.total_amount), 0);
                totalPaymentBuffer = Math.max(0, totalDebt - (useBalance ? currentBalance : 0));
                console.log(`[KasirController] Full payment mode. Total debt: ${totalDebt}. Cash needed: ${totalPaymentBuffer}`);
            }
            for (const invoice of invoices) {
                if (totalPaymentBuffer <= 0 && (!useBalance || currentBalance <= 0) && paymentType !== 'debt')
                    break;
                const invoiceRemaining = parseFloat(invoice.remaining_amount || invoice.total_amount);
                // 1. apply balance first if requested
                let appliedFromBalance = 0;
                if (useBalance && currentBalance > 0) {
                    appliedFromBalance = Math.min(currentBalance, invoiceRemaining);
                    currentBalance -= appliedFromBalance;
                    totalAppliedBalance += appliedFromBalance;
                    // Deduct from customer balance
                    await conn.query('UPDATE customers SET balance = balance - ? WHERE id = ?', [appliedFromBalance, customerId]);
                    // Add balance log
                    await conn.query(`
                        INSERT INTO customer_balance_logs (customer_id, amount, type, description, reference_id, reference_type, created_by)
                        VALUES (?, ?, 'debit', ?, ?, 'invoice', ?)
                    `, [customerId, appliedFromBalance, `Pembayaran tagihan ${invoice.invoice_number} menggunakan saldo`, invoice.id, kasirId]);
                    // Add payment record for balance
                    await conn.query(`
                        INSERT INTO payments (invoice_id, payment_method, amount, payment_date, gateway_status, notes, created_by, created_at)
                        VALUES (?, 'balance', ?, NOW(), 'completed', ?, ?, NOW())
                    `, [invoice.id, appliedFromBalance, `Bayar via saldo`, kasirId]);
                }
                // 2. apply cash buffer
                let appliedFromCash = 0;
                if (totalPaymentBuffer > 0) {
                    appliedFromCash = Math.min(totalPaymentBuffer, invoiceRemaining - appliedFromBalance);
                    totalPaymentBuffer -= appliedFromCash;
                    totalAppliedCash += appliedFromCash;
                    const paymentStatus = 'completed';
                    const [pResult] = await conn.query(`
                        INSERT INTO payments (invoice_id, payment_method, amount, payment_date, gateway_status, notes, created_by, created_at)
                        VALUES (?, ?, ?, NOW(), ?, ?, ?, NOW())
                    `, [invoice.id, paymentMethod, appliedFromCash, paymentStatus, notes || '', kasirId]);
                    if (!firstPaymentId)
                        firstPaymentId = pResult.insertId;
                }
                // Apply debt (no cash, but still marks as partial/overdue)
                if (paymentType === 'debt' && (appliedFromBalance + appliedFromCash) < invoiceRemaining) {
                    // Debt tracking is handled later if remaining > 0
                }
                const totalAppliedToInv = appliedFromBalance + appliedFromCash;
                // 3. Update invoice status
                let newPaidTotal = parseFloat(invoice.paid_amount || 0) + totalAppliedToInv;
                let newRem = Math.max(0, parseFloat(invoice.total_amount) - newPaidTotal);
                let newStat = invoice.status;
                if (newRem <= 0) {
                    newStat = 'paid';
                }
                else if (paymentType === 'debt') {
                    newStat = 'hutang';
                }
                else if (newPaidTotal > 0) {
                    newStat = 'partial';
                    if (new Date(invoice.due_date) < new Date())
                        newStat = 'overdue';
                }
                await conn.query(`
                    UPDATE invoices 
                    SET paid_amount = ?, remaining_amount = ?, status = ?, paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END
                    WHERE id = ?
                `, [newPaidTotal, newRem, newStat, newStat, invoice.id]);
                // Sync with debt_tracking for Admin visibility
                if (newRem > 0) {
                    const [existingDebt] = await conn.query('SELECT id FROM debt_tracking WHERE invoice_id = ? AND status = "active"', [invoice.id]);
                    if (existingDebt.length > 0) {
                        await conn.query('UPDATE debt_tracking SET debt_amount = ?, updated_at = NOW() WHERE id = ?', [newRem, existingDebt[0].id]);
                    }
                    else {
                        await conn.query(`
                            INSERT INTO debt_tracking (customer_id, invoice_id, debt_amount, debt_reason, status, created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
                        `, [customerId, invoice.id, newRem, paymentType === 'debt' ? 'Hutang penuh' : 'Pembayaran parsial', 'active']);
                    }
                    // Carry over for next month logic (mirroring PaymentController)
                    const { getNextPeriod } = await Promise.resolve().then(() => __importStar(require('../utils/periodHelper')));
                    const nextPeriod = getNextPeriod(invoice.period);
                    await conn.query('INSERT INTO carry_over_invoices (customer_id, carry_over_amount, target_period, status) VALUES (?, ?, ?, "pending") ON DUPLICATE KEY UPDATE carry_over_amount = ?', [customerId, newRem, nextPeriod, newRem]);
                }
                else if (newRem <= 0) {
                    // Resolve active debt
                    await conn.query('UPDATE debt_tracking SET status = "resolved", resolved_at = NOW() WHERE invoice_id = ? AND status = "active"', [invoice.id]);
                }
                appliedInvoices.push(invoice.invoice_number);
                // If we partially paid an invoice and ran out of cash/balance, stop here
                if (newRem > 0 && paymentType !== 'debt') {
                    processedInvoicesData.push({ invoice, appliedCash: appliedFromCash });
                    break;
                }
                processedInvoicesData.push({ invoice, appliedCash: appliedFromCash });
            }
            // 5. Excess to balance
            if (totalPaymentBuffer > 0) {
                await conn.query('UPDATE customers SET account_balance = account_balance + ? WHERE id = ?', [totalPaymentBuffer, customerId]);
                await conn.query(`
                    INSERT INTO customer_balance_logs (customer_id, amount, type, description, reference_id, reference_type, created_by)
                    VALUES (?, ?, 'credit', ?, ?, 'payment', ?)
                `, [customerId, totalPaymentBuffer, `Kelebihan pembayaran (buffer cash)`, firstPaymentId || 0, kasirId]);
            }
            // If at least one invoice was paid, check if customer qualifies to be unblocked
            try {
                const isRestored = await isolationService_1.IsolationService.restoreIfQualified(customerId, conn);
                // If the customer was restored, also ensure their PPPoE block date is reset if applicable
                if (isRestored) {
                    const { pppoeActivationService } = await Promise.resolve().then(() => __importStar(require('../services/pppoe/pppoeActivationService')));
                    await pppoeActivationService.resetNextBlockDate(customerId).catch(e => console.error('[KasirController] Failed to reset PPPoE block date:', e));
                }
            }
            catch (restoreErr) {
                console.warn(`[KasirController] Non-critical error during auto-restore check: ${restoreErr.message}`);
            }
            // Notification to Action Desk (Admin)
            try {
                const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification/UnifiedNotificationService')));
                const adminMsg = `💰 *PEMBAYARAN KASIR*\n\n` +
                    `👤 Pelanggan: *${customer.name}*\n` +
                    `🆔 Kode: ${customer.customer_code}\n` +
                    `💵 Jumlah: *Rp ${new Intl.NumberFormat('id-ID').format(amount)}*\n` +
                    `📝 Tipe: ${paymentType.toUpperCase()}\n` +
                    `💳 Metode: ${paymentMethod.toUpperCase()}\n` +
                    `📑 Invoice: ${appliedInvoices.join(', ')}\n\n` +
                    `_Diproses oleh: ${kasirId}_`;
                await UnifiedNotificationService.broadcastToAdmins(adminMsg);
            }
            catch (notifErr) {
                console.error('[KasirController] Action Desk Notification Error:', notifErr);
            }
            await conn.commit();
            // SINKRONISASI AKUNTANSI (Setelah Commit untuk mencegah Deadlock)
            if (firstPaymentId) {
                try {
                    const { AccountingService } = await Promise.resolve().then(() => __importStar(require('../services/billing/accountingService')));
                    // Tidak perlu await jika ingin performa cepat, tapi di sini kita await agar kepastian sinkronisasi terjamin
                    // Jika mati/error di sini, transaksi database tetap aman (sudah commit)
                    await AccountingService.generatePaymentJournalEntry(firstPaymentId).catch(err => console.error('[KasirController] Journal Sync Error:', err));
                }
                catch (e) {
                    console.error('[KasirController] Accounting Service Sync Error:', e);
                }
            }
            // Track late payment and notifications asynchronously for the PRIMARY/LAST invoice processed
            if (firstPaymentId && processedInvoicesData.length > 0) {
                const primaryInvoiceData = processedInvoicesData[processedInvoicesData.length - 1]; // Use last to get "most recently paid" status
                const primaryInvoice = primaryInvoiceData.invoice;
                const paymentDateStr = new Date().toISOString().slice(0, 10);
                this.trackLatePayment(primaryInvoice.id, firstPaymentId, paymentDateStr).catch(err => {
                    console.error('Error tracking late payment:', err);
                });
                const finalCustomer = { ...customer, balance: (currentBalance + totalPaymentBuffer) };
                this.sendPaymentNotification(finalCustomer, primaryInvoice, totalAppliedCash, paymentMethod, firstPaymentId, paymentType, totalAppliedBalance, totalPaymentBuffer).catch(err => {
                    console.error('Error sending WhatsApp notification:', err);
                });
            }
            if (paymentType === 'debt') {
                try {
                    const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification/UnifiedNotificationService')));
                    await UnifiedNotificationService.broadcastToAdmins(`📌 *INFORMASI HUTANG BARU*\n\n` +
                        `👤 *Nama:* ${customer.name}\n` +
                        `🆔 *Kode:* ${customer.customer_code}\n` +
                        `🧾 *Invoice:* ${appliedInvoices.join(', ')}\n` +
                        `💰 *Total Hutang:* Rp ${totalAppliedCash.toLocaleString('id-ID')}\n` +
                        `📝 *Keterangan:* Pembayaran ditunda via Kasir.\n\n` +
                        `Mohon pimpinan (Nina/Diki) untuk memantau status ini.`);
                }
                catch (notifErr) {
                    console.error('Failed to notify admins about debt:', notifErr);
                }
            }
            return {
                success: true,
                message: (paymentType === 'debt' ? `Status hutang berhasil dicatat untuk: ` : `Pembayaran berhasil diproses untuk invoice: `) + appliedInvoices.join(', ') + (totalPaymentBuffer > 0 ? `. Kelebihan Rp ${totalPaymentBuffer.toLocaleString('id-ID')} masuk ke saldo.` : ''),
                paymentId: firstPaymentId
            };
        }
        catch (error) {
            await conn.rollback();
            console.error('Error processing payment transaction:', error);
            return {
                success: false,
                message: 'Terjadi kesalahan saat memproses pembayaran'
            };
        }
        finally {
            conn.release();
        }
    }
    // Send WhatsApp notification after payment
    async sendPaymentNotification(customer, invoice, amount, paymentMethod, paymentId, paymentType, amountFromBalance = 0, excessAmount = 0) {
        try {
            if (!customer.phone) {
                console.log('[KasirController] No phone number, skipping notification');
                return;
            }
            const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification/UnifiedNotificationService')));
            const { getBillingMonth } = await Promise.resolve().then(() => __importStar(require('../utils/periodHelper')));
            // Format bulan tagihan
            const paymentDate = new Date();
            const billingMonth = invoice.period ?
                getBillingMonth(invoice.period, paymentDate, invoice.due_date || null) :
                (invoice.period || '-');
            // Determine notification type
            const notificationType = paymentType === 'debt'
                ? 'payment_debt'
                : paymentType === 'partial'
                    ? 'payment_partial'
                    : 'payment_received';
            // Prepare variables for template
            const variables = {
                customer_name: customer.name || 'Pelanggan',
                customer_code: customer.customer_code || '',
                invoice_number: invoice.invoice_number || '',
                billing_month: billingMonth,
                amount: amount.toLocaleString('id-ID'),
                balance_used: amountFromBalance.toLocaleString('id-ID'),
                excess_amount: excessAmount.toLocaleString('id-ID'),
                new_balance: (customer.balance || 0).toLocaleString('id-ID'),
                payment_method: this.getPaymentMethodName(paymentMethod),
                payment_id: paymentId.toString()
            };
            if (paymentType === 'partial') {
                variables.total_amount = parseFloat(invoice.total_amount || 0).toLocaleString('id-ID');
                variables.paid_amount = amount.toLocaleString('id-ID');
                variables.remaining_amount = parseFloat(invoice.remaining_amount || 0).toLocaleString('id-ID');
                variables.due_date = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('id-ID') : '-';
            }
            if (paymentType === 'debt') {
                variables.total_amount = parseFloat(invoice.total_amount || 0).toLocaleString('id-ID');
                variables.debt_amount = parseFloat(invoice.remaining_amount || 0).toLocaleString('id-ID');
                variables.debt_reason = 'Pembayaran ditunda';
                variables.debt_date = new Date().toLocaleDateString('id-ID');
                variables.due_date = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('id-ID') : '-';
                variables.notes = 'Silakan hubungi customer service untuk informasi lebih lanjut';
            }
            // Send notification
            if (paymentType === 'debt') {
                // For debt, we use custom queueNotification because there's no payment ID
                await UnifiedNotificationService.queueNotification({
                    customer_id: customer.id,
                    invoice_id: invoice.id,
                    notification_type: 'payment_debt',
                    channels: ['whatsapp'],
                    variables: variables,
                    priority: 'high'
                });
            }
            else if (paymentId) {
                // For full/partial payment, use the centralized method which handles PDF generation
                await UnifiedNotificationService.notifyPaymentReceived(paymentId);
            }
            console.log(`[KasirController] ✅ Payment notification processed successfully`);
            // Try to process queue immediately (non-blocking)
            try {
                const result = await UnifiedNotificationService.sendPendingNotifications(10);
                console.log(`[KasirController] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed`);
            }
            catch (queueError) {
                console.warn(`[KasirController] ⚠️ Queue processing error (non-critical):`, queueError.message);
            }
        }
        catch (error) {
            console.error('[KasirController] Error sending payment notification:', error);
        }
    }
    // Track late payment (internal helper)
    async trackLatePayment(invoiceId, paymentId, paymentDate) {
        try {
            // Get invoice info
            const conn = await pool_1.databasePool.getConnection();
            try {
                const [invoiceRows] = await conn.query(`SELECT due_date FROM invoices WHERE id = ?`, [invoiceId]);
                if (invoiceRows.length === 0) {
                    return;
                }
                const invoice = invoiceRows[0];
                if (!invoice || !invoice.due_date) {
                    return;
                }
                const paymentDateObj = new Date(paymentDate);
                const dueDateObj = new Date(invoice.due_date);
                // Import and track
                const { LatePaymentTrackingService } = await Promise.resolve().then(() => __importStar(require('../services/billing/LatePaymentTrackingService')));
                await LatePaymentTrackingService.trackPayment(invoiceId, paymentId, paymentDateObj, dueDateObj);
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('[KasirController] Error in trackLatePayment:', error);
            // Don't throw - this is non-critical
        }
    }
    getPaymentMethodName(method) {
        const methods = {
            'cash': 'Tunai',
            'transfer': 'Transfer Bank',
            'gateway': 'Payment Gateway',
            'ewallet': 'E-Wallet',
            'qris': 'QRIS',
            'balance': 'Saldo'
        };
        return methods[method] || method;
    }
    // Print invoice individual
    async printInvoice(req, res) {
        try {
            const { invoiceId } = req.params;
            const conn = await pool_1.databasePool.getConnection();
            try {
                const [invoices] = await conn.query(`
                    SELECT 
                        i.*,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        c.email as customer_email,
                        c.address as customer_address,
                        c.customer_code
                    FROM invoices i
                    LEFT JOIN customers c ON i.customer_id = c.id
                    WHERE i.id = ?
                `, [invoiceId]);
                if (invoices.length === 0) {
                    res.status(404).send('Invoice tidak ditemukan');
                    return;
                }
                const invoice = invoices[0];
                // Format period
                if (invoice.period) {
                    invoice.period = (0, periodHelper_1.formatPeriodToMonth)(invoice.period, invoice.due_date);
                }
                // Get invoice items
                const [items] = await conn.query(`
                    SELECT id, invoice_id, description, quantity, unit_price, total_price, created_at FROM invoice_items WHERE invoice_id = ? ORDER BY id
                `, [invoiceId]);
                res.render('kasir/print-invoice', {
                    title: `Print Invoice ${invoice.invoice_number}`,
                    invoice,
                    items,
                    layout: false
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error printing invoice:', error);
            res.status(500).send('Gagal mencetak invoice');
        }
    }
    // Export payment records
    async exportPaymentRecords(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const conn = await pool_1.databasePool.getConnection();
            try {
                let query = `
                    SELECT 
                        p.id,
                        p.payment_date,
                        p.amount,
                        p.payment_method,
                        p.reference_number,
                        p.notes,
                        p.created_at,
                        c.customer_code,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        i.invoice_number,
                        i.period,
                        u.full_name as kasir_name
                    FROM payments p
                    LEFT JOIN invoices i ON p.invoice_id = i.id
                    LEFT JOIN customers c ON i.customer_id = c.id
                    LEFT JOIN users u ON p.created_by = u.id
                    WHERE 1=1
                `;
                const params = [];
                if (startDate) {
                    query += ' AND DATE(p.payment_date) >= ?';
                    params.push(startDate);
                }
                if (endDate) {
                    query += ' AND DATE(p.payment_date) <= ?';
                    params.push(endDate);
                }
                query += ' ORDER BY p.payment_date DESC, p.created_at DESC';
                const [records] = await conn.query(query, params);
                // Create Excel workbook
                const wb = XLSX.utils.book_new();
                // Prepare data
                const excelData = [
                    ['TANGGAL', 'CUSTOMER CODE', 'NAMA', 'TELEPON', 'NO INVOICE', 'PERIODE', 'JUMLAH', 'METODE', 'REFERENSI', 'CATATAN', 'KASIR']
                ];
                records.forEach((record) => {
                    excelData.push([
                        new Date(record.payment_date).toLocaleDateString('id-ID'),
                        record.customer_code || '-',
                        record.customer_name || '-',
                        record.customer_phone || '-',
                        record.invoice_number || '-',
                        record.period || '-',
                        record.amount || 0,
                        this.getPaymentMethodName(record.payment_method || 'cash'),
                        record.reference_number || '-',
                        record.notes || '-',
                        record.kasir_name || '-'
                    ]);
                });
                // Add summary
                const totalAmount = records.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
                excelData.push([]);
                excelData.push(['TOTAL', '', '', '', '', '', totalAmount.toString(), '', '', '', '']);
                const ws = XLSX.utils.aoa_to_sheet(excelData);
                XLSX.utils.book_append_sheet(wb, ws, 'Pembayaran');
                // Generate buffer
                const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                // Set headers
                const filename = `Pencatatan_Pembayaran_${startDate || 'all'}_${endDate || 'all'}.xlsx`;
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.send(excelBuffer);
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error exporting payment records:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengekspor data pembayaran'
            });
        }
    }
    // Print payment receipt
    async printPaymentRecord(req, res) {
        try {
            const { paymentId } = req.params;
            const conn = await pool_1.databasePool.getConnection();
            try {
                const [payments] = await conn.query(`
                    SELECT 
                        p.*,
                        c.customer_code,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        c.address,
                        i.invoice_number,
                        i.period,
                        i.total_amount as invoice_total,
                        pp.name as package_name,
                        u.full_name as kasir_name
                    FROM payments p
                    LEFT JOIN invoices i ON p.invoice_id = i.id
                    LEFT JOIN customers c ON i.customer_id = c.id
                    LEFT JOIN pppoe_profiles pp ON c.pppoe_profile_id = pp.id
                    LEFT JOIN users u ON p.created_by = u.id
                    WHERE p.id = ?
                `, [paymentId]);
                if (!payments || payments.length === 0) {
                    return res.status(404).render('error', {
                        title: 'Error',
                        message: 'Data pembayaran tidak ditemukan'
                    });
                }
                const payment = payments[0];
                res.render('kasir/print-payment-record', {
                    title: `Bukti Pembayaran #${paymentId}`,
                    payment,
                    layout: false
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error printing payment record:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal mencetak bukti pembayaran'
            });
        }
    }
    // Manual Verifications - Halaman utama
    async manualVerifications(req, res) {
        try {
            res.render('kasir/manual-verifications', {
                title: 'Verifikasi Manual Pembayaran'
            });
        }
        catch (error) {
            console.error('Error loading manual verifications page:', error);
            req.flash('error', 'Gagal memuat halaman verifikasi manual');
            res.redirect('/kasir/dashboard');
        }
    }
    // Get manual verifications API
    async getManualVerifications(req, res) {
        try {
            const { status = 'pending', page = 1, limit = 20 } = req.query;
            const offset = (Number(page) - 1) * Number(limit);
            const conn = await pool_1.databasePool.getConnection();
            try {
                // Get verifications
                const [verifications] = await conn.query(`
                    SELECT 
                        mpv.*,
                        c.name as customer_name,
                        c.phone as customer_phone,
                        c.customer_code,
                        i.invoice_number,
                        i.period,
                        i.total_amount,
                        i.remaining_amount
                    FROM manual_payment_verifications mpv
                    LEFT JOIN customers c ON mpv.customer_id = c.id
                    LEFT JOIN invoices i ON mpv.invoice_id = i.id
                    WHERE mpv.status = ?
                    ORDER BY mpv.created_at DESC
                    LIMIT ? OFFSET ?
                `, [status, Number(limit), offset]);
                // Get total count
                const [countResult] = await conn.query(`
                    SELECT COUNT(*) as total 
                    FROM manual_payment_verifications 
                    WHERE status = ?
                `, [status]);
                const total = countResult[0]?.total || 0;
                res.json({
                    success: true,
                    data: verifications,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        pages: Math.ceil(total / Number(limit))
                    }
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error getting manual verifications:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil data verifikasi'
            });
        }
    }
    // Approve manual verification
    async approveManualVerification(req, res) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            const { id } = req.params;
            const { amount } = req.body;
            // Get verification data
            const [verifications] = await conn.query(`
                SELECT * FROM manual_payment_verifications WHERE id = ?
            `, [id]);
            if (verifications.length === 0) {
                await conn.rollback();
                res.status(404).json({
                    success: false,
                    message: 'Data verifikasi tidak ditemukan'
                });
                return;
            }
            const verification = verifications[0];
            // Create payment record
            const [paymentResult] = await conn.query(`
                INSERT INTO payments (
                    invoice_id,
                    payment_method,
                    amount,
                    payment_date,
                    gateway_status,
                    notes,
                    created_by,
                    created_at
                ) VALUES (?, 'transfer', ?, NOW(), 'completed', ?, ?, NOW())
            `, [
                verification.invoice_id,
                amount || verification.amount,
                `Verified from WhatsApp proof - ${verification.reason || ''}`,
                req.user.id
            ]);
            const paymentId = paymentResult.insertId;
            // Update invoice
            const [invoice] = await conn.query(`
                SELECT * FROM invoices WHERE id = ?
            `, [verification.invoice_id]);
            if (invoice.length > 0) {
                const inv = invoice[0];
                const newPaidAmount = (inv.paid_amount || 0) + (amount || verification.amount);
                const newRemainingAmount = inv.total_amount - newPaidAmount;
                const newStatus = newRemainingAmount <= 0 ? 'paid' : 'partial';
                await conn.query(`
                    UPDATE invoices 
                    SET paid_amount = ?,
                        remaining_amount = ?,
                        status = ?,
                        paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END
                    WHERE id = ?
                `, [newPaidAmount, newRemainingAmount, newStatus, newStatus, verification.invoice_id]);
            }
            // Update verification status
            await conn.query(`
                UPDATE manual_payment_verifications 
                SET status = 'approved',
                    approved_by = ?,
                    approved_at = NOW(),
                    payment_id = ?
                WHERE id = ?
            `, [req.user.id, paymentId, id]);
            // Check if customer qualifies for auto-restore after verification approval
            try {
                await isolationService_1.IsolationService.restoreIfQualified(verification.customer_id, conn);
            }
            catch (restoreErr) {
                console.warn(`[KasirController] Non-critical error during verification auto-restore check: ${restoreErr.message}`);
            }
            await conn.commit();
            // Send notification (Fire and forget)
            if (paymentId) {
                try {
                    const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification/UnifiedNotificationService')));
                    UnifiedNotificationService.notifyPaymentReceived(paymentId).catch(e => console.error('Background notification error in kasir verification:', e));
                }
                catch (e) {
                    console.warn('Failed to initiate unified notification in kasir:', e);
                }
            }
            res.json({
                success: true,
                message: 'Pembayaran berhasil diverifikasi dan disetujui',
                paymentId
            });
        }
        catch (error) {
            await conn.rollback();
            console.error('Error approving verification:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menyetujui verifikasi'
            });
        }
        finally {
            conn.release();
        }
    }
    // Reject manual verification
    async rejectManualVerification(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const conn = await pool_1.databasePool.getConnection();
            try {
                await conn.query(`
                    UPDATE manual_payment_verifications 
                    SET status = 'rejected',
                        rejected_by = ?,
                        rejected_at = NOW(),
                        reject_reason = ?
                    WHERE id = ?
                `, [req.user.id, reason || 'Bukti pembayaran tidak valid', id]);
                // Send WhatsApp notification to customer about rejection
                const [verificRows] = await conn.query('SELECT mpv.customer_id, c.phone FROM manual_payment_verifications mpv JOIN customers c ON mpv.customer_id = c.id WHERE mpv.id = ?', [id]);
                if (verificRows.length > 0 && verificRows[0].phone) {
                    try {
                        const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp')));
                        await whatsappService.sendMessage(verificRows[0].phone, `❌ *VERIFIKASI PEMBAYARAN DITOLAK*\n\n` +
                            `Alasan: ${reason || 'Bukti pembayaran tidak valid / tidak terbaca.'}\n\n` +
                            `Silakan kirim ulang bukti transfer yang valid atau hubungi Customer Service.`);
                    }
                    catch (notifErr) {
                        console.error('Failed to send rejection notification:', notifErr);
                    }
                }
                res.json({
                    success: true,
                    message: 'Verifikasi ditolak'
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error rejecting verification:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal menolak verifikasi'
            });
        }
    }
    async requestDeferment(req, res) {
        try {
            const { customer_id, invoice_id, deferred_until_date, reason } = req.body;
            if (!customer_id || !deferred_until_date) {
                res.status(400).json({ success: false, message: 'Customer ID dan tanggal penundaan wajib diisi.' });
                return;
            }
            const { DefermentService } = await Promise.resolve().then(() => __importStar(require('../services/billing/DefermentService')));
            const result = await DefermentService.requestDeferment({
                customer_id: parseInt(customer_id),
                invoice_id: invoice_id ? parseInt(invoice_id) : undefined,
                deferred_until_date,
                reason,
                requested_by: req.user?.username || 'kasir'
            });
            if (result.success) {
                res.json(result);
            }
            else {
                res.status(400).json(result);
            }
        }
        catch (error) {
            console.error('Error requesting deferment:', error);
            res.status(500).json({ success: false, message: error.message || 'Gagal memproses penundaan.' });
        }
    }
    // Action Desk: Send payment notification for a specific payment
    async sendPaymentNotificationAction(req, res) {
        try {
            const { paymentId } = req.params;
            if (!paymentId) {
                res.json({ success: false, message: 'Payment ID diperlukan' });
                return;
            }
            const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../services/notification/UnifiedNotificationService')));
            await UnifiedNotificationService.notifyPaymentReceived(parseInt(paymentId));
            // Try to process queue immediately
            try {
                const result = await UnifiedNotificationService.sendPendingNotifications(5);
                console.log(`[KasirController] 📨 Notification queue processed: ${result.sent} sent, ${result.failed} failed`);
            }
            catch (queueError) {
                console.warn('[KasirController] Queue processing error:', queueError.message);
            }
            res.json({ success: true, message: 'Notifikasi pembayaran berhasil dikirim!' });
        }
        catch (error) {
            console.error('Error sending payment notification:', error);
            res.json({ success: false, message: error.message || 'Gagal mengirim notifikasi' });
        }
    }
    // Halaman daftar hutang kasir
    async debtList(req, res) {
        try {
            const { page = 1, limit = 10, search = '' } = req.query;
            const offset = (Number(page) - 1) * Number(limit);
            const conn = await pool_1.databasePool.getConnection();
            try {
                let query = `
                    SELECT 
                        dt.*,
                        dt.debt_amount as remaining_amount,
                        i.invoice_number,
                        i.period,
                        c.name as customer_name, 
                        c.customer_code,
                        c.phone as customer_phone
                    FROM debt_tracking dt
                    JOIN invoices i ON dt.invoice_id = i.id
                    JOIN customers c ON i.customer_id = c.id
                    WHERE dt.status = 'active'
                `;
                const params = [];
                if (search) {
                    query += ` AND (c.name LIKE ? OR c.customer_code LIKE ? OR i.invoice_number LIKE ?)`;
                    const s = `%${search}%`;
                    params.push(s, s, s);
                }
                query += ` ORDER BY dt.updated_at DESC LIMIT ? OFFSET ?`;
                params.push(Number(limit), offset);
                const [debts] = await conn.query(query, params);
                const [countResult] = await conn.query(`
                    SELECT COUNT(*) as total 
                    FROM debt_tracking dt
                    JOIN invoices i ON dt.invoice_id = i.id
                    JOIN customers c ON i.customer_id = c.id
                    WHERE dt.status = 'active'
                    ${search ? ' AND (c.name LIKE ? OR c.customer_code LIKE ? OR i.invoice_number LIKE ?)' : ''}
                `, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);
                const total = countResult[0]?.total || 0;
                res.render('kasir/debt', {
                    title: 'Daftar Hutang Pelanggan',
                    currentPath: '/kasir/debt',
                    user: req.user,
                    debts,
                    search,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        pages: Math.ceil(total / Number(limit))
                    },
                    layout: 'layouts/kasir'
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error loading debt list:', error);
            res.status(500).render('error', { title: 'Error', message: 'Gagal memuat daftar hutang' });
        }
    }
}
exports.KasirController = KasirController;
//# sourceMappingURL=kasirController.js.map