"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AreaController = void 0;
const pool_1 = require("../../db/pool");
class AreaController {
    static async index(req, res) {
        try {
            const [areas] = await pool_1.databasePool.query('SELECT * FROM ftth_areas ORDER BY name ASC');
            res.render('ftth/areas/index', {
                title: 'Data Master Area',
                user: req.user,
                areas: areas,
                path: '/ftth/areas'
            });
        }
        catch (error) {
            console.error('Error fetching areas:', error);
            req.flash('error', 'Gagal memuat data area');
            res.redirect('/dashboard');
        }
    }
    static async create(req, res) {
        res.render('ftth/areas/add', {
            title: 'Tambah Area Baru',
            user: req.user,
            path: '/ftth/areas'
        });
    }
    static async store(req, res) {
        try {
            const { code, name, description } = req.body;
            await pool_1.databasePool.query('INSERT INTO ftth_areas (code, name, description) VALUES (?, ?, ?)', [code, name, description]);
            req.flash('success', 'Area berhasil ditambahkan');
            res.redirect('/ftth/areas');
        }
        catch (error) {
            console.error('Error creating area:', error);
            req.flash('error', 'Gagal menambahkan area');
            res.redirect('/ftth/areas/add');
        }
    }
    static async edit(req, res) {
        try {
            const [rows] = await pool_1.databasePool.query('SELECT * FROM ftth_areas WHERE id = ?', [req.params.id]);
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
        }
        catch (error) {
            console.error('Error fetching area:', error);
            req.flash('error', 'Gagal memuat data area');
            res.redirect('/ftth/areas');
        }
    }
    static async update(req, res) {
        try {
            const { code, name, description } = req.body;
            await pool_1.databasePool.query('UPDATE ftth_areas SET code = ?, name = ?, description = ? WHERE id = ?', [code, name, description, req.params.id]);
            req.flash('success', 'Area berhasil diperbarui');
            res.redirect('/ftth/areas');
        }
        catch (error) {
            console.error('Error updating area:', error);
            req.flash('error', 'Gagal memperbarui area');
            res.redirect('/ftth/areas');
        }
    }
    static async delete(req, res) {
        try {
            await pool_1.databasePool.query('DELETE FROM ftth_areas WHERE id = ?', [req.params.id]);
            req.flash('success', 'Area berhasil dihapus');
            res.redirect('/ftth/areas');
        }
        catch (error) {
            console.error('Error deleting area:', error);
            req.flash('error', 'Gagal menghapus area (mungkin sedanga digunakan oleh ODC)');
            res.redirect('/ftth/areas');
        }
    }
}
exports.AreaController = AreaController;
//# sourceMappingURL=AreaController.js.map