import { Request, Response } from 'express';
export declare class PaymentController {
    private billingPaymentService;
    constructor();
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
     * Get payment form with gateway options
     */
    getPaymentForm(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=paymentController.d.ts.map