"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingLogService = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pool_1 = require("../../db/pool");
const AIAnomalyDetectionService_1 = require("./AIAnomalyDetectionService");
class BillingLogService {
    static async initialize() {
        if (!fs_1.default.existsSync(this.logDir)) {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
    }
    static async log(entry) {
        if (entry.isInternal)
            return;
        try {
            if (!entry.requestId)
                entry.requestId = `req-${Date.now()}`;
            await this.writeToFile(entry);
            const logId = await this.writeToDatabase(entry);
            if (['error', 'critical', 'warning'].includes(entry.level)) {
                const anomaly = await this.anomalyDetector.detectAnomaly(entry, logId);
                if (anomaly.isAnomaly) {
                    await this.updateLogAnomaly(logId, anomaly);
                }
            }
        }
        catch (error) {
            console.error('Logging failed:', error);
        }
    }
    static async writeToFile(entry) {
        const timestamp = new Date().toISOString();
        const logFile = path_1.default.join(this.logDir, `billing-${timestamp.split('T')[0]}.log`);
        const logLine = `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;
        await fs_1.default.promises.appendFile(logFile, logLine);
    }
    static async writeToDatabase(entry) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            const [result] = await conn.execute(`INSERT INTO system_logs (log_level, log_type, service_name, message, context, user_id) VALUES (?, ?, ?, ?, ?, ?)`, [entry.level, entry.type, entry.service, entry.message, JSON.stringify(entry.context || {}), entry.userId || null]);
            return result.insertId;
        }
        finally {
            conn.release();
        }
    }
    static async updateLogAnomaly(logId, anomaly) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.execute(`UPDATE system_logs SET anomaly_detected = 1, anomaly_type = ?, ai_analysis = ? WHERE id = ?`, [anomaly.type, JSON.stringify(anomaly.analysis), logId]);
        }
        finally {
            conn.release();
        }
    }
    static async getLogs(filters) {
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
            if (filters.anomalyOnly) {
                query += ' AND anomaly_detected = 1';
            }
            if (filters.startDate) {
                query += ' AND created_at >= ?';
                params.push(filters.startDate);
            }
            if (filters.endDate) {
                query += ' AND created_at <= ?';
                params.push(filters.endDate);
            }
            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(filters.limit || 100);
            params.push(filters.offset || 0);
            const [rows] = await conn.execute(query, params);
            return rows;
        }
        finally {
            conn.release();
        }
    }
    static async resolveAnomaly(id, userId, resolution) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.execute('UPDATE system_logs SET resolved = 1, resolved_at = NOW(), resolved_by = ?, resolution_notes = ? WHERE id = ?', [userId, resolution, id]);
        }
        finally {
            conn.release();
        }
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
}
exports.BillingLogService = BillingLogService;
BillingLogService.logDir = path_1.default.join(process.cwd(), 'logs');
BillingLogService.anomalyDetector = new AIAnomalyDetectionService_1.AIAnomalyDetectionService();
//# sourceMappingURL=BillingLogService.js.map