/**
 * Advanced Prepaid Portal Controller
 *
 * Customer-facing portal for advanced prepaid system
 */
import { Request, Response } from 'express';
export declare class AdvancedPrepaidPortalController {
    /**
     * Portal dashboard
     */
    dashboard(req: Request, res: Response): Promise<void>;
    /**
     * Packages listing
     */
    packages(req: Request, res: Response): Promise<void>;
    /**
     * Package details
     */
    packageDetail(req: Request, res: Response): Promise<void>;
    /**
     * Purchase package (review & payment)
     */
    purchasePackage(req: Request, res: Response): Promise<void>;
    /**
     * Process purchase
     */
    processPurchase(req: Request, res: Response): Promise<void>;
    /**
     * Usage history
     */
    usageHistory(req: Request, res: Response): Promise<void>;
    /**
     * Referral page
     */
    referrals(req: Request, res: Response): Promise<void>;
}
declare const _default: AdvancedPrepaidPortalController;
export default _default;
//# sourceMappingURL=AdvancedPrepaidPortalController.d.ts.map