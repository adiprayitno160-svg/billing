"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortalController = void 0;
const MikrotikService_1 = require("../../services/mikrotik/MikrotikService");
const pool_1 = require("../../db/pool");
const mikrotikConfigHelper_1 = require("../../utils/mikrotikConfigHelper");
class PortalController {
    constructor() {
        this.mikrotikService = null;
        // Mikrotik service will be initialized when needed
    }
    async getMikrotikService() {
        if (!this.mikrotikService) {
            // Get Mikrotik config using safe helper (never throws, returns null on error)
            const config = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            if (!config) {
                throw new Error('Konfigurasi Mikrotik belum diatur. Silakan setup di Settings > MikroTik');
            }
            this.mikrotikService = new MikrotikService_1.MikrotikService({
                host: config.host,
                username: config.username,
                password: config.password,
                port: config.port || config.api_port || 8728
            });
        }
        return this.mikrotikService;
    }
    /**
     * Halaman portal login
     */
    async getPortalLogin(req, res) {
        try {
            const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
            res.render('portal/login', {
                title: 'Portal Billing - Login',
                layout: 'layouts/portal',
                clientIP: clientIP,
                error: req.query.error || null,
                success: req.query.success || null
            });
        }
        catch (error) {
            console.error('Error rendering portal login:', error);
            res.status(500).render('portal/error', {
                title: 'Error',
                layout: 'layouts/portal',
                message: 'Terjadi kesalahan saat memuat halaman login'
            });
        }
    }
    /**
     * Proses login portal
     */
    async postPortalLogin(req, res) {
        try {
            const { username, password, client_ip } = req.body;
            if (!username || !password) {
                return res.redirect('/portal/login?error=Username dan password harus diisi');
            }
            // Cek customer di database - izinkan login untuk customer yang tidak diisolasi
            const [rows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE username = ? AND status = "active" AND is_isolated = 0', [username]);
            if (!Array.isArray(rows) || rows.length === 0) {
                // Cek apakah customer ada tapi diisolasi
                const [isolatedRows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE username = ? AND status = "active" AND is_isolated = 1', [username]);
                if (Array.isArray(isolatedRows) && isolatedRows.length > 0) {
                    return res.redirect('/portal/login?error=Akun Anda sedang diisolasi. Silakan hubungi administrator untuk informasi lebih lanjut');
                }
                return res.redirect('/portal/login?error=Username tidak ditemukan atau tidak aktif');
            }
            const customer = rows[0];
            // Verifikasi password (support bcrypt jika password di-hash, atau plain text untuk backward compatibility)
            let passwordMatch = false;
            try {
                // Try bcrypt comparison first (if password is hashed)
                if (customer.password && customer.password.startsWith('$2')) {
                    const bcrypt = require('bcrypt');
                    passwordMatch = await bcrypt.compare(password, customer.password);
                }
                else {
                    // Fallback to plain text comparison (for backward compatibility)
                    passwordMatch = customer.password === password;
                }
            }
            catch (bcryptError) {
                // If bcrypt fails, fallback to plain text
                passwordMatch = customer.password === password;
            }
            if (!passwordMatch) {
                return res.redirect('/portal/login?error=Password salah');
            }
            // Set session
            req.session.customerId = customer.id;
            req.session.customerUsername = customer.username;
            req.session.customerName = customer.name;
            // Redirect ke halaman paket
            res.redirect('/portal/packages');
        }
        catch (error) {
            console.error('Error processing portal login:', error);
            // Tampilkan error yang lebih informatif
            const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat login';
            res.redirect(`/portal/login?error=${encodeURIComponent(errorMessage)}`);
        }
    }
    /**
     * Halaman pilihan paket
     */
    async getPortalPackages(req, res) {
        try {
            if (!req.session.customerId) {
                return res.redirect('/portal/login?error=Silakan login terlebih dahulu');
            }
            // Validasi customerId adalah angka yang valid
            const customerId = req.session.customerId;
            const customerIdNum = parseInt(customerId);
            if (isNaN(customerIdNum) || customerIdNum <= 0) {
                return res.redirect('/portal/login?error=Session tidak valid, silakan login kembali');
            }
            // Ambil data paket aktif
            const [packages] = await pool_1.databasePool.query('SELECT * FROM prepaid_packages WHERE status = "active" ORDER BY price ASC');
            // Ambil data customer
            const [customerRows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE id = ?', [customerIdNum]);
            const customer = Array.isArray(customerRows) && customerRows.length > 0 ? customerRows[0] : null;
            res.render('portal/packages', {
                title: 'Pilih Paket Internet',
                layout: 'layouts/portal',
                packages: packages,
                customer: customer,
                success: req.query.success || null,
                error: req.query.error || null
            });
        }
        catch (error) {
            console.error('Error rendering portal packages:', error);
            // Tampilkan error yang lebih informatif
            const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat halaman paket';
            res.redirect(`/portal/login?error=${encodeURIComponent(errorMessage)}`);
        }
    }
    /**
     * Proses pembelian paket
     */
    async postPurchasePackage(req, res) {
        try {
            if (!req.session.customerId) {
                return res.redirect('/portal/login?error=Silakan login terlebih dahulu');
            }
            const { package_id } = req.body;
            const customerId = req.session.customerId;
            // Validasi package_id
            if (!package_id) {
                return res.redirect('/portal/packages?error=Paket harus dipilih');
            }
            // Validasi package_id adalah angka yang valid
            const packageIdNum = parseInt(package_id);
            if (isNaN(packageIdNum) || packageIdNum <= 0) {
                return res.redirect('/portal/packages?error=ID paket tidak valid');
            }
            // Validasi customerId adalah angka yang valid
            const customerIdNum = parseInt(customerId);
            if (isNaN(customerIdNum) || customerIdNum <= 0) {
                return res.redirect('/portal/login?error=Session tidak valid, silakan login kembali');
            }
            // Ambil data paket
            const [packageRows] = await pool_1.databasePool.query('SELECT * FROM prepaid_packages WHERE id = ? AND status = "active"', [packageIdNum]);
            if (!Array.isArray(packageRows) || packageRows.length === 0) {
                return res.redirect('/portal/packages?error=Paket tidak ditemukan');
            }
            const packageData = packageRows[0];
            // Cek saldo customer
            const [customerRows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE id = ?', [customerIdNum]);
            if (!Array.isArray(customerRows) || customerRows.length === 0) {
                return res.redirect('/portal/packages?error=Data customer tidak ditemukan');
            }
            const customer = customerRows[0];
            if (customer.balance < packageData.price) {
                return res.redirect('/portal/packages?error=Saldo tidak mencukupi. Saldo: Rp ' + customer.balance + ', Harga: Rp ' + packageData.price);
            }
            // Proses pembelian
            const connection = await pool_1.databasePool.getConnection();
            await connection.beginTransaction();
            try {
                // Kurangi saldo
                await connection.query('UPDATE customers SET balance = balance - ? WHERE id = ?', [packageData.price, customerIdNum]);
                // Buat transaksi
                await connection.query('INSERT INTO transactions (customer_id, package_id, amount, type, status, description) VALUES (?, ?, ?, "purchase", "completed", ?)', [
                    customerIdNum,
                    packageIdNum,
                    packageData.price,
                    `Pembelian paket ${packageData.name}`
                ]);
                // Tambahkan IP ke address list portal untuk akses internet
                const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
                if (clientIP) {
                    try {
                        await (await this.getMikrotikService()).addToPortalAddressList(clientIP, `Customer: ${customer.username} - Package: ${packageData.name}`);
                    }
                    catch (mikrotikError) {
                        // Log error but don't fail the transaction
                        console.error('Error adding IP to Mikrotik address list:', mikrotikError);
                        // Continue with transaction commit - customer payment is successful
                    }
                }
                await connection.commit();
                res.redirect('/portal/packages?success=Paket berhasil dibeli! Akses internet Anda telah diaktifkan.');
            }
            catch (error) {
                await connection.rollback();
                throw error;
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error('Error purchasing package:', error);
            // Tampilkan error yang lebih informatif
            const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat membeli paket';
            res.redirect(`/portal/packages?error=${encodeURIComponent(errorMessage)}`);
        }
    }
    /**
     * Logout portal
     */
    async postPortalLogout(req, res) {
        try {
            // Hapus IP dari address list jika ada
            const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
            if (clientIP) {
                try {
                    await (await this.getMikrotikService()).removeFromPortalAddressList(clientIP);
                }
                catch (mikrotikError) {
                    // Log error but don't fail logout
                    console.error('Error removing IP from Mikrotik address list:', mikrotikError);
                }
            }
            // Hapus session
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
                res.redirect('/portal/login?success=Anda telah logout');
            });
        }
        catch (error) {
            console.error('Error during logout:', error);
            res.redirect('/portal/login?error=Terjadi kesalahan saat logout');
        }
    }
    /**
     * Halaman profil customer
     */
    async getPortalProfile(req, res) {
        try {
            if (!req.session.customerId) {
                return res.redirect('/portal/login?error=Silakan login terlebih dahulu');
            }
            // Validasi customerId adalah angka yang valid
            const customerId = req.session.customerId;
            const customerIdNum = parseInt(customerId);
            if (isNaN(customerIdNum) || customerIdNum <= 0) {
                return res.redirect('/portal/login?error=Session tidak valid, silakan login kembali');
            }
            // Ambil data customer
            const [customerRows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE id = ?', [customerIdNum]);
            const customer = Array.isArray(customerRows) && customerRows.length > 0 ? customerRows[0] : null;
            if (!customer) {
                return res.redirect('/portal/login?error=Data customer tidak ditemukan');
            }
            // Ambil riwayat transaksi
            const [transactions] = await pool_1.databasePool.query('SELECT t.*, p.name as package_name FROM transactions t LEFT JOIN prepaid_packages p ON t.package_id = p.id WHERE t.customer_id = ? ORDER BY t.created_at DESC LIMIT 10', [customerIdNum]);
            res.render('portal/profile', {
                title: 'Profil Saya',
                layout: 'layouts/portal',
                customer: customer,
                transactions: transactions,
                success: req.query.success || null,
                error: req.query.error || null
            });
        }
        catch (error) {
            console.error('Error rendering portal profile:', error);
            // Tampilkan error yang lebih informatif
            const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat profil';
            res.redirect(`/portal/login?error=${encodeURIComponent(errorMessage)}`);
        }
    }
}
exports.PortalController = PortalController;
//# sourceMappingURL=PortalController.js.map