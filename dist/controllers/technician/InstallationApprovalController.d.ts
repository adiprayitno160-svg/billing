import { Request, Response } from 'express';
export declare class InstallationApprovalController {
    /**
     * Show pending installations waiting for approval
     */
    static list(req: Request, res: Response): Promise<void>;
    /**
     * Get detail of a single installation
     */
    static getDetail(req: Request, res: Response): Promise<void>;
    /**
     * Approve installation and create customer + PPPoE account
     */
    static approve(req: Request, res: Response): Promise<void>;
    /**
     * Reject installation
     */
    static reject(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=InstallationApprovalController.d.ts.map