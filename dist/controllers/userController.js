"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const userService_1 = require("../services/userService");
class UserController {
    constructor() {
        this.userService = new userService_1.UserService();
    }
    // Halaman utama user management
    async index(req, res) {
        try {
            const users = await this.userService.getAllUsers();
            res.render('settings/users/index', {
                title: 'User Management',
                users: users,
                currentPath: '/settings/users'
            });
        }
        catch (error) {
            console.error('Error loading users:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat data user'
            });
        }
    }
    // Form tambah user
    async createForm(req, res) {
        try {
            res.render('settings/users/create', {
                title: 'Tambah User Baru',
                currentPath: '/settings/users'
            });
        }
        catch (error) {
            console.error('Error loading create form:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat form tambah user'
            });
        }
    }
    // Proses tambah user
    async create(req, res) {
        try {
            const { username, email, password, role, full_name } = req.body;
            // Validasi input
            if (!username || !email || !password || !role || !full_name) {
                req.flash('error', 'Semua field harus diisi');
                return res.redirect('/settings/users/create');
            }
            // Validasi role
            const validRoles = ['superadmin', 'operator', 'teknisi', 'kasir'];
            if (!validRoles.includes(role)) {
                req.flash('error', 'Role tidak valid');
                return res.redirect('/settings/users/create');
            }
            const userId = await this.userService.createUser({
                username,
                email,
                password,
                role,
                full_name
            });
            req.flash('success', 'User berhasil ditambahkan');
            res.redirect('/settings/users');
        }
        catch (error) {
            console.error('Error creating user:', error);
            req.flash('error', error.message || 'Gagal menambahkan user');
            res.redirect('/settings/users/create');
        }
    }
    // Form edit user
    async editForm(req, res) {
        try {
            const { id } = req.params;
            const user = await this.userService.getUserById(parseInt(id));
            if (!user) {
                req.flash('error', 'User tidak ditemukan');
                return res.redirect('/settings/users');
            }
            res.render('settings/users/edit', {
                title: 'Edit User',
                user: user,
                currentPath: '/settings/users'
            });
        }
        catch (error) {
            console.error('Error loading edit form:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat form edit user'
            });
        }
    }
    // Proses update user
    async update(req, res) {
        try {
            const { id } = req.params;
            const { username, email, role, full_name, password } = req.body;
            // Validasi input
            if (!username || !email || !role || !full_name) {
                req.flash('error', 'Semua field harus diisi');
                return res.redirect(`/settings/users/${id}/edit`);
            }
            // Validasi role
            const validRoles = ['superadmin', 'operator', 'teknisi', 'kasir'];
            if (!validRoles.includes(role)) {
                req.flash('error', 'Role tidak valid');
                return res.redirect(`/settings/users/${id}/edit`);
            }
            await this.userService.updateUser(parseInt(id), {
                username,
                email,
                role,
                full_name,
                password: password || undefined // Password opsional untuk update
            });
            req.flash('success', 'User berhasil diperbarui');
            res.redirect('/settings/users');
        }
        catch (error) {
            console.error('Error updating user:', error);
            req.flash('error', error.message || 'Gagal memperbarui user');
            res.redirect(`/settings/users/${req.params.id}/edit`);
        }
    }
    // Hapus user
    async delete(req, res) {
        try {
            const { id } = req.params;
            await this.userService.deleteUser(parseInt(id));
            req.flash('success', 'User berhasil dihapus');
            res.redirect('/settings/users');
        }
        catch (error) {
            console.error('Error deleting user:', error);
            req.flash('error', error.message || 'Gagal menghapus user');
            res.redirect('/settings/users');
        }
    }
    // Toggle status user (aktif/nonaktif)
    async toggleStatus(req, res) {
        try {
            const { id } = req.params;
            await this.userService.toggleUserStatus(parseInt(id));
            req.flash('success', 'Status user berhasil diubah');
            res.redirect('/settings/users');
        }
        catch (error) {
            console.error('Error toggling user status:', error);
            req.flash('error', error.message || 'Gagal mengubah status user');
            res.redirect('/settings/users');
        }
    }
}
exports.UserController = UserController;
//# sourceMappingURL=userController.js.map