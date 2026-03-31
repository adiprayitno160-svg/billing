import { Request, Response } from 'express';
import { PrepaidService } from '../services/billing/PrepaidService';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';

/**
 * Prepaid Controller
 * Handles prepaid billing operations
 */
export class PrepaidController {

    /**
     * Switch customer to prepaid mode
     */
    static async switchToPrepaid(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { initialDays } = req.body;

            const customerId = parseInt(id);
            if (!customerId || isNaN(customerId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid customer ID'
                });
                return;
            }

            const result = await PrepaidService.switchToPrepaid(
                customerId,
                parseInt(initialDays) || 1,
                true // Send WhatsApp notification
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    expiryDate: result.expiryDate
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.message
                });
            }

        } catch (error: any) {
            console.error('Switch to prepaid error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to switch to prepaid mode'
            });
        }
    }

    /**
     * Switch customer back to postpaid mode
     */
    static async switchToPostpaid(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const customerId = parseInt(id);
            if (!customerId || isNaN(customerId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid customer ID'
                });
                return;
            }

            const result = await PrepaidService.switchToPostpaid(customerId);

            res.json({
                success: result.success,
                message: result.message
            });

        } catch (error: any) {
            console.error('Switch to postpaid error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to switch to postpaid mode'
            });
        }
    }

    /**
     * Generate payment request with unique code
     */
    static async generatePaymentRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { customerId, packageId, durationDays } = req.body;

            if (!customerId || !packageId || !durationDays) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required parameters'
                });
                return;
            }

            const result = await PrepaidService.generatePaymentRequest(
                parseInt(customerId),
                parseInt(packageId),
                parseInt(durationDays)
            );

            if (result.success) {
                res.json({
                    success: true,
                    paymentRequest: result.paymentRequest
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.message
                });
            }

        } catch (error: any) {
            console.error('Generate payment request error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate payment request'
            });
        }
    }

    /**
     * Confirm payment (admin only)
     */
    static async confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { paymentRequestId, paymentMethod } = req.body;

            if (!paymentRequestId) {
                res.status(400).json({
                    success: false,
                    error: 'Payment request ID is required'
                });
                return;
            }

            const result = await PrepaidService.confirmPayment(
                parseInt(paymentRequestId),
                req.user?.id || null,
                paymentMethod || 'transfer'
            );

            res.json({
                success: result.success,
                message: result.message,
                newExpiryDate: result.newExpiryDate
            });

        } catch (error: any) {
            console.error('Confirm payment error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to confirm payment'
            });
        }
    }
}
