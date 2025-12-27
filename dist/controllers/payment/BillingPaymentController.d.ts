import { Request, Response } from 'express';
export declare class BillingPaymentController {
    private billingPaymentService;
    constructor();
    /**
     * Membuat payment untuk invoice
     */
    createInvoicePayment(req: Request, res: Response): Promise<void>;
    /**
     * Mendapatkan invoice dengan payment options
     */
    getInvoiceWithPaymentOptions(req: Request, res: Response): Promise<void>;
    /**
     * Mendapatkan payment history untuk customer
     */
    getCustomerPaymentHistory(req: Request, res: Response): Promise<void>;
    /**
     * Mendapatkan payment statistics
     */
    getPaymentStatistics(req: Request, res: Response): Promise<void>;
    /**
     * Mendapatkan available payment methods
     */
    getAvailablePaymentMethods(req: Request, res: Response): Promise<void>;
    /**
     * Membuat payment link untuk invoice
     */
    createPaymentLink(req: Request, res: Response): Promise<void>;
    /**
     * Memproses payment success
     */
    processPaymentSuccess(req: Request, res: Response): Promise<void>;
    /**
     * Memproses payment failure
     */
    processPaymentFailure(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=BillingPaymentController.d.ts.map