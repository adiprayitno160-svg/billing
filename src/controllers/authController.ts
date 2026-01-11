import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import bcrypt from 'bcrypt';

export class AuthController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    // Halaman login portal
    public async loginForm(req: Request, res: Response): Promise<void> {
        console.log('[Controller] AuthController.loginForm start ' + req.url);
        try {
            // Handle session timeout - destroy session if timeout parameter exists
            // Handle session timeout - destroy session if timeout parameter exists
            if (req.query.timeout === '1') {
                // if (req.session) {
                //     await new Promise<void>((resolve) => {
                //         req.session.destroy((err) => {
                //             if (err) console.error('Error causing session destroy:', err);
                //             console.log('Session destroyed due to inactivity timeout');
                //             resolve();
                //         });
                //     });
                // }
            }

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

            res.render('auth/login', {
                title: 'Login Portal',
                currentPath: '/login',
                layout: false // Tidak menggunakan layout untuk halaman login
            });
        } catch (error) {
            console.error('Error loading login form:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat halaman login'
            });
        }
    }

    // Proses login portal
    public async login(req: Request, res: Response): Promise<void> {
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
            (req.session as any).userId = user.id;
            (req.session as any).userRole = user.role;
            (req.session as any).username = user.username;

            // Single Session Enforcement: Update User's Session ID
            if (req.sessionID) {
                await this.userService.updateSessionId(user.id, req.sessionID);
            }

            req.flash('success', `Selamat datang, ${user.full_name}!`);

            // Force save session before redirect to ensure persistence
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving session before redirect:', err);
                }

                // Redirect berdasarkan role
                if (user.role === 'kasir') {
                    res.redirect('/kasir/dashboard');
                } else {
                    res.redirect('/');
                }
            });
        } catch (error) {
            console.error('Error during login:', error);
            req.flash('error', 'Terjadi kesalahan saat login');
            res.redirect('/login');
        }
    }

    // Logout
    public async logout(req: Request, res: Response): Promise<void> {
        try {
            // Simpan pesan flash sebelum destroy session
            const userId = (req.session as any)?.userId;
            const username = (req.session as any)?.username;

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
        } catch (error) {
            console.error('Error during logout:', error);
            res.redirect('/login?error=Terjadi kesalahan saat logout');
        }
    }

    // Inisialisasi user admin default
    public async initializeDefaultUsers(): Promise<void> {
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
        } catch (error) {
            console.error('Error initializing default users:', error);
        }
    }

    // Reset user kasir (hapus dan buat ulang)
    public async resetKasirUser(): Promise<void> {
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
        } catch (error) {
            console.error('Error resetting kasir user:', error);
            throw error;
        }
    }
}
