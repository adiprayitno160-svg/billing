/**
 * WhatsApp Settings Controller
 * Handle WhatsApp service configuration and QR Code binding
 */
import { Request, Response } from 'express';
export declare class WhatsAppSettingsController {
    /**
     * Show WhatsApp settings page
     */
    static showSettings(req: Request, res: Response): Promise<void>;
    /**
     * Get WhatsApp status (AJAX endpoint)
     */
    static getStatus(req: Request, res: Response): Promise<void>;
    /**
     * Test send WhatsApp message
     */
    /**
     * Test send WhatsApp message
     */
    static testSendMessage(req: Request, res: Response): Promise<void>;
    /**
     * Regenerate QR code
     */
    static regenerateQR(req: Request, res: Response): Promise<void>;
    /**
     * Show WhatsApp Monitor page (Message Log & Manual Verification)
     */
    static showMonitor(req: Request, res: Response): Promise<void>;
    /**
     * Get WhatsApp messages (AJAX)
     */
    static getMessages(req: Request, res: Response): Promise<void>;
    /**
     * Get pending payment verifications (AJAX)
     */
    static getPendingVerifications(req: Request, res: Response): Promise<void>;
    /**
     * Get single verification detail (AJAX)
     */
    static getVerificationDetail(req: Request, res: Response): Promise<void>;
    /**
     * Get customer invoices for verification (AJAX)
     */
    static getCustomerInvoices(req: Request, res: Response): Promise<void>;
    /**
     * Process payment verification (approve/reject)
     */
    static processVerification(req: Request, res: Response): Promise<void>;
    /**
     * Update Foonte Token
     */
    static updateFoonteToken(req: Request, res: Response): Promise<void>;
}
export default WhatsAppSettingsController;
//# sourceMappingURL=WhatsAppSettingsController.d.ts.map