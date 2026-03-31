"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOdpList = getOdpList;
exports.getOdpAdd = getOdpAdd;
exports.getOdpEdit = getOdpEdit;
exports.postOdpCreate = postOdpCreate;
exports.postOdpUpdate = postOdpUpdate;
exports.postOdpDelete = postOdpDelete;
const odpService_1 = require("../../services/ftth/odpService");
const odcService_1 = require("../../services/ftth/odcService");
const oltService_1 = require("../../services/ftth/oltService");
async function getOdpList(req, res, next) {
    try {
        const odcId = req.query.odc_id ? Number(req.query.odc_id) : undefined;
        const search = req.query.search ? String(req.query.search) : undefined;
        const page = req.query.page ? Number(req.query.page) : 1;
        // Default 10 items, Max 20 items per page
        let limit = req.query.limit ? Number(req.query.limit) : 10;
        if (limit > 20)
            limit = 20;
        const offset = (page - 1) * limit;
        const { items, total } = await (0, odpService_1.listOdps)(odcId, search, limit, offset);
        const totalPages = Math.ceil(total / limit);
        res.render('ftth/odp', {
            title: 'FTTH - ODP',
            items,
            total,
            odcId,
            search,
            page,
            limit,
            totalPages,
            layout: 'layouts/main'
        });
    }
    catch (err) {
        next(err);
    }
}
async function getOdpAdd(req, res) {
    const odcId = req.query.odc_id ? Number(req.query.odc_id) : undefined;
    const odcs = await (0, odcService_1.listOdcs)();
    const olts = await oltService_1.OltService.listOlts();
    // Build map odc_id -> { line_cards, total_ports, olt_id }
    const oltById = new Map(olts.map((o) => [o.id, o]));
    const odcToOlt = odcs.reduce((acc, odc) => {
        const olt = oltById.get(odc.olt_id);
        acc[odc.id] = {
            olt_id: odc.olt_id,
            line_cards: olt?.line_cards ?? null,
            total_ports: olt?.total_ports ?? null
        };
        return acc;
    }, {});
    res.render('ftth/odp_add', { title: 'Tambah ODP', odcId, odcs, odcToOlt, layout: 'layouts/main' });
}
async function getOdpEdit(req, res, next) {
    try {
        const id = Number(req.params.id);
        const item = await (0, odpService_1.getOdpById)(id);
        if (!item) {
            res.status(404).send('ODP tidak ditemukan');
            return;
        }
        const odcs = await (0, odcService_1.listOdcs)();
        const olts = await oltService_1.OltService.listOlts();
        const oltById = new Map(olts.map((o) => [o.id, o]));
        const odcToOlt = odcs.reduce((acc, odc) => {
            const olt = oltById.get(odc.olt_id);
            acc[odc.id] = {
                olt_id: odc.olt_id,
                line_cards: olt?.line_cards ?? null,
                total_ports: olt?.total_ports ?? null
            };
            return acc;
        }, {});
        res.render('ftth/odp_edit', { title: 'Edit ODP', item, odcs, odcToOlt, layout: 'layouts/main' });
    }
    catch (err) {
        next(err);
    }
}
async function postOdpCreate(req, res, next) {
    try {
        const { odc_id, name, location, latitude, longitude, total_ports, olt_card, olt_port, notes } = req.body;
        const total = Number(total_ports ?? 0);
        const cardNum = olt_card !== undefined && olt_card !== '' ? Number(olt_card) : null;
        const portNum = olt_port !== undefined && olt_port !== '' ? Number(olt_port) : null;
        if (!name)
            throw new Error('Nama wajib diisi');
        if (!odc_id)
            throw new Error('ODC wajib dipilih');
        // Validate against parent OLT constraints
        const odc = await (0, odcService_1.getOdcById)(Number(odc_id));
        if (odc) {
            const olt = await oltService_1.OltService.getOltById(odc.olt_id);
            if (olt) {
                if (cardNum && olt.line_cards && cardNum > olt.line_cards)
                    throw new Error('Baris kartu melebihi kapasitas OLT');
                if (portNum && olt.total_ports && portNum > olt.total_ports)
                    throw new Error('Port OLT melebihi kapasitas OLT');
            }
        }
        // Initialize used_ports to 0 (will be calculated automatically)
        await (0, odpService_1.createOdp)({ odc_id: Number(odc_id), name, location: location ?? null, latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, total_ports: total, used_ports: 0, olt_card: cardNum, olt_port: portNum, notes: notes ?? null });
        // Recalculate parent ODC usage
        await (0, odcService_1.recalculateOdcUsage)(Number(odc_id));
        const redirectTo = odc_id ? `/ftth/odp?odc_id=${odc_id}` : '/ftth/odp';
        res.redirect(redirectTo);
    }
    catch (err) {
        next(err);
    }
}
async function postOdpUpdate(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { odc_id, name, location, latitude, longitude, total_ports, olt_card, olt_port, notes } = req.body;
        const total = Number(total_ports ?? 0);
        const cardNum = olt_card !== undefined && olt_card !== '' ? Number(olt_card) : null;
        const portNum = olt_port !== undefined && olt_port !== '' ? Number(olt_port) : null;
        if (!name)
            throw new Error('Nama wajib diisi');
        if (!odc_id)
            throw new Error('ODC wajib dipilih');
        // Get old ODP data to check if ODC changed
        const oldOdp = await (0, odpService_1.getOdpById)(id);
        const oldOdcId = oldOdp?.odc_id;
        const odc = await (0, odcService_1.getOdcById)(Number(odc_id));
        if (odc) {
            const olt = await oltService_1.OltService.getOltById(odc.olt_id);
            if (olt) {
                if (cardNum && olt.line_cards && cardNum > olt.line_cards)
                    throw new Error('Baris kartu melebihi kapasitas OLT');
                if (portNum && olt.total_ports && portNum > olt.total_ports)
                    throw new Error('Port OLT melebihi kapasitas OLT');
            }
        }
        // Preserve current used_ports (will be recalculated)
        const currentUsedPorts = oldOdp?.used_ports ?? 0;
        await (0, odpService_1.updateOdp)(id, { odc_id: Number(odc_id), name, location: location ?? null, latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, total_ports: total, used_ports: currentUsedPorts, olt_card: cardNum, olt_port: portNum, notes: notes ?? null });
        // Recalculate this ODP's usage
        await (0, odpService_1.recalculateOdpUsage)(id);
        // Recalculate parent ODC usage
        await (0, odcService_1.recalculateOdcUsage)(Number(odc_id));
        // If ODC was changed, recalculate old ODC too
        if (oldOdcId && oldOdcId !== Number(odc_id)) {
            await (0, odcService_1.recalculateOdcUsage)(oldOdcId);
        }
        const redirectTo = odc_id ? `/ftth/odp?odc_id=${odc_id}` : '/ftth/odp';
        res.redirect(redirectTo);
    }
    catch (err) {
        next(err);
    }
}
async function postOdpDelete(req, res, next) {
    try {
        const id = Number(req.params.id);
        await (0, odpService_1.deleteOdp)(id);
        res.redirect('/ftth/odp');
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=odpController.js.map