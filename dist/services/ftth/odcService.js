"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOdcs = listOdcs;
exports.getOdcById = getOdcById;
exports.createOdc = createOdc;
exports.updateOdc = updateOdc;
exports.deleteOdc = deleteOdc;
const pool_1 = require("../../db/pool");
async function listOdcs(oltId) {
    let sql = `SELECT id, olt_id, name, location, latitude, longitude, total_ports, used_ports, notes, created_at, updated_at FROM ftth_odc`;
    const params = [];
    if (oltId) {
        sql += ' WHERE olt_id = ?';
        params.push(oltId);
    }
    sql += ' ORDER BY id DESC';
    const [rows] = await pool_1.databasePool.query(sql, params);
    return rows;
}
async function getOdcById(id) {
    const [rows] = await pool_1.databasePool.query(`SELECT id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes FROM ftth_odc WHERE id = ? LIMIT 1`, [id]);
    const list = rows;
    return list.length ? list[0] : null;
}
async function createOdc(data) {
    const { olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
    const [result] = await pool_1.databasePool.query(`INSERT INTO ftth_odc (olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [olt_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null]);
    return result.insertId;
}
async function updateOdc(id, data) {
    const { olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = data;
    await pool_1.databasePool.query(`UPDATE ftth_odc SET olt_id = ?, name = ?, location = ?, latitude = ?, longitude = ?, total_ports = ?, used_ports = ?, olt_card = ?, olt_port = ?, notes = ? WHERE id = ?`, [olt_id, name, location ?? null, latitude ?? null, longitude ?? null, total_ports, used_ports, olt_card ?? null, olt_port ?? null, notes ?? null, id]);
}
async function deleteOdc(id) {
    await pool_1.databasePool.query(`DELETE FROM ftth_odc WHERE id = ?`, [id]);
}
//# sourceMappingURL=odcService.js.map