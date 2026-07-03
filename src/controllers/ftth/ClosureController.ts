import { Request, Response, NextFunction } from 'express';
import { databasePool } from '../../db/pool';

export async function getClosureList(req: Request, res: Response, next: NextFunction) {
	try {
		const [items] = await databasePool.query('SELECT * FROM ftth_closures ORDER BY created_at DESC');
		res.render('ftth/closures/index', { title: 'FTTH - Titik Sambung (Closure)', items, layout: 'layouts/main' });
	} catch (err) { next(err); }
}

export async function getClosureAdd(req: Request, res: Response, next: NextFunction) {
	try {
		const [poles] = await databasePool.query('SELECT id, name, code FROM ftth_poles ORDER BY name ASC');
		res.render('ftth/closures/form', { title: 'Tambah Closure', item: null, poles, layout: 'layouts/main' });
	} catch (err) { next(err); }
}

export async function getClosureEdit(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const [rows] = await databasePool.query('SELECT * FROM ftth_closures WHERE id = ?', [id]);
		const items = rows as any[];
		if (items.length === 0) {
			res.status(404).send('Closure tidak ditemukan');
			return;
		}
		const [poles] = await databasePool.query('SELECT id, name, code FROM ftth_poles ORDER BY name ASC');
		res.render('ftth/closures/form', { title: 'Edit Closure', item: items[0], poles, layout: 'layouts/main' });
	} catch (err) { next(err); }
}

export async function postClosureCreate(req: Request, res: Response, next: NextFunction) {
	try {
		const { code, name, latitude, longitude, description, pole_id } = req.body;
		if (!code || !name) throw new Error('Kode dan Nama wajib diisi');
		
		await databasePool.query(
			'INSERT INTO ftth_closures (code, name, latitude, longitude, description, pole_id) VALUES (?, ?, ?, ?, ?, ?)',
			[code, name, latitude ? Number(latitude) : null, longitude ? Number(longitude) : null, description || null, pole_id ? Number(pole_id) : null]
		);
		res.redirect('/ftth/closures');
	} catch (err) { next(err); }
}

export async function postClosureUpdate(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const { code, name, latitude, longitude, description, pole_id } = req.body;
		if (!code || !name) throw new Error('Kode dan Nama wajib diisi');

		await databasePool.query(
			'UPDATE ftth_closures SET code = ?, name = ?, latitude = ?, longitude = ?, description = ?, pole_id = ? WHERE id = ?',
			[code, name, latitude ? Number(latitude) : null, longitude ? Number(longitude) : null, description || null, pole_id ? Number(pole_id) : null, id]
		);
		res.redirect('/ftth/closures');
	} catch (err) { next(err); }
}

export async function postClosureDelete(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		// Check if used in cables
		const [sourceCables] = await databasePool.query('SELECT id FROM ftth_cables WHERE source_type = "CLOSURE" AND source_id = ?', [id]);
		const [destCables] = await databasePool.query('SELECT id FROM ftth_cables WHERE destination_type = "CLOSURE" AND destination_id = ?', [id]);
		
		if ((sourceCables as any[]).length > 0 || (destCables as any[]).length > 0) {
			// Don't delete if used
			res.status(400).send('Closure sedang digunakan dalam Tarikan Kabel. Hapus kabel tersebut terlebih dahulu.');
			return;
		}

		await databasePool.query('DELETE FROM ftth_closures WHERE id = ?', [id]);
		res.redirect('/ftth/closures');
	} catch (err) { next(err); }
}
