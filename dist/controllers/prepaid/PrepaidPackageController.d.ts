import { Request, Response } from 'express';
/**
 * Controller untuk Prepaid Package Selection
 * Handle package listing, selection, dan info
 */
declare class PrepaidPackageController {
    /**
     * Show package selection page
     */
    showPackages(req: Request, res: Response): Promise<void>;
    /**
     * Show package detail
     */
    showPackageDetail(req: Request, res: Response): Promise<void | Response<any, Record<string, any>>>;
    /**
     * Select package for purchase (redirect to payment)
     */
    selectPackage(req: Request, res: Response): Promise<void>;
    /**
     * Get all active packages (API endpoint)
     */
    getActivePackagesAPI(req: Request, res: Response): Promise<void>;
    /**
     * Get package by ID (API endpoint)
     */
    getPackageByIdAPI(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
declare const _default: PrepaidPackageController;
export default _default;
//# sourceMappingURL=PrepaidPackageController.d.ts.map