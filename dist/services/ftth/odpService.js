"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOdps = listOdps;
exports.getOdpById = getOdpById;
exports.createOdp = createOdp;
exports.updateOdp = updateOdp;
exports.deleteOdp = deleteOdp;
const pool_1 = require("../../db/pool");
async function listOdps(odcId) {
    let sql = `SELECT id, odc_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes, created_at, updated_at FROM ftth_odp`;
    const params = [];
    if (odcId) {
        sql += ' WHERE odc_id = ?';
        params.push(odcId);
    }
    sql += ' ORDER BY id DESC';
    const [rows] = await pool_1.databasePool.query(sql, params);
    return rows;
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
//# sourceMappingURL=odpService.js.map