import { Request, Response } from 'express';
export declare class VerificationController {
    /**
     * Show verification list page
     */
    static index(req: Request, res: Response): Promise<void>;
    /**
     * Get pending verifications (AJAX)
     */
    static getList(req: Request, res: Response): Promise<void>;
    /**
     * Get single verification detail (AJAX)
     */
    static getDetail(req: Request, res: Response): Promise<void>;
    /**
     * Serve verification image raw
     */
    static getImage(req: Request, res: Response): Promise<void>;
    /**
    * Get customer invoices for verification (AJAX)
    */
    static getCustomerInvoices(req: Request, res: Response): Promise<void>;
    /**
     * Process verification
     */
    static process(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=VerificationController.d.ts.map