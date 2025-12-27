"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOltList = getOltList;
exports.getOltEdit = getOltEdit;
exports.postOltCreate = postOltCreate;
exports.postOltUpdate = postOltUpdate;
exports.postOltDelete = postOltDelete;
const pool_1 = require("../../db/pool");
async function getOltList(req, res, next) {
    try {
        const [rows] = await pool_1.databasePool.query(`
            SELECT * FROM ftth_olt 
            ORDER BY id DESC
        `);
        res.render('ftth/olt', {
            title: 'FTTH - OLT',
            items: rows
        });
    }
    catch (err) {
        next(err);
    }
}
async function getOltEdit(req, res, next) {
    try {
        const id = Number(req.params.id);
        const [rows] = await pool_1.databasePool.query(`
            SELECT * FROM ftth_olt WHERE id = ?
        `, [id]);
        if (!Array.isArray(rows) || rows.length === 0) {
            res.status(404).send('OLT tidak ditemukan');
            return;
        }
        res.render('ftth/olt_edit', {
            title: 'Edit OLT',
            olt: rows[0]
        });
    }
    catch (err) {
        next(err);
    }
}
async function postOltCreate(req, res, next) {
    try {
        const { name, ip_address, location, status, total_ports, used_ports, description } = req.body;
        await pool_1.databasePool.query(`
            INSERT INTO ftth_olt (name, ip_address, location, status, total_ports, used_ports, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [name, ip_address, location, status || 'offline', total_ports || 0, used_ports || 0, description]);
        res.redirect('/ftth/olt');
    }
    catch (err) {
        next(err);
    }
}
async function postOltUpdate(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { name, ip_address, location, status, total_ports, used_ports, description } = req.body;
        await pool_1.databasePool.query(`
            UPDATE ftth_olt 
            SET name = ?, ip_address = ?, location = ?, status = ?, total_ports = ?, used_ports = ?, description = ?, updated_at = NOW()
            WHERE id = ?
        `, [name, ip_address, location, status, total_ports, used_ports, description, id]);
        res.redirect('/ftth/olt');
    }
    catch (err) {
        next(err);
    }
}
async function postOltDelete(req, res, next) {
    try {
        const id = Number(req.params.id);
        await pool_1.databasePool.query(`
            DELETE FROM ftth_olt WHERE id = ?
        `, [id]);
        res.redirect('/ftth/olt');
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=oltController.js.map