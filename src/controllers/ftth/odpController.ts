import { Request, Response, NextFunction } from 'express';
import { createOdp, deleteOdp, getOdpById, listOdps, updateOdp, recalculateOdpUsage } from '../../services/ftth/odpService';
import { getOdcById, listOdcs, recalculateOdcUsage } from '../../services/ftth/odcService';
import { OltService } from '../../services/ftth/oltService';

export async function getOdpList(req: Request, res: Response, next: NextFunction) {
    try {
        const odcId = req.query.odc_id ? Number(req.query.odc_id) : undefined;
        const items = await listOdps(odcId);
        res.render('ftth/odp', { title: 'FTTH - ODP', items, odcId, layout: 'layouts/main' });
    } catch (err) { next(err); }
}

export async function getOdpAdd(req: Request, res: Response): Promise<void> {
    const odcId = req.query.odc_id ? Number(req.query.odc_id) : undefined;
    const odcs = await listOdcs();
    const olts = await OltService.listOlts();
    // Build map odc_id -> { line_cards, total_ports, olt_id }
    const oltById = new Map(olts.map((o: any) => [o.id, o] as const));
    const odcToOlt = odcs.reduce((acc: any, odc: any) => {
        const olt = oltById.get(odc.olt_id as any);
        acc[odc.id as any] = {
            olt_id: odc.olt_id,
            line_cards: olt?.line_cards ?? null,
            total_ports: olt?.total_ports ?? null
        };
        return acc;
    }, {} as Record<string, any>);
    res.render('ftth/odp_add', { title: 'Tambah ODP', odcId, odcs, odcToOlt, layout: 'layouts/main' });
}

export async function getOdpEdit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = Number(req.params.id);
        const item = await getOdpById(id);
        if (!item) {
            res.status(404).send('ODP tidak ditemukan');
            return;
        }
        const odcs = await listOdcs();
        const olts = await OltService.listOlts();
        const oltById = new Map(olts.map((o: any) => [o.id, o] as const));
        const odcToOlt = odcs.reduce((acc: any, odc: any) => {
            const olt = oltById.get(odc.olt_id as any);
            acc[odc.id as any] = {
                olt_id: odc.olt_id,
                line_cards: olt?.line_cards ?? null,
                total_ports: olt?.total_ports ?? null
            };
            return acc;
        }, {} as Record<string, any>);
        res.render('ftth/odp_edit', { title: 'Edit ODP', item, odcs, odcToOlt, layout: 'layouts/main' });
    } catch (err) { next(err); }
}

export async function postOdpCreate(req: Request, res: Response, next: NextFunction) {
    try {
        const { odc_id, name, location, latitude, longitude, total_ports, olt_card, olt_port, notes } = req.body;
        const total = Number(total_ports ?? 0);
        const cardNum = olt_card !== undefined && olt_card !== '' ? Number(olt_card) : null;
        const portNum = olt_port !== undefined && olt_port !== '' ? Number(olt_port) : null;
        if (!name) throw new Error('Nama wajib diisi');
        if (!odc_id) throw new Error('ODC wajib dipilih');
        // Validate against parent OLT constraints
        const odc = await getOdcById(Number(odc_id));
        if (odc) {
            const olt = await OltService.getOltById(odc.olt_id);
            if (olt) {
                if (cardNum && olt.line_cards && cardNum > olt.line_cards) throw new Error('Baris kartu melebihi kapasitas OLT');
                if (portNum && olt.total_ports && portNum > olt.total_ports) throw new Error('Port OLT melebihi kapasitas OLT');
            }
        }
        // Initialize used_ports to 0 (will be calculated automatically)
        await createOdp({ odc_id: Number(odc_id), name, location: location ?? null, latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, total_ports: total, used_ports: 0, olt_card: cardNum, olt_port: portNum, notes: notes ?? null });

        // Recalculate parent ODC usage
        await recalculateOdcUsage(Number(odc_id));

        const redirectTo = odc_id ? `/ftth/odp?odc_id=${odc_id}` : '/ftth/odp';
        res.redirect(redirectTo);
    } catch (err) { next(err); }
}

export async function postOdpUpdate(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        const { odc_id, name, location, latitude, longitude, total_ports, olt_card, olt_port, notes } = req.body;
        const total = Number(total_ports ?? 0);
        const cardNum = olt_card !== undefined && olt_card !== '' ? Number(olt_card) : null;
        const portNum = olt_port !== undefined && olt_port !== '' ? Number(olt_port) : null;
        if (!name) throw new Error('Nama wajib diisi');
        if (!odc_id) throw new Error('ODC wajib dipilih');

        // Get old ODP data to check if ODC changed
        const oldOdp = await getOdpById(id);
        const oldOdcId = oldOdp?.odc_id;

        const odc = await getOdcById(Number(odc_id));
        if (odc) {
            const olt = await OltService.getOltById(odc.olt_id);
            if (olt) {
                if (cardNum && olt.line_cards && cardNum > olt.line_cards) throw new Error('Baris kartu melebihi kapasitas OLT');
                if (portNum && olt.total_ports && portNum > olt.total_ports) throw new Error('Port OLT melebihi kapasitas OLT');
            }
        }

        // Preserve current used_ports (will be recalculated)
        const currentUsedPorts = oldOdp?.used_ports ?? 0;
        await updateOdp(id, { odc_id: Number(odc_id), name, location: location ?? null, latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, total_ports: total, used_ports: currentUsedPorts, olt_card: cardNum, olt_port: portNum, notes: notes ?? null });

        // Recalculate this ODP's usage
        await recalculateOdpUsage(id);

        // Recalculate parent ODC usage
        await recalculateOdcUsage(Number(odc_id));

        // If ODC was changed, recalculate old ODC too
        if (oldOdcId && oldOdcId !== Number(odc_id)) {
            await recalculateOdcUsage(oldOdcId);
        }

        const redirectTo = odc_id ? `/ftth/odp?odc_id=${odc_id}` : '/ftth/odp';
        res.redirect(redirectTo);
    } catch (err) { next(err); }
}

export async function postOdpDelete(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        await deleteOdp(id);
        res.redirect('/ftth/odp');
    } catch (err) { next(err); }
}


