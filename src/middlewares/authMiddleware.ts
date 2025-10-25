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
            return res.redirect('/');
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
                return res.redirect('/kasir/login');
            }

            if (req.user.role !== 'kasir') {
                req.flash('error', 'Akses ditolak. Hanya kasir yang dapat mengakses halaman ini');
                return res.redirect('/kasir/login');
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
                        return res.redirect('/kasir/dashboard');
                    } else {
                        return res.redirect('/');
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
                return res.redirect('/kasir/dashboard');
            }

            next();
        } catch (error) {
            console.error('Non-kasir middleware error:', error);
            next();
        }
    };
}
