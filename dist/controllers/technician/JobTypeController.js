"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobTypeController = void 0;
const pool_1 = require("../../db/pool");
class JobTypeController {
    // View Settings Page
    static async index(req, res) {
        try {
            const [types] = await pool_1.databasePool.query("SELECT * FROM job_types ORDER BY name ASC");
            res.render('settings/job_types', {
                title: 'Pengaturan Jenis Pekerjaan',
                currentPath: '/settings/job-types',
                types,
                user: req.user
            });
        }
        catch (error) {
            console.error('Error fetching job types:', error);
            res.status(500).render('error', { message: 'Internal Server Error' });
        }
    }
    // API: Create
    static async create(req, res) {
        try {
            const { name, code, base_fee, description } = req.body;
            await pool_1.databasePool.query("INSERT INTO job_types (name, code, base_fee, description, is_active) VALUES (?, ?, ?, ?, 1)", [name, code, base_fee, description]);
            res.json({ success: true });
        }
        catch (error) {
            res.json({ success: false, error: error.message });
        }
    }
    // API: Update
    static async update(req, res) {
        try {
            const { id } = req.params;
            const { name, code, base_fee, description, is_active } = req.body;
            await pool_1.databasePool.query("UPDATE job_types SET name=?, code=?, base_fee=?, description=?, is_active=? WHERE id=?", [name, code, base_fee, description, is_active, id]);
            res.json({ success: true });
        }
        catch (error) {
            res.json({ success: false, error: error.message });
        }
    }
    // API: Delete
    static async delete(req, res) {
        try {
            const { id } = req.params;
            // Check usage first
            const [usage] = await pool_1.databasePool.query("SELECT COUNT(*) as info FROM technician_jobs WHERE job_type_id = ?", [id]);
            if (usage[0].info > 0) {
                return res.json({ success: false, error: 'Tidak bisa dihapus karena sedang digunakan oleh pekerjaan aktif/riwayat.' });
            }
            await pool_1.databasePool.query("DELETE FROM job_types WHERE id = ?", [id]);
            res.json({ success: true });
        }
        catch (error) {
            res.json({ success: false, error: error.message });
        }
    }
}
exports.JobTypeController = JobTypeController;
//# sourceMappingURL=JobTypeController.js.map