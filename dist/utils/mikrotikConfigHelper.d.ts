/**
 * Helper untuk mengambil konfigurasi MikroTik dari database
 * Digunakan secara konsisten di semua tempat
 */
export interface MikrotikConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    api_port?: number;
    use_tls?: boolean;
}
/**
 * Get MikroTik settings from database
 * NEVER throws error - always returns null if there's any issue
 */
export declare function getMikrotikConfig(): Promise<MikrotikConfig | null>;
/**
 * Validate MikroTik config
 */
export declare function validateMikrotikConfig(config: MikrotikConfig | null): {
    valid: boolean;
    error?: string;
};
//# sourceMappingURL=mikrotikConfigHelper.d.ts.map