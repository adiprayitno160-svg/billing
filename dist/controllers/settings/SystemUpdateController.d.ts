/**
 * System Update Controller
 * Handles automatic updates from GitHub repository
 */
import { Request, Response } from 'express';
export declare class SystemUpdateController {
    /**
     * Show update page
     */
    static showUpdatePage(req: Request, res: Response): Promise<any>;
    /**
     * Check for updates
     */
    static checkForUpdates(req: Request, res: Response): Promise<any>;
    /**
     * Perform system update
     */
    /**
     * Perform system update
     */
    /**
     * Perform system update with smart error handling
     */
    static performUpdate(req: Request, res: Response): Promise<any>;
    /**
     * Get update log/history
     */
    static getUpdateHistory(req: Request, res: Response): Promise<any>;
    /**
     * Rollback to previous version
     */
    static rollbackUpdate(req: Request, res: Response): Promise<any>;
}
//# sourceMappingURL=SystemUpdateController.d.ts.map