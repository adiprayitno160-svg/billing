import { databasePool } from '../db/pool';
import { createQueueTree, updateQueueTree, deleteQueueTree, getQueueTrees, MikroTikConfig, addMangleRulesForClient, findQueueTreeIdByName } from './mikrotikService';

export type StaticIpPackage = {
	id: number;
	name: string;
	parent_upload_name: string;
	parent_download_name: string;
	max_limit_upload: string;
	max_limit_download: string;
	max_clients: number;
	child_upload_name?: string;
	child_download_name?: string;
	child_upload_limit?: string;
	child_download_limit?: string;
	child_limit_at_upload?: string;
	child_limit_at_download?: string;
	child_burst_upload?: string;
	child_burst_download?: string;
	child_queue_type_download?: string;
	child_queue_type_upload?: string;
	child_priority_download?: string;
	child_priority_upload?: string;
	child_burst_threshold_download?: string;
	child_burst_threshold_upload?: string;
	child_burst_time_download?: string;
	child_burst_time_upload?: string;
	price: number;
	duration_days: number;
	status: 'active' | 'inactive';
	description?: string;
	created_at: Date;
	updated_at: Date;
	current_clients?: number;
	shared_upload_limit?: string;
	shared_download_limit?: string;
	limit_at_upload?: string;
	limit_at_download?: string;
};

export type StaticIpClient = {
	id: number;
	package_id: number;
	client_name: string;
	ip_address: string;
	customer_id?: number;
	status: 'active' | 'inactive';
	created_at: Date;
	updated_at: Date;
};

export async function getMikrotikConfig(): Promise<MikroTikConfig | null> {
	const conn = await databasePool.getConnection();
	try {
		const [rows] = await conn.execute('SELECT * FROM mikrotik_settings ORDER BY id DESC LIMIT 1');
		const settings = Array.isArray(rows) && rows.length > 0 ? rows[0] as any : null;

		if (!settings) return null;

		return {
			host: settings.host,
			port: settings.port,
			username: settings.username,
			password: settings.password,
			use_tls: settings.use_tls
		};
	} finally {
		conn.release();
	}
}

export async function listStaticIpPackages(): Promise<StaticIpPackage[]> {
	const conn = await databasePool.getConnection();
	try {
		const [rows] = await conn.execute(`
			SELECT 
				sip.*,
				COUNT(sic.id) as current_clients,
				CASE 
					WHEN sip.max_clients > 1 THEN 
						CONCAT(FLOOR(CAST(SUBSTRING_INDEX(sip.max_limit_upload, 'M', 1) AS UNSIGNED) / sip.max_clients), 'M')
					ELSE sip.max_limit_upload 
				END as shared_upload_limit,
				CASE 
					WHEN sip.max_clients > 1 THEN 
						CONCAT(FLOOR(CAST(SUBSTRING_INDEX(sip.max_limit_download, 'M', 1) AS UNSIGNED) / sip.max_clients), 'M')
					ELSE sip.max_limit_download 
				END as shared_download_limit
			FROM static_ip_packages sip
			LEFT JOIN static_ip_clients sic ON sip.id = sic.package_id AND sic.status = 'active'
			GROUP BY sip.id
			ORDER BY sip.created_at DESC
		`);
		return Array.isArray(rows) ? rows as StaticIpPackage[] : [];
	} finally {
		conn.release();
	}
}

export async function getStaticIpPackageById(id: number): Promise<StaticIpPackage | null> {
	const conn = await databasePool.getConnection();
	try {
		const [rows] = await conn.execute(
			'SELECT * FROM static_ip_packages WHERE id = ?',
			[id]
		);
		const result = Array.isArray(rows) ? rows : [];
		return result.length > 0 ? result[0] as StaticIpPackage : null;
	} finally {
		conn.release();
	}
}

export async function createStaticIpPackage(data: {
	name: string;
	parent_upload_name: string;
	parent_download_name: string;
	max_limit_upload: string;
	max_limit_download: string;
	limit_at_upload?: string;
	limit_at_download?: string;
	max_clients: number;
	child_upload_name?: string;
	child_download_name?: string;
	child_upload_limit?: string;
	child_download_limit?: string;
	child_limit_at_upload?: string;
	child_limit_at_download?: string;
	child_burst_upload?: string;
	child_burst_download?: string;
	child_queue_type_download?: string;
	child_queue_type_upload?: string;
	child_priority_download?: string;
	child_priority_upload?: string;
	child_burst_threshold_download?: string;
	child_burst_threshold_upload?: string;
	child_burst_time_download?: string;
	child_burst_time_upload?: string;
	price: number;
	duration_days: number;
	status: 'active' | 'inactive';
	description?: string;
}): Promise<number> {
	const config = await getMikrotikConfig();
	if (!config) {
		throw new Error('Konfigurasi MikroTik tidak ditemukan');
	}

	const conn = await databasePool.getConnection();
	try {
		await conn.beginTransaction();

		// AUTOMATICALLY CREATE PARENT SIMPLE QUEUE
		try {
			console.log(`[Package] Creating Parent Simple Queue: "${data.name}"`);
			const { createSimpleQueue, getSimpleQueues, updateSimpleQueue } = await import('./mikrotikService');
			const maxLimit = `${data.max_limit_upload || '1M'}/${data.max_limit_download || '1M'}`;

			const simpleQueues = await getSimpleQueues(config);
			const existing = simpleQueues.find(q => q.name === data.name);

			const queueData = {
				name: data.name,
				target: '0.0.0.0/0',
				maxLimit: maxLimit,
				limitAt: (data.limit_at_upload && data.limit_at_download)
					? `${data.limit_at_upload}/${data.limit_at_download}`
					: undefined,
				comment: `[BILLING] PACKAGE PARENT: ${data.name} (Shared Bandwidth Container)`,
				queue: 'default/default'
			};

			if (existing) {
				await updateSimpleQueue(config, existing['.id'], queueData);
			} else {
				await createSimpleQueue(config, queueData);
			}
		} catch (e) {
			console.error(`[Package] ⚠️ Failed to create Parent Simple Queue:`, e);
		}

		const values = [
			data.name,
			data.parent_upload_name || 'SIMPLE_QUEUE_PARENT',
			data.parent_download_name || 'SIMPLE_QUEUE_PARENT',
			null,
			data.max_limit_upload,
			data.limit_at_upload || null,
			data.max_limit_download,
			data.limit_at_download || null,
			data.max_clients,
			data.child_upload_name || null,
			data.child_download_name || null,
			data.child_upload_limit || null,
			data.child_download_limit || null,
			data.child_limit_at_upload || null,
			data.child_limit_at_download || null,
			data.child_burst_upload || null,
			data.child_burst_download || null,
			data.child_queue_type_download || null,
			data.child_queue_type_upload || null,
			data.child_priority_download || null,
			data.child_priority_upload || null,
			data.child_burst_threshold_download || null,
			data.child_burst_threshold_upload || null,
			data.child_burst_time_download || null,
			data.child_burst_time_upload || null,
			data.price,
			data.duration_days,
			data.status,
			data.description || null
		];

		const [result] = await conn.execute(`
            INSERT INTO static_ip_packages 
            (name, parent_upload_name, parent_download_name, parent_queue_id, max_limit_upload, limit_at_upload, max_limit_download, limit_at_download, max_clients, child_upload_name, child_download_name, child_upload_limit, child_download_limit, child_limit_at_upload, child_limit_at_download, child_burst_upload, child_burst_download, child_queue_type_download, child_queue_type_upload, child_priority_download, child_priority_upload, child_burst_threshold_download, child_burst_threshold_upload, child_burst_time_download, child_burst_time_upload, price, duration_days, status, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, values);

		const insertResult = result as any;
		await conn.commit();
		return insertResult.insertId;
	} catch (error) {
		await conn.rollback();
		throw error;
	} finally {
		conn.release();
	}
}

export async function updateStaticIpPackage(id: number, data: {
	name?: string;
	parent_upload_name?: string;
	parent_download_name?: string;
	max_limit_upload?: string;
	max_limit_download?: string;
	limit_at_upload?: string;
	limit_at_download?: string;
	max_clients?: number;
	child_upload_name?: string;
	child_download_name?: string;
	child_upload_limit?: string;
	child_download_limit?: string;
	child_limit_at_upload?: string;
	child_limit_at_download?: string;
	child_burst_upload?: string;
	child_burst_download?: string;
	child_queue_type_download?: string;
	child_queue_type_upload?: string;
	child_priority_download?: string;
	child_priority_upload?: string;
	child_burst_threshold_download?: string;
	child_burst_threshold_upload?: string;
	child_burst_time_download?: string;
	child_burst_time_upload?: string;
	price?: number;
	duration_days?: number;
	status?: 'active' | 'inactive';
	description?: string;
}): Promise<void> {
	const config = await getMikrotikConfig();
	if (!config) {
		throw new Error('Konfigurasi MikroTik tidak ditemukan');
	}

	const conn = await databasePool.getConnection();
	try {
		await conn.beginTransaction();

		const currentPackage = await getStaticIpPackageById(id);
		if (!currentPackage) throw new Error('Paket tidak ditemukan');

		const newPackageName = data.name || currentPackage.name;

		// Update Parent Simple Queue
		try {
			console.log(`[Package] Updating Parent Simple Queue: "${newPackageName}"`);
			const { getSimpleQueues, updateSimpleQueue, createSimpleQueue } = await import('./mikrotikService');
			const simpleQueues = await getSimpleQueues(config);
			const oldQueue = simpleQueues.find(q => q.name === currentPackage.name);
			const maxLimit = `${(data.max_limit_upload || currentPackage.max_limit_upload) || '1M'}/${(data.max_limit_download || currentPackage.max_limit_download) || '1M'}`;

			const queueData = {
				name: newPackageName,
				maxLimit: maxLimit,
				comment: `[BILLING] PACKAGE PARENT: ${newPackageName} (Shared Bandwidth Container)`
			};

			if (oldQueue) {
				await updateSimpleQueue(config, oldQueue['.id'], queueData);
			} else {
				await createSimpleQueue(config, {
					...queueData,
					target: '0.0.0.0/0',
					queue: 'default/default'
				});
			}
		} catch (e) {
			console.warn(`[Package] Warning during Parent Queue update:`, e);
		}

		// Update database
		const updateFields = [];
		const updateValues = [];

		if (data.name !== undefined) { updateFields.push('name = ?'); updateValues.push(data.name); }
		if (data.parent_upload_name !== undefined) { updateFields.push('parent_upload_name = ?'); updateValues.push(data.parent_upload_name); }
		if (data.parent_download_name !== undefined) { updateFields.push('parent_download_name = ?'); updateValues.push(data.parent_download_name); }
		if (data.max_limit_upload !== undefined) { updateFields.push('max_limit_upload = ?'); updateValues.push(data.max_limit_upload); }
		if (data.max_limit_download !== undefined) { updateFields.push('max_limit_download = ?'); updateValues.push(data.max_limit_download); }
		if (data.limit_at_upload !== undefined) { updateFields.push('limit_at_upload = ?'); updateValues.push(data.limit_at_upload); }
		if (data.limit_at_download !== undefined) { updateFields.push('limit_at_download = ?'); updateValues.push(data.limit_at_download); }
		if (data.max_clients !== undefined) { updateFields.push('max_clients = ?'); updateValues.push(Number(data.max_clients)); }
		if (data.child_upload_name !== undefined) { updateFields.push('child_upload_name = ?'); updateValues.push(data.child_upload_name); }
		if (data.child_download_name !== undefined) { updateFields.push('child_download_name = ?'); updateValues.push(data.child_download_name); }
		if (data.child_upload_limit !== undefined) { updateFields.push('child_upload_limit = ?'); updateValues.push(data.child_upload_limit); }
		if (data.child_download_limit !== undefined) { updateFields.push('child_download_limit = ?'); updateValues.push(data.child_download_limit); }
		if (data.child_limit_at_upload !== undefined) { updateFields.push('child_limit_at_upload = ?'); updateValues.push(data.child_limit_at_upload); }
		if (data.child_limit_at_download !== undefined) { updateFields.push('child_limit_at_download = ?'); updateValues.push(data.child_limit_at_download); }
		if (data.child_burst_upload !== undefined) { updateFields.push('child_burst_upload = ?'); updateValues.push(data.child_burst_upload); }
		if (data.child_burst_download !== undefined) { updateFields.push('child_burst_download = ?'); updateValues.push(data.child_burst_download); }
		if (data.child_queue_type_download !== undefined) { updateFields.push('child_queue_type_download = ?'); updateValues.push(data.child_queue_type_download); }
		if (data.child_queue_type_upload !== undefined) { updateFields.push('child_queue_type_upload = ?'); updateValues.push(data.child_queue_type_upload); }
		if (data.child_priority_download !== undefined) { updateFields.push('child_priority_download = ?'); updateValues.push(data.child_priority_download); }
		if (data.child_priority_upload !== undefined) { updateFields.push('child_priority_upload = ?'); updateValues.push(data.child_priority_upload); }
		if (data.child_burst_threshold_download !== undefined) { updateFields.push('child_burst_threshold_download = ?'); updateValues.push(data.child_burst_threshold_download); }
		if (data.child_burst_threshold_upload !== undefined) { updateFields.push('child_burst_threshold_upload = ?'); updateValues.push(data.child_burst_threshold_upload); }
		if (data.child_burst_time_download !== undefined) { updateFields.push('child_burst_time_download = ?'); updateValues.push(data.child_burst_time_download); }
		if (data.child_burst_time_upload !== undefined) { updateFields.push('child_burst_time_upload = ?'); updateValues.push(data.child_burst_time_upload); }
		if (data.price !== undefined) { updateFields.push('price = ?'); updateValues.push(Number(data.price)); }
		if (data.duration_days !== undefined) { updateFields.push('duration_days = ?'); updateValues.push(Number(data.duration_days)); }
		if (data.status !== undefined) { updateFields.push('status = ?'); updateValues.push(data.status); }
		if (data.description !== undefined) { updateFields.push('description = ?'); updateValues.push(data.description || null); }

		if (updateFields.length > 0) {
			updateFields.push('updated_at = NOW()');
			updateValues.push(id);
			await conn.execute(`UPDATE static_ip_packages SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
		}

		await conn.commit();
	} catch (error) {
		await conn.rollback();
		throw error;
	} finally {
		conn.release();
	}
}

export async function createMikrotikQueues(packageId: number): Promise<void> {
	const config = await getMikrotikConfig();
	if (!config) throw new Error('Konfigurasi MikroTik tidak ditemukan');

	const pkg = await getStaticIpPackageById(packageId);
	if (!pkg) throw new Error('Paket tidak ditemukan');

	try {
		const { createSimpleQueue, getSimpleQueues, updateSimpleQueue } = await import('./mikrotikService');
		const maxLimit = `${pkg.max_limit_upload || '1M'}/${pkg.max_limit_download || '1M'}`;
		const simpleQueues = await getSimpleQueues(config);
		const existing = simpleQueues.find(q => q.name === pkg.name);

		const queueData = {
			name: pkg.name,
			target: '0.0.0.0/0',
			maxLimit: maxLimit,
			limitAt: (pkg.limit_at_upload && pkg.limit_at_download)
				? `${pkg.limit_at_upload}/${pkg.limit_at_download}`
				: undefined,
			comment: `[BILLING] PACKAGE PARENT: ${pkg.name} (Shared Bandwidth Container)`,
			queue: 'default/default'
		};

		if (existing) {
			await updateSimpleQueue(config, existing['.id'], queueData);
		} else {
			await createSimpleQueue(config, queueData);
		}
	} catch (e) {
		console.error(`[Package] Failed to create Parent Queue:`, e);
		throw e;
	}
}

export async function deleteStaticIpPackage(id: number): Promise<void> {
	const config = await getMikrotikConfig();
	if (!config) throw new Error('Konfigurasi MikroTik tidak ditemukan');

	const conn = await databasePool.getConnection();
	try {
		await conn.beginTransaction();
		const pkg = await getStaticIpPackageById(id);
		if (!pkg) throw new Error('Paket tidak ditemukan');

		// Delete from MikroTik
		try {
			const { getSimpleQueues, deleteSimpleQueue } = await import('./mikrotikService');
			const simpleQueues = await getSimpleQueues(config);
			const parent = simpleQueues.find(q => q.name === pkg.name);
			if (parent) await deleteSimpleQueue(config, parent['.id']);
		} catch (e) { console.warn(e); }

		await conn.execute('DELETE FROM static_ip_packages WHERE id = ?', [id]);
		await conn.commit();
	} catch (error) {
		await conn.rollback();
		throw error;
	} finally {
		conn.release();
	}
}

export async function deleteMikrotikQueuesOnly(packageId: number): Promise<void> {
	const config = await getMikrotikConfig();
	if (!config) throw new Error('Konfigurasi MikroTik tidak ditemukan');
	const pkg = await getStaticIpPackageById(packageId);
	if (!pkg) throw new Error('Paket tidak ditemukan');

	try {
		const { getSimpleQueues, deleteSimpleQueue } = await import('./mikrotikService');
		const simpleQueues = await getSimpleQueues(config);
		const parent = simpleQueues.find(q => q.name === pkg.name);
		if (parent) await deleteSimpleQueue(config, parent['.id']);
	} catch (e) { throw e; }
}

export async function syncClientQueues(customerId: number, packageId: number, ipAddress: string, clientName: string): Promise<void> {
	const config = await getMikrotikConfig();
	if (!config) throw new Error('Konfigurasi MikroTik tidak ditemukan');

	const { getSimpleQueues, createSimpleQueue, updateSimpleQueue, removeMangleRulesForClient } = await import('./mikrotikService');
	const pkg = await getStaticIpPackageById(packageId);
	if (!pkg) throw new Error('Paket tidak ditemukan');

	const cleanIp = ipAddress.split('/')[0];

	// Prepare Data
	const burstLimit = (pkg.child_burst_upload && pkg.child_burst_download)
		? `${pkg.child_burst_upload}/${pkg.child_burst_download}`
		: undefined;
	const burstThreshold = (pkg.child_burst_threshold_upload && pkg.child_burst_threshold_download)
		? `${pkg.child_burst_threshold_upload}/${pkg.child_burst_threshold_download}`
		: undefined;
	const burstTime = (pkg.child_burst_time_upload && pkg.child_burst_time_download)
		? `${pkg.child_burst_time_upload}/${pkg.child_burst_time_download}`
		: undefined;

	const simpleQueues = await getSimpleQueues(config);
	const existingQueue = simpleQueues.find(q => q.name === clientName || q.target === `${cleanIp}/32`);
	const parentPackageQueue = simpleQueues.find(q => q.name === pkg.name);

	let maxLimit = `${pkg.max_limit_upload || '1M'}/${pkg.max_limit_download || '1M'}`;
	let parentName = parentPackageQueue ? pkg.name : undefined;
	let limitAt = (pkg.child_limit_at_upload && pkg.child_limit_at_download)
		? `${pkg.child_limit_at_upload}/${pkg.child_limit_at_download}`
		: undefined;

	const queueData = {
		name: clientName,
		target: `${cleanIp}/32`,
		maxLimit: maxLimit,
		limitAt: limitAt,
		priority: (pkg.child_priority_upload && pkg.child_priority_download)
			? `${pkg.child_priority_upload}/${pkg.child_priority_download}`
			: undefined,
		burstLimit,
		burstThreshold,
		burstTime,
		parent: parentName,
		comment: `[BILLING] Static IP Client: ${clientName} (${pkg.name}) [${parentName ? 'SHARED' : 'DEDICATED'}]`,
		queue: (pkg.child_queue_type_upload && pkg.child_queue_type_download)
			? `${pkg.child_queue_type_upload}/${pkg.child_queue_type_download}`
			: 'default-small/default-small'
	};

	if (existingQueue) {
		await updateSimpleQueue(config, existingQueue['.id'], queueData);
	} else {
		await createSimpleQueue(config, queueData);
	}
}

export async function syncAllMikrotikQueues(): Promise<void> {
	const packages = await listStaticIpPackages();
	for (const pkg of packages) {
		try {
			await createMikrotikQueues(pkg.id);
		} catch (error) {
			console.error(`[SyncAll] Failed to sync ${pkg.name}:`, error);
		}
	}
}
