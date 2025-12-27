import { Request, Response } from 'express';
/**
 * Controller untuk One-Click Mikrotik Setup
 * Admin tinggal klik tombol, sistem auto-setup semuanya!
 */
declare class PrepaidMikrotikSetupController {
    constructor();
    /**
     * Show setup wizard page
     */
    showSetupWizard(req: Request, res: Response): Promise<void>;
    /**
     * One-click setup Mikrotik
     */
    setupMikrotik(req: Request, res: Response): Promise<void>;
    /**
     * Test Mikrotik connection
     */
    testConnection(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Reset/Remove all prepaid rules
     */
    resetSetup(req: Request, res: Response): Promise<void>;
    /**
     * Create PPPoE Profiles
     */
    private createPPPoEProfiles;
    /**
     * Ensure Address Lists exist
     */
    private ensureAddressLists;
    /**
     * Create NAT Redirect Rules
     */
    private createNATRules;
    /**
     * Create Firewall Filter Rules
     */
    private createFilterRules;
    /**
     * Parse Portal URL to get IP and port
     */
    private parsePortalUrl;
    /**
     * Ensure system_settings table exists and has required columns
     */
    private ensureSystemSettingsTable;
    /**
     * Ensure activity_logs table exists
     */
    private ensureActivityLogsTable;
    /**
     * Auto-fix mikrotik_settings table (add is_active column if not exists)
     */
    private autoFixMikrotikSettingsTable;
    /**
     * Check current setup status (OPTIMIZED WITH FASTER TIMEOUT)
     * Menggunakan MikrotikConfig dari helper
     */
    private checkSetupStatus;
}
declare const _default: PrepaidMikrotikSetupController;
export default _default;
//# sourceMappingURL=PrepaidMikrotikSetupController.d.ts.map