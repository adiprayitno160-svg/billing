import { Request, Response } from 'express';
import { SystemUpdateService } from '../../services/system/SystemUpdateService';

export const checkSystemUpdate = async (req: Request, res: Response) => {
    try {
        const status = await SystemUpdateService.checkForUpdates();
        res.json({
            success: true,
            hasUpdate: status.hasUpdate,
            behind: status.behind,
            commits: status.commits
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const performSystemUpdate = async (req: Request, res: Response) => {
    try {
        const result = await SystemUpdateService.performUpdate();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
