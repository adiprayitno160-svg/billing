"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOdcs = listOdcs;
exports.getOdcById = getOdcById;
exports.createOdc = createOdc;
exports.updateOdc = updateOdc;
exports.deleteOdc = deleteOdc;
exports.recalculateOdcUsage = recalculateOdcUsage;
const pool_1 = require("../../db/pool");
async function listOdcs(oltId) {
    // Join with areas and olts
    let sql = `
		SELECT 
			o.*, 
			a.name as area_name,
			olt.name as olt_name 
		FROM ftth_odc o
		LEFT JOIN ftth_areas a ON o.area_id = a.id
		LEFT JOIN ftth_olt olt ON o.olt_id = olt.id
	`;
    const params = [];
    if (oltId) {
        sql += ' WHERE o.olt_id = ?';
        params.push(oltId);
    }
    sql += ' ORDER BY o.id DESC';
    const [rows] = await pool_1.databasePool.query(sql, params);
    return rows;
}
async function getOdcById(id) {
    const [rows] = await pool_1.databasePool.query(`SELECT id, area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes FROM ftth_odc WHERE id = ? LIMIT 1`, [id]);
    const list = rows;
    return list.length ? list[0] : null;
}
async function createOdc(data) {
    const { area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
    const [result] = await pool_1.databasePool.query(`INSERT INTO ftth_odc (area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [area_id ?? null, olt_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null]);
    return result.insertId;
}
async function updateOdc(id, data) {
    const { area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
    await pool_1.databasePool.query(`UPDATE ftth_odc SET area_id = ?, olt_id = ?, name = ?, location = ?, latitude = ?, longitude = ?, total_ports = ?, used_ports = ?, olt_card = ?, olt_port = ?, notes = ? WHERE id = ?`, [area_id ?? null, olt_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null, id]);
}
async function deleteOdc(id) {
    await pool_1.databasePool.query(`DELETE FROM ftth_odc WHERE id = ?`, [id]);
}
async function recalculateOdcUsage(id) {
    const [rows] = await pool_1.databasePool.query('SELECT COUNT(*) as count FROM ftth_odp WHERE odc_id = ?', [id]);
    const count = rows[0]?.count || 0;
    await pool_1.databasePool.query('UPDATE ftth_odc SET used_ports = ? WHERE id = ?', [count, id]);
}
//# sourceMappingURL=odcService.js.map