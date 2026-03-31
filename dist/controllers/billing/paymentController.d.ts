import { Request, Response } from 'express';
export declare class PaymentController {
    private billingPaymentService;
    constructor();
    /**
     * Resend Payment Notification
     */
    resendNotification(req: Request, res: Response): Promise<void>;
    /**
     * Get payment history list
     */
    getPaymentHistory(req: Request, res: Response): Promise<void>;
    /**
     * Process FULL payment (pembayaran penuh)
     */
    processFullPayment(req: Request, res: Response): Promise<void>;
    /**
     * Process PARTIAL payment (pembayaran kurang/sebagian)
     */
    processPartialPayment(req: Request, res: Response): Promise<void>;
    /**
     * Process DEBT payment (pencatatan hutang sepenuhnya tanpa pembayaran)
     */
    processDebtPayment(req: Request, res: Response): Promise<void>;
    /**
     * Get debt tracking list
     */
    getDebtTrackingList(req: Request, res: Response): Promise<void>;
    /**
     * Resolve debt (mark as paid/resolved)
     */
    resolveDebt(req: Request, res: Response): Promise<void>;
    /**
     * Upload payment proof
     */
    uploadPaymentProof(req: Request, res: Response): Promise<void>;
    /**
     * Process payment via gateway (Xendit, Mitra, Tripay)
     */
    processGatewayPayment(req: Request, res: Response): Promise<void>;
    /**
     * Unified Payment Processor for Admin
     * Supports multi-invoice selection, partial payments, and discounts.
     */
    processPayment(req: Request, res: Response): Promise<void>;
    private processPaymentTransaction;
}
//# sourceMappingURL=paymentController.d.ts.map