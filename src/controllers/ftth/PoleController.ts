import { Request, Response, NextFunction } from 'express';
import { databasePool } from '../../db/pool';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

// Helper to generate TNG-YYMMDD-XXX
async function generatePoleCode(): Promise<string> {
	const today = new Date();
	const yy = String(today.getFullYear()).slice(2);
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	const prefix = `TNG-${yy}${mm}${dd}-`;

	const [rows] = await databasePool.query(
		'SELECT code FROM ftth_poles WHERE code LIKE ? ORDER BY code DESC LIMIT 1',
		[`${prefix}%`]
	);
	const items = rows as any[];
	let nextNum = 1;
	if (items.length > 0) {
		const lastCode = items[0].code;
		const parts = lastCode.split('-');
		if (parts.length === 3) {
			const lastNum = parseInt(parts[2], 10);
			if (!isNaN(lastNum)) nextNum = lastNum + 1;
		}
	}
	return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

export async function getPoleList(req: Request, res: Response, next: NextFunction) {
	try {
		const [items] = await databasePool.query(`
			SELECT p.*, 
				(SELECT COUNT(*) FROM ftth_pole_devices WHERE pole_id = p.id) as device_count,
				(SELECT COUNT(*) FROM customers WHERE pole_id = p.id) as customer_count
			FROM ftth_poles p 
			ORDER BY p.created_at DESC
		`);
		res.render('ftth/poles/index', { title: 'FTTH - Manajemen Tiang', items, layout: 'layouts/main' });
	} catch (err) { next(err); }
}

export async function getPoleAdd(req: Request, res: Response, next: NextFunction) {
	try {
		const code = await generatePoleCode();
		res.render('ftth/poles/form', { 
			title: 'Tambah Tiang', 
			item: { code }, 
			devices: [],
			layout: 'layouts/main' 
		});
	} catch (err) { next(err); }
}

export async function getPoleEdit(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const [rows] = await databasePool.query('SELECT * FROM ftth_poles WHERE id = ?', [id]);
		const items = rows as any[];
		if (items.length === 0) {
			res.status(404).send('Tiang tidak ditemukan');
			return;
		}

		const [devices] = await databasePool.query('SELECT * FROM ftth_pole_devices WHERE pole_id = ? ORDER BY id ASC', [id]);

		res.render('ftth/poles/form', { 
			title: 'Edit Tiang', 
			item: items[0], 
			devices,
			layout: 'layouts/main' 
		});
	} catch (err) { next(err); }
}

export async function postPoleCreate(req: Request, res: Response, next: NextFunction) {
	const connection = await databasePool.getConnection();
	try {
		await connection.beginTransaction();

		const { code, name, latitude, longitude, pole_type, height_meters, status, description } = req.body;
		if (!code || !name) throw new Error('Kode dan Nama wajib diisi');

		const [result] = await connection.query<ResultSetHeader>(
			'INSERT INTO ftth_poles (code, name, latitude, longitude, pole_type, height_meters, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			[code, name, latitude ? Number(latitude) : null, longitude ? Number(longitude) : null, pole_type || 'besi', height_meters ? Number(height_meters) : 7.00, status || 'active', description || null]
		);

		const poleId = result.insertId;

		// Process devices if any
		const devNames = req.body.device_name;
		if (devNames) {
			const namesArray = Array.isArray(devNames) ? devNames : [devNames];
			for (let i = 0; i < namesArray.length; i++) {
				const name = namesArray[i];
				if (!name) continue;

				const dCode = (Array.isArray(req.body.device_code) ? req.body.device_code[i] : req.body.device_code) || `DEV-HTB-${Date.now()}-${i}`;
				const dType = (Array.isArray(req.body.device_type) ? req.body.device_type[i] : req.body.device_type) || 'converter';
				const dBrand = (Array.isArray(req.body.device_brand) ? req.body.device_brand[i] : req.body.device_brand) || null;
				const dPorts = Number(Array.isArray(req.body.device_ports) ? req.body.device_ports[i] : req.body.device_ports) || 4;
				const dStatus = (Array.isArray(req.body.device_status) ? req.body.device_status[i] : req.body.device_status) || 'active';
				const dNotes = (Array.isArray(req.body.device_notes) ? req.body.device_notes[i] : req.body.device_notes) || null;

				await connection.query(
					'INSERT INTO ftth_pole_devices (pole_id, code, name, device_type, brand, total_ports, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
					[poleId, dCode, name, dType, dBrand, dPorts, dStatus, dNotes]
				);
			}
		}

		await connection.commit();
		res.redirect('/ftth/poles');
	} catch (err) {
		await connection.rollback();
		next(err);
	} finally {
		connection.release();
	}
}

export async function postPoleUpdate(req: Request, res: Response, next: NextFunction) {
	const connection = await databasePool.getConnection();
	try {
		await connection.beginTransaction();

		const id = Number(req.params.id);
		const { code, name, latitude, longitude, pole_type, height_meters, status, description } = req.body;
		if (!code || !name) throw new Error('Kode dan Nama wajib diisi');

		await connection.query(
			'UPDATE ftth_poles SET code = ?, name = ?, latitude = ?, longitude = ?, pole_type = ?, height_meters = ?, status = ?, description = ? WHERE id = ?',
			[code, name, latitude ? Number(latitude) : null, longitude ? Number(longitude) : null, pole_type || 'besi', height_meters ? Number(height_meters) : 7.00, status || 'active', description || null, id]
		);

		// Handle Devices update dynamically
		const devIds = req.body.device_id;
		const submittedIds: number[] = [];

		if (devIds) {
			const idsArray = Array.isArray(devIds) ? devIds.map(Number) : [Number(devIds)];
			idsArray.forEach(dId => { if (!isNaN(dId) && dId > 0) submittedIds.push(dId); });
		}

		if (submittedIds.length > 0) {
			await connection.query('DELETE FROM ftth_pole_devices WHERE pole_id = ? AND id NOT IN (?)', [id, submittedIds]);
		} else {
			await connection.query('DELETE FROM ftth_pole_devices WHERE pole_id = ?', [id]);
		}

		const devNames = req.body.device_name;
		if (devNames) {
			const namesArray = Array.isArray(devNames) ? devNames : [devNames];
			for (let i = 0; i < namesArray.length; i++) {
				const name = namesArray[i];
				if (!name) continue;

				const dId = Number(Array.isArray(req.body.device_id) ? req.body.device_id[i] : req.body.device_id);
				const dCode = (Array.isArray(req.body.device_code) ? req.body.device_code[i] : req.body.device_code) || `DEV-HTB-${Date.now()}-${i}`;
				const dType = (Array.isArray(req.body.device_type) ? req.body.device_type[i] : req.body.device_type) || 'converter';
				const dBrand = (Array.isArray(req.body.device_brand) ? req.body.device_brand[i] : req.body.device_brand) || null;
				const dPorts = Number(Array.isArray(req.body.device_ports) ? req.body.device_ports[i] : req.body.device_ports) || 4;
				const dStatus = (Array.isArray(req.body.device_status) ? req.body.device_status[i] : req.body.device_status) || 'active';
				const dNotes = (Array.isArray(req.body.device_notes) ? req.body.device_notes[i] : req.body.device_notes) || null;

				if (dId && dId > 0) {
					await connection.query(
						'UPDATE ftth_pole_devices SET code = ?, name = ?, device_type = ?, brand = ?, total_ports = ?, status = ?, notes = ? WHERE id = ? AND pole_id = ?',
						[dCode, name, dType, dBrand, dPorts, dStatus, dNotes, dId, id]
					);
				} else {
					await connection.query(
						'INSERT INTO ftth_pole_devices (pole_id, code, name, device_type, brand, total_ports, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
						[id, dCode, name, dType, dBrand, dPorts, dStatus, dNotes]
					);
				}
			}
		}

		await connection.commit();
		res.redirect('/ftth/poles');
	} catch (err) {
		await connection.rollback();
		next(err);
	} finally {
		connection.release();
	}
}

export async function postPoleDelete(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		
		// Check if connected in cables
		const [sourceCables] = await databasePool.query('SELECT id FROM ftth_cables WHERE source_type = "POLE" AND source_id = ?', [id]);
		const [destCables] = await databasePool.query('SELECT id FROM ftth_cables WHERE destination_type = "POLE" AND destination_id = ?', [id]);
		
		if ((sourceCables as any[]).length > 0 || (destCables as any[]).length > 0) {
			res.status(400).send('Tiang sedang digunakan dalam Tarikan Kabel. Hapus kabel tersebut terlebih dahulu.');
			return;
		}

		await databasePool.query('DELETE FROM ftth_poles WHERE id = ?', [id]);
		res.redirect('/ftth/poles');
	} catch (err) { next(err); }
}
