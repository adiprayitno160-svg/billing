import { databasePool } from '../db/pool';
import bcrypt from 'bcrypt';

export interface User {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: 'superadmin' | 'operator' | 'teknisi' | 'kasir';
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserData {
    username: string;
    email: string;
    password: string;
    role: 'superadmin' | 'operator' | 'teknisi' | 'kasir';
    full_name: string;
}

export interface UpdateUserData {
    username: string;
    email: string;
    role: 'superadmin' | 'operator' | 'teknisi' | 'kasir';
    full_name: string;
    password?: string;
}

export class UserService {
    // Dapatkan semua user
    public async getAllUsers(): Promise<User[]> {
        try {
            const [rows] = await databasePool.execute(
                'SELECT id, username, email, full_name, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC'
            );
            return rows as User[];
        } catch (error) {
            console.error('Error getting all users:', error);
            throw new Error('Gagal mengambil data user');
        }
    }

    // Dapatkan user by ID
    public async getUserById(id: number): Promise<User | null> {
        try {
            const [rows] = await databasePool.execute(
                'SELECT id, username, email, full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?',
                [id]
            );
            const users = rows as User[];
            return users.length > 0 ? users[0] as User : null;
        } catch (error) {
            console.error('Error getting user by ID:', error);
            throw new Error('Gagal mengambil data user');
        }
    }

    // Dapatkan user by username
    public async getUserByUsername(username: string): Promise<User | null> {
        try {
            const [rows] = await databasePool.execute(
                'SELECT id, username, email, full_name, role, is_active, created_at, updated_at FROM users WHERE username = ?',
                [username]
            );
            const users = rows as User[];
            return users.length > 0 ? users[0] as User : null;
        } catch (error) {
            console.error('Error getting user by username:', error);
            throw new Error('Gagal mengambil data user');
        }
    }

    // Dapatkan user by email
    public async getUserByEmail(email: string): Promise<User | null> {
        try {
            const [rows] = await databasePool.execute(
                'SELECT id, username, email, full_name, role, is_active, created_at, updated_at FROM users WHERE email = ?',
                [email]
            );
            const users = rows as User[];
            return users.length > 0 ? users[0] as User : null;
        } catch (error) {
            console.error('Error getting user by email:', error);
            throw new Error('Gagal mengambil data user');
        }
    }

    // Buat user baru
    public async createUser(userData: CreateUserData): Promise<number> {
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
            const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

            const [result] = await databasePool.execute(
                'INSERT INTO users (username, email, password, role, full_name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())',
                [userData.username, userData.email, hashedPassword, userData.role, userData.full_name]
            );

            const insertResult = result as any;
            return insertResult.insertId;
        } catch (error: any) {
            console.error('Error creating user:', error);
            throw new Error(error.message || 'Gagal membuat user');
        }
    }

    // Update user
    public async updateUser(id: number, userData: UpdateUserData): Promise<void> {
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
            const params: any[] = [userData.username, userData.email, userData.role, userData.full_name];

            // Update password jika disediakan
            if (userData.password) {
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
                query += ', password = ?';
                params.push(hashedPassword);
            }

            query += ' WHERE id = ?';
            params.push(id);

            await databasePool.execute(query, params);
        } catch (error: any) {
            console.error('Error updating user:', error);
            throw new Error(error.message || 'Gagal memperbarui user');
        }
    }

    // Hapus user
    public async deleteUser(id: number): Promise<void> {
        try {
            // Cek apakah user ada
            const existingUser = await this.getUserById(id);
            if (!existingUser) {
                throw new Error('User tidak ditemukan');
            }

            await databasePool.execute('DELETE FROM users WHERE id = ?', [id]);
        } catch (error: any) {
            console.error('Error deleting user:', error);
            throw new Error(error.message || 'Gagal menghapus user');
        }
    }

    // Toggle status user (aktif/nonaktif)
    public async toggleUserStatus(id: number): Promise<void> {
        try {
            // Cek apakah user ada
            const existingUser = await this.getUserById(id);
            if (!existingUser) {
                throw new Error('User tidak ditemukan');
            }

            const newStatus = existingUser.is_active ? 0 : 1;
            await databasePool.execute(
                'UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?',
                [newStatus, id]
            );
        } catch (error: any) {
            console.error('Error toggling user status:', error);
            throw new Error(error.message || 'Gagal mengubah status user');
        }
    }

    // Verifikasi password
    public async verifyPassword(userId: number, password: string): Promise<boolean> {
        try {
            const [rows] = await databasePool.execute(
                'SELECT password FROM users WHERE id = ?',
                [userId]
            );
            const users = rows as any[];
            
            if (users.length === 0) {
                return false;
            }

            return await bcrypt.compare(password, users[0].password);
        } catch (error) {
            console.error('Error verifying password:', error);
            return false;
        }
    }

    // Update password
    public async updatePassword(userId: number, newPassword: string): Promise<void> {
        try {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            
            await databasePool.execute(
                'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
                [hashedPassword, userId]
            );
        } catch (error) {
            console.error('Error updating password:', error);
            throw new Error('Gagal memperbarui password');
        }
    }
}
