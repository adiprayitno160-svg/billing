import { Request, Response, NextFunction } from 'express';
import { createOdc, deleteOdc, getOdcById, listOdcs, updateOdc } from '../../services/ftth/odcService';
import { OltService } from '../../services/ftth/oltService';

export async function getOdcList(req: Request, res: Response, next: NextFunction) {
	try {
		const oltId = req.query.olt_id ? Number(req.query.olt_id) : undefined;
		const items = await listOdcs(oltId);
		res.render('ftth/odc', { title: 'FTTH - ODC', items, oltId });
	} catch (err) { next(err); }
}

export async function getOdcAdd(req: Request, res: Response): Promise<void> {
	try {
		console.log('getOdcAdd: Starting to load OLTs...');
		const oltId = req.query.olt_id ? Number(req.query.olt_id) : undefined;
		console.log('getOdcAdd: oltId =', oltId);
		
		const olts = await OltService.listOlts();
		console.log('getOdcAdd: olts loaded =', olts);
		console.log('getOdcAdd: olts length =', olts.length);
		
		res.render('ftth/odc_add', { title: 'Tambah ODC', oltId, olts });
	} catch (error) {
		console.error('Error loading OLTs for ODC add page:', error);
		// Fallback: render with empty olts array
		const oltId = req.query.olt_id ? Number(req.query.olt_id) : undefined;
		console.log('getOdcAdd: Using fallback with empty olts array');
		res.render('ftth/odc_add', { title: 'Tambah ODC', oltId, olts: [] });
	}
}

export async function getOdcEdit(req: Request, res: Response, next: NextFunction): Promise<void> {
	try {
		const id = Number(req.params.id);
		const item = await getOdcById(id);
		if (!item) {
			res.status(404).send('ODC tidak ditemukan');
			return;
		}
		const olts = await OltService.listOlts();
		res.render('ftth/odc_edit', { title: 'Edit ODC', item, olts });
	} catch (err) { next(err); }
}

export async function postOdcCreate(req: Request, res: Response, next: NextFunction) {
	try {
        const { olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = req.body;
		const total = Number(total_ports ?? 0);
		const used = Number(used_ports ?? 0);
		if (!name) throw new Error('Nama wajib diisi');
		if (!olt_id) throw new Error('OLT wajib dipilih');
		if (used > total) throw new Error('Terpakai tidak boleh melebihi total port');
        const cardNum = olt_card !== undefined && olt_card !== '' ? Number(olt_card) : null;
        const portNum = olt_port !== undefined && olt_port !== '' ? Number(olt_port) : null;
        await createOdc({ olt_id: Number(olt_id), name, location: location ?? null, latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, total_ports: total, used_ports: used, olt_card: cardNum, olt_port: portNum, notes: notes ?? null });
		const redirectTo = olt_id ? `/ftth/odc?olt_id=${olt_id}` : '/ftth/odc';
		res.redirect(redirectTo);
	} catch (err) { next(err); }
}

export async function postOdcUpdate(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
        const { olt_id, name, location, latitude, longitude, total_ports, used_ports, olt_card, olt_port, notes } = req.body;
		const total = Number(total_ports ?? 0);
		const used = Number(used_ports ?? 0);
		if (!name) throw new Error('Nama wajib diisi');
		if (!olt_id) throw new Error('OLT wajib dipilih');
		if (used > total) throw new Error('Terpakai tidak boleh melebihi total port');
        const cardNum = olt_card !== undefined && olt_card !== '' ? Number(olt_card) : null;
        const portNum = olt_port !== undefined && olt_port !== '' ? Number(olt_port) : null;
        await updateOdc(id, { olt_id: Number(olt_id), name, location: location ?? null, latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null, total_ports: total, used_ports: used, olt_card: cardNum, olt_port: portNum, notes: notes ?? null });
		const redirectTo = olt_id ? `/ftth/odc?olt_id=${olt_id}` : '/ftth/odc';
		res.redirect(redirectTo);
	} catch (err) { next(err); }
}

export async function postOdcDelete(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		await deleteOdc(id);
		res.redirect('/ftth/odc');
	} catch (err) { next(err); }
}


