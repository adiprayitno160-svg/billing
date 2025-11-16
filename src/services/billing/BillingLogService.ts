/**
 * BillingLogService - Comprehensive logging system for billing
 * Logs to both file and database with automatic anomaly detection
 */
import * as fs from 'fs';
import * as path from 'path';
import { databasePool } from '../../db/pool';
import { AIAnomalyDetectionService } from './AIAnomalyDetectionService';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type LogType = 
    | 'billing'
    | 'payment'
    | 'invoice'
    | 'customer'
    | 'notification'
    | 'database'
    | 'api'
    | 'scheduler'
    | 'security'
    | 'system'
    | 'mikrotik'
    | 'whatsapp'
    | 'telegram'
    | 'prepaid';

export interface LogContext {
    [key: string]: any;
}

export interface LogEntry {
    level: LogLevel;
    type: LogType;
    service: string;
    message: string;
    context?: LogContext;
    userId?: number;
    customerId?: number;
    invoiceId?: number;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    error?: Error;
}

export class BillingLogService {
    private static logDir = path.join(process.cwd(), 'logs');
    private static anomalyDetector = new AIAnomalyDetectionService();
    
    /**
     * Initialize logging directory
     */
    static async initialize(): Promise<void> {
        // Ensure logs directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Ensure database tables exist
        try {
            const { createSystemLogsTable } = await import('../../db/migrations/create-system-logs-table');
            await createSystemLogsTable();
        } catch (error) {
            console.error('Error initializing log tables:', error);
        }
    }

    /**
     * Main logging method
     */
    static async log(entry: LogEntry): Promise<void> {
        try {
            // Generate request ID if not provided
            if (!entry.requestId) {
                entry.requestId = this.generateRequestId();
            }

            // Write to file
            await this.writeToFile(entry);

            // Write to database
            const logId = await this.writeToDatabase(entry);

            // Run AI anomaly detection for errors and warnings
            if (entry.level === 'error' || entry.level === 'critical' || entry.level === 'warning') {
                const anomaly = await this.anomalyDetector.detectAnomaly(entry, logId);
                
                if (anomaly.isAnomaly) {
                    // Update log with anomaly detection result
                    await this.updateLogAnomaly(logId, anomaly);
                    
                    // Log anomaly separately
                    await this.logAnomaly(entry, anomaly, logId);
                }
            }

            // Update statistics
            await this.updateStatistics(entry);
        } catch (error) {
            // Fallback to console if logging fails
            console.error('Error in BillingLogService:', error);
            console.error('Original log entry:', entry);
        }
    }

    /**
     * Write log to file
     */
    private static async writeToFile(entry: LogEntry): Promise<void> {
        const timestamp = new Date().toISOString();
        const logFile = path.join(this.logDir, `billing-${new Date().toISOString().split('T')[0]}.log`);
        const errorLogFile = path.join(this.logDir, 'err.log');

        const logLine = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.type}] [${entry.service}] ${entry.message}${entry.context ? ' ' + JSON.stringify(entry.context) : ''}${entry.error ? '\n' + entry.error.stack : ''}\n`;

        // Write to combined log
        fs.appendFileSync(logFile, logLine, 'utf8');

        // Write errors to error log
        if (entry.level === 'error' || entry.level === 'critical') {
            fs.appendFileSync(errorLogFile, logLine, 'utf8');
        }
    }

    /**
     * Write log to database
     */
    private static async writeToDatabase(entry: LogEntry): Promise<number> {
        const conn = await databasePool.getConnection();
        try {
            const [result] = await conn.execute(`
                INSERT INTO system_logs (
                    log_level, log_type, service_name, message, context,
                    user_id, customer_id, invoice_id, request_id,
                    ip_address, user_agent, stack_trace, error_code
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                entry.level,
                entry.type,
                entry.service,
                entry.message,
                entry.context ? JSON.stringify(entry.context) : null,
                entry.userId || null,
                entry.customerId || null,
                entry.invoiceId || null,
                entry.requestId || null,
                entry.ipAddress || null,
                entry.userAgent || null,
                entry.error?.stack || null,
                entry.error?.name || null
            ]);

            return (result as any).insertId;
        } finally {
            conn.release();
        }
    }

    /**
     * Update log with anomaly detection result
     */
    private static async updateLogAnomaly(logId: number, anomaly: any): Promise<void> {
        const conn = await databasePool.getConnection();
        try {
            await conn.execute(`
                UPDATE system_logs 
                SET 
                    anomaly_detected = 1,
                    anomaly_type = ?,
                    anomaly_score = ?,
                    ai_analysis = ?
                WHERE id = ?
            `, [
                anomaly.type,
                anomaly.score,
                JSON.stringify(anomaly.analysis),
                logId
            ]);
        } finally {
            conn.release();
        }
    }

    /**
     * Log detected anomaly
     */
    private static async logAnomaly(entry: LogEntry, anomaly: any, logId: number): Promise<void> {
        const anomalyEntry: LogEntry = {
            level: 'warning',
            type: 'system',
            service: 'AIAnomalyDetection',
            message: `Anomaly detected: ${anomaly.type} - ${entry.message}`,
            context: {
                originalLogId: logId,
                anomalyScore: anomaly.score,
                anomalyType: anomaly.type,
                analysis: anomaly.analysis
            },
            requestId: entry.requestId
        };

        await this.log(anomalyEntry);
    }

    /**
     * Update statistics
     */
    private static async updateStatistics(entry: LogEntry): Promise<void> {
        const conn = await databasePool.getConnection();
        try {
            const today = new Date().toISOString().split('T')[0];
            
            await conn.execute(`
                INSERT INTO log_statistics (stat_date, service_name, log_level, log_count, error_count)
                VALUES (?, ?, ?, 1, ?)
                ON DUPLICATE KEY UPDATE
                    log_count = log_count + 1,
                    error_count = error_count + ?,
                    updated_at = NOW()
            `, [
                today,
                entry.service,
                entry.level,
                (entry.level === 'error' || entry.level === 'critical') ? 1 : 0,
                (entry.level === 'error' || entry.level === 'critical') ? 1 : 0
            ]);
        } catch (error) {
            // Silent fail for statistics
        } finally {
            conn.release();
        }
    }

    /**
     * Convenience methods for different log levels
     */
    static async debug(type: LogType, service: string, message: string, context?: LogContext): Promise<void> {
        await this.log({ level: 'debug', type, service, message, context });
    }

    static async info(type: LogType, service: string, message: string, context?: LogContext): Promise<void> {
        await this.log({ level: 'info', type, service, message, context });
    }

    static async warning(type: LogType, service: string, message: string, context?: LogContext): Promise<void> {
        await this.log({ level: 'warning', type, service, message, context });
    }

    static async error(type: LogType, service: string, message: string, error?: Error, context?: LogContext): Promise<void> {
        await this.log({ level: 'error', type, service, message, error, context });
    }

    static async critical(type: LogType, service: string, message: string, error?: Error, context?: LogContext): Promise<void> {
        await this.log({ level: 'critical', type, service, message, error, context });
    }

    /**
     * Log billing-specific events
     */
    static async logBilling(level: LogLevel, service: string, message: string, customerId?: number, invoiceId?: number, context?: LogContext): Promise<void> {
        await this.log({
            level,
            type: 'billing',
            service,
            message,
            customerId,
            invoiceId,
            context
        });
    }

    /**
     * Log payment events
     */
    static async logPayment(level: LogLevel, service: string, message: string, customerId?: number, invoiceId?: number, context?: LogContext): Promise<void> {
        await this.log({
            level,
            type: 'payment',
            service,
            message,
            customerId,
            invoiceId,
            context
        });
    }

    /**
     * Generate unique request ID
     */
    private static generateRequestId(): string {
        return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get logs with filters
     */
    static async getLogs(filters: {
        level?: LogLevel;
        type?: LogType;
        service?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
        anomalyOnly?: boolean;
    } = {}): Promise<any[]> {
        const conn = await databasePool.getConnection();
        try {
            let query = 'SELECT * FROM system_logs WHERE 1=1';
            const params: any[] = [];

            if (filters.level) {
                query += ' AND log_level = ?';
                params.push(filters.level);
            }

            if (filters.type) {
                query += ' AND log_type = ?';
                params.push(filters.type);
            }

            if (filters.service) {
                query += ' AND service_name = ?';
                params.push(filters.service);
            }

            if (filters.startDate) {
                query += ' AND created_at >= ?';
                params.push(filters.startDate);
            }

            if (filters.endDate) {
                query += ' AND created_at <= ?';
                params.push(filters.endDate);
            }

            if (filters.anomalyOnly) {
                query += ' AND anomaly_detected = 1';
            }

            query += ' ORDER BY created_at DESC';
            query += ' LIMIT ? OFFSET ?';
            params.push(filters.limit || 100, filters.offset || 0);

            const [rows] = await conn.execute(query, params);
            return rows as any[];
        } finally {
            conn.release();
        }
    }

    /**
     * Mark anomaly as resolved
     */
    static async resolveAnomaly(logId: number, userId: number, resolution?: string): Promise<void> {
        const conn = await databasePool.getConnection();
        try {
            await conn.execute(`
                UPDATE system_logs 
                SET 
                    resolved = 1,
                    resolved_at = NOW(),
                    resolved_by = ?,
                    context = JSON_SET(COALESCE(context, '{}'), '$.resolution', ?)
                WHERE id = ?
            `, [userId, resolution || 'Resolved manually', logId]);
        } finally {
            conn.release();
        }
    }
}



