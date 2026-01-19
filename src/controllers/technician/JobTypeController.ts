import { Request, Response } from 'express';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export class JobTypeController {

    // View Settings Page
    static async index(req: Request, res: Response) {
        try {
            const [types] = await databasePool.query<RowDataPacket[]>("SELECT * FROM job_types ORDER BY name ASC");

            res.render('settings/job_types', {
                title: 'Pengaturan Jenis Pekerjaan',
                currentPath: '/settings/job-types',
                types,
                user: (req as any).user
            });
        } catch (error) {
            console.error('Error fetching job types:', error);
            res.status(500).render('error', { message: 'Internal Server Error' });
        }
    }

    // API: Create
    static async create(req: Request, res: Response) {
        try {
            const { name, code, base_fee, description } = req.body;
            await databasePool.query(
                "INSERT INTO job_types (name, code, base_fee, description, is_active) VALUES (?, ?, ?, ?, 1)",
                [name, code, base_fee, description]
            );
            res.json({ success: true });
        } catch (error: any) {
            res.json({ success: false, error: error.message });
        }
    }

    // API: Update
    static async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { name, code, base_fee, description, is_active } = req.body;
            await databasePool.query(
                "UPDATE job_types SET name=?, code=?, base_fee=?, description=?, is_active=? WHERE id=?",
                [name, code, base_fee, description, is_active, id]
            );
            res.json({ success: true });
        } catch (error: any) {
            res.json({ success: false, error: error.message });
        }
    }

    // API: Delete
    static async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            // Check usage first
            const [usage]: any = await databasePool.query("SELECT COUNT(*) as info FROM technician_jobs WHERE job_type_id = ?", [id]);
            if (usage[0].info > 0) {
                return res.json({ success: false, error: 'Tidak bisa dihapus karena sedang digunakan oleh pekerjaan aktif/riwayat.' });
            }

            await databasePool.query("DELETE FROM job_types WHERE id = ?", [id]);
            res.json({ success: true });
        } catch (error: any) {
            res.json({ success: false, error: error.message });
        }
    }
}
