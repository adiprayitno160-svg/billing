"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TechnicianController = void 0;
const pool_1 = require("../../db/pool");
const WhatsAppService_1 = require("../../services/whatsapp/WhatsAppService");
class TechnicianController {
    // Initialize tables
    static async ensureTables() {
        try {
            await pool_1.databasePool.query(`
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
                    collected_funds DECIMAL(12,2) DEFAULT 0,
                    is_remitted TINYINT(1) DEFAULT 0,
                    remitted_at TIMESTAMP NULL,
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
        }
        catch (error) {
            console.error('Failed to ensure technician tables:', error);
        }
    }
    // Dashboard
    static async dashboard(req, res) {
        try {
            // Use req.user which is set by isAuthenticated middleware
            const user = req.user;
            const userId = user === null || user === void 0 ? void 0 : user.id;
            const userRole = user === null || user === void 0 ? void 0 : user.role;
            // Get stats
            const isTeknisi = userRole === 'teknisi';
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_jobs,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'completed' AND DATE(completed_at) = CURDATE() THEN 1 ELSE 0 END) as completed_today,
                    COALESCE(SUM(CASE WHEN ${isTeknisi ? 'technician_id = ?' : '1=1'} AND is_remitted = 0 THEN collected_funds ELSE 0 END), 0) as wallet_balance,
                    COALESCE(SUM(CASE WHEN ${isTeknisi ? 'technician_id = ?' : '1=1'} AND status = 'completed' AND MONTH(completed_at) = MONTH(CURRENT_DATE()) AND YEAR(completed_at) = YEAR(CURRENT_DATE()) THEN total_fee ELSE 0 END), 0) as monthly_fees
                FROM technician_jobs
                ${isTeknisi ? 'WHERE technician_id = ? OR status = "pending"' : ''}
            `;
            const statsParams = isTeknisi ? [userId, userId, userId] : [];
            const [stats] = await pool_1.databasePool.query(statsQuery, statsParams);
            // Get Job Types for Modal
            const [jobTypes] = await pool_1.databasePool.query('SELECT * FROM job_types WHERE is_active = 1');
            res.render('technician/dashboard', {
                title: 'Dashboard Teknisi',
                currentPath: '/technician',
                user: req.user,
                stats: stats[0],
                jobTypes
            });
        }
        catch (error) {
            console.error('Error loading technician dashboard:', error);
            res.status(500).render('error', { error: 'Failed to load dashboard' });
        }
    }
    // Get Jobs List (AJAX)
    static async getJobs(req, res) {
        var _a, _b;
        try {
            // Default limit 10 rows per user request
            const { status, limit = 10 } = req.query;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            let query = `
                SELECT j.*, c.name as customer_name, c.phone as customer_phone, u.full_name as technician_name
                FROM technician_jobs j
                LEFT JOIN customers c ON j.customer_id = c.id
                LEFT JOIN users u ON j.technician_id = u.id
                WHERE 1=1
            `;
            const params = [];
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
            const [rows] = await pool_1.databasePool.query(query, params);
            res.json({ success: true, data: rows });
        }
        catch (error) {
            res.json({ success: false, error: 'Failed to fetch jobs' });
        }
    }
    // Get Job History
    static async getJobHistory(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            let query = `
                SELECT j.*, c.name as customer_name, c.phone as customer_phone, u.full_name as technician_name
                FROM technician_jobs j
                LEFT JOIN customers c ON j.customer_id = c.id
                LEFT JOIN users u ON j.technician_id = u.id
                WHERE 1=1
            `;
            const params = [];
            if (userRole === 'teknisi') {
                // Technician sees their own jobs only
                query += ` AND j.technician_id = ?`;
                params.push(userId);
            }
            // Order by created_at descending to show latest jobs first
            query += ` ORDER BY j.created_at DESC`;
            const [rows] = await pool_1.databasePool.query(query, params);
            res.render('technician/history', {
                title: 'Riwayat Pekerjaan',
                jobs: rows,
                currentPath: '/technician/history',
                user: req.user
            });
        }
        catch (error) {
            console.error('Error loading technician job history:', error);
            res.status(500).render('error', { error: 'Failed to load job history' });
        }
    }
    // API: Search Customers for autocomplete
    static async apiSearchCustomers(req, res) {
        try {
            const { q } = req.query;
            const [rows] = await pool_1.databasePool.query("SELECT id, name, phone, address, coordinates FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 10", [`%${q}%`, `%${q}%`]);
            res.json({ success: true, data: rows });
        }
        catch (error) {
            res.json({ success: false, error: 'Failed to search customers' });
        }
    }
    // API: Save Job from Dashboard
    static async apiSaveJob(req, res) {
        var _a;
        try {
            const { title, description, customer_id, priority, coordinates, address, job_type_id, fee } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
            }
            else {
                res.json({ success: false, error: 'Gagal membuat pekerjaan' });
            }
        }
        catch (error) {
            console.error('Error saving job:', error);
            res.json({ success: false, error: 'Gagal membuat pekerjaan' });
        }
    }
    // Create Job (Can be called internally or via API)
    static async createJob(data) {
        try {
            await TechnicianController.ensureTables();
            // Simple Ticket Number: JOB-XXXXX (5 random digits)
            const ticketNumber = `JOB-${Math.floor(10000 + Math.random() * 90000)}`;
            let finalFee = 0;
            let typeName = 'Umum';
            if (data.job_type_id) {
                const [types] = await pool_1.databasePool.query('SELECT * FROM job_types WHERE id = ?', [data.job_type_id]);
                if (types.length > 0) {
                    finalFee = Number(types[0].base_fee);
                    typeName = types[0].name;
                }
            }
            if (data.fee !== undefined)
                finalFee = data.fee;
            await pool_1.databasePool.query(`INSERT INTO technician_jobs (ticket_number, title, description, customer_id, priority, coordinates, address, reported_by, job_type_id, total_fee)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [ticketNumber, data.title, data.description, data.customer_id, data.priority || 'medium', data.coordinates, data.address, data.reported_by || 'system', data.job_type_id, finalFee]);
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
            const [techs] = await pool_1.databasePool.query("SELECT phone FROM users WHERE role = 'teknisi' AND is_active = 1 AND phone IS NOT NULL");
            if (techs.length > 0) {
                const waClient = WhatsAppService_1.whatsappService;
                for (const tech of techs) {
                    if (tech.phone) {
                        // Send WA
                        await waClient.sendMessage(tech.phone, message).catch(console.warn);
                    }
                }
            }
            return ticketNumber;
        }
        catch (error) {
            console.error('Failed to create technician job:', error);
            return null;
        }
    }
    // Accept Job
    static async acceptJob(req, res) {
        var _a;
        try {
            const { id } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            // Check if job is pending
            const [jobs] = await pool_1.databasePool.query("SELECT * FROM technician_jobs WHERE id = ?", [id]);
            if (jobs.length === 0)
                return res.json({ success: false, error: 'Job not found' });
            if (jobs[0].status !== 'pending')
                return res.json({ success: false, error: 'Job already taken' });
            await pool_1.databasePool.query("UPDATE technician_jobs SET status = 'accepted', technician_id = ?, accepted_at = NOW() WHERE id = ?", [userId, id]);
            res.json({ success: true, message: 'Pekerjaan berhasil diambil' });
        }
        catch (error) {
            console.error('Accept job error:', error);
            res.json({ success: false, error: 'Failed to accept job' });
        }
    }
    // Decline Job (Technician rejects)
    static async declineJob(req, res) {
        var _a;
        try {
            const { id, reason } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
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
            const [jobs] = await pool_1.databasePool.query("SELECT * FROM technician_jobs WHERE id = ?", [id]);
            if (jobs.length === 0)
                return res.json({ success: false, error: 'Job not found' });
            const job = jobs[0];
            if (job.status === 'accepted' && job.technician_id === userId) {
                // Return to pool
                await pool_1.databasePool.query("UPDATE technician_jobs SET status = 'pending', technician_id = NULL, accepted_at = NULL WHERE id = ?", [id]);
                return res.json({ success: true, message: 'Pekerjaan dikembalikan ke antrian' });
            }
            // If status is pending, maybe they just want to hide it physically? 
            // For now, let's just handle "Un-accepting" or "Releasing".
            return res.json({ success: false, error: 'Cannot decline this job' });
        }
        catch (error) {
            console.error('Error declining job:', error);
            res.json({ success: false, error: 'Failed to decline job' });
        }
    }
    // Complete Job
    static async completeJob(req, res) {
        var _a;
        try {
            const { id, notes } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const file = req.file; // From Multer
            let proofPath = null;
            if (file) {
                // Save relative path for serving
                proofPath = '/uploads/technician/' + file.filename;
            }
            // 1. Fetch Job & Customer Details first
            const [jobs] = await pool_1.databasePool.query(`
                SELECT j.*, c.name as customer_name, c.phone as customer_phone, u.full_name as technician_name, u.phone as technician_phone
                FROM technician_jobs j
                LEFT JOIN customers c ON j.customer_id = c.id
                LEFT JOIN users u ON j.technician_id = u.id
                WHERE j.id = ?
            `, [id]);
            if (jobs.length === 0)
                return res.json({ success: false, error: 'Job not found' });
            const job = jobs[0];
            // 2. Update Status
            // Allow admin or the assigned technician to complete
            // (Using technician_id check only if not admin? For now stick to strict technician check or if job is accepted)
            const [result] = await pool_1.databasePool.query("UPDATE technician_jobs SET status = 'completed', completed_at = NOW(), completion_notes = ?, completion_proof = ? WHERE id = ? AND (technician_id = ? OR ? IN (SELECT id FROM users WHERE role = 'admin'))", [notes, proofPath, id, userId, userId]);
            if (result.affectedRows === 0) {
                return res.json({ success: false, error: 'Gagal menyelesaikan pekerjaan. Pastikan Anda teknisi yang bertugas.' });
            }
            // 3. SEND WHATSAPP NOTIFICATIONS
            const waClient = WhatsAppService_1.whatsappService;
            const timeString = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
            // Notification content
            const customerMsg = `*✅ PEKERJAAN SELESAI*\n\nHalo Kak *${job.customer_name}*,\nPekerjaan *${job.title}* (#${job.ticket_number}) telah diselesaikan oleh teknisi kami.\n\n📅 Waktu: ${timeString}\n📋 Catatan: ${notes || '-'}\n\nTerima kasih atas kepercayaannya.`;
            const techMsg = `*✅ LAPORAN TERKIRIM*\n\nTiket: *${job.ticket_number}* (#${job.id})\nStatus: *Completed*\nCustomer: ${job.customer_name}\nWaktu: ${timeString}\nCatatan: ${notes}`;
            // A. To Customer
            if (job.customer_phone) {
                // Send Text Only to Customer (per request)
                await waClient.sendMessage(job.customer_phone, customerMsg).catch(err => console.warn('Failed to send Customer WA:', err));
            }
            // B. To Technician (Report/Receipt)
            if (job.technician_phone) {
                if (file && file.path) {
                    await waClient.sendImage(job.technician_phone, file.path, techMsg).catch(err => console.warn('Failed to send Tech WA Image:', err));
                }
                else {
                    await waClient.sendMessage(job.technician_phone, techMsg).catch(err => console.warn('Failed to send Tech WA:', err));
                }
            }
            res.json({ success: true, message: 'Pekerjaan selesai dan notifikasi terkirim' });
        }
        catch (error) {
            console.error('Complete job error:', error);
            res.json({ success: false, error: 'Failed to complete job' });
        }
    }
    // View Job Detail
    static async getJobDetail(req, res) {
        var _a, _b;
        try {
            const { id } = req.params;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const userRole = (_b = req.user) === null || _b === void 0 ? void 0 : _b.role;
            const [jobs] = await pool_1.databasePool.query(`
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
                user: req.user
            });
        }
        catch (error) {
            console.error('Error viewing job detail:', error);
            res.status(500).render('error', { title: 'Error', message: 'Internal Server Error' });
        }
    }
    // Verify & Broadcast Job (Admin Operator)
    static async verifyJob(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            // Check Permissions
            if (!user || !['admin', 'superadmin', 'operator'].includes(user.role)) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }
            // Check Status First
            const [check] = await pool_1.databasePool.query("SELECT status FROM technician_jobs WHERE id = ?", [id]);
            if (check.length === 0 || check[0].status !== 'verifying') {
                return res.status(400).json({ success: false, message: 'Job not found or not in verifying status' });
            }
            // Update Status
            await pool_1.databasePool.query("UPDATE technician_jobs SET status = 'pending', priority = 'high' WHERE id = ?", [id]);
            // Fetch Job Details for Broadcast
            const [jobs] = await pool_1.databasePool.query(`SELECT j.*, c.name as customer_name, c.phone as customer_phone 
                 FROM technician_jobs j
                 LEFT JOIN customers c ON j.customer_id = c.id
                 WHERE j.id = ?`, [id]);
            const job = jobs[0];
            const waClient = WhatsAppService_1.whatsappService;
            // Get Techs
            const [techs] = await pool_1.databasePool.query("SELECT phone FROM users WHERE role = 'teknisi' AND is_active = 1");
            const msg = `
*🛠️ JOB TIKET BARU (VERIFIED)*

🎫 Tiket: *${job.ticket_number}*
📂 Tipe: *Perbaikan / Keluhan (Bot)*

👤 Nama: *${job.customer_name}*
📞 HP: ${job.customer_phone || '-'}
📍 Alamat: ${job.address}
📝 Info: ${job.description}

Untuk mengambil:
*!ambil ${job.ticket_number}*
`.trim();
            for (const tech of techs) {
                if (tech.phone)
                    await waClient.sendMessage(tech.phone, msg).catch(() => { });
            }
            res.json({ success: true, message: 'Job verified and broadcasted.' });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Server Error' });
        }
    }
    // Delete Job (Admin/Operator only)
    static async deleteJob(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            // Check Permissions
            const isTeknisi = user.role === 'teknisi';
            if (!user || !['admin', 'superadmin', 'operator', 'teknisi'].includes(user.role)) {
                return res.status(403).json({ success: false, message: 'Unauthorized.' });
            }
            // Check if job exists
            const [check] = await pool_1.databasePool.query("SELECT id, status FROM technician_jobs WHERE id = ?", [id]);
            if (check.length === 0) {
                return res.status(404).json({ success: false, message: 'Job not found' });
            }
            const job = check[0];
            // If teknisi, only allow deleting PENDING jobs (e.g. created by mistake)
            if (isTeknisi && job.status !== 'pending') {
                return res.status(403).json({ success: false, message: 'Teknisi hanya dapat menghapus pekerjaan yang berstatus Pending.' });
            }
            // Delete Job
            await pool_1.databasePool.query("DELETE FROM technician_jobs WHERE id = ?", [id]);
            res.json({ success: true, message: 'Pekerjaan berhasil dihapus' });
        }
        catch (error) {
            console.error('Error deleting job:', error);
            res.status(500).json({ success: false, message: 'Gagal menghapus pekerjaan' });
        }
    }
}
exports.TechnicianController = TechnicianController;
