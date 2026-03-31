"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOdps = listOdps;
exports.getOdpById = getOdpById;
exports.createOdp = createOdp;
exports.updateOdp = updateOdp;
exports.deleteOdp = deleteOdp;
exports.recalculateOdpUsage = recalculateOdpUsage;
const pool_1 = require("../../db/pool");
async function listOdps(odcId, search, limit, offset) {
    let sql = `
		SELECT 
			p.*, 
			o.name as odc_name 
		FROM ftth_odp p
		LEFT JOIN ftth_odc o ON p.odc_id = o.id
	`;
    const params = [];
    const whereClauses = [];
    if (odcId) {
        whereClauses.push('p.odc_id = ?');
        params.push(odcId);
    }
    if (search) {
        whereClauses.push('(p.name LIKE ? OR p.location LIKE ? OR o.name LIKE ?)');
        const searchVal = `%${search}%`;
        params.push(searchVal, searchVal, searchVal);
    }
    if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
    }
    // Get total count before applying limit/offset
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as t`;
    const [countRows] = await pool_1.databasePool.query(countSql, params);
    const total = countRows[0]?.total || 0;
    sql += ' ORDER BY p.id DESC';
    if (limit !== undefined && offset !== undefined) {
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
    }
    const [rows] = await pool_1.databasePool.query(sql, params);
    return { items: rows, total };
}
async function getOdpById(id) {
    const [rows] = await pool_1.databasePool.query(`SELECT id, odc_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes FROM ftth_odp WHERE id = ? LIMIT 1`, [id]);
    const list = rows;
    return list.length ? list[0] : null;
}
async function createOdp(data) {
    const { odc_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
    const [result] = await pool_1.databasePool.query(`INSERT INTO ftth_odp (odc_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [odc_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null]);
    return result.insertId;
}
async function updateOdp(id, data) {
    const { odc_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
    await pool_1.databasePool.query(`UPDATE ftth_odp SET odc_id = ?, name = ?, location = ?, latitude = ?, longitude = ?, total_ports = ?, used_ports = ?, olt_card = ?, olt_port = ?, notes = ? WHERE id = ?`, [odc_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null, id]);
}
async function deleteOdp(id) {
    await pool_1.databasePool.query(`DELETE FROM ftth_odp WHERE id = ?`, [id]);
}
async function recalculateOdpUsage(id) {
    // Count all customers assigned to this ODP
    const [rows] = await pool_1.databasePool.query('SELECT COUNT(*) as count FROM customers WHERE odp_id = ?', [id]);
    const count = rows[0]?.count || 0;
    await pool_1.databasePool.query('UPDATE ftth_odp SET used_ports = ? WHERE id = ?', [count, id]);
}
//# sourceMappingURL=odpService.js.map