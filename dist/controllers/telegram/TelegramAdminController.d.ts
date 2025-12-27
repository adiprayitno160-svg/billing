/**
 * Telegram Admin Controller
 * Handles HTTP requests for Telegram Bot management
 */
import { Request, Response } from 'express';
export declare class TelegramAdminController {
    /**
     * Dashboard - Display Telegram Bot dashboard
     */
    dashboard(req: Request, res: Response): Promise<void>;
    /**
     * Get bot statistics (API)
     */
    getStatistics(req: Request, res: Response): Promise<void>;
    /**
     * Users Page - Display users list with layout
     */
    usersPage(req: Request, res: Response): Promise<void>;
    /**
     * Get active users list (API)
     */
    getUsers(req: Request, res: Response): Promise<void>;
    /**
     * Create invite code
     */
    createInviteCode(req: Request, res: Response): Promise<void>;
    /**
     * Send custom notification
     */
    sendNotification(req: Request, res: Response): Promise<void>;
    /**
     * Get chat logs
     */
    getChatLogs(req: Request, res: Response): Promise<void>;
    /**
     * Get notifications history
     */
    getNotifications(req: Request, res: Response): Promise<void>;
    /**
     * Get incident assignments
     */
    getIncidentAssignments(req: Request, res: Response): Promise<void>;
    /**
     * Get technician performance
     */
    getTechnicianPerformance(req: Request, res: Response): Promise<void>;
    /**
     * Update user settings
     */
    updateUserSettings(req: Request, res: Response): Promise<void>;
    /**
     * Deactivate user
     */
    deactivateUser(req: Request, res: Response): Promise<void>;
    /**
     * Test send message to user
     */
    testSendMessage(req: Request, res: Response): Promise<void>;
    /**
     * Get bot info
     */
    getBotInfo(req: Request, res: Response): Promise<void>;
}
declare const _default: TelegramAdminController;
export default _default;
//# sourceMappingURL=TelegramAdminController.d.ts.map