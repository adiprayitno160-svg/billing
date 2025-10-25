import { Request, Response, NextFunction } from 'express';
import { 
	syncProfilesFromMikrotik, 
	listProfiles, 
	listPackages, 
	getPackageById, 
	createPackage, 
	updatePackage, 
	deletePackage 
} from '../services/pppoeService';

export async function getProfileList(req: Request, res: Response, next: NextFunction) {
	try {
		const profiles = await listProfiles();
		res.render('packages/pppoe_profiles', { 
			title: 'Profil PPPoE', 
			profiles,
			success: req.flash('success'),
			error: req.flash('error')
		});
	} catch (err) { 
		next(err); 
	}
}

export async function postSyncProfiles(req: Request, res: Response, next: NextFunction) {
	try {
		const result = await syncProfilesFromMikrotik();
		
		if (result.errors.length > 0) {
			req.flash('error', `Sync selesai dengan ${result.errors.length} error. ${result.synced} profil berhasil di-sync.`);
		} else {
			req.flash('success', `Berhasil sync ${result.synced} profil dari MikroTik.`);
		}
		
		res.redirect('/packages/pppoe/profiles');
	} catch (err) { 
		req.flash('error', `Gagal sync profil: ${err instanceof Error ? err.message : 'Unknown error'}`);
		res.redirect('/packages/pppoe/profiles');
	}
}

export async function getPackageList(req: Request, res: Response, next: NextFunction) {
	try {
		const packages = await listPackages();
		const profiles = await listProfiles();
		res.render('packages/pppoe_packages', { 
			title: 'Paket PPPoE', 
			packages,
			profiles,
			success: req.flash('success'),
			error: req.flash('error')
		});
	} catch (err) { 
		next(err); 
	}
}

	export async function postPackageCreate(req: Request, res: Response, next: NextFunction) {
	try {
		const { 
			name, 
			profile_id, 
			price, 
			duration_days,
			auto_activation, 
			status, 
			description,
			rate_limit_rx,
			rate_limit_tx,
			burst_limit_rx,
			burst_limit_tx,
			burst_threshold_rx,
			burst_threshold_tx,
			burst_time_rx,
			burst_time_tx
		} = req.body;

		if (!name) throw new Error('Nama paket wajib diisi');
		if (!price || Number(price) < 0) throw new Error('Harga harus lebih dari 0');
		if (!duration_days || Number(duration_days) < 1) throw new Error('Durasi harus minimal 1 hari');

		await createPackage({
			name,
			profile_id: profile_id ? Number(profile_id) : undefined,
			price: Number(price),
			duration_days: Number(duration_days),
			auto_activation: auto_activation === '1' || auto_activation === 'on' ? 1 : 0,
			status: status as 'active' | 'inactive',
			description: description || undefined,
			rate_limit_rx: rate_limit_rx || undefined,
			rate_limit_tx: rate_limit_tx || undefined,
			burst_limit_rx: burst_limit_rx || undefined,
			burst_limit_tx: burst_limit_tx || undefined,
			burst_threshold_rx: burst_threshold_rx || undefined,
			burst_threshold_tx: burst_threshold_tx || undefined,
			burst_time_rx: burst_time_rx || undefined,
			burst_time_tx: burst_time_tx || undefined
		});

		req.flash('success', 'Paket berhasil dibuat');
		res.redirect('/packages/pppoe/packages');
	} catch (err) { 
		req.flash('error', err instanceof Error ? err.message : 'Gagal membuat paket');
		res.redirect('/packages/pppoe/packages');
	}
}

export async function postPackageUpdate(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const { 
			name, 
			profile_id, 
			price, 
			duration_days, 
			status, 
			description,
			rate_limit_rx,
			rate_limit_tx,
			burst_limit_rx,
			burst_limit_tx,
			burst_threshold_rx,
			burst_threshold_tx,
			burst_time_rx,
			burst_time_tx
		} = req.body;

		if (!name) throw new Error('Nama paket wajib diisi');
		if (price && Number(price) < 0) throw new Error('Harga harus lebih dari 0');
		if (duration_days && Number(duration_days) < 1) throw new Error('Durasi harus minimal 1 hari');

		await updatePackage(id, {
			name,
			profile_id: profile_id ? Number(profile_id) : undefined,
			price: price ? Number(price) : undefined,
			duration_days: duration_days ? Number(duration_days) : undefined,
			status: status as 'active' | 'inactive',
			description: description || undefined,
			rate_limit_rx: rate_limit_rx || undefined,
			rate_limit_tx: rate_limit_tx || undefined,
			burst_limit_rx: burst_limit_rx || undefined,
			burst_limit_tx: burst_limit_tx || undefined,
			burst_threshold_rx: burst_threshold_rx || undefined,
			burst_threshold_tx: burst_threshold_tx || undefined,
			burst_time_rx: burst_time_rx || undefined,
			burst_time_tx: burst_time_tx || undefined
		});

		req.flash('success', 'Paket berhasil diupdate');
		res.redirect('/packages/pppoe/packages');
	} catch (err) { 
		req.flash('error', err instanceof Error ? err.message : 'Gagal mengupdate paket');
		res.redirect('/packages/pppoe/packages');
	}
}

export async function getPackageForm(req: Request, res: Response, next: NextFunction) {
	try {
		const profiles = await listProfiles();
		res.render('packages/pppoe_package_form', { 
			title: 'Tambah Paket PPPoE', 
			profiles,
			success: req.flash('success'),
			error: req.flash('error')
		});
	} catch (err) { 
		next(err); 
	}
}

export async function getPackageEdit(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const packageData = await getPackageById(id);
		const profiles = await listProfiles();
		
		if (!packageData) {
			req.flash('error', 'Paket tidak ditemukan');
			return res.redirect('/packages/pppoe/packages');
		}
		
		res.render('packages/pppoe_package_edit', { 
			title: 'Edit Paket PPPoE', 
			package: packageData,
			profiles,
			success: req.flash('success'),
			error: req.flash('error')
		});
	} catch (err) { 
		next(err); 
	}
}

export async function postPackageDelete(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		await deletePackage(id);
		req.flash('success', 'Paket berhasil dihapus');
		res.redirect('/packages/pppoe/packages');
	} catch (err) { 
		req.flash('error', err instanceof Error ? err.message : 'Gagal menghapus paket');
		res.redirect('/packages/pppoe/packages');
	}
}
