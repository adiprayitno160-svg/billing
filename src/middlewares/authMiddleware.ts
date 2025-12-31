import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        username: string;
        email: string;
        full_name: string;
        role: 'superadmin' | 'operator' | 'teknisi' | 'kasir';
        is_active: boolean;
        session_id?: string;
        created_at: Date;
        updated_at: Date;
    };
}

// Simple auth check middleware functions
export const isAuthenticated = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req.session as any)?.userId;

        if (!userId) {
            req.flash('error', 'Anda harus login terlebih dahulu');
            return res.redirect('/login');
        }

        const userService = new UserService();
        const user = await userService.getUserById(userId);

        if (!user || !user.is_active) {
            req.flash('error', 'Akun tidak aktif atau tidak ditemukan');
            return res.redirect('/login');
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        req.flash('error', 'Terjadi kesalahan pada sistem autentikasi');
        res.redirect('/login');
    }
};

export const isAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req.session as any)?.userId;

        if (!userId) {
            req.flash('error', 'Anda harus login terlebih dahulu');
            return res.redirect('/login');
        }

        const userService = new UserService();
        const user = await userService.getUserById(userId);

        if (!user || !user.is_active) {
            req.flash('error', 'Akun tidak aktif atau tidak ditemukan');
            return res.redirect('/login');
        }

        if (user.role !== 'superadmin' && user.role !== 'operator') {
            req.flash('error', 'Akses ditolak. Anda tidak memiliki hak akses');
            res.redirect('/');
            return;
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        req.flash('error', 'Terjadi kesalahan pada sistem autentikasi');
        res.redirect('/login');
    }
};

export class AuthMiddleware {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    // Middleware untuk memeriksa apakah user sudah login
    public requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req.session as any)?.userId;

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
                res.redirect('/login');
                return;
            }

            const user = await this.userService.getUserById(userId);

            if (!user || !user.is_active) {
                req.flash('error', 'Akun tidak aktif atau tidak ditemukan');
                res.redirect('/login');
                return;
            }

            // Single Session Enforcement
            if (user.session_id && user.session_id !== req.sessionID) {
                req.session.destroy(() => {
                    res.clearCookie('connect.sid');
                    res.redirect('/login?error=Sesi berakhir. Akun Anda telah login di perangkat lain.');
                });
                return;
            }

            req.user = user;
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            req.flash('error', 'Terjadi kesalahan pada sistem autentikasi');
            res.redirect('/login');
        }
    };

    // Middleware untuk memeriksa role kasir
    public requireKasir = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                req.flash('error', 'Anda harus login terlebih dahulu');
                res.redirect('/kasir/login');
                return;
            }

            if (req.user.role !== 'kasir') {
                req.flash('error', 'Akses ditolak. Hanya kasir yang dapat mengakses halaman ini');
                res.redirect('/kasir/login');
                return;
            }

            next();
        } catch (error) {
            console.error('Kasir role middleware error:', error);
            req.flash('error', 'Terjadi kesalahan pada sistem autentikasi');
            res.redirect('/kasir/login');
        }
    };

    // Middleware untuk memeriksa apakah user sudah login (untuk redirect jika sudah login)
    public redirectIfAuthenticated = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req.session as any)?.userId;

            if (userId) {
                const user = await this.userService.getUserById(userId);

                if (user && user.is_active) {
                    if (user.role === 'kasir') {
                        res.redirect('/kasir/dashboard');
                        return;
                    } else {
                        res.redirect('/');
                        return;
                    }
                }
            }

            next();
        } catch (error) {
            console.error('Redirect if authenticated middleware error:', error);
            next();
        }
    };

    // Middleware untuk mencegah kasir mengakses halaman non-kasir
    public requireNonKasir = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (req.user && req.user.role === 'kasir') {
                req.flash('error', 'Akses ditolak. Silakan gunakan portal kasir.');
                res.redirect('/kasir/dashboard');
                return;
            }

            next();
        } catch (error) {
            console.error('Non-kasir middleware error:', error);
            next();
        }
    };
}
