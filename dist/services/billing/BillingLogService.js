"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingLogService = void 0;
/**
 * BillingLogService - Comprehensive logging system for billing
 * Logs to both file and database with automatic anomaly detection
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pool_1 = require("../../db/pool");
const AIAnomalyDetectionService_1 = require("./AIAnomalyDetectionService");
class BillingLogService {
    /**
     * Initialize logging directory
     */
    static async initialize() {
        // Ensure logs directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        // Ensure database tables exist
        try {
            const { createSystemLogsTable } = await Promise.resolve().then(() => __importStar(require('../../db/migrations/create-system-logs-table')));
            await createSystemLogsTable();
        }
        catch (error) {
            console.error('Error initializing log tables:', error);
        }
    }
    /**
     * Main logging method
     */
    static async log(entry) {
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
        }
        catch (error) {
            // Fallback to console if logging fails
            console.error('Error in BillingLogService:', error);
            console.error('Original log entry:', entry);
        }
    }
    /**
     * Write log to file
     */
    static async writeToFile(entry) {
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
    static async writeToDatabase(entry) {
        const conn = await pool_1.databasePool.getConnection();
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
            return result.insertId;
        }
        finally {
            conn.release();
        }
    }
    /**
     * Update log with anomaly detection result
     */
    static async updateLogAnomaly(logId, anomaly) {
        const conn = await pool_1.databasePool.getConnection();
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
        }
        finally {
            conn.release();
        }
    }
    /**
     * Log detected anomaly
     */
    static async logAnomaly(entry, anomaly, logId) {
        const anomalyEntry = {
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
    static async updateStatistics(entry) {
        const conn = await pool_1.databasePool.getConnection();
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
        }
        catch (error) {
            // Silent fail for statistics
        }
        finally {
            conn.release();
        }
    }
    /**
     * Convenience methods for different log levels
     */
    static async debug(type, service, message, context) {
        await this.log({ level: 'debug', type, service, message, context });
    }
    static async info(type, service, message, context) {
        await this.log({ level: 'info', type, service, message, context });
    }
    static async warning(type, service, message, context) {
        await this.log({ level: 'warning', type, service, message, context });
    }
    static async error(type, service, message, error, context) {
        await this.log({ level: 'error', type, service, message, error, context });
    }
    static async critical(type, service, message, error, context) {
        await this.log({ level: 'critical', type, service, message, error, context });
    }
    /**
     * Log billing-specific events
     */
    static async logBilling(level, service, message, customerId, invoiceId, context) {
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
    static async logPayment(level, service, message, customerId, invoiceId, context) {
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
    static generateRequestId() {
        return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get logs with filters
     */
    static async getLogs(filters = {}) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            let query = 'SELECT * FROM system_logs WHERE 1=1';
            const params = [];
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
            return rows;
        }
        finally {
            conn.release();
        }
    }
    /**
     * Mark anomaly as resolved
     */
    static async resolveAnomaly(logId, userId, resolution) {
        const conn = await pool_1.databasePool.getConnection();
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
        }
        finally {
            conn.release();
        }
    }
}
exports.BillingLogService = BillingLogService;
BillingLogService.logDir = path.join(process.cwd(), 'logs');
BillingLogService.anomalyDetector = new AIAnomalyDetectionService_1.AIAnomalyDetectionService();
//# sourceMappingURL=BillingLogService.js.map