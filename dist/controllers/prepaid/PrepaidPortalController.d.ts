import { Request, Response } from 'express';
/**
 * Controller untuk Prepaid Portal Pages
 * Handle login, dashboard, dan portal navigation
 */
declare class PrepaidPortalController {
    /**
     * Show login page
     */
    showLogin(req: Request, res: Response): Promise<void>;
    /**
     * Process login
     */
    processLogin(req: Request, res: Response): Promise<void | Response<any, Record<string, any>>>;
    /**
     * Show portal dashboard
     */
    showDashboard(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Logout
     */
    logout(req: Request, res: Response): Promise<void>;
    /**
     * Show customer usage/statistics
     */
    showUsage(req: Request, res: Response): Promise<void>;
}
declare const _default: PrepaidPortalController;
export default _default;
//# sourceMappingURL=PrepaidPortalController.d.ts.map