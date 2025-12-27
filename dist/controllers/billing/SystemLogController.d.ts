/**
 * SystemLogController - Controller for viewing and managing system logs
 */
import { Request, Response, NextFunction } from 'express';
export declare class SystemLogController {
    /**
     * Get system logs page
     */
    static getLogsPage(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get logs via API
     */
    static getLogs(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get log statistics
     */
    static getLogStatistics(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get specific log details
     */
    static getLogDetails(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Resolve anomaly
     */
    static resolveAnomaly(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get anomalies
     */
    static getAnomalies(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Export logs
     */
    static exportLogs(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=SystemLogController.d.ts.map