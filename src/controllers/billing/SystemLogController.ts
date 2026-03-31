/**
 * SystemLogController - Controller for viewing and managing system logs
 */
import { Request, Response, NextFunction } from 'express';
import { BillingLogService, LogLevel, LogType } from '../../services/billing/BillingLogService';
import { databasePool } from '../../db/pool';
import { AIAnomalyDetectionService } from '../../services/billing/AIAnomalyDetectionService';

export class SystemLogController {
    /**
     * Get system logs page
     */
    static async getLogsPage(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            console.log('[SystemLogController] Rendering logs page');
            res.render('billing/system-logs', {
                title: 'System Logs',
                currentPath: '/billing/logs'
            });
        } catch (error) {
            console.error('[SystemLogController] Error rendering logs page:', error);
            BillingLogService.error('api', 'SystemLogController', 'Error rendering logs page', error as Error);

            // Render error page instead of 404
            res.status(500).render('error', {
                title: 'Error',
                status: 500,
                message: 'Failed to load system logs page',
                error: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    }

    /**
     * Get logs via API
     */
    static async getLogs(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const {
                level,
                type,
                service,
                startDate,
                endDate,
                limit = '100',
                offset = '0',
                anomalyOnly,
                search
            } = req.query;

            const filters: any = {
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
                anomalyOnly: anomalyOnly === 'true'
            };

            if (level) filters.level = level as LogLevel;
            if (type) filters.type = type as LogType;
            if (service) filters.service = service as string;
            if (startDate) filters.startDate = new Date(startDate as string);
            if (endDate) filters.endDate = new Date(endDate as string);

            let logs = await BillingLogService.getLogs(filters);

            // Apply search filter if provided
            if (search) {
                const searchTerm = (search as string).toLowerCase();
                logs = logs.filter(log =>
                    log.message.toLowerCase().includes(searchTerm) ||
                    log.service_name.toLowerCase().includes(searchTerm)
                );
            }

            // Parse JSON fields safely
            logs = logs.map(log => {
                const parseJsonSafely = (value: any) => {
                    if (typeof value === 'string' && value) {
                        try {
                            return JSON.parse(value);
                        } catch {
                            return {};
                        }
                    }
                    return value || {};
                };

                return {
                    ...log,
                    context: parseJsonSafely(log.context),
                    ai_analysis: parseJsonSafely(log.ai_analysis)
                };
            });

            res.json({
                success: true,
                data: logs,
                count: logs.length
            });
        } catch (error) {
            BillingLogService.error('api', 'SystemLogController', 'Error getting logs', error as Error);
            next(error);
        }
    }

    /**
     * Get log statistics
     */
    static async getLogStatistics(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { days = '7' } = req.query;
            const daysNum = parseInt(days as string);

            const conn = await databasePool.getConnection();
            try {
                // Get log counts by level
                const [levelStats] = await conn.execute(`
                    SELECT 
                        log_level,
                        COUNT(*) as count
                    FROM system_logs
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                    GROUP BY log_level
                    ORDER BY 
                        CASE log_level
                            WHEN 'critical' THEN 1
                            WHEN 'error' THEN 2
                            WHEN 'warning' THEN 3
                            WHEN 'info' THEN 4
                            WHEN 'debug' THEN 5
                        END
                `, [daysNum]);

                // Get log counts by type
                const [typeStats] = await conn.execute(`
                    SELECT 
                        log_type,
                        COUNT(*) as count
                    FROM system_logs
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                    GROUP BY log_type
                    ORDER BY count DESC
                `, [daysNum]);

                // Get service stats
                const [serviceStats] = await conn.execute(`
                    SELECT 
                        service_name,
                        COUNT(*) as count,
                        SUM(CASE WHEN log_level IN ('error', 'critical') THEN 1 ELSE 0 END) as error_count
                    FROM system_logs
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                    GROUP BY service_name
                    ORDER BY error_count DESC, count DESC
                    LIMIT 10
                `, [daysNum]);

                // Get anomaly stats
                const anomalyDetector = new AIAnomalyDetectionService();
                const anomalyStats = await anomalyDetector.getAnomalyStatistics(daysNum);

                // Get unresolved anomalies
                const [unresolvedAnomalies] = await conn.execute(`
                    SELECT COUNT(*) as count
                    FROM system_logs
                    WHERE anomaly_detected = 1
                    AND resolved = 0
                    AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                `, [daysNum]);

                res.json({
                    success: true,
                    data: {
                        levelStats,
                        typeStats,
                        serviceStats,
                        anomalyStats,
                        unresolvedAnomalies: (unresolvedAnomalies as any[])[0]?.count || 0,
                        period: daysNum
                    }
                });
            } finally {
                conn.release();
            }
        } catch (error) {
            BillingLogService.error('api', 'SystemLogController', 'Error getting log statistics', error as Error);
            next(error);
        }
    }

    /**
     * Get specific log details
     */
    static async getLogDetails(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { id } = req.params;

            const conn = await databasePool.getConnection();
            try {
                const [rows] = await conn.execute(`
                    SELECT * FROM system_logs WHERE id = ?
                `, [id]);

                if ((rows as any[]).length === 0) {
                    res.status(404).json({
                        success: false,
                        message: 'Log not found'
                    });
                    return;
                }

                const log = (rows as any[])[0];

                // Parse JSON fields safely
                const parseJsonSafely = (value: any) => {
                    if (typeof value === 'string' && value) {
                        try {
                            return JSON.parse(value);
                        } catch {
                            return {};
                        }
                    }
                    return value || {};
                };

                log.context = parseJsonSafely(log.context);
                log.ai_analysis = parseJsonSafely(log.ai_analysis);

                res.json({
                    success: true,
                    data: log
                });
            } finally {
                conn.release();
            }
        } catch (error) {
            BillingLogService.error('api', 'SystemLogController', 'Error getting log details', error as Error);
            next(error);
        }
    }

    /**
     * Resolve anomaly
     */
    static async resolveAnomaly(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const { id } = req.params;
            const { resolution } = req.body;
            const userId = (req as any).user?.id || 0;

            if (!id) {
                return res.status(400).json({ success: false, error: 'ID is required' });
            }
            await BillingLogService.resolveAnomaly(parseInt(id), userId, resolution);

            res.json({
                success: true,
                message: 'Anomaly resolved successfully'
            });
        } catch (error) {
            BillingLogService.error('api', 'SystemLogController', 'Error resolving anomaly', error as Error);
            next(error);
        }
    }

    /**
     * Get anomalies
     */
    static async getAnomalies(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const {
                limit = '50',
                offset = '0',
                resolved
            } = req.query;

            const conn = await databasePool.getConnection();
            try {
                let query = `
                    SELECT * FROM system_logs
                    WHERE anomaly_detected = 1
                `;

                if (resolved === 'true') {
                    query += ' AND resolved = 1';
                } else if (resolved === 'false') {
                    query += ' AND resolved = 0';
                }

                query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

                const [rows] = await conn.execute(query, [
                    parseInt(limit as string),
                    parseInt(offset as string)
                ]);

                // Parse JSON fields safely
                const parseJsonSafely = (value: any) => {
                    if (typeof value === 'string' && value) {
                        try {
                            return JSON.parse(value);
                        } catch {
                            return {};
                        }
                    }
                    return value || {};
                };

                const logs = (rows as any[]).map(log => ({
                    ...log,
                    context: parseJsonSafely(log.context),
                    ai_analysis: parseJsonSafely(log.ai_analysis)
                }));

                res.json({
                    success: true,
                    data: logs,
                    count: logs.length
                });
            } finally {
                conn.release();
            }
        } catch (error) {
            BillingLogService.error('api', 'SystemLogController', 'Error getting anomalies', error as Error);
            next(error);
        }
    }

    /**
     * Export logs
     */
    static async exportLogs(req: Request, res: Response, next: NextFunction): Promise<any> {
        try {
            const {
                level,
                type,
                service,
                startDate,
                endDate,
                format = 'json'
            } = req.query;

            const filters: any = {
                limit: 10000, // Max export limit
                offset: 0
            };

            if (level) filters.level = level as LogLevel;
            if (type) filters.type = type as LogType;
            if (service) filters.service = service as string;
            if (startDate) filters.startDate = new Date(startDate as string);
            if (endDate) filters.endDate = new Date(endDate as string);

            const logs = await BillingLogService.getLogs(filters);

            if (format === 'csv') {
                // Convert to CSV
                const headers = ['ID', 'Level', 'Type', 'Service', 'Message', 'Created At'];
                const csvRows = [
                    headers.join(','),
                    ...logs.map(log => [
                        log.id,
                        log.log_level,
                        log.log_type,
                        log.service_name,
                        `"${log.message.replace(/"/g, '""')}"`,
                        log.created_at
                    ].join(','))
                ].join('\n');

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=logs-${Date.now()}.csv`);
                res.send(csvRows);
            } else {
                // JSON format
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename=logs-${Date.now()}.json`);
                res.json(logs);
            }
        } catch (error) {
            BillingLogService.error('api', 'SystemLogController', 'Error exporting logs', error as Error);
            next(error);
        }
    }
}

