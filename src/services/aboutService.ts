/**
 * About Service
 * Service untuk mengelola informasi aplikasi, versi, dan fitur
 */

export interface AppVersion {
    current: string;
    latest: string;
    releaseDate: string;
    changelog: string[];
}

export interface AppFeature {
    name: string;
    description: string;
    version: string;
    status: 'active' | 'beta' | 'deprecated';
    category: 'billing' | 'network' | 'monitoring' | 'system';
}

export interface UpdateSettings {
    autoUpdate: boolean;
    updateChannel: 'stable' | 'beta' | 'dev';
}

export interface UpdateInfo {
    available: boolean;
    version?: string;
    releaseDate?: string;
    changelog?: string[];
}

/**
 * Get application version information
 */
export async function getAppVersion(): Promise<AppVersion> {
    return {
        current: '2.0.0',
        latest: '2.0.0',
        releaseDate: new Date().toISOString(),
        changelog: [
            'Sistem Prepaid Management dengan integrasi MikroTik',
            'WhatsApp Bot untuk notifikasi otomatis',
            'Telegram Bot untuk monitoring dan manajemen',
            'Dashboard monitoring real-time',
            'Payment Gateway Integration',
            'FTTH Management (OLT, ODC, ODP)',
            'SLA Monitoring & Reporting',
            'Backup & Restore System',
            'Multi-user Management',
            'Kasir / POS System'
        ]
    };
}

/**
 * Get application features
 */
export async function getAppFeatures(): Promise<AppFeature[]> {
    return [
        {
            name: 'Billing Management',
            description: 'Manajemen tagihan pelanggan, pembayaran, dan pelaporan keuangan',
            version: '2.0.0',
            status: 'active',
            category: 'billing'
        },
        {
            name: 'Prepaid System',
            description: 'Sistem prepaid untuk pelanggan dengan voucher dan auto-renewal',
            version: '2.0.0',
            status: 'active',
            category: 'billing'
        },
        {
            name: 'MikroTik Integration',
            description: 'Integrasi lengkap dengan MikroTik RouterOS untuk manajemen PPPoE dan Static IP',
            version: '2.0.0',
            status: 'active',
            category: 'network'
        },
        {
            name: 'FTTH Management',
            description: 'Manajemen infrastruktur fiber optik (OLT, ODC, ODP)',
            version: '2.0.0',
            status: 'active',
            category: 'network'
        },
        {
            name: 'Network Monitoring',
            description: 'Monitoring real-time status jaringan dan koneksi pelanggan',
            version: '2.0.0',
            status: 'active',
            category: 'monitoring'
        },
        {
            name: 'SLA Monitoring',
            description: 'Monitoring Service Level Agreement dan uptime pelanggan',
            version: '2.0.0',
            status: 'active',
            category: 'monitoring'
        },
        {
            name: 'WhatsApp Bot',
            description: 'Bot WhatsApp untuk notifikasi tagihan dan komunikasi pelanggan',
            version: '2.0.0',
            status: 'active',
            category: 'system'
        },
        {
            name: 'Telegram Bot',
            description: 'Bot Telegram untuk notifikasi dan manajemen sistem',
            version: '2.0.0',
            status: 'active',
            category: 'system'
        },
        {
            name: 'Payment Gateway',
            description: 'Integrasi payment gateway untuk pembayaran online',
            version: '2.0.0',
            status: 'active',
            category: 'billing'
        },
        {
            name: 'Kasir/POS System',
            description: 'Sistem kasir untuk pembayaran langsung di lokasi',
            version: '2.0.0',
            status: 'active',
            category: 'billing'
        },
        {
            name: 'Customer Portal',
            description: 'Portal pelanggan untuk cek tagihan dan pembayaran mandiri',
            version: '2.0.0',
            status: 'active',
            category: 'system'
        },
        {
            name: 'Backup & Restore',
            description: 'Sistem backup dan restore database otomatis',
            version: '2.0.0',
            status: 'active',
            category: 'system'
        }
    ];
}

/**
 * Check for updates
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
    // Simulasi pengecekan update
    // Dalam implementasi nyata, ini akan query ke server update
    return {
        available: false,
        version: '2.0.0'
    };
}

/**
 * Get update settings
 */
export async function getUpdateSettings(): Promise<UpdateSettings> {
    return {
        autoUpdate: false,
        updateChannel: 'stable'
    };
}
