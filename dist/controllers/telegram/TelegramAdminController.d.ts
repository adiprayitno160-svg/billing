/**
 * Telegram Admin Controller
 * Handles HTTP requests for Telegram Bot management
 */
import { Request, Response } from 'express';
export declare class TelegramAdminController {
    /**
     * Dashboard - Display Telegram Bot dashboard
     */
    dashboard(req: Request, res: Response): Promise<any>;
    /**
     * Get bot statistics (API)
     */
    getStatistics(req: Request, res: Response): Promise<any>;
    /**
     * Users Page - Display users list with layout
     */
    usersPage(req: Request, res: Response): Promise<any>;
    /**
     * Get active users list (API)
     */
    getUsers(req: Request, res: Response): Promise<any>;
    /**
     * Create invite code
     */
    createInviteCode(req: Request, res: Response): Promise<any>;
    /**
     * Send custom notification
     */
    sendNotification(req: Request, res: Response): Promise<any>;
    /**
     * Get chat logs
     */
    getChatLogs(req: Request, res: Response): Promise<any>;
    /**
     * Get notifications history
     */
    getNotifications(req: Request, res: Response): Promise<any>;
    /**
     * Get incident assignments
     */
    getIncidentAssignments(req: Request, res: Response): Promise<any>;
    /**
     * Get technician performance
     */
    getTechnicianPerformance(req: Request, res: Response): Promise<any>;
    /**
     * Update user settings
     */
    updateUserSettings(req: Request, res: Response): Promise<any>;
    /**
     * Deactivate user
     */
    deactivateUser(req: Request, res: Response): Promise<any>;
    /**
     * Test send message to user
     */
    testSendMessage(req: Request, res: Response): Promise<any>;
    /**
     * Get bot info
     */
    getBotInfo(req: Request, res: Response): Promise<any>;
}
declare const _default: TelegramAdminController;
export default _default;
//# sourceMappingURL=TelegramAdminController.d.ts.map