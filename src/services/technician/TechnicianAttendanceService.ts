import { databasePool } from '../../db/pool';

export class TechnicianAttendanceService {

    // Ensure table exists
    static async ensureTable() {
        await databasePool.query(`
            CREATE TABLE IF NOT EXISTS technician_daily_attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                technician_id INT NOT NULL,
                date DATE NOT NULL,
                status ENUM('present', 'absent', 'sick', 'permission', 'off') DEFAULT 'present',
                check_in_time DATETIME NULL,
                check_out_time DATETIME NULL,
                daily_wage DECIMAL(12,2) DEFAULT 0,
                notes TEXT NULL,
                admin_approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                approved_by INT NULL,
                approved_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_attendance (technician_id, date),
                FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
    }

    // Check In
    static async checkIn(technicianId: number, wage: number) {
        await this.ensureTable();
        const date = new Date().toISOString().split('T')[0];

        await databasePool.query(`
            INSERT INTO technician_daily_attendance 
            (technician_id, date, check_in_time, status, daily_wage)
            VALUES (?, ?, NOW(), 'present', ?)
            ON DUPLICATE KEY UPDATE 
            check_in_time = COALESCE(check_in_time, NOW()),
            status = 'present'
        `, [technicianId, date, wage]);
    }

    // Get Monthly Report for a Technician
    static async getMonthlyReport(technicianId: number, month: number, year: number) {
        await this.ensureTable();
        // Get attendance
        const [attendance] = await databasePool.query<any[]>(`
            SELECT * FROM technician_daily_attendance 
            WHERE technician_id = ? 
            AND MONTH(date) = ? AND YEAR(date) = ?
            ORDER BY date ASC
        `, [technicianId, month, year]);

        // Get jobs
        const [jobs] = await databasePool.query<any[]>(`
            SELECT * FROM technician_jobs
            WHERE technician_id = ?
            AND status = 'completed'
            AND MONTH(completed_at) = ? AND YEAR(completed_at) = ?
        `, [technicianId, month, year]);

        return { attendance, jobs };
    }
}
