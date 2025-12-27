/**
 * Prepaid Portal Payment Controller
 * Customer portal untuk pilih paket dan bayar
 */
import { Request, Response } from 'express';
declare class PrepaidPortalPaymentController {
    constructor();
    /**
     * Step 1: Display available packages (filtered by customer connection type)
     */
    selectPackage(req: Request, res: Response): Promise<void>;
    /**
     * Step 2: Review selected package before payment
     */
    reviewPackage(req: Request, res: Response): Promise<void>;
    /**
     * Step 3: Select payment method
     */
    selectPaymentMethod(req: Request, res: Response): Promise<void>;
    /**
     * Step 4A: Process manual transfer (with proof upload)
     */
    processManualTransfer(req: Request, res: Response): Promise<void>;
    /**
     * Step 4B: Process payment gateway
     * Integrated with PaymentGatewayService (Xendit, Mitra, Tripay)
     */
    processPaymentGateway(req: Request, res: Response): Promise<void>;
    /**
     * Step 5: Waiting page (after payment submission)
     */
    showWaitingPage(req: Request, res: Response): Promise<void>;
    /**
     * Step 6: Success page (after activation)
     */
    showSuccessPage(req: Request, res: Response): Promise<void>;
    /**
     * API: Check payment status (AJAX polling)
     */
    checkPaymentStatus(req: Request, res: Response): Promise<void>;
}
declare const _default: PrepaidPortalPaymentController;
export default _default;
//# sourceMappingURL=PrepaidPortalPaymentController.d.ts.map