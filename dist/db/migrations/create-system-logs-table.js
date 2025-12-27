"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSystemLogsTable = createSystemLogsTable;
/**
 * Migration: Create system_logs table for comprehensive billing system logging
 */
const pool_1 = require("../pool");
async function createSystemLogsTable() {
    const conn = await pool_1.databasePool.getConnection();
    try {
        // Create system_logs table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                log_level ENUM('debug', 'info', 'warning', 'error', 'critical') NOT NULL DEFAULT 'info',
                log_type VARCHAR(100) NOT NULL,
                service_name VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                context JSON NULL,
                user_id INT NULL,
                customer_id INT NULL,
                invoice_id INT NULL,
                request_id VARCHAR(100) NULL,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                stack_trace TEXT NULL,
                error_code VARCHAR(50) NULL,
                anomaly_detected TINYINT(1) DEFAULT 0,
                anomaly_type VARCHAR(100) NULL,
                anomaly_score DECIMAL(5,2) NULL,
                ai_analysis JSON NULL,
                resolved TINYINT(1) DEFAULT 0,
                resolved_at TIMESTAMP NULL,
                resolved_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_log_level (log_level),
                INDEX idx_log_type (log_type),
                INDEX idx_service_name (service_name),
                INDEX idx_created_at (created_at),
                INDEX idx_anomaly_detected (anomaly_detected),
                INDEX idx_resolved (resolved),
                INDEX idx_customer_id (customer_id),
                INDEX idx_user_id (user_id),
                INDEX idx_request_id (request_id),
                FULLTEXT idx_message_search (message)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        // Create anomaly_patterns table for AI learning
        await conn.query(`
            CREATE TABLE IF NOT EXISTS anomaly_patterns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                pattern_name VARCHAR(100) NOT NULL UNIQUE,
                pattern_type ENUM('error', 'performance', 'security', 'data', 'business') NOT NULL,
                description TEXT NULL,
                severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
                pattern_rules JSON NOT NULL,
                detection_count INT DEFAULT 0,
                last_detected_at TIMESTAMP NULL,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_pattern_type (pattern_type),
                INDEX idx_severity (severity),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        // Create log_statistics table for analytics
        await conn.query(`
            CREATE TABLE IF NOT EXISTS log_statistics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                stat_date DATE NOT NULL,
                service_name VARCHAR(100) NOT NULL,
                log_level VARCHAR(20) NOT NULL,
                log_count INT DEFAULT 0,
                error_count INT DEFAULT 0,
                anomaly_count INT DEFAULT 0,
                avg_response_time DECIMAL(10,2) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_stat (stat_date, service_name, log_level),
                INDEX idx_stat_date (stat_date),
                INDEX idx_service_name (service_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ System logs tables created successfully');
    }
    catch (error) {
        console.error('❌ Error creating system logs tables:', error);
        throw error;
    }
    finally {
        conn.release();
    }
}
//# sourceMappingURL=create-system-logs-table.js.map