/**
 * Migration: Create maintenance_schedules table
 */
import { databasePool } from '../pool';

export async function createMaintenanceSchedulesTable(): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        // Create maintenance_schedules table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS maintenance_schedules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                status ENUM('scheduled', 'in_progress', 'ongoing', 'completed', 'cancelled') DEFAULT 'scheduled',
                issue_type VARCHAR(100) DEFAULT 'Maintenance',
                affected_customers JSON COMMENT 'Array of customer IDs affected by this maintenance',
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                notification_sent BOOLEAN DEFAULT FALSE,
                notification_sent_at TIMESTAMP NULL,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_status (status),
                INDEX idx_start_time (start_time),
                INDEX idx_end_time (end_time),
                INDEX idx_created_by (created_by)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Check if column exists (for idempotency if table existed but column didn't)
        const [columns] = await conn.query<any[]>(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'maintenance_schedules' 
            AND COLUMN_NAME = 'issue_type'
        `);

        if (columns.length === 0) {
            await conn.query(`
                ALTER TABLE maintenance_schedules 
                ADD COLUMN issue_type VARCHAR(100) DEFAULT 'Maintenance' AFTER status
            `);
            console.log('✅ Added issue_type column to maintenance_schedules');
        }

        console.log('✅ Maintenance schedules table created successfully');
    } catch (error) {
        console.error('❌ Error creating maintenance schedules table:', error);
        throw error;
    } finally {
        conn.release();
    }
}
