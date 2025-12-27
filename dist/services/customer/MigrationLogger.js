"use strict";
/**
 * Migration Logger Service
 * Sistem logging yang proper untuk migration dengan log ke file dan database
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pool_1 = __importDefault(require("../../db/pool"));
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class MigrationLogger {
    constructor() {
        this.maxLogFileSize = 10 * 1024 * 1024; // 10MB
        this.maxBackupFiles = 5;
        // Setup log directory
        this.logDir = path_1.default.join(process.cwd(), 'logs');
        this.logFile = path_1.default.join(this.logDir, 'migration.log');
        // Ensure log directory exists
        if (!fs_1.default.existsSync(this.logDir)) {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
    }
    /**
     * Ensure migration_logs table exists
     */
    async ensureMigrationLogsTable() {
        try {
            await pool_1.default.query(`
        CREATE TABLE IF NOT EXISTS migration_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          log_level VARCHAR(10) NOT NULL,
          message TEXT NOT NULL,
          customer_id INT NULL,
          customer_name VARCHAR(255) NULL,
          admin_id INT NULL,
          migration_id INT NULL,
          step VARCHAR(100) NULL,
          context JSON NULL,
          error_message TEXT NULL,
          error_stack TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_customer_id (customer_id),
          INDEX idx_migration_id (migration_id),
          INDEX idx_log_level (log_level),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
        }
        catch (error) {
            console.error('[MigrationLogger] Error creating migration_logs table:', error);
        }
    }
    /**
     * Rotate log file if it exceeds max size
     */
    rotateLogFile() {
        try {
            if (!fs_1.default.existsSync(this.logFile)) {
                return;
            }
            const stats = fs_1.default.statSync(this.logFile);
            if (stats.size >= this.maxLogFileSize) {
                // Find next backup number
                let backupNum = 1;
                while (fs_1.default.existsSync(`${this.logFile}.${backupNum}`)) {
                    backupNum++;
                }
                // Rotate existing backups
                for (let i = this.maxBackupFiles - 1; i >= 1; i--) {
                    const oldBackup = `${this.logFile}.${i}`;
                    const newBackup = `${this.logFile}.${i + 1}`;
                    if (fs_1.default.existsSync(oldBackup)) {
                        if (i + 1 > this.maxBackupFiles) {
                            fs_1.default.unlinkSync(oldBackup); // Delete if exceeds max
                        }
                        else {
                            fs_1.default.renameSync(oldBackup, newBackup);
                        }
                    }
                }
                // Rotate current log
                fs_1.default.renameSync(this.logFile, `${this.logFile}.1`);
            }
        }
        catch (error) {
            console.error('[MigrationLogger] Error rotating log file:', error);
        }
    }
    /**
     * Format log entry for file
     */
    formatLogEntry(entry) {
        const { timestamp, level, message, context, error } = entry;
        let logLine = `[${timestamp}] [${level}] ${message}`;
        if (context) {
            const contextStr = Object.entries(context)
                .filter(([key]) => !['error'].includes(key))
                .map(([key, value]) => `${key}=${value}`)
                .join(' ');
            if (contextStr) {
                logLine += ` | ${contextStr}`;
            }
        }
        if (error) {
            logLine += ` | ERROR: ${error.message}`;
            if (error.stack) {
                logLine += `\n${error.stack}`;
            }
        }
        return logLine;
    }
    /**
     * Write log to file
     */
    writeToFile(entry) {
        try {
            this.rotateLogFile();
            const logLine = this.formatLogEntry(entry);
            fs_1.default.appendFileSync(this.logFile, logLine + '\n', 'utf8');
        }
        catch (error) {
            console.error('[MigrationLogger] Error writing to log file:', error);
        }
    }
    /**
     * Write log to database
     */
    async writeToDatabase(entry) {
        try {
            await this.ensureMigrationLogsTable();
            const { level, message, context, error } = entry;
            await pool_1.default.query(`INSERT INTO migration_logs (
          log_level, message, customer_id, customer_name, admin_id, 
          migration_id, step, context, error_message, error_stack, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [
                level,
                message,
                context?.customerId || null,
                context?.customerName || null,
                context?.adminId || null,
                context?.migrationId || null,
                context?.step || null,
                context ? JSON.stringify(context) : null,
                error?.message || null,
                error?.stack || null
            ]);
        }
        catch (error) {
            // Don't throw - logging should not break the application
            console.error('[MigrationLogger] Error writing to database:', error);
        }
    }
    /**
     * Write log to console
     */
    writeToConsole(entry) {
        const { timestamp, level, message, context, error } = entry;
        const emoji = {
            [LogLevel.DEBUG]: '🔍',
            [LogLevel.INFO]: '✅',
            [LogLevel.WARN]: '⚠️',
            [LogLevel.ERROR]: '❌'
        }[level] || '📝';
        let consoleMessage = `${emoji} [${level}] ${message}`;
        if (context?.customerId) {
            consoleMessage += ` | Customer: ${context.customerName || 'ID:' + context.customerId} (${context.customerId})`;
        }
        if (context?.step) {
            consoleMessage += ` | Step: ${context.step}`;
        }
        // Use appropriate console method
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(consoleMessage);
                break;
            case LogLevel.INFO:
                console.log(consoleMessage);
                break;
            case LogLevel.WARN:
                console.warn(consoleMessage);
                break;
            case LogLevel.ERROR:
                console.error(consoleMessage);
                if (error) {
                    console.error('Error details:', error.message);
                    if (error.stack) {
                        console.error(error.stack);
                    }
                }
                break;
        }
    }
    /**
     * Core log method
     */
    async log(level, message, context, error) {
        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            level,
            message,
            context,
            error: error ? {
                message: error.message,
                stack: error.stack
            } : undefined
        };
        // Write to all destinations
        this.writeToConsole(entry);
        this.writeToFile(entry);
        await this.writeToDatabase(entry);
    }
    /**
     * Log DEBUG message
     */
    async debug(message, context) {
        await this.log(LogLevel.DEBUG, message, context);
    }
    /**
     * Log INFO message
     */
    async info(message, context) {
        await this.log(LogLevel.INFO, message, context);
    }
    /**
     * Log WARN message
     */
    async warn(message, context) {
        await this.log(LogLevel.WARN, message, context);
    }
    /**
     * Log ERROR message
     */
    async error(message, error, context) {
        await this.log(LogLevel.ERROR, message, context, error);
    }
    /**
     * Start migration log
     */
    async startMigration(direction, customerId, customerName, adminId) {
        const message = `🚀 START MIGRATION ${direction === 'toPrepaid' ? 'TO PREPAID' : 'TO POSTPAID'}`;
        await this.info(message, {
            customerId,
            customerName,
            adminId,
            step: 'START',
            direction
        });
        // Return a migration ID (timestamp-based for uniqueness)
        return Date.now();
    }
    /**
     * End migration log
     */
    async endMigration(migrationId, direction, customerId, customerName, success, result) {
        const message = success
            ? `✅ MIGRATION ${direction === 'toPrepaid' ? 'TO PREPAID' : 'TO POSTPAID'} COMPLETED SUCCESSFULLY`
            : `❌ MIGRATION ${direction === 'toPrepaid' ? 'TO PREPAID' : 'TO POSTPAID'} FAILED`;
        const context = {
            customerId,
            customerName,
            migrationId,
            step: 'END',
            direction,
            success
        };
        if (result) {
            if (result.portal_id)
                context.portal_id = result.portal_id;
            if (result.error)
                context.error_message = result.error;
        }
        if (success) {
            await this.info(message + (result?.message ? ` | ${result.message}` : ''), context);
        }
        else {
            await this.error(message + (result?.error ? ` | ${result.error}` : ''), undefined, context);
        }
    }
    /**
     * Log migration step
     */
    async step(step, message, customerId, customerName, metadata) {
        await this.info(message, {
            customerId,
            customerName,
            step,
            ...metadata
        });
    }
    /**
     * Log database operation
     */
    async dbOperation(operation, customerId, customerName, details) {
        await this.info(`Database: ${operation}`, {
            customerId,
            customerName,
            step: 'DATABASE',
            operation,
            ...details
        });
    }
    /**
     * Log Mikrotik operation
     */
    async mikrotikOperation(operation, customerId, customerName, details) {
        await this.info(`Mikrotik: ${operation}`, {
            customerId,
            customerName,
            step: 'MIKROTIK',
            operation,
            ...details
        });
    }
    /**
     * Get migration logs for a customer
     */
    async getCustomerLogs(customerId, limit = 50) {
        try {
            const [rows] = await pool_1.default.query(`SELECT * FROM migration_logs 
         WHERE customer_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`, [customerId, limit]);
            return rows;
        }
        catch (error) {
            console.error('[MigrationLogger] Error getting customer logs:', error);
            return [];
        }
    }
    /**
     * Get migration logs for a migration ID
     */
    async getMigrationLogs(migrationId) {
        try {
            const [rows] = await pool_1.default.query(`SELECT * FROM migration_logs 
         WHERE migration_id = ? 
         ORDER BY created_at ASC`, [migrationId]);
            return rows;
        }
        catch (error) {
            console.error('[MigrationLogger] Error getting migration logs:', error);
            return [];
        }
    }
    /**
     * Get recent migration logs
     */
    async getRecentLogs(limit = 100, level) {
        try {
            let query = `SELECT * FROM migration_logs `;
            const params = [];
            if (level) {
                query += `WHERE log_level = ? `;
                params.push(level);
            }
            query += `ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);
            const [rows] = await pool_1.default.query(query, params);
            return rows;
        }
        catch (error) {
            console.error('[MigrationLogger] Error getting recent logs:', error);
            return [];
        }
    }
}
exports.default = new MigrationLogger();
//# sourceMappingURL=MigrationLogger.js.map