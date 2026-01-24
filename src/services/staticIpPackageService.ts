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
	price_7_days?: number;  // ADDED for prepaid
	price_30_days?: number; // ADDED for prepaid
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
	price_7_days?: number;  // ADDED for prepaid
	price_30_days?: number; // ADDED for prepaid
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

		// AUTOMATICALLY CREATE PARENT QUEUE TREE
		try {
			console.log(`[Package] Creating Parent Queue Trees for: "${data.name}"`);

			// We sync after insertion to have all defaults etc.
		} catch (notifError: any) {
			console.error(`[Package] Error preparation:`, notifError);
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

		// Sync to MikroTik after commit
		try {
			const pkg = await getStaticIpPackageById(insertResult.insertId);
			if (pkg) await syncPackageQueueTrees(config, pkg);
		} catch (e) {
			console.error(`[Package] Failed to sync Queue Tree to MikroTik:`, e);
		}

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
		// Update Parent Simple Queue - DISABLED BY USER REQUEST
		/*
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
		*/

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

		// Update MikroTik Queue Tree
		try {
			const updatedPkg = await getStaticIpPackageById(id);
			if (updatedPkg) {
				// Handle renaming if name changed
				if (currentPackage.name !== newPackageName) {
					console.log(`[Package] Renaming Package Queues from ${currentPackage.name} to ${newPackageName}`);
					const oldDlId = await findQueueTreeIdByName(config, currentPackage.name);
					if (oldDlId) await updateQueueTree(config, oldDlId, { name: newPackageName });

					const oldUpName = `UP-${currentPackage.name}`;
					const oldUpId = await findQueueTreeIdByName(config, oldUpName);
					if (oldUpId) await updateQueueTree(config, oldUpId, { name: `UP-${newPackageName}` });
				}

				await syncPackageQueueTrees(config, updatedPkg);
			}
		} catch (e) {
			console.error(`[Package] Failed to update Queue Tree on MikroTik:`, e);
		}
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
		await syncPackageQueueTrees(config, pkg);
	} catch (e) {
		console.error(`[Package] Failed to create Parent Queue Tree:`, e);
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
			await deletePackageQueueTrees(config, pkg.name);
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
		await deletePackageQueueTrees(config, pkg.name);
	} catch (e) { throw e; }
}

export async function syncClientQueues(
	customerId: number,
	packageId: number,
	ipAddress: string,
	clientName: string,
	options?: {
		oldClientName?: string,
		overrides?: {
			maxLimitDownload?: string;
			maxLimitUpload?: string;
			limitAtDownload?: string;
			limitAtUpload?: string;
			priorityDownload?: string;
			priorityUpload?: string;
			queueDownload?: string;
			queueUpload?: string;
			useBurst?: boolean;
			burstLimitDownload?: string;
			burstLimitUpload?: string;
			burstThresholdDownload?: string;
			burstThresholdUpload?: string;
			burstTimeDownload?: string;
			burstTimeUpload?: string;
		}
	}
): Promise<void> {
	const config = await getMikrotikConfig();
	if (!config) throw new Error('Konfigurasi MikroTik tidak ditemukan');

	const { createQueueTree, deleteClientQueuesByClientName, addMangleRulesForClient, findQueueTreeIdByPacketMark, deleteQueueTree } = await import('./mikrotikService');
	const { calculateSharedLimit } = await import('../services/staticIpClientService');

	const pkg = await getStaticIpPackageById(packageId);
	if (!pkg) throw new Error('Paket tidak ditemukan');

	// ENSURE PARENT EXISTS
	await syncPackageQueueTrees(config, pkg);

	const cleanIp = ipAddress.split('/')[0];

	// Cleanup first
	await deleteClientQueuesByClientName(config, clientName);
	if (options?.oldClientName && options.oldClientName !== clientName) {
		await deleteClientQueuesByClientName(config, options.oldClientName);
	}

	// Calculate Peer IP for marks
	function ipToInt(ip: string) { return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0; }
	function intToIp(int: number) { return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.'); }

	const [ipOnly, prefixStr] = ipAddress.split('/');
	const prefix = Number(prefixStr || '32');
	const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
	const networkInt = ipToInt(ipOnly) & mask;

	let peerIp = ipOnly;
	if (prefix === 30) {
		const firstHost = networkInt + 1;
		const secondHost = networkInt + 2;
		const ipInt = ipToInt(ipOnly);
		peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
	}

	// Cleanup Queue by IP/PacketMark to be extra safe
	try {
		const dlIdByMark = await findQueueTreeIdByPacketMark(config, peerIp);
		if (dlIdByMark) await deleteQueueTree(config, dlIdByMark);
		const upIdByMark = await findQueueTreeIdByPacketMark(config, `UP-${peerIp}`);
		if (upIdByMark) await deleteQueueTree(config, upIdByMark);
	} catch (e) { console.warn('Extra cleanup failed (not critical):', e); }

	// Add Mangle Rules
	const downloadMark = peerIp;
	const uploadMark = `UP-${peerIp}`;
	await addMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });

	// Calculate Limits (taking overrides into account)
	const mlDownload = options?.overrides?.maxLimitDownload || pkg.child_download_limit || (pkg as any).shared_download_limit || pkg.max_limit_download;
	const mlUpload = options?.overrides?.maxLimitUpload || pkg.child_upload_limit || (pkg as any).shared_upload_limit || pkg.max_limit_upload;

	let laDownload = options?.overrides?.limitAtDownload || pkg.child_limit_at_download;
	if (!laDownload && pkg.max_clients > 1) {
		laDownload = calculateSharedLimit(mlDownload, pkg.max_clients);
	}

	let laUpload = options?.overrides?.limitAtUpload || pkg.child_limit_at_upload;
	if (!laUpload && pkg.max_clients > 1) {
		laUpload = calculateSharedLimit(mlUpload, pkg.max_clients);
	}

	const useBurst = options?.overrides?.useBurst !== undefined
		? options.overrides.useBurst
		: ((pkg.child_burst_upload && pkg.child_burst_download) ? true : false);

	// Create Download Queue Tree
	await createQueueTree(config, {
		name: clientName,
		parent: pkg.name, // Use Package Name as Parent for Download
		packetMarks: downloadMark,
		limitAt: laDownload,
		maxLimit: mlDownload,
		queue: options?.overrides?.queueDownload || pkg.child_queue_type_download || 'pcq',
		priority: options?.overrides?.priorityDownload || pkg.child_priority_download || '8',
		...(useBurst ? {
			burstLimit: options?.overrides?.burstLimitDownload || pkg.child_burst_download,
			burstThreshold: options?.overrides?.burstThresholdDownload || pkg.child_burst_threshold_download,
			burstTime: options?.overrides?.burstTimeDownload || pkg.child_burst_time_download
		} : {})
	});

	// Create Upload Queue Tree
	await createQueueTree(config, {
		name: `UP-${clientName}`,
		parent: `UP-${pkg.name}`, // Use UP-{Package Name} as Parent for Upload
		packetMarks: uploadMark,
		limitAt: laUpload,
		maxLimit: mlUpload,
		queue: options?.overrides?.queueUpload || pkg.child_queue_type_upload || 'pcq',
		priority: options?.overrides?.priorityUpload || pkg.child_priority_upload || '8',
		...(useBurst ? {
			burstLimit: options?.overrides?.burstLimitUpload || pkg.child_burst_upload,
			burstThreshold: options?.overrides?.burstThresholdUpload || pkg.child_burst_threshold_upload,
			burstTime: options?.overrides?.burstTimeUpload || pkg.child_burst_time_upload
		} : {})
	});

	console.log(`[SyncClientQueues] Queue Tree updated for ${clientName}`);
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

/**
 * Sync Package Queue Trees Helper
 */
export async function syncPackageQueueTrees(config: MikroTikConfig, pkg: StaticIpPackage) {
	// Download
	const dlName = pkg.name;
	const dlId = await findQueueTreeIdByName(config, dlName);
	const dlData = {
		name: dlName,
		parent: (pkg.parent_download_name && pkg.parent_download_name !== 'SIMPLE_QUEUE_PARENT') ? pkg.parent_download_name : 'global',
		maxLimit: pkg.max_limit_download,
		limitAt: pkg.limit_at_download || undefined,
		comment: pkg.name
	};
	if (dlId) await updateQueueTree(config, dlId, dlData);
	else await createQueueTree(config, dlData);

	// Upload
	const upName = `UP-${pkg.name}`;
	const upId = await findQueueTreeIdByName(config, upName);
	const upData = {
		name: upName,
		parent: (pkg.parent_upload_name && pkg.parent_upload_name !== 'SIMPLE_QUEUE_PARENT') ? pkg.parent_upload_name : 'global',
		maxLimit: pkg.max_limit_upload || '1M',
		limitAt: pkg.limit_at_upload || undefined,
		comment: `${pkg.name} Upload`
	};
	if (upId) await updateQueueTree(config, upId, upData);
	else await createQueueTree(config, upData);
}

/**
 * Delete Package Queue Trees Helper
 */
export async function deletePackageQueueTrees(config: MikroTikConfig, packageName: string) {
	const dlId = await findQueueTreeIdByName(config, packageName);
	if (dlId) await deleteQueueTree(config, dlId);

	const upName = `UP-${packageName}`;
	const upId = await findQueueTreeIdByName(config, upName);
	if (upId) await deleteQueueTree(config, upId);
}
