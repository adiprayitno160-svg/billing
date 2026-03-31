export interface User {
    id: number;
    username: string;
    email: string;
    phone: string | null;
    full_name: string;
    role: 'superadmin' | 'operator' | 'teknisi' | 'kasir';
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface CreateUserData {
    username: string;
    email: string;
    phone?: string;
    password: string;
    role: 'superadmin' | 'operator' | 'teknisi' | 'kasir';
    full_name: string;
}
export interface UpdateUserData {
    username: string;
    email: string;
    phone?: string;
    role: 'superadmin' | 'operator' | 'teknisi' | 'kasir';
    full_name: string;
    password?: string;
}
export declare class UserService {
    getAllUsers(): Promise<User[]>;
    getUserById(id: number): Promise<User | any>;
    getUserByUsername(username: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    createUser(userData: CreateUserData): Promise<number>;
    updateUser(id: number, userData: UpdateUserData): Promise<void>;
    deleteUser(id: number): Promise<void>;
    toggleUserStatus(id: number): Promise<void>;
    verifyPassword(userId: number, password: string): Promise<boolean>;
    updatePassword(userId: number, newPassword: string): Promise<void>;
    updateSessionId(userId: number, sessionId: string): Promise<void>;
}
//# sourceMappingURL=userService.d.ts.map