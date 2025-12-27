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
    static testSendMessage(req: Request, res: Response): Promise<void>;
    /**
     * Regenerate QR code
     */
    static regenerateQR(req: Request, res: Response): Promise<void>;
}
export default WhatsAppSettingsController;
//# sourceMappingURL=WhatsAppSettingsController.d.ts.map