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
 * ⚠️ HANYA menampilkan MAJOR versions (2.0.8), TIDAK termasuk hotfixes (2.0.8.5)
 */
export declare function getAppVersion(): Promise<AppVersion>;
/**
 * Get application features
 */
export declare function getAppFeatures(): Promise<AppFeature[]>;
/**
 * Check for updates
 * ⚠️ HANYA check MAJOR updates, TIDAK termasuk hotfixes
 */
export declare function checkForUpdates(): Promise<UpdateInfo>;
/**
 * Get update settings
 */
export declare function getUpdateSettings(): Promise<UpdateSettings>;
/**
 * Update settings
 */
export declare function saveUpdateSettings(settings: UpdateSettings): Promise<void>;
/**
 * Apply update
 */
export declare function applyUpdate(version: string): Promise<{
    success: boolean;
    message: string;
    needsRestart: boolean;
}>;
/**
 * Perform full update
 */
export declare function performFullUpdate(version: string): Promise<{
    success: boolean;
    message: string;
    steps: {
        step: string;
        status: string;
        message: string;
    }[];
}>;
/**
 * Get update history
 */
export declare function getUpdateHistory(limit?: number): Promise<any[]>;
//# sourceMappingURL=aboutService.d.ts.map