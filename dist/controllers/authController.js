"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const userService_1 = require("../services/userService");
class AuthController {
    constructor() {
        this.userService = new userService_1.UserService();
    }
    // Halaman login portal
    async loginForm(req, res) {
        try {
            // Handle session timeout - destroy session if timeout parameter exists
            if (req.query.timeout === '1') {
                req.session?.destroy(() => {
                    console.log('Session destroyed due to inactivity timeout');
                });
                req.flash('error', 'Session Anda telah berakhir karena tidak ada aktivitas selama 10 menit. Silakan login kembali.');
            }
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
            res.render('auth/login', {
                title: 'Login Portal',
                currentPath: '/login',
                layout: false // Tidak menggunakan layout untuk halaman login
            });
        }
        catch (error) {
            console.error('Error loading login form:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman login'
            });
        }
    }
    // Proses login portal
    async login(req, res) {
        try {
            const { username, password } = req.body;
            // Validasi input
            if (!username || !password) {
                req.flash('error', 'Username dan password harus diisi');
                return res.redirect('/login');
            }
            // Cari user berdasarkan username
            const user = await this.userService.getUserByUsername(username);
            if (!user) {
                req.flash('error', 'Username atau password salah');
                return res.redirect('/login');
            }
            // Cek apakah user aktif
            if (!user.is_active) {
                req.flash('error', 'Akun tidak aktif');
                return res.redirect('/login');
            }
            // Verifikasi password
            const isValidPassword = await this.userService.verifyPassword(user.id, password);
            if (!isValidPassword) {
                req.flash('error', 'Username atau password salah');
                return res.redirect('/login');
            }
            // Set session
            req.session.userId = user.id;
            req.session.userRole = user.role;
            req.session.username = user.username;
            req.flash('success', `Selamat datang, ${user.full_name}!`);
            // Redirect berdasarkan role
            if (user.role === 'kasir') {
                res.redirect('/kasir/dashboard');
            }
            else {
                res.redirect('/');
            }
        }
        catch (error) {
            console.error('Error during login:', error);
            req.flash('error', 'Terjadi kesalahan saat login');
            res.redirect('/login');
        }
    }
    // Logout
    async logout(req, res) {
        try {
            // Simpan pesan flash sebelum destroy session
            const userId = req.session?.userId;
            const username = req.session?.username;
            // Log untuk tracking
            if (userId) {
                console.log(`User ${username} (ID: ${userId}) logged out at ${new Date().toISOString()}`);
            }
            // Destroy session
            req.session?.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                    return res.redirect('/login?error=Gagal logout, silakan coba lagi');
                }
                // Clear cookie
                res.clearCookie('connect.sid');
                // Redirect ke login dengan pesan sukses
                res.redirect('/login?success=Anda telah berhasil logout');
            });
        }
        catch (error) {
            console.error('Error during logout:', error);
            res.redirect('/login?error=Terjadi kesalahan saat logout');
        }
    }
    // Inisialisasi user admin default
    async initializeDefaultUsers() {
        try {
            // Cek apakah user admin sudah ada
            const adminUser = await this.userService.getUserByUsername('admin');
            if (!adminUser) {
                // Buat user admin default (password akan di-hash oleh createUser)
                await this.userService.createUser({
                    username: 'admin',
                    email: 'admin@billing.com',
                    password: 'admin',
                    full_name: 'Administrator',
                    role: 'superadmin'
                });
                console.log('Default admin user created: admin/admin');
            }
            // Cek apakah user kasir sudah ada
            const kasirUser = await this.userService.getUserByUsername('kasir');
            if (!kasirUser) {
                // Buat user kasir default (password akan di-hash oleh createUser)
                await this.userService.createUser({
                    username: 'kasir',
                    email: 'kasir@billing.com',
                    password: 'kasir',
                    full_name: 'Kasir',
                    role: 'kasir'
                });
                console.log('Default kasir user created: kasir/kasir');
            }
        }
        catch (error) {
            console.error('Error initializing default users:', error);
        }
    }
    // Reset user kasir (hapus dan buat ulang)
    async resetKasirUser() {
        try {
            // Cari user kasir yang lama
            const kasirUser = await this.userService.getUserByUsername('kasir');
            if (kasirUser) {
                // Hapus user kasir yang lama
                await this.userService.deleteUser(kasirUser.id);
                console.log('Old kasir user deleted');
            }
            // Buat user kasir baru dengan password yang benar
            await this.userService.createUser({
                username: 'kasir',
                email: 'kasir@billing.com',
                password: 'kasir',
                full_name: 'Kasir',
                role: 'kasir'
            });
            console.log('New kasir user created: kasir/kasir');
        }
        catch (error) {
            console.error('Error resetting kasir user:', error);
            throw error;
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map