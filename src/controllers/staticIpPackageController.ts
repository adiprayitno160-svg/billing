import { Request, Response, NextFunction } from 'express';
import { 
    listStaticIpPackages, 
    getStaticIpPackageById, 
    createStaticIpPackage, 
    updateStaticIpPackage, 
    deleteStaticIpPackage,
    createMikrotikQueues,
    deleteMikrotikQueuesOnly
} from '../services/staticIpPackageService';

export async function getStaticIpPackageList(req: Request, res: Response, next: NextFunction) {
	try {
		const packages = await listStaticIpPackages();
		res.render('packages/static_ip_packages', { 
			title: 'Paket IP Static', 
			packages,
			success: req.flash('success'),
			error: req.flash('error')
		});
	} catch (err) { 
		next(err); 
	}
}

export async function getStaticIpPackageAdd(req: Request, res: Response, next: NextFunction) {
	try {
		res.render('packages/static_ip_add', { 
			title: 'Tambah Paket IP Static',
			error: req.flash('error')
		});
	} catch (err) { 
		next(err); 
	}
}

export async function getStaticIpPackageEdit(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const packageData = await getStaticIpPackageById(id);
		
		if (!packageData) {
			req.flash('error', 'Paket tidak ditemukan');
			return res.redirect('/packages/static-ip');
		}
		
		res.render('packages/static_ip_edit', { 
			title: 'Edit Paket IP Static',
			package: packageData,
			error: req.flash('error')
		});
	} catch (err) { 
		next(err); 
	}
}

export async function postStaticIpPackageCreate(req: Request, res: Response, next: NextFunction) {
	try {
		const { 
			name, 
			parent_upload_name,
			parent_download_name,
			max_limit_upload,
			limit_at_upload,
			max_limit_download,
			limit_at_download,
			max_clients,
			child_upload_name,
			child_download_name,
			child_upload_limit,
			child_download_limit,
			child_limit_at_upload,
			child_limit_at_download,
			child_burst_upload,
			child_burst_download,
			child_queue_type_download,
			child_queue_type_upload,
			child_priority_download,
			child_priority_upload,
			child_burst_threshold_download,
			child_burst_threshold_upload,
			child_burst_time_download,
			child_burst_time_upload,
			price, 
			duration_days, 
			status, 
			description
		} = req.body;

		if (!name) throw new Error('Nama paket wajib diisi');
		if (!parent_upload_name) throw new Error('Parent upload wajib diisi');
		if (!parent_download_name) throw new Error('Parent download wajib diisi');
		if (!max_limit_upload) throw new Error('Max limit upload wajib diisi');
		if (!max_limit_download) throw new Error('Max limit download wajib diisi');
		if (!max_clients || Number(max_clients) < 1) throw new Error('Max clients harus minimal 1');
		if (!child_upload_name) throw new Error('Child upload name wajib diisi');
		if (!child_download_name) throw new Error('Child download name wajib diisi');
		if (!price || Number(price) < 0) throw new Error('Harga harus lebih dari 0');
		if (!duration_days || Number(duration_days) < 1) throw new Error('Durasi harus minimal 1 hari');

		await createStaticIpPackage({
			name,
			parent_upload_name,
			parent_download_name,
            max_limit_upload,
            max_limit_download,
            max_clients: Number(max_clients),
            child_upload_name,
            child_download_name,
            child_upload_limit: child_upload_limit || undefined,
			child_download_limit: child_download_limit || undefined,
			child_limit_at_upload: child_limit_at_upload || undefined,
			child_limit_at_download: child_limit_at_download || undefined,
			child_burst_upload: child_burst_upload || undefined,
			child_burst_download: child_burst_download || undefined,
			child_queue_type_download: child_queue_type_download || undefined,
			child_queue_type_upload: child_queue_type_upload || undefined,
			child_priority_download: child_priority_download || undefined,
			child_priority_upload: child_priority_upload || undefined,
			child_burst_threshold_download: child_burst_threshold_download || undefined,
			child_burst_threshold_upload: child_burst_threshold_upload || undefined,
			child_burst_time_download: child_burst_time_download || undefined,
			child_burst_time_upload: child_burst_time_upload || undefined,
            price: Number(price),
            duration_days: Number(duration_days),
            status: status as 'active' | 'inactive',
            description: description || undefined
        });

		req.flash('success', 'Paket IP Static berhasil dibuat');
		res.redirect('/packages/static-ip');
	} catch (err) { 
		req.flash('error', err instanceof Error ? err.message : 'Gagal membuat paket IP Static');
		res.redirect('/packages/static-ip');
	}
}

export async function postStaticIpPackageUpdate(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		const { 
			name, 
			parent_upload_name,
			parent_download_name,
			max_limit_upload,
			limit_at_upload,
			max_limit_download,
			limit_at_download,
			max_clients,
			child_upload_name,
			child_download_name,
			child_upload_limit,
			child_download_limit,
			child_limit_at_upload,
			child_limit_at_download,
			child_burst_upload,
			child_burst_download,
			child_queue_type_download,
			child_queue_type_upload,
			child_priority_download,
			child_priority_upload,
			child_burst_threshold_download,
			child_burst_threshold_upload,
			child_burst_time_download,
			child_burst_time_upload,
			price, 
			duration_days, 
			status, 
			description
		} = req.body;

		if (!name) throw new Error('Nama paket wajib diisi');
		if (!parent_upload_name) throw new Error('Parent upload wajib diisi');
		if (!parent_download_name) throw new Error('Parent download wajib diisi');
		if (!max_limit_upload) throw new Error('Max limit upload wajib diisi');
		if (!max_limit_download) throw new Error('Max limit download wajib diisi');
		if (max_clients && Number(max_clients) < 1) throw new Error('Max clients harus minimal 1');
		if (child_upload_name && !child_upload_name.trim()) throw new Error('Child upload name tidak boleh kosong');
		if (child_download_name && !child_download_name.trim()) throw new Error('Child download name tidak boleh kosong');
		if (price && Number(price) < 0) throw new Error('Harga harus lebih dari 0');
		if (duration_days && Number(duration_days) < 1) throw new Error('Durasi harus minimal 1 hari');

		await updateStaticIpPackage(id, {
			name,
			parent_upload_name,
			parent_download_name,
			max_limit_upload,
			limit_at_upload,
			max_limit_download,
			limit_at_download,
			max_clients: max_clients ? Number(max_clients) : undefined,
			child_upload_name: child_upload_name || undefined,
			child_download_name: child_download_name || undefined,
			child_upload_limit: child_upload_limit || undefined,
			child_download_limit: child_download_limit || undefined,
			child_limit_at_upload: child_limit_at_upload || undefined,
			child_limit_at_download: child_limit_at_download || undefined,
			child_burst_upload: child_burst_upload || undefined,
			child_burst_download: child_burst_download || undefined,
			child_queue_type_download: child_queue_type_download || undefined,
			child_queue_type_upload: child_queue_type_upload || undefined,
			child_priority_download: child_priority_download || undefined,
			child_priority_upload: child_priority_upload || undefined,
			child_burst_threshold_download: child_burst_threshold_download || undefined,
			child_burst_threshold_upload: child_burst_threshold_upload || undefined,
			child_burst_time_download: child_burst_time_download || undefined,
			child_burst_time_upload: child_burst_time_upload || undefined,
			price: price ? Number(price) : undefined,
			duration_days: duration_days ? Number(duration_days) : undefined,
			status: status as 'active' | 'inactive',
			description: description || undefined
		});

		req.flash('success', 'Paket IP Static berhasil diupdate');
		res.redirect('/packages/static-ip');
	} catch (err) { 
		req.flash('error', err instanceof Error ? err.message : 'Gagal mengupdate paket IP Static');
		res.redirect('/packages/static-ip');
	}
}

export async function postStaticIpPackageCreateQueues(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		await createMikrotikQueues(id);
		req.flash('success', 'Queue MikroTik berhasil dibuat');
		res.redirect('/packages/static-ip');
	} catch (err) { 
		req.flash('error', err instanceof Error ? err.message : 'Gagal membuat queue MikroTik');
		res.redirect('/packages/static-ip');
	}
}

export async function postStaticIpPackageDelete(req: Request, res: Response, next: NextFunction) {
	try {
		const id = Number(req.params.id);
		await deleteStaticIpPackage(id);
		req.flash('success', 'Paket IP Static berhasil dihapus');
		res.redirect('/packages/static-ip');
	} catch (err) { 
		req.flash('error', err instanceof Error ? err.message : 'Gagal menghapus paket IP Static');
		res.redirect('/packages/static-ip');
	}
}

export async function postStaticIpPackageDeleteQueues(req: Request, res: Response, next: NextFunction) {
    try {
        const id = Number(req.params.id);
        await deleteMikrotikQueuesOnly(id);
        req.flash('success', 'Queue MikroTik untuk paket ini telah dihapus');
        res.redirect('/packages/static-ip');
    } catch (err) { 
        req.flash('error', err instanceof Error ? err.message : 'Gagal menghapus queue MikroTik');
        res.redirect('/packages/static-ip');
    }
}
