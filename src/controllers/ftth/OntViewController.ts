import { Request, Response } from 'express';
import { OntService } from '../../services/ftth/ontService';
import { databasePool } from '../../db/pool';

export class OntViewController {
    static async index(req: Request, res: Response) {
        try {
            const onts = await OntService.listOnts();
            res.render('ftth/ont/index', {
                title: 'Data Master ONT',
                user: req.user,
                onts: onts,
                path: '/ftth/ont'
            });
        } catch (error) {
            console.error('Error fetching ONTs:', error);
            req.flash('error', 'Gagal memuat data ONT');
            res.redirect('/dashboard');
        }
    }

    static async create(req: Request, res: Response) {
        try {
            // Fetch dependencies for dropdowns
            const [olts] = await databasePool.query('SELECT * FROM ftth_olt ORDER BY name ASC');
            const [odcs] = await databasePool.query('SELECT * FROM ftth_odc ORDER BY name ASC');
            const [odps] = await databasePool.query('SELECT * FROM ftth_odp ORDER BY name ASC');
            const [customers] = await databasePool.query('SELECT id, name, customer_code FROM customers ORDER BY name ASC');

            res.render('ftth/ont/add', {
                title: 'Tambah ONT Baru',
                user: req.user,
                path: '/ftth/ont',
                olts, odcs, odps, customers
            });
        } catch (error) {
            console.error('Error loading create ONT form:', error);
            req.flash('error', 'Gagal memuat form');
            res.redirect('/ftth/ont');
        }
    }

    static async store(req: Request, res: Response) {
        try {
            const {
                serial_number, mac_address, model, location,
                customer_id, olt_id, olt_port, odc_id, odp_id,
                notes, status
            } = req.body;

            await OntService.createOnt({
                serial_number,
                mac_address,
                model,
                location,
                customer_id: customer_id ? Number(customer_id) : undefined,
                olt_id: olt_id ? Number(olt_id) : undefined,
                olt_port,
                odc_id: odc_id ? Number(odc_id) : undefined,
                odp_id: odp_id ? Number(odp_id) : undefined,
                notes,
                status: status || 'offline'
            });

            req.flash('success', 'ONT berhasil ditambahkan');
            res.redirect('/ftth/ont');
        } catch (error) {
            console.error('Error creating ONT:', error);
            req.flash('error', 'Gagal menambahkan ONT');
            res.redirect('/ftth/ont/add');
        }
    }

    static async edit(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const ont = await OntService.getOntById(id);

            if (!ont) {
                req.flash('error', 'ONT tidak ditemukan');
                return res.redirect('/ftth/ont');
            }

            const [olts] = await databasePool.query('SELECT * FROM ftth_olt ORDER BY name ASC');
            const [odcs] = await databasePool.query('SELECT * FROM ftth_odc ORDER BY name ASC');
            const [odps] = await databasePool.query('SELECT * FROM ftth_odp ORDER BY name ASC');
            const [customers] = await databasePool.query('SELECT id, name, customer_code FROM customers ORDER BY name ASC');

            // Parse metadata if needed (already handled in View mostly, but good to ensure)
            if (ont.metadata && typeof ont.metadata === 'string') {
                try { ont.metadata = JSON.parse(ont.metadata); } catch { }
            }

            res.render('ftth/ont/edit', {
                title: 'Edit ONT',
                user: req.user,
                path: '/ftth/ont',
                ont,
                olts, odcs, odps, customers
            });
        } catch (error) {
            console.error('Error loading edit ONT form:', error);
            req.flash('error', 'Gagal memuat form edit');
            res.redirect('/ftth/ont');
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const {
                serial_number, mac_address, model, location,
                customer_id, olt_id, olt_port, odc_id, odp_id,
                notes, status
            } = req.body;

            await OntService.updateOnt(id, {
                serial_number,
                mac_address,
                model,
                location,
                customer_id: customer_id ? Number(customer_id) : undefined,
                olt_id: olt_id ? Number(olt_id) : undefined,
                olt_port,
                odc_id: odc_id ? Number(odc_id) : undefined,
                odp_id: odp_id ? Number(odp_id) : undefined,
                notes,
                status
            });

            req.flash('success', 'ONT berhasil diperbarui');
            res.redirect('/ftth/ont');
        } catch (error) {
            console.error('Error updating ONT:', error);
            req.flash('error', 'Gagal memperbarui ONT');
            res.redirect(`/ftth/ont/${req.params.id}/edit`);
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            await OntService.deleteOnt(id);
            req.flash('success', 'ONT berhasil dihapus');
            res.redirect('/ftth/ont');
        } catch (error) {
            console.error('Error deleting ONT:', error);
            req.flash('error', 'Gagal menghapus ONT');
            res.redirect('/ftth/ont');
        }
    }
}
