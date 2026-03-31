import { Request, Response } from 'express';
/**
 * Prepaid Dashboard Controller
 * Handles UI for prepaid customer management
 */
export declare class PrepaidDashboardController {
    /**
     * Show prepaid customers list page
     */
    static listPrepaidCustomers(req: Request, res: Response): Promise<void>;
    /**
     * Show prepaid transactions report
     */
    static listTransactions(req: Request, res: Response): Promise<void>;
    /**
     * Show pending payment requests
     */
    static listPaymentRequests(req: Request, res: Response): Promise<void>;
    /**
     * Show prepaid reports page
     */
    static getReports(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=PrepaidDashboardController.d.ts.map