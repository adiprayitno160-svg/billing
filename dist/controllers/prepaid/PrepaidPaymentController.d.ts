import { Request, Response } from 'express';
/**
 * Controller untuk Prepaid Payment Processing
 * Handle payment method selection, payment processing, dan activation
 */
declare class PrepaidPaymentController {
    /**
     * Show payment page
     */
    showPaymentPage(req: Request, res: Response): Promise<void | Response<any, Record<string, any>>>;
    /**
     * Process payment
     */
    processPayment(req: Request, res: Response): Promise<void>;
    /**
     * Process cash payment (direct activation for testing)
     */
    private processCashPayment;
    /**
     * Process payment gateway
     */
    private processGatewayPayment;
    /**
     * Show payment waiting page (for gateway payments)
     */
    showPaymentWaiting(req: Request, res: Response): Promise<void>;
    /**
     * Check payment status (API for polling)
     */
    checkPaymentStatus(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Show success page
     */
    showSuccessPage(req: Request, res: Response): Promise<void>;
    /**
     * Generate invoice number
     */
    private generateInvoiceNumber;
}
declare const _default: PrepaidPaymentController;
export default _default;
//# sourceMappingURL=PrepaidPaymentController.d.ts.map