/**
 * Maintenance Schedule Controller
 * Manage planned maintenance schedules
 */
import { Request, Response } from 'express';
export declare class MaintenanceController {
    /**
     * GET /monitoring/maintenance
     * List all maintenance schedules
     */
    list(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/maintenance/create
     * Show create form
     */
    showCreate(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/monitoring/maintenance
     * Create new maintenance schedule
     */
    create(req: Request, res: Response): Promise<void>;
    /**
     * GET /monitoring/maintenance/:id
     * View maintenance detail
     */
    detail(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/monitoring/maintenance/:id/start
     * Start maintenance
     */
    start(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/monitoring/maintenance/:id/complete
     * Complete maintenance
     */
    complete(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/monitoring/maintenance/:id/cancel
     * Cancel maintenance
     */
    cancel(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/monitoring/maintenance/:id/send-notification
     * Send notification manually
     */
    sendNotification(req: Request, res: Response): Promise<void>;
}
export default MaintenanceController;
//# sourceMappingURL=maintenanceController.d.ts.map