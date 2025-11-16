import { Request, Response, NextFunction } from 'express';
import { 
	syncProfilesFromMikrotik, 
	listProfiles, 
	getProfileById,
	createProfile,
	updateProfile,
	deleteProfile,
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
			currentPath: '/packages/pppoe/profiles',
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
			currentPath: '/packages/pppoe/packages',
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

		// Update package termasuk rate limit dari form (yang sudah auto-filled dari profile)
		await updatePackage(id, {
			name,
			profile_id: profile_id ? Number(profile_id) : undefined,
			price: price ? Number(price) : undefined,
			duration_days: duration_days ? Number(duration_days) : undefined,
			status: status as 'active' | 'inactive',
			description: description || undefined,
			// Rate limit dari form (yang sudah auto-filled dari profile terbaru)
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
			currentPath: '/packages/pppoe/packages',
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
			currentPath: '/packages/pppoe/packages',
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

// =====================================================================
// PROFILE CRUD OPERATIONS
// =====================================================================

export async function getProfileForm(req: Request, res: Response, next: NextFunction) {
	try {
		res.render('packages/pppoe_profile_form', { 
			title: 'Tambah Profil PPPoE', 
			currentPath: '/packages/pppoe/profiles',
			success: req.flash('success'),
			error: req.flash('error')
		});
	} catch (err) { 
		next(err); 
	}
}

export async function getProfileEdit(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const profile = await getProfileById(id);
		
		if (!profile) {
			req.flash('error', 'Profil tidak ditemukan');
			return res.redirect('/packages/pppoe/profiles');
		}
		
		res.render('packages/pppoe_profile_form', { 
			title: 'Edit Profil PPPoE', 
			currentPath: '/packages/pppoe/profiles',
			profile,
			success: req.flash('success'),
			error: req.flash('error')
		});
	} catch (err) { 
		next(err); 
	}
}

export async function postProfileCreate(req: Request, res: Response, next: NextFunction) {
	try {
		const { 
			name, 
			local_address,
			remote_address_pool,
			dns_server,
			rate_limit_rx,
			rate_limit_tx,
			burst_limit_rx,
			burst_limit_tx,
			burst_threshold_rx,
			burst_threshold_tx,
			burst_time_rx,
			burst_time_tx,
			comment
		} = req.body;

		if (!name) throw new Error('Nama profil wajib diisi');
		if (!rate_limit_rx || !rate_limit_tx) throw new Error('Rate limit RX dan TX wajib diisi');

		await createProfile({
			name,
			local_address: local_address || undefined,
			remote_address_pool: remote_address_pool || undefined,
			dns_server: dns_server || undefined,
			rate_limit_rx: rate_limit_rx || '0',
			rate_limit_tx: rate_limit_tx || '0',
			burst_limit_rx: burst_limit_rx || undefined,
			burst_limit_tx: burst_limit_tx || undefined,
			burst_threshold_rx: burst_threshold_rx || undefined,
			burst_threshold_tx: burst_threshold_tx || undefined,
			burst_time_rx: burst_time_rx || undefined,
			burst_time_tx: burst_time_tx || undefined,
			comment: comment || undefined
		});

		req.flash('success', 'Profil berhasil dibuat');
		res.redirect('/packages/pppoe/profiles');
	} catch (err) { 
		req.flash('error', err instanceof Error ? err.message : 'Gagal membuat profil');
		res.redirect('/packages/pppoe/profiles/new');
	}
}

export async function postProfileUpdate(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const { 
			name, 
			local_address,
			remote_address_pool,
			dns_server,
			rate_limit_rx,
			rate_limit_tx,
			burst_limit_rx,
			burst_limit_tx,
			burst_threshold_rx,
			burst_threshold_tx,
			burst_time_rx,
			burst_time_tx,
			comment
		} = req.body;

		if (!name) throw new Error('Nama profil wajib diisi');

		// Handle empty strings - convert to undefined for optional fields, but keep for rate_limit
		// Rate limit fields: if empty string, convert to '0', if undefined/null, keep as undefined
		const handleRateLimit = (value: any) => {
			if (value === undefined || value === null) return undefined;
			if (typeof value === 'string' && value.trim() === '') return '0';
			return value.trim();
		};

		await updateProfile(id, {
			name,
			local_address: (local_address && local_address.trim()) || undefined,
			remote_address_pool: (remote_address_pool && remote_address_pool.trim()) || undefined,
			dns_server: (dns_server && dns_server.trim()) || undefined,
			rate_limit_rx: handleRateLimit(rate_limit_rx),
			rate_limit_tx: handleRateLimit(rate_limit_tx),
			burst_limit_rx: (burst_limit_rx && burst_limit_rx.trim()) || undefined,
			burst_limit_tx: (burst_limit_tx && burst_limit_tx.trim()) || undefined,
			burst_threshold_rx: (burst_threshold_rx && burst_threshold_rx.trim()) || undefined,
			burst_threshold_tx: (burst_threshold_tx && burst_threshold_tx.trim()) || undefined,
			burst_time_rx: (burst_time_rx && burst_time_rx.trim()) || undefined,
			burst_time_tx: (burst_time_tx && burst_time_tx.trim()) || undefined,
			comment: (comment && comment.trim()) || undefined
		});

		req.flash('success', 'Profil berhasil diupdate');
		res.redirect('/packages/pppoe/profiles');
	} catch (err) { 
		req.flash('error', err instanceof Error ? err.message : 'Gagal mengupdate profil');
		res.redirect(`/packages/pppoe/profiles/${req.params.id}/edit`);
	}
}

export async function postProfileDelete(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		await deleteProfile(id);
		res.json({ success: true, message: 'Profil berhasil dihapus' });
	} catch (err) { 
		res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Gagal menghapus profil' });
	}
}
