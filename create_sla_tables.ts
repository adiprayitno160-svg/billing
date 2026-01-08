
import { databasePool } from './src/db/pool';

async function createSLATables() {
    try {
        console.log('--- Creating SLA Tables ---');

        // Create sla_incidents table
        await databasePool.query(`
            CREATE TABLE IF NOT EXISTS sla_incidents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT,
                customer_name VARCHAR(255),
                incident_type VARCHAR(100),
                description TEXT,
                start_time DATETIME,
                end_time DATETIME,
                duration_minutes INT DEFAULT 0,
                status ENUM('ongoing', 'resolved', 'closed') DEFAULT 'ongoing',
                severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
                affected_service VARCHAR(100),
                root_cause TEXT,
                resolution TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_customer (customer_id),
                INDEX idx_status (status),
                INDEX idx_start_time (start_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ sla_incidents table created');

        // Create sla_refunds table
        await databasePool.query(`
            CREATE TABLE IF NOT EXISTS sla_refunds (
                id INT AUTO_INCREMENT PRIMARY KEY,
                incident_id INT,
                customer_id INT,
                customer_name VARCHAR(255),
                refund_amount DECIMAL(15, 2) DEFAULT 0,
                refund_type ENUM('credit', 'cash', 'discount') DEFAULT 'credit',
                reason TEXT,
                status ENUM('pending', 'approved', 'processed', 'rejected') DEFAULT 'pending',
                approved_by INT,
                processed_at DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_incident (incident_id),
                INDEX idx_customer (customer_id),
                INDEX idx_status (status),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ sla_refunds table created');

        // Create sla_targets table for SLA configuration
        await databasePool.query(`
            CREATE TABLE IF NOT EXISTS sla_targets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                target_uptime DECIMAL(5, 2) DEFAULT 99.50,
                max_response_minutes INT DEFAULT 60,
                max_resolution_minutes INT DEFAULT 240,
                refund_percentage DECIMAL(5, 2) DEFAULT 10.00,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ sla_targets table created');

        // Insert default SLA target if not exists
        const [existing] = await databasePool.query('SELECT id FROM sla_targets LIMIT 1');
        if ((existing as any[]).length === 0) {
            await databasePool.query(`
                INSERT INTO sla_targets (name, target_uptime, max_response_minutes, max_resolution_minutes, refund_percentage)
                VALUES ('Default SLA', 99.50, 60, 240, 10.00)
            `);
            console.log('✅ Default SLA target inserted');
        }

        console.log('\n✅ All SLA tables created successfully!');

    } catch (error) {
        console.error('Error creating SLA tables:', error);
    } finally {
        await databasePool.end();
        process.exit();
    }
}

createSLATables();
