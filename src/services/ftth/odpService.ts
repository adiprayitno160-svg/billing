import { databasePool } from '../../db/pool';

export interface OdpRecord {
	id?: number;
	odc_id: number;
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

export async function listOdps(odcId?: number): Promise<any[]> {
	let sql = `
		SELECT 
			p.*, 
			o.name as odc_name 
		FROM ftth_odp p
		LEFT JOIN ftth_odc o ON p.odc_id = o.id
	`;
	const params: any[] = [];
	if (odcId) {
		sql += ' WHERE p.odc_id = ?';
		params.push(odcId);
	}
	sql += ' ORDER BY p.id DESC';
	const [rows] = await databasePool.query(sql, params);
	return rows as any[];
}

export async function getOdpById(id: number): Promise<OdpRecord | null> {
	const [rows] = await databasePool.query(
		`SELECT id, odc_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes FROM ftth_odp WHERE id = ? LIMIT 1`,
		[id]
	);
	const list = rows as OdpRecord[];
	return list.length ? (list[0] as OdpRecord) : null;
}

export async function createOdp(data: OdpRecord): Promise<number> {
	const { odc_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
	const [result]: any = await databasePool.query(
		`INSERT INTO ftth_odp (odc_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[odc_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null]
	);
	return result.insertId as number;
}

export async function updateOdp(id: number, data: OdpRecord): Promise<void> {
	const { odc_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
	await databasePool.query(
		`UPDATE ftth_odp SET odc_id = ?, name = ?, location = ?, latitude = ?, longitude = ?, total_ports = ?, used_ports = ?, olt_card = ?, olt_port = ?, notes = ? WHERE id = ?`,
		[odc_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null, id]
	);
}

export async function deleteOdp(id: number): Promise<void> {
	await databasePool.query(`DELETE FROM ftth_odp WHERE id = ?`, [id]);
}



export async function recalculateOdpUsage(id: number): Promise<void> {
	// Count all customers assigned to this ODP
	const [rows] = await databasePool.query(
		'SELECT COUNT(*) as count FROM customers WHERE odp_id = ?',
		[id]
	);
	const count = (rows as any)[0]?.count || 0;
	await databasePool.query(
		'UPDATE ftth_odp SET used_ports = ? WHERE id = ?',
		[count, id]
	);
}
