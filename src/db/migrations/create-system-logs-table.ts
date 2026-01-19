import { databasePool } from '../pool';

export async function createSystemLogsTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS system_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            log_level ENUM('debug', 'info', 'warning', 'error', 'critical') DEFAULT 'info',
            log_type VARCHAR(50) DEFAULT 'system',
            service_name VARCHAR(100),
            message TEXT,
            context JSON,
            user_id INT,
            customer_id INT,
            invoice_id INT,
            request_id VARCHAR(100),
            ip_address VARCHAR(45),
            user_agent TEXT,
            stack_trace TEXT,
            error_code VARCHAR(100),
            anomaly_detected BOOLEAN DEFAULT 0,
            anomaly_type VARCHAR(50),
            anomaly_score FLOAT,
            ai_analysis JSON,
            resolved BOOLEAN DEFAULT 0,
            resolved_at DATETIME,
            resolved_by INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX (log_level),
            INDEX (log_type),
            INDEX (service_name),
            INDEX (created_at),
            INDEX (request_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await databasePool.query(query);

    // Also ensure log_statistics table
    const statsQuery = `
        CREATE TABLE IF NOT EXISTS log_statistics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            stat_date DATE,
            service_name VARCHAR(100),
            log_level VARCHAR(20),
            log_count INT DEFAULT 0,
            error_count INT DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY (stat_date, service_name, log_level)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await databasePool.query(statsQuery);
}
