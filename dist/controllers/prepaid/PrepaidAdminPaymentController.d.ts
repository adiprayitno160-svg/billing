/**
 * Prepaid Admin Payment Controller
 * Admin panel untuk verifikasi pembayaran manual transfer
 */
import { Request, Response } from 'express';
declare class PrepaidAdminPaymentController {
    constructor();
    /**
     * Payment verification dashboard
     */
    index(req: Request, res: Response): Promise<void>;
    /**
     * Approve/verify payment
     */
    verifyPayment(req: Request, res: Response): Promise<void>;
    /**
     * Reject payment
     */
    rejectPayment(req: Request, res: Response): Promise<void>;
    /**
     * View payment proof (image/PDF)
     */
    viewPaymentProof(req: Request, res: Response): Promise<void>;
    /**
     * Get payment statistics (for dashboard widgets)
     */
    getPaymentStatistics(req: Request, res: Response): Promise<void>;
}
declare const _default: PrepaidAdminPaymentController;
export default _default;
//# sourceMappingURL=PrepaidAdminPaymentController.d.ts.map