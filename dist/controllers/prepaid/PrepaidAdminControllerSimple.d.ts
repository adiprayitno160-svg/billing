import { Request, Response } from 'express';
/**
 * Simplified Controller untuk Admin Prepaid Management
 * Minimal dependencies, error handling
 */
declare class PrepaidAdminControllerSimple {
    /**
     * Dashboard Prepaid
     */
    dashboard(req: Request, res: Response): Promise<void>;
    /**
     * Customer Prepaid List
     */
    customers(req: Request, res: Response): Promise<void>;
    /**
     * Packages Management
     */
    packages(req: Request, res: Response): Promise<void>;
    /**
     * Speed Profiles Management
     */
    speedProfiles(req: Request, res: Response): Promise<void>;
    /**
     * Address List Management (Portal Redirect)
     */
    addressList(req: Request, res: Response): Promise<void>;
    /**
     * Active Subscriptions
     */
    subscriptions(req: Request, res: Response): Promise<void>;
    /**
     * Reports
     */
    reports(req: Request, res: Response): Promise<void>;
    /**
     * Manual trigger scheduler (for testing)
     */
    triggerScheduler(req: Request, res: Response): Promise<void>;
    /**
     * Add customer to portal redirect (manual)
     */
    addToPortalRedirect(req: Request, res: Response): Promise<void>;
    /**
     * Remove customer from portal redirect
     */
    removeFromPortalRedirect(req: Request, res: Response): Promise<void>;
}
declare const _default: PrepaidAdminControllerSimple;
export default _default;
//# sourceMappingURL=PrepaidAdminControllerSimple.d.ts.map