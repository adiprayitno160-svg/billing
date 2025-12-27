/**
 * AI Settings Controller
 * Manage AI (Gemini) configuration for payment auto-approval
 */
import { Request, Response } from 'express';
export declare class AISettingsController {
    /**
     * Show AI settings page
     */
    static index(req: Request, res: Response): Promise<void>;
    /**
     * Update AI settings
     */
    static updateSettings(req: Request, res: Response): Promise<void>;
    /**
     * Test API key
     */
    static testAPIKey(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=AISettingsController.d.ts.map