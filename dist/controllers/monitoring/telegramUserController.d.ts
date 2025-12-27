/**
 * Telegram User Management Controller
 * Manage internal staff registration via Telegram bot
 */
import { Request, Response } from 'express';
export declare class TelegramUserController {
    /**
     * GET /monitoring/telegram/users
     * List all Telegram users
     */
    listUsers(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/telegram/create-invite
     * Show create invite form
     */
    showCreateInvite(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/monitoring/telegram/create-invite
     * Create new invite code
     */
    createInvite(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/monitoring/telegram/users/:id/deactivate
     * Deactivate user
     */
    deactivateUser(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/monitoring/telegram/users/:id/activate
     * Activate user
     */
    activateUser(req: Request, res: Response): Promise<void>;
    /**
     * DELETE /api/monitoring/telegram/users/:id
     * Delete user
     */
    deleteUser(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/monitoring/telegram/bot-info
     * Get bot information
     */
    getBotInfo(req: Request, res: Response): Promise<void>;
}
export default TelegramUserController;
//# sourceMappingURL=telegramUserController.d.ts.map