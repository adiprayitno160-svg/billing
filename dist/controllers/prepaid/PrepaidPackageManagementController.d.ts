/**
 * Prepaid Package Management Controller
 * Admin interface untuk mengelola paket prepaid (PPPoE & Static IP)
 */
import { Request, Response } from 'express';
declare class PrepaidPackageManagementController {
    constructor();
    /**
     * Display all packages (admin view)
     */
    index(req: Request, res: Response): Promise<void>;
    /**
     * Show create package form
     */
    showCreateForm(req: Request, res: Response): Promise<void>;
    /**
     * Create new package
     */
    createPackage(req: Request, res: Response): Promise<void>;
    /**
     * Show edit package form
     */
    showEditForm(req: Request, res: Response): Promise<void>;
    /**
     * Update package
     */
    updatePackage(req: Request, res: Response): Promise<void>;
    /**
     * Delete package
     */
    deletePackage(req: Request, res: Response): Promise<void>;
    /**
     * API: Get parent queues from Mikrotik (for AJAX dropdown)
     */
    getParentQueues(req: Request, res: Response): Promise<void>;
    /**
     * API: Get rate limit from MikroTik profile (for auto-fill download limit)
     */
    getProfileRateLimit(req: Request, res: Response): Promise<void>;
}
declare const _default: PrepaidPackageManagementController;
export default _default;
//# sourceMappingURL=PrepaidPackageManagementController.d.ts.map