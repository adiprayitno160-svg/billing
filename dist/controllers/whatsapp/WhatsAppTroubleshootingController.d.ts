/**
 * WhatsApp Troubleshooting Controller
 * Handle WhatsApp troubleshooting and diagnostics
 */
import { Request, Response } from 'express';
export declare class WhatsAppTroubleshootingController {
    /**
     * Show troubleshooting page
     */
    static showTroubleshooting(req: Request, res: Response): Promise<void>;
    /**
     * Get diagnostic information
     */
    static getDiagnostics(req: Request, res: Response): Promise<void>;
    /**
     * Clear failed notifications
     */
    static clearFailedNotifications(req: Request, res: Response): Promise<void>;
    /**
     * Retry failed notifications
     */
    static retryFailedNotifications(req: Request, res: Response): Promise<void>;
    /**
     * Test WhatsApp connection
     */
    static testConnection(req: Request, res: Response): Promise<void>;
    /**
     * Get notification logs with filters
     */
    static getNotificationLogs(req: Request, res: Response): Promise<void>;
    /**
     * Delete old notification logs
     */
    static cleanupLogs(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=WhatsAppTroubleshootingController.d.ts.map