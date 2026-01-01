import { Request, Response } from 'express';
import { databasePool } from '../../config/database';

export class AreaController {
    static async index(req: Request, res: Response) {
        try {
            const [areas] = await databasePool.query('SELECT * FROM ftth_areas ORDER BY name ASC');
            res.render('ftth/areas/index', {
                title: 'Data Master Area',
                user: req.user,
                areas: areas,
                path: '/ftth/areas'
            });
        } catch (error) {
            console.error('Error fetching areas:', error);
            req.flash('error', 'Gagal memuat data area');
            res.redirect('/dashboard');
        }
    }

    static async create(req: Request, res: Response) {
        res.render('ftth/areas/add', {
            title: 'Tambah Area Baru',
            user: req.user,
            path: '/ftth/areas'
        });
    }

    static async store(req: Request, res: Response) {
        try {
            const { code, name, description } = req.body;
            await databasePool.query(
                'INSERT INTO ftth_areas (code, name, description) VALUES (?, ?, ?)',
                [code, name, description]
            );
            req.flash('success', 'Area berhasil ditambahkan');
            res.redirect('/ftth/areas');
        } catch (error) {
            console.error('Error creating area:', error);
            req.flash('error', 'Gagal menambahkan area');
            res.redirect('/ftth/areas/add');
        }
    }

    static async edit(req: Request, res: Response) {
        try {
            const [rows] = await databasePool.query('SELECT * FROM ftth_areas WHERE id = ?', [req.params.id]);
            if (!Array.isArray(rows) || rows.length === 0) {
                req.flash('error', 'Area tidak ditemukan');
                return res.redirect('/ftth/areas');
            }
            res.render('ftth/areas/edit', {
                title: 'Edit Area',
                user: req.user,
                area: rows[0],
                path: '/ftth/areas'
            });
        } catch (error) {
            console.error('Error fetching area:', error);
            req.flash('error', 'Gagal memuat data area');
            res.redirect('/ftth/areas');
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const { code, name, description } = req.body;
            await databasePool.query(
                'UPDATE ftth_areas SET code = ?, name = ?, description = ? WHERE id = ?',
                [code, name, description, req.params.id]
            );
            req.flash('success', 'Area berhasil diperbarui');
            res.redirect('/ftth/areas');
        } catch (error) {
            console.error('Error updating area:', error);
            req.flash('error', 'Gagal memperbarui area');
            res.redirect('/ftth/areas');
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            await databasePool.query('DELETE FROM ftth_areas WHERE id = ?', [req.params.id]);
            req.flash('success', 'Area berhasil dihapus');
            res.redirect('/ftth/areas');
        } catch (error) {
            console.error('Error deleting area:', error);
            req.flash('error', 'Gagal menghapus area (mungkin sedanga digunakan oleh ODC)');
            res.redirect('/ftth/areas');
        }
    }
}
