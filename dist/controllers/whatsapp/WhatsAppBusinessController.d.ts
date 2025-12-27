import { Request, Response } from 'express';
export declare class WhatsAppBusinessController {
    /**
     * Dashboard/Index page
     */
    getDashboard(req: Request, res: Response): Promise<void>;
    /**
     * Binding page (QR Code)
     */
    getBinding(req: Request, res: Response): Promise<void>;
    /**
     * Get status (API)
     */
    getStatus(req: Request, res: Response): Promise<void>;
    /**
     * Get QR Code (API)
     */
    getQRCode(req: Request, res: Response): Promise<void>;
    /**
     * Start WhatsApp client
     */
    start(req: Request, res: Response): Promise<void>;
    /**
     * Stop WhatsApp client
     */
    stop(req: Request, res: Response): Promise<void>;
    /**
     * Restart WhatsApp client
     */
    restart(req: Request, res: Response): Promise<void>;
    /**
     * Send message to phone number
     */
    sendToPhone(req: Request, res: Response): Promise<void>;
    /**
     * Send message to customer by ID
     */
    sendToCustomer(req: Request, res: Response): Promise<void>;
    /**
     * Send message to multiple customers
     */
    sendToMultiple(req: Request, res: Response): Promise<void>;
    /**
     * Get notification history
     */
    getHistory(req: Request, res: Response): Promise<void>;
    /**
     * Check phone number
     */
    checkNumber(req: Request, res: Response): Promise<void>;
    /**
     * Diagnostic endpoint
     */
    getDiagnostic(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=WhatsAppBusinessController.d.ts.map