/**
 * Telegram Settings Controller
 * Handle Telegram Bot configuration
 */
import { Request, Response } from 'express';
export declare class TelegramSettingsController {
    /**
     * Show Telegram settings page
     */
    static showSettings(req: Request, res: Response): Promise<void>;
    /**
     * Save Telegram settings
     */
    static saveSettings(req: Request, res: Response): Promise<void>;
    /**
     * Test bot connection
     */
    static testConnection(req: Request, res: Response): Promise<void>;
    /**
     * Restart bot service
     */
    static restartBot(req: Request, res: Response): Promise<void>;
    /**
     * Internal: Restart bot service
     */
    private static restartBotService;
    /**
     * Update .env file
     */
    private static updateEnvFile;
}
export default TelegramSettingsController;
//# sourceMappingURL=TelegramSettingsController.d.ts.map