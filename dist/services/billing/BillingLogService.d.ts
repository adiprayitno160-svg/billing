export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type LogType = 'billing' | 'payment' | 'invoice' | 'customer' | 'notification' | 'database' | 'api' | 'scheduler' | 'security' | 'system' | 'mikrotik' | 'whatsapp' | 'telegram';
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
export declare class BillingLogService {
    private static logDir;
    private static anomalyDetector;
    /**
     * Initialize logging directory
     */
    static initialize(): Promise<void>;
    /**
     * Main logging method
     */
    static log(entry: LogEntry): Promise<void>;
    /**
     * Write log to file
     */
    private static writeToFile;
    /**
     * Write log to database
     */
    private static writeToDatabase;
    /**
     * Update log with anomaly detection result
     */
    private static updateLogAnomaly;
    /**
     * Log detected anomaly
     */
    private static logAnomaly;
    /**
     * Update statistics
     */
    private static updateStatistics;
    /**
     * Convenience methods for different log levels
     */
    static debug(type: LogType, service: string, message: string, context?: LogContext): Promise<void>;
    static info(type: LogType, service: string, message: string, context?: LogContext): Promise<void>;
    static warning(type: LogType, service: string, message: string, context?: LogContext): Promise<void>;
    static error(type: LogType, service: string, message: string, error?: Error, context?: LogContext): Promise<void>;
    static critical(type: LogType, service: string, message: string, error?: Error, context?: LogContext): Promise<void>;
    /**
     * Log billing-specific events
     */
    static logBilling(level: LogLevel, service: string, message: string, customerId?: number, invoiceId?: number, context?: LogContext): Promise<void>;
    /**
     * Log payment events
     */
    static logPayment(level: LogLevel, service: string, message: string, customerId?: number, invoiceId?: number, context?: LogContext): Promise<void>;
    /**
     * Generate unique request ID
     */
    private static generateRequestId;
    /**
     * Get logs with filters
     */
    static getLogs(filters?: {
        level?: LogLevel;
        type?: LogType;
        service?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
        anomalyOnly?: boolean;
    }): Promise<any[]>;
    /**
     * Mark anomaly as resolved
     */
    static resolveAnomaly(logId: number, userId: number, resolution?: string): Promise<void>;
}
//# sourceMappingURL=BillingLogService.d.ts.map