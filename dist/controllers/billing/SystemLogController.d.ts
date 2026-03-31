/**
 * SystemLogController - Controller for viewing and managing system logs
 */
import { Request, Response, NextFunction } from 'express';
export declare class SystemLogController {
    /**
     * Get system logs page
     */
    static getLogsPage(req: Request, res: Response, next: NextFunction): Promise<any>;
    /**
     * Get logs via API
     */
    static getLogs(req: Request, res: Response, next: NextFunction): Promise<any>;
    /**
     * Get log statistics
     */
    static getLogStatistics(req: Request, res: Response, next: NextFunction): Promise<any>;
    /**
     * Get specific log details
     */
    static getLogDetails(req: Request, res: Response, next: NextFunction): Promise<any>;
    /**
     * Resolve anomaly
     */
    static resolveAnomaly(req: Request, res: Response, next: NextFunction): Promise<any>;
    /**
     * Get anomalies
     */
    static getAnomalies(req: Request, res: Response, next: NextFunction): Promise<any>;
    /**
     * Export logs
     */
    static exportLogs(req: Request, res: Response, next: NextFunction): Promise<any>;
}
//# sourceMappingURL=SystemLogController.d.ts.map