/**
 * Migration Logger Service
 * Sistem logging yang proper untuk migration dengan log ke file dan database
 */
export declare enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR"
}
interface LogContext {
    customerId?: number;
    customerName?: string;
    adminId?: number;
    migrationId?: number;
    step?: string;
    [key: string]: any;
}
declare class MigrationLogger {
    private logDir;
    private logFile;
    private maxLogFileSize;
    private maxBackupFiles;
    constructor();
    /**
     * Ensure migration_logs table exists
     */
    private ensureMigrationLogsTable;
    /**
     * Rotate log file if it exceeds max size
     */
    private rotateLogFile;
    /**
     * Format log entry for file
     */
    private formatLogEntry;
    /**
     * Write log to file
     */
    private writeToFile;
    /**
     * Write log to database
     */
    private writeToDatabase;
    /**
     * Write log to console
     */
    private writeToConsole;
    /**
     * Core log method
     */
    private log;
    /**
     * Log DEBUG message
     */
    debug(message: string, context?: LogContext): Promise<void>;
    /**
     * Log INFO message
     */
    info(message: string, context?: LogContext): Promise<void>;
    /**
     * Log WARN message
     */
    warn(message: string, context?: LogContext): Promise<void>;
    /**
     * Log ERROR message
     */
    error(message: string, error?: Error, context?: LogContext): Promise<void>;
    /**
     * Start migration log
     */
    startMigration(direction: 'toPrepaid' | 'toPostpaid', customerId: number, customerName: string, adminId?: number): Promise<number>;
    /**
     * End migration log
     */
    endMigration(migrationId: number, direction: 'toPrepaid' | 'toPostpaid', customerId: number, customerName: string, success: boolean, result?: {
        message?: string;
        portal_id?: string;
        error?: string;
    }): Promise<void>;
    /**
     * Log migration step
     */
    step(step: string, message: string, customerId: number, customerName?: string, metadata?: Record<string, any>): Promise<void>;
    /**
     * Log database operation
     */
    dbOperation(operation: string, customerId: number, customerName?: string, details?: Record<string, any>): Promise<void>;
    /**
     * Log Mikrotik operation
     */
    mikrotikOperation(operation: string, customerId: number, customerName?: string, details?: Record<string, any>): Promise<void>;
    /**
     * Get migration logs for a customer
     */
    getCustomerLogs(customerId: number, limit?: number): Promise<any[]>;
    /**
     * Get migration logs for a migration ID
     */
    getMigrationLogs(migrationId: number): Promise<any[]>;
    /**
     * Get recent migration logs
     */
    getRecentLogs(limit?: number, level?: LogLevel): Promise<any[]>;
}
declare const _default: MigrationLogger;
export default _default;
//# sourceMappingURL=MigrationLogger.d.ts.map