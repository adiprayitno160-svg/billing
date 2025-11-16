import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { databasePool } from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import * as XLSX from 'xlsx';

export class KasirController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    // Halaman login kasir
    public async loginForm(req: Request, res: Response): Promise<void> {
        try {
            // Tangkap pesan dari query string
            const successMessage = req.query.success as string;
            const errorMessage = req.query.error as string;
            
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
        } catch (error) {
            console.error('Error loading kasir login form:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman login kasir'
            });
        }
    }

    // Proses login kasir
    public async login(req: Request, res: Response): Promise<void> {
        try {
            const { username, password } = req.body;

            // Validasi input
            if (!username || !password) {
                req.flash('error', 'Username dan password harus diisi');
                return res.redirect('/kasir/login');
            }

            // Cari user berdasarkan username
            const user = await this.userService.getUserByUsername(username);

            if (!user) {
                req.flash('error', 'Username atau password salah');
                return res.redirect('/kasir/login');
            }

            // Cek apakah user aktif
            if (!user.is_active) {
                req.flash('error', 'Akun tidak aktif');
                return res.redirect('/kasir/login');
            }

            // Cek role kasir
            if (user.role !== 'kasir') {
                req.flash('error', 'Akses ditolak. Hanya kasir yang dapat login');
                return res.redirect('/kasir/login');
            }

            // Verifikasi password
            const isValidPassword = await this.userService.verifyPassword(user.id, password);

            if (!isValidPassword) {
                req.flash('error', 'Username atau password salah');
                return res.redirect('/kasir/login');
            }

            // Set session
            (req.session as any).userId = user.id;
            (req.session as any).userRole = user.role;
            (req.session as any).username = user.username;

            req.flash('success', `Selamat datang, ${user.full_name}!`);
            res.redirect('/kasir/dashboard');
        } catch (error) {
            console.error('Error during kasir login:', error);
            req.flash('error', 'Terjadi kesalahan saat login');
            res.redirect('/kasir/login');
        }
    }

    // Logout kasir
    public async logout(req: Request, res: Response): Promise<void> {
        try {
            // Simpan pesan flash sebelum destroy session
            const userId = (req.session as any)?.userId;
            const username = (req.session as any)?.username;
            
            // Log untuk tracking
            if (userId) {
                console.log(`Kasir ${username} (ID: ${userId}) logged out at ${new Date().toISOString()}`);
            }

            // Destroy session
            req.session?.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                    return res.redirect('/kasir/login?error=Gagal logout, silakan coba lagi');
                }
                
                // Clear cookie
                res.clearCookie('connect.sid');
                
                // Redirect ke login dengan pesan sukses
                res.redirect('/kasir/login?success=Anda telah berhasil logout');
            });
        } catch (error) {
            console.error('Error during logout:', error);
            res.redirect('/kasir/login?error=Terjadi kesalahan saat logout');
        }
    }

    // Dashboard kasir
    public async dashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
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
        } catch (error) {
            console.error('Error loading kasir dashboard:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat dashboard kasir'
            });
        }
    }

    // Halaman transaksi kasir
    public async transactions(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { page = 1, limit = 10, search = '', status = '' } = req.query;
            
            // Ambil data transaksi dengan pagination
            const transactions = await this.getTransactions(
                parseInt(page as string),
                parseInt(limit as string),
                search as string,
                status as string
            );

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
        } catch (error) {
            console.error('Error loading kasir transactions:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat data transaksi'
            });
        }
    }

    // Halaman pembayaran kasir
    public async payments(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const conn = await databasePool.getConnection();
            try {
                // Get all active customers with their invoice status
                const [recentCustomers] = await conn.query<RowDataPacket[]>(`
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
                        (SELECT SUM(total_amount - paid_amount) FROM invoices 
                         WHERE customer_id = c.id 
                         AND status IN ('sent', 'partial', 'overdue')) as total_pending,
                        (SELECT COUNT(*) FROM payment_verifications pv
                         WHERE pv.customer_id = c.id 
                         AND pv.status = 'approved' 
                         AND pv.confidence_score >= 80) > 0 as ai_verified
                    FROM customers c
                    LEFT JOIN pppoe_profiles pp ON c.pppoe_profile_id = pp.id
                    ORDER BY 
                        CASE 
                            WHEN c.is_isolated = 1 THEN 1
                            WHEN (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id AND status IN ('sent', 'partial', 'overdue')) > 0 THEN 2
                            ELSE 3
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
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error loading kasir payments:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman pembayaran'
            });
        }
    }

    // Search customer API
    public async searchCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { q } = req.query;
            
            if (!q || typeof q !== 'string') {
                res.json({ success: false, message: 'Query tidak valid' });
                return;
            }
            
            const conn = await databasePool.getConnection();
            try {
                const [customers] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        c.*,
                        pp.name as package_name,
                        (SELECT COUNT(*) FROM invoices 
                         WHERE customer_id = c.id 
                         AND status IN ('sent', 'partial', 'overdue')) as pending_count
                    FROM customers c
                    LEFT JOIN pppoe_profiles pp ON c.pppoe_profile_id = pp.id
                    WHERE c.customer_code LIKE ? 
                       OR c.name LIKE ? 
                       OR c.phone LIKE ?
                       OR c.pppoe_username LIKE ?
                    LIMIT 20
                `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
                
                res.json({ success: true, data: customers });
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error searching customer:', error);
            res.json({ success: false, message: 'Gagal mencari pelanggan' });
        }
    }

    // Get customer invoices API
    public async getCustomerInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            
            const conn = await databasePool.getConnection();
            try {
                const [invoices] = await conn.query<RowDataPacket[]>(`
                    SELECT id, invoice_number, customer_id, subscription_id, period, due_date, subtotal, discount_amount, total_amount, paid_amount, remaining_amount, status, notes, created_at, updated_at FROM invoices
                    WHERE customer_id = ?
                    AND status IN ('sent', 'partial', 'overdue')
                    ORDER BY period ASC
                `, [id]);
                
                res.json({ success: true, data: invoices });
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error getting customer invoices:', error);
            res.json({ success: false, message: 'Gagal mengambil data tagihan' });
        }
    }

    // Get payment detail API
    public async getPaymentDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            
            const conn = await databasePool.getConnection();
            try {
                const [payments] = await conn.query<RowDataPacket[]>(`
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
                } else {
                    res.json({ success: false, message: 'Data payment tidak ditemukan' });
                }
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error getting payment detail:', error);
            res.json({ success: false, message: 'Gagal mengambil detail payment' });
        }
    }

    // Halaman print individual
    public async printIndividual(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            res.render('kasir/print', {
                title: 'Print Tagihan Individual',
                currentPath: '/kasir/print',
                user: req.user,
                layout: 'layouts/kasir'
            });
        } catch (error) {
            console.error('Error loading print individual:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman print'
            });
        }
    }

    // Halaman print kelompok
    public async printGroup(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const conn = await databasePool.getConnection();
            try {
                // Get list of ODC with customer count
                const [odcList] = await conn.query<RowDataPacket[]>(`
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
                
                // Get invoice statistics
                const [stats] = await conn.query<RowDataPacket[]>(`
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
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error loading print group:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman print kelompok'
            });
        }
    }

    // Print checklist for ODC
    public async printChecklist(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            console.log('=== PRINT CHECKLIST CALLED ===');
            const { odc_id } = req.params;
            const { format = 'a4' } = req.query; // Default to A4
            console.log('ODC ID:', odc_id, 'Format:', format);
            const conn = await databasePool.getConnection();
            
            try {
                // Get ODC info
                const [odcResult] = await conn.query<RowDataPacket[]>(
                    'SELECT id, olt_id, name, location, latitude, longitude, total_ports, used_ports, notes, created_at, updated_at FROM ftth_odc WHERE id = ?',
                    [odc_id]
                );
                
                if (odcResult.length === 0) {
                    res.status(404).send('ODC tidak ditemukan');
                    return;
                }
                
                const odc = odcResult[0];
                
                // Get customers with invoices in this ODC
                const [customers] = await conn.query<RowDataPacket[]>(`
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
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error generating checklist:', error);
            res.status(500).send('Gagal membuat checklist');
        }
    }

    // Print receipt
    public async printReceipt(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { paymentId } = req.params;
            
            const conn = await databasePool.getConnection();
            try {
                const [payments] = await conn.query<RowDataPacket[]>(`
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
                    LEFT JOIN pppoe_packages pp ON c.package_id = pp.id
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
                
                res.render('kasir/receipt', {
                    title: `Receipt #${paymentId}`,
                    payment: payment,
                    layout: false
                });
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error printing receipt:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal mencetak receipt'
            });
        }
    }

    // Halaman laporan kasir
    public async reports(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { startDate, endDate, type = 'daily' } = req.query;
            
            // Ambil data laporan
            const reports = await this.getKasirReports(
                startDate as string,
                endDate as string,
                type as string
            );

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
        } catch (error) {
            console.error('Error loading kasir reports:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat laporan'
            });
        }
    }

    // Export laporan kasir ke Excel
    public async exportReports(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { startDate, endDate, type = 'daily' } = req.query;
            
            // Ambil data laporan
            const reports = await this.getKasirReports(
                startDate as string,
                endDate as string,
                type as string
            );

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
            
            details.forEach((detail: any) => {
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
        } catch (error) {
            console.error('Error exporting kasir reports:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengekspor laporan'
            });
        }
    }

    // Proses pembayaran
    public async processPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { customerId, amount, paymentMethod, notes, paymentType } = req.body;

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
            if (paymentType !== 'debt' && !paymentMethod) {
                req.flash('error', 'Metode pembayaran harus dipilih');
                return res.redirect('/kasir/payments');
            }

            // Proses pembayaran
            const paymentResult = await this.processPaymentTransaction(
                parseInt(customerId),
                parseFloat(amount) || 0,
                paymentMethod || 'cash',
                notes || '',
                req.user!.id,
                paymentType
            );

            if (paymentResult.success) {
                // Redirect to print receipt page
                if (paymentResult.paymentId) {
                    return res.redirect(`/kasir/receipt/${paymentResult.paymentId}`);
                }
                req.flash('success', 'Pembayaran berhasil diproses');
                res.redirect('/kasir/payments');
            } else {
                req.flash('error', paymentResult.message || 'Gagal memproses pembayaran');
                res.redirect('/kasir/payments');
            }
        } catch (error) {
            console.error('Error processing payment:', error);
            req.flash('error', 'Terjadi kesalahan saat memproses pembayaran');
            res.redirect('/kasir/payments');
        }
    }

    // Helper methods
    private async getKasirStats(): Promise<any> {
        const conn = await databasePool.getConnection();
        try {
            // Get today's statistics
            const [todayStats] = await conn.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) as todayTransactions,
                    COALESCE(SUM(amount), 0) as todayRevenue
                FROM payments 
                WHERE DATE(payment_date) = CURDATE()
            `);

            // Get total statistics
            const [totalStats] = await conn.query<RowDataPacket[]>(`
                SELECT 
                    COUNT(*) as totalTransactions,
                    COALESCE(SUM(amount), 0) as totalRevenue
                FROM payments
            `);

            // Get pending invoices count
            const [pendingStats] = await conn.query<RowDataPacket[]>(`
                SELECT COUNT(*) as pendingPayments
                FROM invoices 
                WHERE status IN ('sent', 'partial', 'overdue')
            `);

            // Get payment method breakdown for today
            const [methodStats] = await conn.query<RowDataPacket[]>(`
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
        } catch (error) {
            console.error('Error getting kasir stats:', error);
            return {
                totalTransactions: 0,
                totalRevenue: 0,
                todayTransactions: 0,
                todayRevenue: 0,
                pendingPayments: 0,
                paymentMethods: []
            };
        } finally {
            conn.release();
        }
    }

    private async getTransactions(page: number, limit: number, search: string, status: string): Promise<any> {
        const conn = await databasePool.getConnection();
        try {
            const offset = (page - 1) * limit;
            
            // Build WHERE clause
            let whereClause = 'WHERE 1=1';
            const params: any[] = [];
            
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
            
            const [transactions] = await conn.query<RowDataPacket[]>(
                query,
                [...params, limit, offset]
            );
            
            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM payments p
                LEFT JOIN invoices i ON p.invoice_id = i.id
                LEFT JOIN customers c ON i.customer_id = c.id
                ${whereClause}
            `;
            
            const [countResult] = await conn.query<RowDataPacket[]>(countQuery, params);
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
        } catch (error) {
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
        } finally {
            conn.release();
        }
    }

    private async getKasirReports(startDate?: string, endDate?: string, type?: string): Promise<any> {
        const conn = await databasePool.getConnection();
        try {
            // Set default dates if not provided
            const end = endDate || new Date().toISOString().split('T')[0];
            const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            
            // Get summary statistics
            const [summary] = await conn.query<RowDataPacket[]>(`
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
            const [details] = await conn.query<RowDataPacket[]>(`
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
        } catch (error) {
            console.error('Error getting kasir reports:', error);
            return {
                summary: {},
                details: [],
                startDate: startDate,
                endDate: endDate
            };
        } finally {
            conn.release();
        }
    }

    private async processPaymentTransaction(
        customerId: number, 
        amount: number, 
        paymentMethod: string, 
        notes: string, 
        kasirId: number,
        paymentType: string
    ): Promise<{success: boolean, message?: string, paymentId?: number}> {
        const conn = await databasePool.getConnection();
        try {
            await conn.beginTransaction();
            
            // Get customer info
            const [customerRows] = await conn.query<RowDataPacket[]>(
                'SELECT id, customer_code, name, phone, email, address, odc_id, odp_id, connection_type, status, latitude, longitude, pppoe_username, pppoe_password, area, odc_location, custom_payment_deadline, custom_isolate_days_after_deadline, billing_mode, balance, late_payment_count, created_at, updated_at FROM customers WHERE id = ?',
                [customerId]
            );
            
            if (!customerRows || customerRows.length === 0) {
                await conn.rollback();
                return { success: false, message: 'Pelanggan tidak ditemukan' };
            }
            
            const customer = customerRows[0];
            
            // Get pending invoices for this customer
            const [invoices] = await conn.query<RowDataPacket[]>(`
                SELECT id, invoice_number, customer_id, subscription_id, period, due_date, subtotal, discount_amount, total_amount, paid_amount, remaining_amount, status, notes, created_at, updated_at FROM invoices 
                WHERE customer_id = ? 
                AND status IN ('sent', 'partial', 'overdue')
                ORDER BY period ASC
                LIMIT 1
            `, [customerId]);
            
            if (!invoices || invoices.length === 0) {
                await conn.rollback();
                return { success: false, message: 'Tidak ada tagihan yang perlu dibayar' };
            }
            
            const invoice = invoices[0];
            if (!invoice) {
                await conn.rollback();
                return { success: false, message: 'Invoice tidak ditemukan' };
            }
            const remainingAmount = invoice.remaining_amount || invoice.total_amount;
            
            // Determine payment amount based on type
            let paymentAmount = amount;
            if (paymentType === 'full') {
                paymentAmount = remainingAmount;
            } else if (paymentType === 'debt') {
                paymentAmount = 0; // No actual payment for debt
            }
            
            // Validate partial payment amount
            if (paymentType === 'partial' && paymentAmount > remainingAmount) {
                await conn.rollback();
                return { success: false, message: 'Jumlah pembayaran melebihi total tagihan' };
            }
            
            // Insert payment record
            const paymentStatus = paymentType === 'debt' ? 'pending' : 'completed';
            const [paymentResult] = await conn.query<ResultSetHeader>(`
                INSERT INTO payments (
                    invoice_id, 
                    payment_method, 
                    amount, 
                    payment_date,
                    gateway_status,
                    notes,
                    created_by,
                    created_at
                ) VALUES (?, ?, ?, NOW(), ?, ?, ?, NOW())
            `, [invoice.id, paymentMethod, paymentAmount, paymentStatus, notes || '', kasirId]);
            
            const paymentId = paymentResult.insertId;
            
            // Update invoice based on payment type
            let newPaidAmount = invoice.paid_amount || 0;
            let newRemainingAmount = remainingAmount;
            let newStatus = invoice.status;
            
            if (paymentType === 'full') {
                newPaidAmount += remainingAmount;
                newRemainingAmount = 0;
                newStatus = 'paid';
            } else if (paymentType === 'partial') {
                newPaidAmount += paymentAmount;
                newRemainingAmount -= paymentAmount;
                newStatus = newRemainingAmount <= 0 ? 'paid' : 'partial';
            } else if (paymentType === 'debt') {
                // For debt, just mark the invoice but don't change paid amount yet
                // Status remains as is or could be marked differently
                newStatus = 'debt'; // You may need to add this status to your database
            }
            
            await conn.query(`
                UPDATE invoices 
                SET paid_amount = ?,
                    remaining_amount = ?,
                    status = ?,
                    paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END
                WHERE id = ?
            `, [newPaidAmount, newRemainingAmount, newStatus, newStatus, invoice.id]);
            
            // If invoice is paid, remove isolation
            if (newStatus === 'paid') {
                await conn.query(
                    'UPDATE customers SET is_isolated = FALSE WHERE id = ?',
                    [customerId]
                );
            }
            
            await conn.commit();
            
            // Track late payment (async, don't wait)
            const paymentDateStr = new Date().toISOString().slice(0, 10);
            this.trackLatePayment(invoice.id, paymentId, paymentDateStr).catch(err => {
                console.error('Error tracking late payment:', err);
            });
            
            // Send WhatsApp notification (async, don't wait)
            this.sendPaymentNotification(customer, invoice, paymentAmount, paymentMethod, paymentId, paymentType).catch(err => {
                console.error('Error sending WhatsApp notification:', err);
            });
            
            return {
                success: true,
                message: 'Pembayaran berhasil diproses',
                paymentId: paymentId
            };
            
        } catch (error) {
            await conn.rollback();
            console.error('Error processing payment transaction:', error);
            return {
                success: false,
                message: 'Terjadi kesalahan saat memproses pembayaran'
            };
        } finally {
            conn.release();
        }
    }
    
    // Send WhatsApp notification after payment
    private async sendPaymentNotification(
        customer: any,
        invoice: any,
        amount: number,
        paymentMethod: string,
        paymentId: number,
        paymentType?: string
    ): Promise<void> {
        try {
            if (!customer.phone) {
                console.log('[KasirController] No phone number, skipping notification');
                return;
            }

            const { UnifiedNotificationService } = await import('../services/notification/UnifiedNotificationService');
            const { getBillingMonth } = await import('../utils/periodHelper');
            
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
            const variables: any = {
                customer_name: customer.name || 'Pelanggan',
                customer_code: customer.customer_code || '',
                invoice_number: invoice.invoice_number || '',
                billing_month: billingMonth,
                amount: amount.toLocaleString('id-ID'),
                payment_method: this.getPaymentMethodName(paymentMethod),
                payment_id: paymentId.toString()
            };
            
            if (paymentType === 'partial') {
                variables.total_amount = parseFloat(invoice.total_amount || 0).toLocaleString('id-ID');
                variables.paid_amount = amount.toLocaleString('id-ID');
                variables.remaining_amount = (parseFloat(invoice.remaining_amount || 0) - amount).toLocaleString('id-ID');
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
            
            // Queue notification using UnifiedNotificationService
            console.log(`[KasirController] 📤 Queueing ${notificationType} notification for customer ${customer.id}`);
            
            await UnifiedNotificationService.queueNotification({
                customer_id: customer.id,
                invoice_id: invoice.id,
                payment_id: paymentId,
                notification_type: notificationType,
                channels: ['whatsapp'],
                variables: variables,
                priority: 'high'
            });
            
            console.log(`[KasirController] ✅ Payment notification queued successfully`);
            
            // Try to process queue immediately (non-blocking)
            try {
                const result = await UnifiedNotificationService.sendPendingNotifications(10);
                console.log(`[KasirController] 📨 Processed queue: ${result.sent} sent, ${result.failed} failed`);
            } catch (queueError: any) {
                console.warn(`[KasirController] ⚠️ Queue processing error (non-critical):`, queueError.message);
                // Non-critical, notification is already queued
            }
            
        } catch (error) {
            console.error('[KasirController] Error sending payment notification:', error);
            // Don't throw error, just log it - payment should still succeed
        }
    }

    // Track late payment (internal helper)
    private async trackLatePayment(invoiceId: number, paymentId: number, paymentDate: string): Promise<void> {
        try {
            // Get invoice info
            const conn = await databasePool.getConnection();
            try {
                const [invoiceRows] = await conn.query<RowDataPacket[]>(
                    `SELECT due_date FROM invoices WHERE id = ?`,
                    [invoiceId]
                );

                if (invoiceRows.length === 0) {
                    return;
                }

                const invoice = invoiceRows[0];
                if (!invoice.due_date) {
                    return;
                }

                const paymentDateObj = new Date(paymentDate);
                const dueDateObj = new Date(invoice.due_date);

                // Import and track
                const { LatePaymentTrackingService } = await import('../services/billing/LatePaymentTrackingService');
                await LatePaymentTrackingService.trackPayment(
                    invoiceId,
                    paymentId,
                    paymentDateObj,
                    dueDateObj
                );
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('[KasirController] Error in trackLatePayment:', error);
            // Don't throw - this is non-critical
        }
    }
    
    private getPaymentMethodName(method: string): string {
        const methods: { [key: string]: string } = {
            'cash': 'Tunai',
            'transfer': 'Transfer Bank',
            'gateway': 'Payment Gateway',
            'ewallet': 'E-Wallet',
            'qris': 'QRIS'
        };
        return methods[method] || method;
    }

    // Halaman verifikasi pembayaran prepaid
    public async prepaidVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { PrepaidPaymentService } = await import('../services/prepaid/PrepaidPaymentService');
            const pendingPayments = await PrepaidPaymentService.getPendingTransactions();

            // Get statistics
            const conn = await databasePool.getConnection();
            try {
                const [stats] = await conn.query<RowDataPacket[]>(`
                    SELECT 
                        COUNT(*) as total_pending,
                        SUM(amount) as total_amount,
                        COUNT(CASE WHEN TIMESTAMPDIFF(HOUR, created_at, NOW()) > 24 THEN 1 END) as overdue_24h
                    FROM prepaid_transactions
                    WHERE payment_status = 'pending' AND payment_method = 'manual_transfer'
                `);

                res.render('kasir/prepaid-verification', {
                    title: 'Verifikasi Pembayaran Prepaid',
                    currentPath: '/kasir/prepaid-verification',
                    user: req.user,
                    pendingPayments: pendingPayments || [],
                    stats: stats[0] || {}
                });
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error loading prepaid verification:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman verifikasi prepaid'
            });
        }
    }

    // Verify prepaid payment
    public async verifyPrepaidPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { transactionId } = req.params;
            const { notes } = req.body;
            const kasirId = req.user!.id;

            const { PrepaidPaymentService } = await import('../services/prepaid/PrepaidPaymentService');
            const PrepaidActivationService = (await import('../services/prepaid/PrepaidActivationService')).default;
            // WhatsApp service removed

            // Verify payment
            await PrepaidPaymentService.verifyPayment(parseInt(transactionId), kasirId, notes);

            // Activate package
            const activationResult = await PrepaidActivationService.activateFromTransaction(parseInt(transactionId!));

            if (!activationResult.success) {
                return res.json({
                    success: false,
                    error: 'Pembayaran diverifikasi tapi aktivasi gagal: ' + activationResult.error
                });
            }

            // Send notification
            try {
                const conn = await databasePool.getConnection();
                try {
                    const [rows] = await conn.query<RowDataPacket[]>(
                        'SELECT customer_id FROM prepaid_transactions WHERE id = ?',
                        [transactionId]
                    );
                    if (rows.length > 0) {
                        // WhatsApp notification removed
                        // await WhatsAppNotificationService.sendPrepaidPaymentVerifiedNotification(
                        //     parseInt(transactionId),
                        //     rows[0].customer_id
                        // );
                    }
                } finally {
                    conn.release();
                }
            } catch (notifError) {
                console.error('Failed to send notification:', notifError);
            }

            res.json({
                success: true,
                message: 'Pembayaran berhasil diverifikasi dan paket diaktifkan',
                subscription_id: activationResult.subscription_id
            });
        } catch (error) {
            console.error('Error verifying prepaid payment:', error);
            res.json({
                success: false,
                error: error instanceof Error ? error.message : 'Gagal memverifikasi pembayaran'
            });
        }
    }

    // Reject prepaid payment
    public async rejectPrepaidPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { transactionId } = req.params;
            const { reason } = req.body;
            const kasirId = req.user!.id;

            const { PrepaidPaymentService } = await import('../services/prepaid/PrepaidPaymentService');
            // WhatsApp service removed

            await PrepaidPaymentService.rejectPayment(parseInt(transactionId), kasirId, reason || 'Ditolak oleh kasir');

            // Send notification
            try {
                const conn = await databasePool.getConnection();
                try {
                    const [rows] = await conn.query<RowDataPacket[]>(
                        'SELECT customer_id FROM prepaid_transactions WHERE id = ?',
                        [transactionId]
                    );
                    if (rows.length > 0) {
                        // WhatsApp notification removed
                        // await WhatsAppNotificationService.sendPrepaidPaymentRejectedNotification(
                        //     parseInt(transactionId),
                        //     rows[0].customer_id,
                        //     reason || 'Ditolak oleh kasir'
                        // );
                    }
                } finally {
                    conn.release();
                }
            } catch (notifError) {
                console.error('Failed to send notification:', notifError);
            }

            res.json({
                success: true,
                message: 'Pembayaran berhasil ditolak'
            });
        } catch (error) {
            console.error('Error rejecting prepaid payment:', error);
            res.json({
                success: false,
                error: error instanceof Error ? error.message : 'Gagal menolak pembayaran'
            });
        }
    }

    // Print invoice individual
    public async printInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { invoiceId } = req.params;
            
            const conn = await databasePool.getConnection();
            try {
                const [invoices] = await conn.query<RowDataPacket[]>(`
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
                    return res.status(404).send('Invoice tidak ditemukan');
                }
                
                const invoice = invoices[0];
                
                // Get invoice items
                const [items] = await conn.query<RowDataPacket[]>(`
                    SELECT id, invoice_id, description, quantity, unit_price, total_price, created_at FROM invoice_items WHERE invoice_id = ? ORDER BY id
                `, [invoiceId]);
                
                res.render('kasir/print-invoice', {
                    title: `Print Invoice ${invoice.invoice_number}`,
                    invoice,
                    items,
                    layout: false
                });
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error printing invoice:', error);
            res.status(500).send('Gagal mencetak invoice');
        }
    }

    // Export payment records
    public async exportPaymentRecords(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { startDate, endDate } = req.query;
            
            const conn = await databasePool.getConnection();
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
                
                const params: any[] = [];
                
                if (startDate) {
                    query += ' AND DATE(p.payment_date) >= ?';
                    params.push(startDate);
                }
                
                if (endDate) {
                    query += ' AND DATE(p.payment_date) <= ?';
                    params.push(endDate);
                }
                
                query += ' ORDER BY p.payment_date DESC, p.created_at DESC';
                
                const [records] = await conn.query<RowDataPacket[]>(query, params);
                
                // Create Excel workbook
                const wb = XLSX.utils.book_new();
                
                // Prepare data
                const excelData = [
                    ['TANGGAL', 'CUSTOMER CODE', 'NAMA', 'TELEPON', 'NO INVOICE', 'PERIODE', 'JUMLAH', 'METODE', 'REFERENSI', 'CATATAN', 'KASIR']
                ];
                
                records.forEach((record: any) => {
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
                const totalAmount = records.reduce((sum: number, r: any) => sum + (parseFloat(r.amount) || 0), 0);
                excelData.push([]);
                excelData.push(['TOTAL', '', '', '', '', '', totalAmount, '', '', '', '']);
                
                const ws = XLSX.utils.aoa_to_sheet(excelData);
                XLSX.utils.book_append_sheet(wb, ws, 'Pembayaran');
                
                // Generate buffer
                const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
                
                // Set headers
                const filename = `Pencatatan_Pembayaran_${startDate || 'all'}_${endDate || 'all'}.xlsx`;
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                
                res.send(excelBuffer);
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error exporting payment records:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengekspor data pembayaran'
            });
        }
    }

    // Print payment receipt
    public async printPaymentRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { paymentId } = req.params;
            
            const conn = await databasePool.getConnection();
            try {
                const [payments] = await conn.query<RowDataPacket[]>(`
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
            } finally {
                conn.release();
            }
        } catch (error) {
            console.error('Error printing payment record:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal mencetak bukti pembayaran'
            });
        }
    }
}

