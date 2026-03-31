"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallationApprovalController = void 0;
const pool_1 = require("../../db/pool");
class InstallationApprovalController {
    /**
     * Show pending installations waiting for approval
     */
    static async list(req, res) {
        try {
            const conn = await pool_1.databasePool.getConnection();
            try {
                // Get completed installations pending approval
                const [installations] = await conn.query(`
                    SELECT 
                        tj.id as job_id,
                        tj.ticket_number,
                        tj.title,
                        tj.status as job_status,
                        tj.completed_at,
                        tj.completion_proof,
                        tj.completion_notes,
                        tj.total_fee,
                        tj.coordinates,
                        tj.address,
                        pr.id as pending_reg_id,
                        pr.name as customer_name,
                        pr.phone as customer_phone,
                        pr.status as reg_status,
                        jt.name as job_type_name,
                        u.full_name as technician_name,
                        u.id as technician_id
                    FROM technician_jobs tj
                    LEFT JOIN pending_registrations pr ON tj.pending_registration_id = pr.id
                    LEFT JOIN job_types jt ON tj.job_type_id = jt.id
                    LEFT JOIN users u ON tj.technician_id = u.id
                    WHERE tj.status = 'completed' 
                    AND (tj.qc_status IS NULL OR tj.qc_status = 'pending')
                    AND tj.pending_registration_id IS NOT NULL
                    ORDER BY tj.completed_at DESC
                `);
                // Get all technicians for assignment
                const [technicians] = await conn.query("SELECT id, full_name, phone FROM users WHERE role = 'teknisi' AND is_active = 1");
                // Get PPPoE packages for assignment
                const [packages] = await conn.query("SELECT id, name, price FROM pppoe_packages ORDER BY price ASC");
                // Stats
                const [stats] = await conn.query(`
                    SELECT 
                        COUNT(*) as pending_approval,
                        SUM(CASE WHEN qc_status = 'verified' THEN 1 ELSE 0 END) as approved_today
                    FROM technician_jobs 
                    WHERE status = 'completed' 
                    AND pending_registration_id IS NOT NULL
                    AND DATE(completed_at) = CURDATE()
                `);
                res.render('technician/installation-approval', {
                    title: 'Approval Pemasangan',
                    installations,
                    technicians,
                    packages,
                    stats: stats[0] || {},
                    layout: 'layouts/main'
                });
            }
            finally {
                conn.release();
            }
        }
        catch (error) {
            console.error('Error loading installation approvals:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: 'Gagal memuat data approval',
                error: error.message
            });
        }
    }
    /**
     * Get detail of a single installation
     */
    static async getDetail(req, res) {
        try {
            const { jobId } = req.params;
            const [jobs] = await pool_1.databasePool.query(`
                SELECT 
                    tj.*,
                    pr.name as customer_name,
                    pr.phone as customer_phone,
                    pr.address as customer_address,
                    pr.coordinates as customer_coordinates,
                    jt.name as job_type_name,
                    jt.base_fee,
                    u.full_name as technician_name
                FROM technician_jobs tj
                LEFT JOIN pending_registrations pr ON tj.pending_registration_id = pr.id
                LEFT JOIN job_types jt ON tj.job_type_id = jt.id
                LEFT JOIN users u ON tj.technician_id = u.id
                WHERE tj.id = ?
            `, [jobId]);
            if (jobs.length === 0) {
                res.status(404).json({ success: false, error: 'Job not found' });
                return;
            }
            // Get existing assignments
            const [assignments] = await pool_1.databasePool.query(`
                SELECT tja.*, u.full_name as technician_name
                FROM technician_job_assignments tja
                JOIN users u ON tja.technician_id = u.id
                WHERE tja.job_id = ?
            `, [jobId]);
            res.json({
                success: true,
                job: jobs[0],
                assignments
            });
        }
        catch (error) {
            console.error('Error getting installation detail:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    /**
     * Approve installation and create customer + PPPoE account
     */
    static async approve(req, res) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            await conn.beginTransaction();
            const { jobId, packageId, activationFee, technicianAssignments, // Array of { technician_id, fee_amount, role }
            notes } = req.body;
            const userId = req.session.user?.id;
            // 1. Get job and pending registration
            const [jobs] = await conn.query("SELECT * FROM technician_jobs WHERE id = ?", [jobId]);
            if (jobs.length === 0)
                throw new Error('Job tidak ditemukan');
            const job = jobs[0];
            if (!job.pending_registration_id)
                throw new Error('Job ini bukan pemasangan baru');
            const [regs] = await conn.query("SELECT * FROM pending_registrations WHERE id = ?", [job.pending_registration_id]);
            if (regs.length === 0)
                throw new Error('Data registrasi tidak ditemukan');
            const regData = regs[0];
            // 2. Save Technician Assignments with Fee Distribution
            if (technicianAssignments && Array.isArray(technicianAssignments)) {
                for (const assignment of technicianAssignments) {
                    await conn.query(`INSERT INTO technician_fee_distributions (technician_job_id, technician_id, role, amount)
                         VALUES (?, ?, ?, ?)`, [jobId, assignment.technician_id, assignment.role || 'member', assignment.fee_amount || 0]);
                }
            }
            // 3. Create Activation Payment Request (with Unique Code)
            const uniqueCode = Math.floor(Math.random() * 900) + 100; // 100-999
            const baseAmount = parseFloat(activationFee || '0');
            const totalAmount = baseAmount + uniqueCode;
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 48); // Valid for 48 hours for installation
            await conn.query(`INSERT INTO payment_requests 
                 (customer_id, pending_registration_id, package_id, base_amount, unique_code, total_amount, status, type, expires_at)
                 VALUES (NULL, ?, ?, ?, ?, ?, 'pending', 'activation', ?)`, [job.pending_registration_id, packageId, baseAmount, uniqueCode, totalAmount, expiresAt]);
            // 4. Update Job & Registration Status
            await conn.query(`UPDATE technician_jobs SET qc_status = 'verified', qc_notes = ?, qc_by = ? WHERE id = ?`, [notes, userId, jobId]);
            await conn.query(`UPDATE pending_registrations SET status = 'waiting_payment', package_id = ? WHERE id = ?`, [packageId, job.pending_registration_id]);
            await conn.commit();
            // 5. Send Notification to Customer via WhatsApp
            try {
                const { whatsappService } = await Promise.resolve().then(() => __importStar(require('../../services/whatsapp')));
                const [pkgRows] = await pool_1.databasePool.query("SELECT name FROM pppoe_packages WHERE id = ?", [packageId]);
                const packageName = pkgRows[0]?.name || 'Internet';
                const message = `
🎉 *PEMASANGAN SELESAI & DISETUJUI*

Halo *${regData.name}*, pemasangan perangkat di lokasi Anda telah selesai dilakukan oleh tim teknisi kami.

Satu langkah lagi untuk mengaktifkan layanan internet Anda. Silakan lakukan pembayaran *Biaya Aktivasi*:

📋 *DETAIL TAGIHAN:*
🔹 Paket: ${packageName}
🔹 Biaya Aktivasi: Rp ${baseAmount.toLocaleString('id-ID')}
🔹 Kode Unik: *${uniqueCode}*
💰 *TOTAL TRANSFER: Rp ${totalAmount.toLocaleString('id-ID')}*

⚠️ *PENTING:* Mohon transfer **TEPAT** hingga digit terakhir agar sistem dapat melakukan aktivasi otomatis.

🏦 *TRANSFER KE:*
BCA: 123456789 (A/N ISP BILLING)

Setelah transfer, kirimkan foto bukti pembayaran di sini. Internet akan otomatis aktif segera setelah pembayaran diverifikasi.
`.trim();
                const waClient = whatsappService;
                await waClient.sendMessage(regData.phone, message);
            }
            catch (err) {
                console.error('Failed to send activation notification:', err);
            }
            res.json({
                success: true,
                message: 'Pemasangan disetujui. Menunggu pembayaran aktivasi dari pelanggan.'
            });
        }
        catch (error) {
            await conn.rollback();
            console.error('Error approving installation:', error);
            res.status(500).json({ success: false, error: error.message });
        }
        finally {
            conn.release();
        }
    }
    /**
     * Reject installation
     */
    static async reject(req, res) {
        try {
            const { jobId, reason } = req.body;
            const userId = req.session.user?.id;
            await pool_1.databasePool.query(`UPDATE technician_jobs SET qc_status = 'rejected', qc_notes = ?, qc_by = ? WHERE id = ?`, [reason, userId, jobId]);
            // Get job to update pending registration
            const [jobs] = await pool_1.databasePool.query("SELECT pending_registration_id FROM technician_jobs WHERE id = ?", [jobId]);
            if (jobs.length > 0 && jobs[0].pending_registration_id) {
                await pool_1.databasePool.query(`UPDATE pending_registrations SET status = 'rejected' WHERE id = ?`, [jobs[0].pending_registration_id]);
            }
            res.json({ success: true, message: 'Pemasangan ditolak' });
        }
        catch (error) {
            console.error('Error rejecting installation:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
exports.InstallationApprovalController = InstallationApprovalController;
//# sourceMappingURL=InstallationApprovalController.js.map