"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMiddleware = exports.isAdmin = exports.isAuthenticated = void 0;
const userService_1 = require("../services/userService");
// Simple auth check middleware functions
const isAuthenticated = async (req, res, next) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            req.flash('error', 'Anda harus login terlebih dahulu');
            return res.redirect('/login');
        }
        const userService = new userService_1.UserService();
        const user = await userService.getUserById(userId);
        if (!user || !user.is_active) {
            req.flash('error', 'Akun tidak aktif atau tidak ditemukan');
            return res.redirect('/login');
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        req.flash('error', 'Terjadi kesalahan pada sistem autentikasi');
        res.redirect('/login');
    }
};
exports.isAuthenticated = isAuthenticated;
const isAdmin = async (req, res, next) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            req.flash('error', 'Anda harus login terlebih dahulu');
            return res.redirect('/login');
        }
        const userService = new userService_1.UserService();
        const user = await userService.getUserById(userId);
        if (!user || !user.is_active) {
            req.flash('error', 'Akun tidak aktif atau tidak ditemukan');
            return res.redirect('/login');
        }
        if (user.role !== 'superadmin' && user.role !== 'operator') {
            req.flash('error', 'Akses ditolak. Anda tidak memiliki hak akses');
            return res.redirect('/');
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error('Admin middleware error:', error);
        req.flash('error', 'Terjadi kesalahan pada sistem autentikasi');
        res.redirect('/login');
    }
};
exports.isAdmin = isAdmin;
class AuthMiddleware {
    constructor() {
        // Middleware untuk memeriksa apakah user sudah login
        this.requireAuth = async (req, res, next) => {
            try {
                const userId = req.session?.userId;
                if (!userId) {
                    // Check if this is an API request (JSON expected)
                    const acceptsJson = req.headers.accept?.includes('application/json') ||
                        req.headers['content-type']?.includes('application/json');
                    if (acceptsJson || req.method === 'DELETE' || req.method === 'PUT' || req.method === 'PATCH') {
                        res.status(401).json({
                            success: false,
                            error: 'Unauthorized: Anda harus login terlebih dahulu'
                        });
                    }
                    req.flash('error', 'Anda harus login terlebih dahulu');
                    return res.redirect('/login');
                }
                const user = await this.userService.getUserById(userId);
                if (!user || !user.is_active) {
                    req.flash('error', 'Akun tidak aktif atau tidak ditemukan');
                    return res.redirect('/login');
                }
                req.user = user;
                next();
            }
            catch (error) {
                console.error('Auth middleware error:', error);
                req.flash('error', 'Terjadi kesalahan pada sistem autentikasi');
                res.redirect('/login');
            }
        };
        // Middleware untuk memeriksa role kasir
        this.requireKasir = async (req, res, next) => {
            try {
                if (!req.user) {
                    req.flash('error', 'Anda harus login terlebih dahulu');
                    return res.redirect('/kasir/login');
                }
                if (req.user.role !== 'kasir') {
                    req.flash('error', 'Akses ditolak. Hanya kasir yang dapat mengakses halaman ini');
                    return res.redirect('/kasir/login');
                }
                next();
            }
            catch (error) {
                console.error('Kasir role middleware error:', error);
                req.flash('error', 'Terjadi kesalahan pada sistem autentikasi');
                res.redirect('/kasir/login');
            }
        };
        // Middleware untuk memeriksa apakah user sudah login (untuk redirect jika sudah login)
        this.redirectIfAuthenticated = async (req, res, next) => {
            try {
                const userId = req.session?.userId;
                if (userId) {
                    const user = await this.userService.getUserById(userId);
                    if (user && user.is_active) {
                        if (user.role === 'kasir') {
                            return res.redirect('/kasir/dashboard');
                        }
                        else {
                            return res.redirect('/');
                        }
                    }
                }
                next();
            }
            catch (error) {
                console.error('Redirect if authenticated middleware error:', error);
                next();
            }
        };
        // Middleware untuk mencegah kasir mengakses halaman non-kasir
        this.requireNonKasir = async (req, res, next) => {
            try {
                if (req.user && req.user.role === 'kasir') {
                    req.flash('error', 'Akses ditolak. Silakan gunakan portal kasir.');
                    return res.redirect('/kasir/dashboard');
                }
                next();
            }
            catch (error) {
                console.error('Non-kasir middleware error:', error);
                next();
            }
        };
        this.userService = new userService_1.UserService();
    }
}
exports.AuthMiddleware = AuthMiddleware;
//# sourceMappingURL=authMiddleware.js.map