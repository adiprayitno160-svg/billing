import { Request, Response } from 'express';
/**
 * Controller untuk System Settings
 * Manage konfigurasi sistem
 */
export declare class SystemSettingsController {
    /**
     * Show system settings page
     */
    static index(req: Request, res: Response): Promise<void>;
    /**
     * Update system settings
     */
    static updateSettings(req: Request, res: Response): Promise<void>;
    /**
     * Get setting value by key
     */
    static getSettingValue(key: string): Promise<string | null>;
    /**
     * Get active URL based on domain/local mode settings
     * This is a convenience method that uses UrlConfigService
     */
    static getActiveUrl(): Promise<string>;
    /**
     * Ensure system_settings table exists
     */
    private static ensureSystemSettingsTable;
}
//# sourceMappingURL=SystemSettingsController.d.ts.map