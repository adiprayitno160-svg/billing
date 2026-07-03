import { Request, Response, NextFunction } from 'express';
import { databasePool } from '../../db/pool';

// Helper to generate CBL-YYMMDD-XXX
async function generateCableCode(): Promise<string> {
	const today = new Date();
	const yy = String(today.getFullYear()).slice(2);
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	const prefix = `CBL-${yy}${mm}${dd}-`;

	const [rows] = await databasePool.query(
		'SELECT code FROM ftth_cables WHERE code LIKE ? ORDER BY code DESC LIMIT 1',
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

export async function getCableList(req: Request, res: Response, next: NextFunction) {
	try {
		const [items] = await databasePool.query(`
			SELECT c.*, 
				CASE 
					WHEN c.source_type = 'OLT' THEN (SELECT name FROM ftth_olt WHERE id = c.source_id)
					WHEN c.source_type = 'ODC' THEN (SELECT name FROM ftth_odc WHERE id = c.source_id)
					WHEN c.source_type = 'CLOSURE' THEN (SELECT name FROM ftth_closures WHERE id = c.source_id)
					WHEN c.source_type = 'POLE' THEN (SELECT name FROM ftth_poles WHERE id = c.source_id)
					WHEN c.source_type = 'ODP' THEN (SELECT name FROM ftth_odp WHERE id = c.source_id)
				END as source_name,
				CASE 
					WHEN c.destination_type = 'OLT' THEN (SELECT name FROM ftth_olt WHERE id = c.destination_id)
					WHEN c.destination_type = 'ODC' THEN (SELECT name FROM ftth_odc WHERE id = c.destination_id)
					WHEN c.destination_type = 'CLOSURE' THEN (SELECT name FROM ftth_closures WHERE id = c.destination_id)
					WHEN c.destination_type = 'POLE' THEN (SELECT name FROM ftth_poles WHERE id = c.destination_id)
					WHEN c.destination_type = 'ODP' THEN (SELECT name FROM ftth_odp WHERE id = c.destination_id)
				END as destination_name
			FROM ftth_cables c
			ORDER BY c.created_at DESC
		`);
		res.render('ftth/cables/index', { title: 'FTTH - Tarikan Kabel', items, layout: 'layouts/main' });
	} catch (err) { next(err); }
}

export async function getCableAdd(req: Request, res: Response, next: NextFunction) {
	try {
		const code = await generateCableCode();
		
		const [olts] = await databasePool.query('SELECT id, name, latitude, longitude FROM ftth_olt ORDER BY name ASC');
		const [odcs] = await databasePool.query('SELECT id, name, latitude, longitude FROM ftth_odc ORDER BY name ASC');
		const [closures] = await databasePool.query('SELECT id, name, latitude, longitude FROM ftth_closures ORDER BY name ASC');
		const [poles] = await databasePool.query('SELECT id, name, code, latitude, longitude FROM ftth_poles ORDER BY name ASC');
		const [odps] = await databasePool.query('SELECT id, name, latitude, longitude FROM ftth_odp ORDER BY name ASC');
		
		res.render('ftth/cables/form', { 
			title: 'Tambah Tarikan Kabel', 
			item: { code }, // Pre-fill generated code
			olts, odcs, closures, poles, odps,
			layout: 'layouts/main' 
		});
	} catch (err) { next(err); }
}

export async function getCableEdit(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const [rows] = await databasePool.query('SELECT * FROM ftth_cables WHERE id = ?', [id]);
		const items = rows as any[];
		if (items.length === 0) {
			res.status(404).send('Kabel tidak ditemukan');
			return;
		}

		const [olts] = await databasePool.query('SELECT id, name, latitude, longitude FROM ftth_olt ORDER BY name ASC');
		const [odcs] = await databasePool.query('SELECT id, name, latitude, longitude FROM ftth_odc ORDER BY name ASC');
		const [closures] = await databasePool.query('SELECT id, name, latitude, longitude FROM ftth_closures ORDER BY name ASC');
		const [poles] = await databasePool.query('SELECT id, name, code, latitude, longitude FROM ftth_poles ORDER BY name ASC');
		const [odps] = await databasePool.query('SELECT id, name, latitude, longitude FROM ftth_odp ORDER BY name ASC');

		res.render('ftth/cables/form', { 
			title: 'Edit Tarikan Kabel', 
			item: items[0], 
			olts, odcs, closures, poles, odps,
			layout: 'layouts/main' 
		});
	} catch (err) { next(err); }
}

export async function postCableCreate(req: Request, res: Response, next: NextFunction) {
	try {
		const { code, name, capacity_core, real_length_meters, source, destination, color, path_nodes } = req.body;
		if (!code || !name || !source || !destination) throw new Error('Semua field wajib diisi');
		
		const [srcType, srcId] = source.split('-');
		const [dstType, dstId] = destination.split('-');

		await databasePool.query(
			'INSERT INTO ftth_cables (code, name, capacity_core, real_length_meters, source_type, source_id, destination_type, destination_id, color, path_nodes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
			[code, name, capacity_core || 12, real_length_meters ? Number(real_length_meters) : null, srcType, Number(srcId), dstType, Number(dstId), color || '#3388ff', path_nodes ? path_nodes : null]
		);
		res.redirect('/ftth/cables');
	} catch (err) { next(err); }
}

export async function postCableUpdate(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const { code, name, capacity_core, real_length_meters, source, destination, color, path_nodes } = req.body;
		if (!code || !name || !source || !destination) throw new Error('Semua field wajib diisi');

		const [srcType, srcId] = source.split('-');
		const [dstType, dstId] = destination.split('-');

		await databasePool.query(
			'UPDATE ftth_cables SET code = ?, name = ?, capacity_core = ?, real_length_meters = ?, source_type = ?, source_id = ?, destination_type = ?, destination_id = ?, color = ?, path_nodes = ? WHERE id = ?',
			[code, name, capacity_core || 12, real_length_meters ? Number(real_length_meters) : null, srcType, Number(srcId), dstType, Number(dstId), color || '#3388ff', path_nodes ? path_nodes : null, id]
		);
		res.redirect('/ftth/cables');
	} catch (err) { next(err); }
}

export async function postCableDelete(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		await databasePool.query('DELETE FROM ftth_cables WHERE id = ?', [id]);
		res.redirect('/ftth/cables');
	} catch (err) { next(err); }
}

// API for map drawing
export async function getMapCablesClosures(req: Request, res: Response, next: NextFunction) {
	try {
		const [closures] = await databasePool.query('SELECT * FROM ftth_closures');
		const [poles] = await databasePool.query('SELECT * FROM ftth_poles');
		const [cables] = await databasePool.query('SELECT * FROM ftth_cables');
		
		// For map plotting, we need coordinates for source and destination.
		const [olts] = await databasePool.query('SELECT id, latitude, longitude FROM ftth_olt');
		const [odcs] = await databasePool.query('SELECT id, latitude, longitude FROM ftth_odc');
		const [odps] = await databasePool.query('SELECT id, latitude, longitude FROM ftth_odp');

		// Create a coordinate lookup map
		const coordsMap: Record<string, {lat: number, lng: number}> = {};
		
		(olts as any[]).forEach(o => { if(o.latitude && o.longitude) coordsMap[`OLT-${o.id}`] = {lat: o.latitude, lng: o.longitude}; });
		(odcs as any[]).forEach(o => { if(o.latitude && o.longitude) coordsMap[`ODC-${o.id}`] = {lat: o.latitude, lng: o.longitude}; });
		(closures as any[]).forEach(o => { if(o.latitude && o.longitude) coordsMap[`CLOSURE-${o.id}`] = {lat: o.latitude, lng: o.longitude}; });
		(poles as any[]).forEach(o => { if(o.latitude && o.longitude) coordsMap[`POLE-${o.id}`] = {lat: o.latitude, lng: o.longitude}; });
		(odps as any[]).forEach(o => { if(o.latitude && o.longitude) coordsMap[`ODP-${o.id}`] = {lat: o.latitude, lng: o.longitude}; });

		// Map cables with coordinates
		const mapCables = (cables as any[]).map(c => {
			const sourceKey = `${c.source_type}-${c.source_id}`;
			const destKey = `${c.destination_type}-${c.destination_id}`;
			
			// Resolve path coords
			const pathCoords: {lat: number, lng: number}[] = [];
			try {
				if(c.path_nodes) {
					const nodes = typeof c.path_nodes === 'string' ? JSON.parse(c.path_nodes) : c.path_nodes;
					if(Array.isArray(nodes)) {
						nodes.forEach(n => {
							const pk = `POLE-${n}`;
							if(coordsMap[pk]) pathCoords.push(coordsMap[pk]);
						});
					}
				}
			} catch(e) {}

			return {
				...c,
				source_coords: coordsMap[sourceKey] || null,
				dest_coords: coordsMap[destKey] || null,
				path_coords: pathCoords
			};
		}).filter(c => c.source_coords && c.dest_coords);

		res.json({
			closures,
			poles,
			cables: mapCables
		});
	} catch (err) { 
		console.error('Error fetching map cables/closures API:', err);
		res.status(500).json({ error: 'Internal Server Error' }); 
	}
}
