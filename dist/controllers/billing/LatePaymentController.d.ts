/**
 * Late Payment Controller
 * Admin interface for managing late payment tracking
 */
import { Request, Response } from 'express';
export declare class LatePaymentController {
    /**
     * Show late payment dashboard
     */
    dashboard(req: Request, res: Response): Promise<void>;
    /**
     * Show late payment report
     */
    report(req: Request, res: Response): Promise<void>;
    /**
     * Show customer late payment detail
     */
    customerDetail(req: Request, res: Response): Promise<void>;
    /**
     * Reset counter API
     */
    resetCounter(req: Request, res: Response): Promise<void>;
    /**
     * Adjust counter API
     */
    adjustCounter(req: Request, res: Response): Promise<void>;
    /**
     * Batch reset counter
     */
    batchReset(req: Request, res: Response): Promise<void>;
    /**
     * Export report to Excel
     */
    exportReport(req: Request, res: Response): Promise<void>;
}
declare const _default: LatePaymentController;
export default _default;
//# sourceMappingURL=LatePaymentController.d.ts.map