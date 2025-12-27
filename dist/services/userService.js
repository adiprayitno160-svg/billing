"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const pool_1 = require("../db/pool");
const bcrypt_1 = __importDefault(require("bcrypt"));
class UserService {
    // Dapatkan semua user
    async getAllUsers() {
        try {
            const [rows] = await pool_1.databasePool.execute('SELECT id, username, email, full_name, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC');
            return rows;
        }
        catch (error) {
            console.error('Error getting all users:', error);
            throw new Error('Gagal mengambil data user');
        }
    }
    // Dapatkan user by ID
    async getUserById(id) {
        try {
            const [rows] = await pool_1.databasePool.execute('SELECT id, username, email, full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?', [id]);
            const users = rows;
            return users.length > 0 ? users[0] : null;
        }
        catch (error) {
            console.error('Error getting user by ID:', error);
            throw new Error('Gagal mengambil data user');
        }
    }
    // Dapatkan user by username
    async getUserByUsername(username) {
        try {
            const [rows] = await pool_1.databasePool.execute('SELECT id, username, email, full_name, role, is_active, created_at, updated_at FROM users WHERE username = ?', [username]);
            const users = rows;
            return users.length > 0 ? users[0] : null;
        }
        catch (error) {
            console.error('Error getting user by username:', error);
            throw new Error('Gagal mengambil data user');
        }
    }
    // Dapatkan user by email
    async getUserByEmail(email) {
        try {
            const [rows] = await pool_1.databasePool.execute('SELECT id, username, email, full_name, role, is_active, created_at, updated_at FROM users WHERE email = ?', [email]);
            const users = rows;
            return users.length > 0 ? users[0] : null;
        }
        catch (error) {
            console.error('Error getting user by email:', error);
            throw new Error('Gagal mengambil data user');
        }
    }
    // Buat user baru
    async createUser(userData) {
        try {
            // Cek apakah username sudah ada
            const existingUser = await this.getUserByUsername(userData.username);
            if (existingUser) {
                throw new Error('Username sudah digunakan');
            }
            // Cek apakah email sudah ada
            const existingEmail = await this.getUserByEmail(userData.email);
            if (existingEmail) {
                throw new Error('Email sudah digunakan');
            }
            // Hash password
            const saltRounds = 10;
            const hashedPassword = await bcrypt_1.default.hash(userData.password, saltRounds);
            const [result] = await pool_1.databasePool.execute('INSERT INTO users (username, email, password, role, full_name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())', [userData.username, userData.email, hashedPassword, userData.role, userData.full_name]);
            const insertResult = result;
            return insertResult.insertId;
        }
        catch (error) {
            console.error('Error creating user:', error);
            throw new Error(error.message || 'Gagal membuat user');
        }
    }
    // Update user
    async updateUser(id, userData) {
        try {
            // Cek apakah user ada
            const existingUser = await this.getUserById(id);
            if (!existingUser) {
                throw new Error('User tidak ditemukan');
            }
            // Cek apakah username sudah digunakan oleh user lain
            const userWithUsername = await this.getUserByUsername(userData.username);
            if (userWithUsername && userWithUsername.id !== id) {
                throw new Error('Username sudah digunakan');
            }
            // Cek apakah email sudah digunakan oleh user lain
            const userWithEmail = await this.getUserByEmail(userData.email);
            if (userWithEmail && userWithEmail.id !== id) {
                throw new Error('Email sudah digunakan');
            }
            let query = 'UPDATE users SET username = ?, email = ?, role = ?, full_name = ?, updated_at = NOW()';
            const params = [userData.username, userData.email, userData.role, userData.full_name];
            // Update password jika disediakan
            if (userData.password) {
                const saltRounds = 10;
                const hashedPassword = await bcrypt_1.default.hash(userData.password, saltRounds);
                query += ', password = ?';
                params.push(hashedPassword);
            }
            query += ' WHERE id = ?';
            params.push(id);
            await pool_1.databasePool.execute(query, params);
        }
        catch (error) {
            console.error('Error updating user:', error);
            throw new Error(error.message || 'Gagal memperbarui user');
        }
    }
    // Hapus user
    async deleteUser(id) {
        try {
            // Cek apakah user ada
            const existingUser = await this.getUserById(id);
            if (!existingUser) {
                throw new Error('User tidak ditemukan');
            }
            await pool_1.databasePool.execute('DELETE FROM users WHERE id = ?', [id]);
        }
        catch (error) {
            console.error('Error deleting user:', error);
            throw new Error(error.message || 'Gagal menghapus user');
        }
    }
    // Toggle status user (aktif/nonaktif)
    async toggleUserStatus(id) {
        try {
            // Cek apakah user ada
            const existingUser = await this.getUserById(id);
            if (!existingUser) {
                throw new Error('User tidak ditemukan');
            }
            const newStatus = existingUser.is_active ? 0 : 1;
            await pool_1.databasePool.execute('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?', [newStatus, id]);
        }
        catch (error) {
            console.error('Error toggling user status:', error);
            throw new Error(error.message || 'Gagal mengubah status user');
        }
    }
    // Verifikasi password
    async verifyPassword(userId, password) {
        try {
            const [rows] = await pool_1.databasePool.execute('SELECT password FROM users WHERE id = ?', [userId]);
            const users = rows;
            if (users.length === 0) {
                return false;
            }
            return await bcrypt_1.default.compare(password, users[0].password);
        }
        catch (error) {
            console.error('Error verifying password:', error);
            return false;
        }
    }
    // Update password
    async updatePassword(userId, newPassword) {
        try {
            const saltRounds = 10;
            const hashedPassword = await bcrypt_1.default.hash(newPassword, saltRounds);
            await pool_1.databasePool.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, userId]);
        }
        catch (error) {
            console.error('Error updating password:', error);
            throw new Error('Gagal memperbarui password');
        }
    }
}
exports.UserService = UserService;
//# sourceMappingURL=userService.js.map