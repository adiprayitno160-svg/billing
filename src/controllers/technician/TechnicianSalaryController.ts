import { Request, Response } from 'express';
import { TechnicianAttendanceService } from '../../services/technician/TechnicianAttendanceService';
import { databasePool } from '../../db/pool';

export class TechnicianSalaryController {

    // Check-In Action
    static async checkIn(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            // Default wage could be dynamic or from settings. Let's assume 100k for now or fetch from user config if existed
            // For now hardcode or param
            const defaultWage = 100000;

            await TechnicianAttendanceService.checkIn(userId, defaultWage);

            res.json({ success: true, message: 'Berhasil Check-In hari ini!' });
        } catch (error) {
            console.error('Check-in error:', error);
            res.status(500).json({ success: false, error: 'Gagal melakukan check-in' });
        }
    }

    // Admin: View Monthly Recap for Approval
    static async viewMonthlyRecap(req: Request, res: Response) {
        try {
            const { month, year, technician_id } = req.query;

            // Default to current month
            const current = new Date();
            const m = month ? Number(month) : current.getMonth() + 1;
            const y = year ? Number(year) : current.getFullYear();

            // Get all technicians for dropdown
            const [technicians] = await databasePool.query('SELECT id, full_name FROM users WHERE role = "teknisi"');

            let report = null;
            let selectedTech = null;

            if (technician_id) {
                const techId = Number(technician_id);
                report = await TechnicianAttendanceService.getMonthlyReport(techId, m, y);
                selectedTech = (technicians as any[]).find(t => t.id === techId);
            }

            res.render('technician/salary/approval', {
                title: 'Approval Gaji Teknisi',
                technicians,
                selectedTech,
                report,
                month: m,
                year: y,
                technician_id: technician_id || null,
                user: (req as any).user
            });

        } catch (error) {
            console.error('Salary recap error:', error);
            res.status(500).render('error', { error: 'Internal Error' });
        }
    }

    // Initialize tables
    static async ensurePaymentTable() {
        await databasePool.query(`
            CREATE TABLE IF NOT EXISTS technician_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                technician_id INT NOT NULL,
                month INT NOT NULL,
                year INT NOT NULL,
                total_attendance_days INT DEFAULT 0,
                total_jobs INT DEFAULT 0,
                base_salary DECIMAL(15,2) DEFAULT 0,
                bonus_amount DECIMAL(15,2) DEFAULT 0,
                deduction_amount DECIMAL(15,2) DEFAULT 0,
                final_amount DECIMAL(15,2) DEFAULT 0,
                notes TEXT,
                status ENUM('pending', 'paid') DEFAULT 'paid',
                approved_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (technician_id) REFERENCES users(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            )
        `);
    }

    // Admin: Approve Salary (Process Payment)
    static async approveSalary(req: Request, res: Response) {
        try {
            await TechnicianSalaryController.ensurePaymentTable();

            const adminId = (req as any).user?.id;
            const {
                technician_id,
                month,
                year,
                total_attendance,
                total_jobs,
                base_salary,
                bonus,
                deduction,
                notes
            } = req.body;

            const bonusVal = Number(bonus) || 0;
            const deductionVal = Number(deduction) || 0;
            const finalAmount = Number(base_salary) + bonusVal - deductionVal;

            // Check if already paid for this period
            const [existing] = await databasePool.query<any[]>(
                "SELECT id FROM technician_payments WHERE technician_id = ? AND month = ? AND year = ?",
                [technician_id, month, year]
            );

            if (existing.length > 0) {
                return res.json({ success: false, error: 'Gaji untuk periode ini sudah disetujui sebelumnya.' });
            }

            // Insert Payment Record
            await databasePool.query(
                `INSERT INTO technician_payments 
                (technician_id, month, year, total_attendance_days, total_jobs, base_salary, bonus_amount, deduction_amount, final_amount, notes, status, approved_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`,
                [technician_id, month, year, total_attendance, total_jobs, base_salary, bonusVal, deductionVal, finalAmount, notes, adminId]
            );

            // Optional: Mark daily attendance as "processed" or similar if needed, 
            // but for now we just rely on the monthly payment record.

            res.json({ success: true, message: 'Gaji berhasil disetujui dan dicatat.' });

        } catch (error) {
            console.error('Approve salary error:', error);
            res.status(500).json({ success: false, error: 'Gagal memproses persetujuan gaji.' });
        }
    }
    // Admin: View Payment History (Summary)
    static async viewPaymentSummary(req: Request, res: Response) {
        try {
            await TechnicianSalaryController.ensurePaymentTable();

            const [history] = await databasePool.query<any[]>(`
                SELECT tp.*, u.full_name as technician_name, a.full_name as admin_name 
                FROM technician_payments tp
                JOIN users u ON tp.technician_id = u.id
                LEFT JOIN users a ON tp.approved_by = a.id
                ORDER BY tp.created_at DESC
                LIMIT 100
            `);

            res.render('technician/salary/summary', {
                title: 'Riwayat Pembayaran Gaji',
                history,
                user: (req as any).user
            });
        } catch (error) {
            console.error('View payment summary error:', error);
            res.status(500).render('error', { error: 'Internal Error' });
        }
    }

    // View/Print Salary Slip
    static async printSalarySlip(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const [rows] = await databasePool.query<any[]>(`
                SELECT tp.*, u.full_name as technician_name, u.phone as technician_phone, a.full_name as admin_name 
                FROM technician_payments tp
                JOIN users u ON tp.technician_id = u.id
                LEFT JOIN users a ON tp.approved_by = a.id
                WHERE tp.id = ?
            `, [id]);

            if (rows.length === 0) {
                return res.status(404).send('Data pembayaran tidak ditemukan');
            }

            const payment = rows[0];

            res.render('technician/salary/slip', {
                layout: false, // No layout for print view
                payment
            });

        } catch (error) {
            console.error('Print slip error:', error);
            res.status(500).send('Internal Server Error');
        }
    }
}
