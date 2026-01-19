import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { WhatsAppClient } from '../../services/whatsapp';
import { RowDataPacket } from 'mysql2';

export class TechnicianController {

    // Initialize tables
    static async ensureTables() {
        try {
            await databasePool.query(`
                CREATE TABLE IF NOT EXISTS technician_jobs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ticket_number VARCHAR(50) UNIQUE NOT NULL,
                    customer_id INT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
                    status ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
                    technician_id INT NULL,
                    reported_by VARCHAR(50) DEFAULT 'system',
                    coordinates VARCHAR(100) NULL,
                    address TEXT NULL,
                    job_type_id INT NULL,
                    total_fee DECIMAL(12,2) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    accepted_at TIMESTAMP NULL,
                    completed_at TIMESTAMP NULL,
                    completion_notes TEXT,
                    completion_proof VARCHAR(255) NULL,
                    FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
                )
            `);
            console.log('✅ Technician jobs table ensured');
        } catch (error) {
            console.error('Failed to ensure technician tables:', error);
        }
    }

    // Dashboard
    static async dashboard(req: Request, res: Response) {
        try {
            // await TechnicianController.ensureTables(); // Optimization: Avoid DDL on every request
            const userId = (req.session as any).user?.id;
            const userRole = (req.session as any).user?.role;

            // Get stats
            const [stats] = await databasePool.query<any[]>(`
                SELECT 
                    COUNT(*) as total_jobs,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'completed' AND DATE(completed_at) = CURDATE() THEN 1 ELSE 0 END) as completed_today,
                    COALESCE(SUM(CASE WHEN technician_id = ? AND is_remitted = 0 THEN collected_funds ELSE 0 END), 0) as wallet_balance,
                    COALESCE(SUM(CASE WHEN technician_id = ? AND status = 'completed' AND MONTH(completed_at) = MONTH(CURRENT_DATE()) AND YEAR(completed_at) = YEAR(CURRENT_DATE()) THEN total_fee ELSE 0 END), 0) as monthly_fees
                FROM technician_jobs
                ${userRole === 'teknisi' ? 'WHERE technician_id = ? OR status = "pending"' : ''}
            `, userRole === 'teknisi' ? [userId, userId, userId] : [userId, userId]);

            // Get Job Types for Modal
            const [jobTypes] = await databasePool.query<any[]>('SELECT * FROM job_types WHERE is_active = 1');

            res.render('technician/dashboard', {
                title: 'Dashboard Teknisi',
                currentPath: '/technician',
                user: (req.session as any).user,
                stats: stats[0],
                jobTypes
            });
        } catch (error) {
            console.error('Error loading technician dashboard:', error);
            res.status(500).render('error', { error: 'Failed to load dashboard' });
        }
    }

    // Get Jobs List (AJAX)
    static async getJobs(req: Request, res: Response) {
        try {
            // Default limit 10 rows per user request
            const { status, limit = 10 } = req.query;
            const userId = (req as any).user?.id;
            const userRole = (req as any).user?.role;

            let query = `
                SELECT j.*, c.name as customer_name, c.phone as customer_phone, u.full_name as technician_name
                FROM technician_jobs j
                LEFT JOIN customers c ON j.customer_id = c.id
                LEFT JOIN users u ON j.technician_id = u.id
                WHERE 1=1
            `;
            const params: any[] = [];

            if (userRole === 'teknisi') {
                // Technician sees their own jobs OR pending jobs
                query += ` AND (j.technician_id = ? OR j.status = 'pending')`;
                params.push(userId);
            }

            if (status) {
                query += ` AND j.status = ?`;
                params.push(status);
            }

            query += ` ORDER BY CASE WHEN j.status = 'pending' THEN 0 ELSE 1 END, j.created_at DESC LIMIT ?`;
            params.push(Number(limit));

            const [rows] = await databasePool.query<any[]>(query, params);

            res.json({ success: true, data: rows });
        } catch (error) {
            res.json({ success: false, error: 'Failed to fetch jobs' });
        }
    }

    // API: Search Customers for autocomplete
    static async apiSearchCustomers(req: Request, res: Response) {
        try {
            const { q } = req.query;
            const [rows] = await databasePool.query<RowDataPacket[]>(
                "SELECT id, name, phone, address, coordinates FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 10",
                [`%${q}%`, `%${q}%`]
            );
            res.json({ success: true, data: rows });
        } catch (error) {
            res.json({ success: false, error: 'Failed to search customers' });
        }
    }

    // API: Save Job from Dashboard
    static async apiSaveJob(req: Request, res: Response) {
        try {
            const { title, description, customer_id, priority, coordinates, address, job_type_id, fee } = req.body;
            const userId = (req as any).user?.id;

            const ticket = await TechnicianController.createJob({
                title,
                description,
                customer_id: customer_id ? Number(customer_id) : undefined,
                priority,
                coordinates,
                address,
                reported_by: 'technician', // Or fetch the user's name if available
                job_type_id: job_type_id ? Number(job_type_id) : undefined,
                fee: fee ? Number(fee) : undefined
            });

            if (ticket) {
                res.json({ success: true, message: 'Pekerjaan berhasil dibuat dan notifikasi dikirim', ticket });
            } else {
                res.json({ success: false, error: 'Gagal membuat pekerjaan' });
            }
        } catch (error) {
            console.error('Error saving job:', error);
            res.json({ success: false, error: 'Gagal membuat pekerjaan' });
        }
    }

    // Create Job (Can be called internally or via API)
    static async createJob(data: {
        title: string;
        description?: string;
        customer_id?: number;
        priority?: 'low' | 'medium' | 'high' | 'critical';
        coordinates?: string;
        address?: string;
        reported_by?: string;
        job_type_id?: number;
        fee?: number;
    }) {
        try {
            await TechnicianController.ensureTables();

            // Simple Ticket Number: JOB-XXXXX (5 random digits)
            const ticketNumber = `JOB-${Math.floor(10000 + Math.random() * 90000)}`;

            let finalFee = 0;
            let typeName = 'Umum';

            if (data.job_type_id) {
                const [types] = await databasePool.query<any[]>('SELECT * FROM job_types WHERE id = ?', [data.job_type_id]);
                if (types.length > 0) {
                    finalFee = Number(types[0].base_fee);
                    typeName = types[0].name;
                }
            }
            if (data.fee !== undefined) finalFee = data.fee;

            await databasePool.query(
                `INSERT INTO technician_jobs (ticket_number, title, description, customer_id, priority, coordinates, address, reported_by, job_type_id, total_fee)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [ticketNumber, data.title, data.description, data.customer_id, data.priority || 'medium', data.coordinates, data.address, data.reported_by || 'system', data.job_type_id, finalFee]
            );

            // Notify Technicians via WhatsApp
            const message = `
*🛠️ JOB BARU TERSEDIA*

🎫 Tiket: *${ticketNumber}*
📂 Tipe: *${typeName}*
📝 Judul: ${data.title}
🚨 Prio: ${data.priority || 'medium'}
📍 Loc: ${data.coordinates || '-'}

Untuk mengambil, balas:
*!ambil ${ticketNumber}*
`.trim();

            // Find all technicians with phone numbers
            const [techs] = await databasePool.query<RowDataPacket[]>(
                "SELECT phone FROM users WHERE role = 'teknisi' AND is_active = 1 AND phone IS NOT NULL"
            );

            if (techs.length > 0) {
                const waClient = WhatsAppClient.getInstance();
                for (const tech of techs) {
                    if (tech.phone) {
                        // Send WA
                        await waClient.sendMessage(tech.phone, message).catch(console.warn);
                    }
                }
            }

            return ticketNumber;
        } catch (error) {
            console.error('Failed to create technician job:', error);
            return null;
        }
    }

    // Accept Job
    static async acceptJob(req: Request, res: Response) {
        try {
            const { id } = req.body;
            const userId = (req as any).user?.id;

            // Check if job is pending
            const [jobs] = await databasePool.query<any[]>("SELECT * FROM technician_jobs WHERE id = ?", [id]);
            if (jobs.length === 0) return res.json({ success: false, error: 'Job not found' });
            if (jobs[0].status !== 'pending') return res.json({ success: false, error: 'Job already taken' });

            await databasePool.query(
                "UPDATE technician_jobs SET status = 'accepted', technician_id = ?, accepted_at = NOW() WHERE id = ?",
                [userId, id]
            );

            // AUTO CHECK-IN Logic
            const { TechnicianAttendanceService } = await import('../../services/technician/TechnicianAttendanceService');
            // Assuming 100k daily wage
            await TechnicianAttendanceService.checkIn(Number(userId), 100000);

            res.json({ success: true, message: 'Pekerjaan berhasil diambil' });
        } catch (error) {
            console.error('Accept job error:', error);
            res.json({ success: false, error: 'Failed to accept job' });
        }
    }

    // Decline Job (Technician rejects)
    static async declineJob(req: Request, res: Response) {
        try {
            const { id, reason } = req.body;
            const userId = (req as any).user?.id;
            // NOTE: Currently, we don't have a specific 'declined' status or 'declined_by' tracking per tech.
            // If a tech declines, does it disappear for them? or go back to pool?
            // Ideally, we might want to log who declined it so they don't see it again, 
            // OR if it's assigned to them (which it isn't if pending), they can't decline.
            // But if they just don't want to see it?

            // Assuming this is for valid reasons to ignore a pending job? 
            // Or maybe declining an assigned job?
            // "Pending" jobs are open to all.

            // Let's assume for now "Declining" means "I can't do this" and maybe we just log it or hide it?
            // Actually, usually techs "Accept" from a pool. They don't "Decline" unless it was assigned to them specifically.
            // Current flow: Jobs are Pending (Pool). Techs "Ambil" (Accept).

            // If the user wants `declineJob`, maybe it's for when they accidentally accepted it?
            // OR if the dispatch system assigned it to them.

            // Let's implement "Release/Cancel" if they accepted it but can't do it.
            // Or if it's strictly "Pending", maybe they want to hide it?

            // Given the summary says "declineJob method... /tolak_pekerjaan", let's assume it allows a tech to say "No" to a Pending job (maybe marking it so they don't see it?)
            // OR resetting an "Accepted" job back to "Pending"?

            // Let's go with: TECHNICIAN wants to RETURN a job they Accepted. (Release)
            // AND/OR Reject a job assigned to them (if assignment exists).

            // Since jobs are currently "grabbed" (Pool model), "Decline" on a Pending job effectively means nothing unless we track "Declined By".
            // Let's implement "Release" (Kembalikan ke antrian) if they already accepted it.

            // Wait, the user objective says: "Develop declineJob Method... /tolak_pekerjaan"
            // If I am a tech and I see a pending job, maybe I want to ignore it.

            // Let's implement RELEASING a job (un-assign) for now if status is 'accepted'.

            const [jobs] = await databasePool.query<any[]>("SELECT * FROM technician_jobs WHERE id = ?", [id]);
            if (jobs.length === 0) return res.json({ success: false, error: 'Job not found' });

            const job = jobs[0];

            if (job.status === 'accepted' && job.technician_id === userId) {
                // Return to pool
                await databasePool.query(
                    "UPDATE technician_jobs SET status = 'pending', technician_id = NULL, accepted_at = NULL WHERE id = ?",
                    [id]
                );
                return res.json({ success: true, message: 'Pekerjaan dikembalikan ke antrian' });
            }

            // If status is pending, maybe they just want to hide it physically? 
            // For now, let's just handle "Un-accepting" or "Releasing".

            return res.json({ success: false, error: 'Cannot decline this job' });

        } catch (error) {
            console.error('Error declining job:', error);
            res.json({ success: false, error: 'Failed to decline job' });
        }
    }

    // Complete Job
    static async completeJob(req: Request, res: Response) {
        try {
            const { id, notes } = req.body;
            const userId = (req as any).user?.id;
            const file = req.file; // From Multer

            let proofPath = null;
            if (file) {
                // Save relative path for serving
                proofPath = '/uploads/technician/' + file.filename;
            }

            // Using parameterized query for optional proof
            await databasePool.query(
                "UPDATE technician_jobs SET status = 'completed', completed_at = NOW(), completion_notes = ?, completion_proof = ? WHERE id = ? AND technician_id = ?",
                [notes, proofPath, id, userId]
            );

            res.json({ success: true, message: 'Pekerjaan selesai' });
        } catch (error) {
            console.error('Complete job error:', error);
            res.json({ success: false, error: 'Failed to complete job' });
        }
    }

    // View Job Detail
    static async getJobDetail(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = (req as any).user?.id;
            const userRole = (req as any).user?.role;

            const [jobs] = await databasePool.query<any[]>(`
                SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, u.full_name as technician_name
                FROM technician_jobs j
                LEFT JOIN customers c ON j.customer_id = c.id
                LEFT JOIN users u ON j.technician_id = u.id
                WHERE j.id = ?
            `, [id]);

            if (jobs.length === 0) {
                return res.status(404).render('error', { title: 'Not Found', message: 'Job not found' });
            }

            const job = jobs[0];

            // Security check: Technicians can only see their own jobs or pending jobs
            if (userRole === 'teknisi' && job.technician_id && job.technician_id !== userId && job.status !== 'pending') {
                return res.status(403).render('error', { title: 'Forbidden', message: 'Akses ditolak. Pekerjaan ini diambil oleh teknisi lain.' });
            }

            res.render('technician/job_detail', {
                title: `Job ${job.ticket_number}`,
                job,
                currentPath: '/technician',
                user: (req as any).user
            });

        } catch (error) {
            console.error('Error viewing job detail:', error);
            res.status(500).render('error', { title: 'Error', message: 'Internal Server Error' });
        }
    }
}
