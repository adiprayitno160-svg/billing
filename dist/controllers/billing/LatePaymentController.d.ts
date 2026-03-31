/**
 * Late Payment Controller
 * Admin interface for managing late payment tracking
 */
import { Request, Response } from 'express';
export declare class LatePaymentController {
    /**
     * Show late payment dashboard
     */
    dashboard(req: Request, res: Response): Promise<any>;
    /**
     * Show late payment report
     */
    report(req: Request, res: Response): Promise<any>;
    /**
     * Show customer late payment detail
     */
    customerDetail(req: Request, res: Response): Promise<any>;
    /**
     * Reset counter API
     */
    resetCounter(req: Request, res: Response): Promise<any>;
    /**
     * Adjust counter API
     */
    adjustCounter(req: Request, res: Response): Promise<any>;
    /**
     * Batch reset counter
     */
    batchReset(req: Request, res: Response): Promise<any>;
    /**
     * Export report to Excel
     */
    exportReport(req: Request, res: Response): Promise<any>;
}
declare const _default: LatePaymentController;
export default _default;
//# sourceMappingURL=LatePaymentController.d.ts.map