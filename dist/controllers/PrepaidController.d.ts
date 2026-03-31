import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
/**
 * Prepaid Controller
 * Handles prepaid billing operations
 */
export declare class PrepaidController {
    /**
     * Switch customer to prepaid mode
     */
    static switchToPrepaid(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Switch customer back to postpaid mode
     */
    static switchToPostpaid(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Generate payment request with unique code
     */
    static generatePaymentRequest(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Confirm payment (admin only)
     */
    static confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=PrepaidController.d.ts.map