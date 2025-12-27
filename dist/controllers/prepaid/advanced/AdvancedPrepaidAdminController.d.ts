/**
 * Advanced Prepaid Admin Controller
 *
 * Handles admin-facing routes for advanced prepaid system
 */
import { Request, Response } from 'express';
export declare class AdvancedPrepaidAdminController {
    /**
     * Dashboard overview
     */
    dashboard(req: Request, res: Response): Promise<void>;
    /**
     * Package management
     */
    packages(req: Request, res: Response): Promise<void>;
    /**
     * Create package form
     */
    showCreatePackage(req: Request, res: Response): Promise<void>;
    /**
     * Edit package form
     */
    showEditPackage(req: Request, res: Response): Promise<void>;
    /**
     * Create package
     */
    createPackage(req: Request, res: Response): Promise<void>;
    /**
     * Update package
     */
    updatePackage(req: Request, res: Response): Promise<void>;
    /**
     * Subscriptions list
     */
    subscriptions(req: Request, res: Response): Promise<void>;
    /**
     * Vouchers management
     */
    vouchers(req: Request, res: Response): Promise<void>;
    /**
     * Referrals management
     */
    referrals(req: Request, res: Response): Promise<void>;
    /**
     * Analytics page
     */
    analytics(req: Request, res: Response): Promise<void>;
}
declare const _default: AdvancedPrepaidAdminController;
export default _default;
//# sourceMappingURL=AdvancedPrepaidAdminController.d.ts.map