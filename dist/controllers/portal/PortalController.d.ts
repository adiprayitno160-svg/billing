import { Request, Response } from 'express';
export declare class PortalController {
    private mikrotikService;
    constructor();
    private getMikrotikService;
    /**
     * Halaman portal login
     */
    getPortalLogin(req: Request, res: Response): Promise<void>;
    /**
     * Proses login portal
     */
    postPortalLogin(req: Request, res: Response): Promise<void>;
    /**
     * Halaman pilihan paket
     */
    getPortalPackages(req: Request, res: Response): Promise<void>;
    /**
     * Proses pembelian paket
     */
    postPurchasePackage(req: Request, res: Response): Promise<void>;
    /**
     * Logout portal
     */
    postPortalLogout(req: Request, res: Response): Promise<void>;
    /**
     * Halaman profil customer
     */
    getPortalProfile(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=PortalController.d.ts.map