import { PppoeSecret, PppoeActiveConnection } from '../mikrotikService';
export interface MikrotikConfig {
    host: string;
    username: string;
    password: string;
    port?: number;
}
export interface MikrotikUser {
    id: string;
    name: string;
    password: string;
    profile: string;
    comment?: string;
}
export interface MikrotikAddressList {
    id: string;
    address: string;
    list: string;
    comment?: string;
}
export interface MikrotikProfile {
    id: string;
    name: string;
    localAddress?: string;
    remoteAddress?: string;
    rateLimit?: string;
    comment?: string;
}
export declare class MikrotikService {
    private static instance;
    private config;
    constructor(config: MikrotikConfig);
    /**
     * Get singleton instance of MikrotikService
     * Loads config from database automatically
     */
    static getInstance(): Promise<MikrotikService>;
    /**
     * Test koneksi ke Mikrotik
     */
    testConnection(): Promise<boolean>;
    /**
     * Buat PPPoE user baru
     */
    createPPPoEUser(userData: {
        name: string;
        password: string;
        profile: string;
        comment?: string;
    }): Promise<boolean>;
    /**
     * Update PPPoE user by ID
     */
    updatePPPoEUser(userId: string, userData: {
        password?: string;
        profile?: string;
        comment?: string;
    }): Promise<boolean>;
    /**
     * Update PPPoE user by username
     */
    updatePPPoEUserByUsername(username: string, userData: {
        password?: string;
        profile?: string;
        comment?: string;
        disabled?: boolean;
    }): Promise<boolean>;
    /**
     * Disconnect active PPPoE user (force reconnect)
     */
    disconnectPPPoEUser(username: string): Promise<boolean>;
    /**
     * Get PPPoE user by username
     */
    getPPPoEUserByUsername(username: string): Promise<PppoeSecret | null>;
    /**
     * Hapus PPPoE user
     */
    deletePPPoEUser(userId: string): Promise<boolean>;
    /**
     * Toggle status PPPoE user
     */
    togglePPPoEUser(userId: string, disabled: boolean): Promise<boolean>;
    /**
     * Dapatkan semua PPPoE users
     */
    getPPPoEUsers(): Promise<MikrotikUser[]>;
    /**
     * Buat PPPoE profile baru
     */
    createPPPoEProfile(profileData: {
        name: string;
        localAddress?: string;
        remoteAddress?: string;
        rateLimit?: string;
        comment?: string;
    }): Promise<boolean>;
    /**
     * Dapatkan semua PPPoE profiles
     */
    getPPPoEProfiles(): Promise<MikrotikProfile[]>;
    /**
     * Tambah IP ke address list
     */
    addToAddressList(addressData: {
        address: string;
        list: string;
        comment?: string;
    }): Promise<boolean>;
    /**
     * Hapus IP dari address list
     */
    removeFromAddressList(addressId: string): Promise<boolean>;
    /**
     * Dapatkan semua address list entries
     */
    getAddressList(): Promise<MikrotikAddressList[]>;
    /**
     * Dapatkan active PPPoE sessions
     */
    getActivePPPoESessions(): Promise<PppoeActiveConnection[]>;
    /**
     * Disconnect PPPoE session
     */
    disconnectPPPoESession(sessionId: string): Promise<boolean>;
    /**
     * Bulk create PPPoE users
     */
    bulkCreatePPPoEUsers(users: Array<{
        name: string;
        password: string;
        profile: string;
        comment?: string;
    }>): Promise<{
        success: number;
        failed: number;
        errors: string[];
    }>;
    /**
     * Bulk add to address list
     */
    bulkAddToAddressList(addresses: Array<{
        address: string;
        list: string;
        comment?: string;
    }>): Promise<{
        success: number;
        failed: number;
        errors: string[];
    }>;
}
//# sourceMappingURL=MikrotikService.d.ts.map