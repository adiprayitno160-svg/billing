import { Request, Response } from 'express';
/**
 * Controller untuk Speed Profile Management (PPPoE Profiles)
 * Manage Mikrotik PPPoE profiles untuk prepaid customers
 */
declare class PrepaidSpeedProfileController {
    private static profilesCache;
    private static cacheTime;
    private static CACHE_TTL;
    constructor();
    /**
     * Show speed profiles page (WITH AUTO-FIX)
     */
    index(req: Request, res: Response): Promise<void>;
    /**
     * Create new PPPoE profile in Mikrotik
     */
    createProfile(req: Request, res: Response): Promise<void>;
    /**
     * Update existing PPPoE profile
     */
    updateProfile(req: Request, res: Response): Promise<void>;
    /**
     * Delete PPPoE profile
     */
    deleteProfile(req: Request, res: Response): Promise<void>;
    /**
     * Get all PPPoE profiles from Mikrotik (USING CONNECTION POOL)
     */
    private getProfilesFromMikrotik;
    /**
     * Clear cache (called after create/update/delete)
     */
    private clearCache;
}
declare const _default: PrepaidSpeedProfileController;
export default _default;
//# sourceMappingURL=PrepaidSpeedProfileController.d.ts.map