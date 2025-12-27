/**
 * System Update Controller
 * Handles automatic updates from GitHub repository
 */
import { Request, Response } from 'express';
export declare class SystemUpdateController {
    /**
     * Show update page
     */
    static showUpdatePage(req: Request, res: Response): Promise<void>;
    /**
     * Check for updates
     */
    static checkForUpdates(req: Request, res: Response): Promise<void>;
    /**
     * Perform system update
     */
    static performUpdate(req: Request, res: Response): Promise<void>;
    /**
     * Get update log/history
     */
    static getUpdateHistory(req: Request, res: Response): Promise<void>;
    /**
     * Rollback to previous version
     */
    static rollbackUpdate(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=SystemUpdateController.d.ts.map