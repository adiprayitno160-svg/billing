"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOdcList = getOdcList;
exports.getOdcAdd = getOdcAdd;
exports.getOdcEdit = getOdcEdit;
exports.postOdcCreate = postOdcCreate;
exports.postOdcUpdate = postOdcUpdate;
exports.postOdcDelete = postOdcDelete;
const odcService_1 = require("../../services/ftth/odcService");
const oltService_1 = require("../../services/ftth/oltService");
async function getOdcList(req, res, next) {
    try {
        const oltId = req.query.olt_id ? Number(req.query.olt_id) : undefined;
        const items = await (0, odcService_1.listOdcs)(oltId);
        res.render('ftth/odc', { title: 'FTTH - ODC', items, oltId, layout: 'layouts/main' });
    }
    catch (err) {
        next(err);
    }
}
// Import databasePool manually if needed or create AreaService usage
const pool_1 = require("../../db/pool");
async function getOdcAdd(req, res) {
    try {
        console.log('getOdcAdd: Starting to load OLTs...');
        const oltId = req.query.olt_id ? Number(req.query.olt_id) : undefined;
        const olts = await oltService_1.OltService.listOlts();
        // Load Areas
        const [areas] = await pool_1.databasePool.query('SELECT * FROM ftth_areas ORDER BY name ASC');
        res.render('ftth/odc_add', { title: 'Tambah ODC', oltId, olts, areas, layout: 'layouts/main' });
    }
    catch (error) {
        console.error('Error loading OLTs for ODC add page:', error);
        const oltId = req.query.olt_id ? Number(req.query.olt_id) : undefined;
        res.render('ftth/odc_add', { title: 'Tambah ODC', oltId, olts: [], areas: [], layout: 'layouts/main' });
    }
}
async function getOdcEdit(req, res, next) {
    try {
        console.log('=== GET ODC EDIT REQUEST ===');
        const idString = req.params.id;
        console.log('Requested ID:', idString);
        const id = Number(idString);
        if (isNaN(id)) {
            console.error('Invalid ODC ID:', idString);
            res.status(400).send(`Invalid ODC ID: ${idString}`);
            return;
        }
        const item = await (0, odcService_1.getOdcById)(id);
        if (!item) {
            console.error('ODC Not Found:', id);
            res.status(404).send('ODC tidak ditemukan di database');
            return;
        }
        console.log('ODC Found:', item.name);
        const olts = await oltService_1.OltService.listOlts();
        console.log('OLT List loaded:', olts.length);
        // Load Areas
        const [areas] = await pool_1.databasePool.query('SELECT * FROM ftth_areas ORDER BY name ASC');
        console.log('Areas loaded:', areas.length);
        res.render('ftth/odc_edit', { title: 'Edit ODC', item, olts, areas, layout: 'layouts/main' });
    }
    catch (err) {
        console.error('Error in getOdcEdit:', err);
        next(err);
    }
}
async function postOdcCreate(req, res, next) {
    try {
        const { area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = req.body;
        const total = Number(total_ports ?? 0);
        const used = Number(used_ports ?? 0);
        if (!name)
            throw new Error('Nama wajib diisi');
        if (!olt_id)
            throw new Error('OLT wajib dipilih');
        if (used > total)
            throw new Error('Terpakai tidak boleh melebihi total port');
        const cardNum = olt_card !== undefined && olt_card !== '' ? Number(olt_card) : null;
        const portNum = olt_port !== undefined && olt_port !== '' ? Number(olt_port) : null;
        const areaIdNum = area_id ? Number(area_id) : null;
        await (0, odcService_1.createOdc)({ area_id: areaIdNum, olt_id: Number(olt_id), name, location: location ?? null, latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, total_ports: total, used_ports: 0, olt_card: cardNum, olt_port: portNum, notes: notes ?? null });
        const redirectTo = olt_id ? `/ftth/odc?olt_id=${olt_id}` : '/ftth/odc';
        res.redirect(redirectTo);
    }
    catch (err) {
        next(err);
    }
}
async function postOdcUpdate(req, res, next) {
    try {
        console.log('=== UPDATE ODC REQUEST ===');
        console.log('ID:', req.params.id);
        console.log('Body:', req.body);
        const id = Number(req.params.id);
        const { area_id, olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = req.body;
        const total = Number(total_ports ?? 0);
        const used = Number(used_ports ?? 0);
        if (!name)
            throw new Error('Nama wajib diisi');
        if (!olt_id)
            throw new Error('OLT wajib dipilih');
        if (used > total)
            throw new Error('Terpakai tidak boleh melebihi total port');
        const cardNum = olt_card !== undefined && olt_card !== '' ? Number(olt_card) : null;
        const portNum = olt_port !== undefined && olt_port !== '' ? Number(olt_port) : null;
        const areaIdNum = area_id ? Number(area_id) : null;
        // Fetch current ODC to preserve used_ports
        const currentOdc = await (0, odcService_1.getOdcById)(id);
        const currentUsed = currentOdc ? currentOdc.used_ports : 0;
        await (0, odcService_1.updateOdc)(id, { area_id: areaIdNum, olt_id: Number(olt_id), name, location: location ?? null, latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, total_ports: total, used_ports: currentUsed, olt_card: cardNum, olt_port: portNum, notes: notes ?? null });
        // Recalculate just in case
        await (0, odcService_1.recalculateOdcUsage)(id);
        const redirectTo = olt_id ? `/ftth/odc?olt_id=${olt_id}` : '/ftth/odc';
        res.redirect(redirectTo);
    }
    catch (err) {
        next(err);
    }
}
async function postOdcDelete(req, res, next) {
    try {
        const id = Number(req.params.id);
        await (0, odcService_1.deleteOdc)(id);
        res.redirect('/ftth/odc');
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=odcController.js.map