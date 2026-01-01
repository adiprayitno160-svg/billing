import { databasePool } from '../../db/pool';

export interface OdcRecord {
	id?: number;
	area_id?: number | null; // Added area_id
	olt_id: number;
	name: string;
	location?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	total_ports: number;
	used_ports: number;
	olt_card?: number | null;
	olt_port?: number | null;
	notes?: string | null;
}

export async function listOdcs(oltId?: number): Promise<OdcRecord[]> {
	// Select area_id too
	let sql = `SELECT id, area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, notes, created_at, updated_at FROM ftth_odc`;
	const params: any[] = [];
	if (oltId) {
		sql += ' WHERE olt_id = ?';
		params.push(oltId);
	}
	sql += ' ORDER BY id DESC';
	const [rows] = await databasePool.query(sql, params);
	return rows as OdcRecord[];
}

export async function getOdcById(id: number): Promise<OdcRecord | null> {
	const [rows] = await databasePool.query(
		`SELECT id, area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes FROM ftth_odc WHERE id = ? LIMIT 1`,
		[id]
	);
	const list = rows as OdcRecord[];
	return list.length ? (list[0] as OdcRecord) : null;
}

export async function createOdc(data: OdcRecord): Promise<number> {
	const { area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
	const [result]: any = await databasePool.query(
		`INSERT INTO ftth_odc (area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[area_id ?? null, olt_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null]
	);
	return result.insertId as number;
}

export async function updateOdc(id: number, data: OdcRecord): Promise<void> {
	const { area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
	await databasePool.query(
		`UPDATE ftth_odc SET area_id = ?, olt_id = ?, name = ?, location = ?, latitude = ?, longitude = ?, total_ports = ?, used_ports = ?, olt_card = ?, olt_port = ?, notes = ? WHERE id = ?`,
		[area_id ?? null, olt_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null, id]
	);
}

export async function deleteOdc(id: number): Promise<void> {
	await databasePool.query(`DELETE FROM ftth_odc WHERE id = ?`, [id]);
}




export async function recalculateOdcUsage(id: number): Promise<void> {
	const [rows] = await databasePool.query(
		'SELECT COUNT(*) as count FROM ftth_odp WHERE odc_id = ?',
		[id]
	);
	const count = (rows as any)[0]?.count || 0;
	await databasePool.query(
		'UPDATE ftth_odc SET used_ports = ? WHERE id = ?',
		[count, id]
	);
}

