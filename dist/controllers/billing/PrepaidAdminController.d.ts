/**
 * Prepaid Admin Controller
 * Manages prepaid payment requests, vouchers, and reports
 */
import { Request, Response } from 'express';
export declare class PrepaidAdminController {
    /**
     * Show prepaid payment monitoring dashboard
     */
    static paymentMonitoring(req: Request, res: Response): Promise<void>;
    /**
     * View payment request detail
     */
    static viewPaymentRequest(req: Request, res: Response): Promise<void>;
    /**
     * Manual approve payment
     */
    static approvePayment(req: Request, res: Response): Promise<void>;
    /**
     * Reject payment request
     */
    static rejectPayment(req: Request, res: Response): Promise<void>;
    /**
     * Prepaid reports / analytics
     */
    static reports(req: Request, res: Response): Promise<void>;
    /**
     * Voucher Management - List
     */
    static listVouchers(req: Request, res: Response): Promise<void>;
    /**
     * Create voucher
     */
    static createVoucher(req: Request, res: Response): Promise<void>;
    /**
     * Update voucher
     */
    static updateVoucher(req: Request, res: Response): Promise<void>;
    /**
     * Delete voucher
     */
    static deleteVoucher(req: Request, res: Response): Promise<void>;
    /**
     * Referral tracking
     */
    static referralTracking(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=PrepaidAdminController.d.ts.map