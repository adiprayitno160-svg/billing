import { Request, Response } from 'express';
/**
 * Full Controller untuk Admin Prepaid Management
 * Dengan CRUD lengkap dan integrasi MikroTik
 */
declare class PrepaidAdminControllerFull {
    dashboard(req: Request, res: Response): Promise<void>;
    packages(req: Request, res: Response): Promise<void>;
    createPackage(req: Request, res: Response): Promise<void>;
    updatePackage(req: Request, res: Response): Promise<void>;
    deletePackage(req: Request, res: Response): Promise<void>;
    customers(req: Request, res: Response): Promise<void>;
    createPortalAccess(req: Request, res: Response): Promise<void>;
    subscriptions(req: Request, res: Response): Promise<void>;
    /**
     * Manual activation (tanpa bayar)
     */
    manualActivation(req: Request, res: Response): Promise<void>;
    /**
     * Deactivate subscription
     */
    deactivateSubscription(req: Request, res: Response): Promise<void>;
    private activateInMikrotik;
    private deactivateInMikrotik;
    speedProfiles(req: Request, res: Response): Promise<void>;
    addressList(req: Request, res: Response): Promise<void>;
    reports(req: Request, res: Response): Promise<void>;
    triggerScheduler(req: Request, res: Response): Promise<void>;
    addToPortalRedirect(req: Request, res: Response): Promise<void>;
    removeFromPortalRedirect(req: Request, res: Response): Promise<void>;
}
declare const _default: PrepaidAdminControllerFull;
export default _default;
//# sourceMappingURL=PrepaidAdminControllerFull.d.ts.map