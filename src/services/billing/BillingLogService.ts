import path from 'path';
import fs from 'fs';
import { databasePool } from '../../db/pool';
import { AIAnomalyDetectionService } from './AIAnomalyDetectionService';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';
export type LogType = 'system' | 'auth' | 'billing' | 'payment' | 'network' | 'customer' | 'mikrotik' | 'technician' | 'invoice' | 'api' | 'olt' | 'genieacs' | 'ftth' | 'whatsapp';

export interface LogEntry {
    level: LogLevel;
    type: LogType;
    service: string;
    message: string;
    context?: any;
    userId?: number;
    customerId?: number;
    invoiceId?: number;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    error?: Error;
    isInternal?: boolean;
}

export class BillingLogService {
    private static logDir = path.join(process.cwd(), 'logs');
    private static anomalyDetector = new AIAnomalyDetectionService();

    static async initialize(): Promise<void> {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    static async log(entry: LogEntry): Promise<void> {
        if (entry.isInternal) return;

        try {
            if (!entry.requestId) entry.requestId = `req-${Date.now()}`;
            await this.writeToFile(entry);
            const logId = await this.writeToDatabase(entry);

            if (['error', 'critical', 'warning'].includes(entry.level)) {
                const anomaly = await this.anomalyDetector.detectAnomaly(entry, logId);
                if (anomaly.isAnomaly) {
                    await this.updateLogAnomaly(logId, anomaly);
                }
            }
        } catch (error) {
            console.error('Logging failed:', error);
        }
    }

    private static async writeToFile(entry: LogEntry): Promise<void> {
        const timestamp = new Date().toISOString();
        const logFile = path.join(this.logDir, `billing-${timestamp.split('T')[0]}.log`);
        const logLine = `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;
        fs.appendFileSync(logFile, logLine);
    }

    private static async writeToDatabase(entry: LogEntry): Promise<number> {
        const conn = await databasePool.getConnection();
        try {
            const [result]: any = await conn.execute(
                `INSERT INTO system_logs (log_level, log_type, service_name, message, context, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
                [entry.level, entry.type, entry.service, entry.message, JSON.stringify(entry.context || {}), entry.userId || null]
            );
            return result.insertId;
        } finally {
            conn.release();
        }
    }

    private static async updateLogAnomaly(logId: number, anomaly: any): Promise<void> {
        const conn = await databasePool.getConnection();
        try {
            await conn.execute(
                `UPDATE system_logs SET anomaly_detected = 1, anomaly_type = ?, ai_analysis = ? WHERE id = ?`,
                [anomaly.type, JSON.stringify(anomaly.analysis), logId]
            );
        } finally {
            conn.release();
        }
    }

    static async getLogs(filters: any): Promise<any[]> {
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
            return rows as any[];
        } finally {
            conn.release();
        }
    }

    static async resolveAnomaly(id: number, userId: number, resolution: string): Promise<void> {
        const conn = await databasePool.getConnection();
        try {
            await conn.execute(
                'UPDATE system_logs SET resolved = 1, resolved_at = NOW(), resolved_by = ?, resolution_notes = ? WHERE id = ?',
                [userId, resolution, id]
            );
        } finally {
            conn.release();
        }
    }

    static async info(type: LogType, service: string, message: string, context?: any) {
        await this.log({ level: 'info', type, service, message, context });
    }

    static async warning(type: LogType, service: string, message: string, context?: any) {
        await this.log({ level: 'warning', type, service, message, context });
    }

    static async error(type: LogType, service: string, message: string, error?: Error, context?: any) {
        await this.log({ level: 'error', type, service, message, error, context });
    }

    static async critical(type: LogType, service: string, message: string, error?: Error, context?: any) {
        await this.log({ level: 'critical', type, service, message, error, context });
    }
}
