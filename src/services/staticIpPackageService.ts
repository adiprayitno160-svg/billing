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

		// Create MikroTik queues with custom names
		console.log('Creating MikroTik queues with custom names...');
		console.log('Package data:', {
			name: data.name,
			parent_upload: data.parent_upload_name,
			parent_download: data.parent_download_name,
			upload_limit: data.max_limit_upload,
			download_limit: data.max_limit_download
		});



		// Check existing queues to prevent errors if they already exist (Smart Create)
		// AUTOMATICALLY CREATE PARENT SIMPLE QUEUE
		// This queue acts as the "Total Limit" for the package
		// Clients can be attached to this parent for "Shared Bandwidth" mode
		try {
			console.log(`[Package] Creating Parent Simple Queue: "${data.name}"`);

			const { createSimpleQueue, getSimpleQueues, updateSimpleQueue } = await import('./mikrotikService');

			// Limit Format: upload/download (e.g. "10M/20M")
			const maxLimit = `${data.max_limit_upload || '1M'}/${data.max_limit_download || '1M'}`;

			// Check if exists
			const simpleQueues = await getSimpleQueues(config);
			const existing = simpleQueues.find(q => q.name === data.name);

			const queueData = {
				name: data.name,
				// Parent usually doesn't target specific IP unless needed
				// It serves as a container. Target 0.0.0.0/0 might capture everything if not careful with priority,
				// but for a parent queue that is only used for children, it's often fine or user can adjust.
				// BETTER: Don't set target if possible, or set a dummy target. 
				// However, Simple Queues MUST have a target. 
				// Best Practice for Parent Only: Target the subnet of the package if known, 
				// OR leave it 0.0.0.0/0 but rely on children.
				// For safety, let's use a non-matching target or the network subnet if we knew it.
				// Since we don't know the subnet, we will use '0.0.0.0/0' but we should be careful.
				// Actually, if we want it to be a pure parent, it needs to be valid.
				// Let's use the standard approach: Target = 0.0.0.0/0 is common for global parents.
				// But wait, if we target 0.0.0.0/0 it might throttle widely.
				// Alternative: The user wants to manually control "Shared" vs "Dedicated".
				// If we create it automatically, we enable Shared mode by default if we aren't careful?
				// No, syncClientQueues checks if parent exists.
				// So if we create it here, we are DEFAULTING to Shared Mode availability.

				// Let's set a safe default target that doesn't mess up others?
				// Actually, for a PARENT queue in Simple Queues, the target is often irrelevant if children capture traffic first
				// OR the parent captures the aggregate.
				// Let's stick to creating it.
				target: '0.0.0.0/0',
				maxLimit: maxLimit,
				comment: `[BILLING] PACKAGE PARENT: ${data.name} (Shared Bandwidth Container)`,
				queue: 'default/default'
			};

			if (existing) {
				console.log(`[Package] Parent Queue "${data.name}" exists, updating...`);
				await updateSimpleQueue(config, existing['.id'], queueData);
			} else {
				await createSimpleQueue(config, queueData);
			}
			console.log(`[Package] ✅ Parent Simple Queue synced.`);

		} catch (e) {
			console.error(`[Package] ⚠️ Failed to create Parent Simple Queue:`, e);
			// Don't block package creation if queue fails (e.g. connection issue)
		}


		const values = [
			data.name,
			data.parent_upload_name,
			data.parent_download_name,
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

		// Get current package data
		const currentPackage = await getStaticIpPackageById(id);
		if (!currentPackage) {
			throw new Error('Paket tidak ditemukan');
		}

		// Standardized names based on CURRENT package name (to find them)
		const oldUploadQueueName = `${currentPackage.name}_UPLOAD`;
		const oldDownloadQueueName = `${currentPackage.name}_DOWNLOAD`;


		const newPackageName = data.name || currentPackage.name;

		// REF ACTOR: Update Parent Simple Queue (for Shared Mode)
		// Instead of updating Queue Trees, we check and update the Parent Simple Queue
		try {
			console.log(`[Package] Updating Parent Simple Queue: "${newPackageName}"`);
			const { getSimpleQueues, updateSimpleQueue, createSimpleQueue, deleteSimpleQueue } = await import('./mikrotikService');

			const simpleQueues = await getSimpleQueues(config);

			// Find OLD queue (if name changed)
			const oldQueue = simpleQueues.find(q => q.name === currentPackage.name);

			// New Limits
			const maxLimit = `${(data.max_limit_upload || currentPackage.max_limit_upload) || '1M'}/${(data.max_limit_download || currentPackage.max_limit_download) || '1M'}`;

			const queueData = {
				name: newPackageName,
				maxLimit: maxLimit,
				comment: `[BILLING] PACKAGE PARENT: ${newPackageName} (Shared Bandwidth Container)`
			};

			if (oldQueue) {
				// Update existing
				await updateSimpleQueue(config, oldQueue['.id'], queueData);
				console.log(`[Package] ✅ Updated Parent Queue: ${oldQueue.name} -> ${newPackageName}`);
			} else {
				// If it didn't exist before, create it now (maybe it was deleted manually or didn't exist)
				// Only create if we think it should exist (Shared Mode support)
				console.log(`[Package] ⚠️ Parent Queue not found for "${currentPackage.name}". Creating new one for "${newPackageName}"...`);
				await createSimpleQueue(config, {
					...queueData,
					target: '0.0.0.0/0',
					queue: 'default/default'
				});
			}

		} catch (e) {
			console.warn(`[Package] Warning during Parent Queue update:`, e);
		}


		// Update package in database
		const updateFields = [];
		const updateValues = [];

		if (data.name !== undefined) {
			updateFields.push('name = ?');
			updateValues.push(data.name);
		}
		if (data.parent_upload_name !== undefined) {
			updateFields.push('parent_upload_name = ?');
			updateValues.push(data.parent_upload_name);
		}
		if (data.parent_download_name !== undefined) {
			updateFields.push('parent_download_name = ?');
			updateValues.push(data.parent_download_name);
		}
		if (data.max_limit_upload !== undefined) {
			updateFields.push('max_limit_upload = ?');
			updateValues.push(data.max_limit_upload);
		}
		if (data.max_limit_download !== undefined) {
			updateFields.push('max_limit_download = ?');
			updateValues.push(data.max_limit_download);
		}
		if (data.limit_at_upload !== undefined) { updateFields.push('limit_at_upload = ?'); updateValues.push(data.limit_at_upload); }
		if (data.limit_at_download !== undefined) { updateFields.push('limit_at_download = ?'); updateValues.push(data.limit_at_download); }
		if (data.max_clients !== undefined) {
			updateFields.push('max_clients = ?');
			updateValues.push(data.max_clients);
		}
		if (data.child_upload_name !== undefined && data.child_upload_name !== null && data.child_upload_name !== '') {
			updateFields.push('child_upload_name = ?');
			updateValues.push(data.child_upload_name);
		}
		if (data.child_download_name !== undefined && data.child_download_name !== null && data.child_download_name !== '') {
			updateFields.push('child_download_name = ?');
			updateValues.push(data.child_download_name);
		}
		if (data.child_upload_limit !== undefined && data.child_upload_limit !== null && data.child_upload_limit !== '') {
			updateFields.push('child_upload_limit = ?');
			updateValues.push(data.child_upload_limit);
		}
		if (data.child_download_limit !== undefined && data.child_download_limit !== null && data.child_download_limit !== '') {
			updateFields.push('child_download_limit = ?');
			updateValues.push(data.child_download_limit);
		}
		if (data.child_limit_at_upload !== undefined && data.child_limit_at_upload !== null && data.child_limit_at_upload !== '') {
			updateFields.push('child_limit_at_upload = ?');
			updateValues.push(data.child_limit_at_upload);
		}
		if (data.child_limit_at_download !== undefined && data.child_limit_at_download !== null && data.child_limit_at_download !== '') {
			updateFields.push('child_limit_at_download = ?');
			updateValues.push(data.child_limit_at_download);
		}
		if (data.child_burst_upload !== undefined && data.child_burst_upload !== null && data.child_burst_upload !== '') {
			updateFields.push('child_burst_upload = ?');
			updateValues.push(data.child_burst_upload);
		}
		if (data.child_burst_download !== undefined && data.child_burst_download !== null && data.child_burst_download !== '') {
			updateFields.push('child_burst_download = ?');
			updateValues.push(data.child_burst_download);
		}
		if (data.child_queue_type_download !== undefined && data.child_queue_type_download !== null && data.child_queue_type_download !== '') {
			updateFields.push('child_queue_type_download = ?');
			updateValues.push(data.child_queue_type_download);
		}
		if (data.child_queue_type_upload !== undefined && data.child_queue_type_upload !== null && data.child_queue_type_upload !== '') {
			updateFields.push('child_queue_type_upload = ?');
			updateValues.push(data.child_queue_type_upload);
		}
		if (data.child_priority_download !== undefined && data.child_priority_download !== null && data.child_priority_download !== '') {
			updateFields.push('child_priority_download = ?');
			updateValues.push(data.child_priority_download);
		}
		if (data.child_priority_upload !== undefined && data.child_priority_upload !== null && data.child_priority_upload !== '') {
			updateFields.push('child_priority_upload = ?');
			updateValues.push(data.child_priority_upload);
		}
		if (data.child_burst_threshold_download !== undefined && data.child_burst_threshold_download !== null && data.child_burst_threshold_download !== '') {
			updateFields.push('child_burst_threshold_download = ?');
			updateValues.push(data.child_burst_threshold_download);
		}
		if (data.child_burst_threshold_upload !== undefined && data.child_burst_threshold_upload !== null && data.child_burst_threshold_upload !== '') {
			updateFields.push('child_burst_threshold_upload = ?');
			updateValues.push(data.child_burst_threshold_upload);
		}
		if (data.child_burst_time_download !== undefined && data.child_burst_time_download !== null && data.child_burst_time_download !== '') {
			updateFields.push('child_burst_time_download = ?');
			updateValues.push(data.child_burst_time_download);
		}
		if (data.child_burst_time_upload !== undefined && data.child_burst_time_upload !== null && data.child_burst_time_upload !== '') {
			updateFields.push('child_burst_time_upload = ?');
			updateValues.push(data.child_burst_time_upload);
		}
		if (data.price !== undefined) {
			updateFields.push('price = ?');
			updateValues.push(data.price);
		}
		if (data.duration_days !== undefined) {
			updateFields.push('duration_days = ?');
			updateValues.push(data.duration_days);
		}
		if (data.status !== undefined) {
			updateFields.push('status = ?');
			updateValues.push(data.status);
		}
		if (data.description !== undefined && data.description !== null) {
			updateFields.push('description = ?');
			updateValues.push(data.description || null);
		}

		if (updateFields.length > 0) {
			updateFields.push('updated_at = NOW()');
			updateValues.push(id);

			await conn.execute(`
				UPDATE static_ip_packages 
				SET ${updateFields.join(', ')}
				WHERE id = ?
			`, updateValues);
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
	if (!config) {
		throw new Error('Konfigurasi MikroTik tidak ditemukan');
	}

	const packageData = await getStaticIpPackageById(packageId);
	if (!packageData) {
		throw new Error('Paket tidak ditemukan');
	}

	// REF ACTOR: Create Parent Simple Queue
	try {
		console.log(`[Package] Creating Parent Simple Queue (Manual Sync): "${packageData.name}"`);

		const { createSimpleQueue, getSimpleQueues, updateSimpleQueue } = await import('./mikrotikService');

		const maxLimit = `${(packageData.max_limit_upload || '1M')}/${(packageData.max_limit_download || '1M')}`;

		// Check if exists
		const simpleQueues = await getSimpleQueues(config);
		const existing = simpleQueues.find(q => q.name === packageData.name);

		const queueData = {
			name: packageData.name,
			target: '0.0.0.0/0',
			maxLimit: maxLimit,
			comment: `[BILLING] PACKAGE PARENT: ${packageData.name} (Shared Bandwidth Container)`,
			queue: 'default/default'
		};

		if (existing) {
			console.log(`[Package] Parent Queue "${packageData.name}" exists, updating...`);
			await updateSimpleQueue(config, existing['.id'], queueData);
		} else {
			await createSimpleQueue(config, queueData);
		}
		console.log(`[Package] ✅ Parent Simple Queue synced manually.`);

	} catch (e) {
		console.error(`[Package] ⚠️ Failed to create Parent Simple Queue:`, e);
		throw e;
	}
}

export async function deleteStaticIpPackage(id: number): Promise<void> {
	const config = await getMikrotikConfig();
	if (!config) {
		throw new Error('Konfigurasi MikroTik tidak ditemukan');
	}

	const conn = await databasePool.getConnection();
	try {
		await conn.beginTransaction();

		// Get package data
		const packageData = await getStaticIpPackageById(id);
		if (!packageData) {
			throw new Error('Paket tidak ditemukan');
		}

		// Delete upload and download queues from MikroTik (Legacy Queue Tree)
		const queueTrees = await getQueueTrees(config);
		const uploadQueueName = `${packageData.name}_UPLOAD`;
		const downloadQueueName = `${packageData.name}_DOWNLOAD`;

		const uploadQueue = queueTrees.find(qt => qt.name === uploadQueueName);
		const downloadQueue = queueTrees.find(qt => qt.name === downloadQueueName);

		if (uploadQueue) {
			console.log('Deleting upload queue:', uploadQueueName);
			await deleteQueueTree(config, uploadQueue['.id']);
		}
		if (downloadQueue) {
			console.log('Deleting download queue:', downloadQueueName);
			await deleteQueueTree(config, downloadQueue['.id']);
		}

		// REF ACTOR: Delete Parent Simple Queue (New System)
		try {
			const { getSimpleQueues, deleteSimpleQueue } = await import('./mikrotikService');
			const simpleQueues = await getSimpleQueues(config);
			const parentQueue = simpleQueues.find(q => q.name === packageData.name);

			if (parentQueue) {
				console.log(`[Package] Deleting Parent Simple Queue: "${parentQueue.name}"`);
				await deleteSimpleQueue(config, parentQueue['.id']);
			}
		} catch (e) {
			console.warn(`[Package] Warning during Parent Queue deletion:`, e);
		}

		// Delete package from database
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
	if (!config) {
		throw new Error('Konfigurasi MikroTik tidak ditemukan');
	}

	const packageData = await getStaticIpPackageById(packageId);
	if (!packageData) {
		throw new Error('Paket tidak ditemukan');
	}

	// Hapus Parent Simple Queue (New System)
	try {
		console.log(`[Package] Deleting Parent Simple Queue (Manual): "${packageData.name}"`);
		const { getSimpleQueues, deleteSimpleQueue } = await import('./mikrotikService');
		const simpleQueues = await getSimpleQueues(config);
		const parentQueue = simpleQueues.find(q => q.name === packageData.name);

		if (parentQueue) {
			await deleteSimpleQueue(config, parentQueue['.id']);
			console.log(`[Package] ✅ Parent Simple Queue deleted.`);
		} else {
			console.log(`[Package] Parent Simple Queue not found.`);
		}
	} catch (e) {
		console.error(`[Package] Error deleting Parent Simple Queue:`, e);
		throw e;
	}

}


// -- SIMPLE QUEUE IMPLEMENTATION FOR STATIC IP (Replaces Queue Tree) --

export async function syncClientQueues(customerId: number, packageId: number, ipAddress: string, clientName: string): Promise<void> {
	const config = await getMikrotikConfig();
	if (!config) throw new Error('Konfigurasi MikroTik tidak ditemukan');

	// Dynamic import to avoid circular dependencies if any
	const {
		getSimpleQueues,
		createSimpleQueue,
		updateSimpleQueue,
		deleteSimpleQueue,
		removeMangleRulesForClient
	} = await import('./mikrotikService');

	const pkg = await getStaticIpPackageById(packageId);
	if (!pkg) throw new Error('Paket tidak ditemukan');

	// Sanitize client name for MikroTik (remove spaces and special chars)
	// We want it to be readable but valid for MikroTik
	const cleanName = clientName.replace(/[^a-zA-Z0-9]/g, '_');

	// Clean IP address from CIDR if present (e.g. 192.168.1.1/30 -> 192.168.1.1)
	const cleanIp = ipAddress.split('/')[0];

	// **CRITICAL:** Remove OLD Queue Tree & Mangle rules first if they exist
	// This ensures we switch cleanly from Queue Tree to Simple Queue
	try {
		console.log(`[StaticIP] Cleaning up old Queue Tree & Mangle for ${cleanIp}...`);

		// 1. Remove Mangle Rules
		await removeMangleRulesForClient(config, {
			peerIp: cleanIp,
			downloadMark: `${cleanName}_DL_MARK`,
			uploadMark: `${cleanName}_UP_MARK`
		});

		// 2. Remove Queue Tree entries (if any exist matching this client)
		// We do this by searching for queues containing the client name
		const { getQueueTrees, deleteQueueTree } = await import('./mikrotikService');
		const queueTrees = await getQueueTrees(config);
		const oldQueues = queueTrees.filter(q => q.name.includes(cleanName) || (q['packet-mark'] && q['packet-mark'].includes(cleanIp)));

		for (const q of oldQueues) {
			await deleteQueueTree(config, q['.id']);
			console.log(`[StaticIP] Deleted old Queue Tree: ${q.name}`);
		}
	} catch (e) {
		console.warn(`[StaticIP] Warning during cleanup:`, e);
	}

	// -- CREATE SIMPLE QUEUE --
	// IMPLEMENTATION OF 2 CONCEPTS: DEDICATED & SHARED BANDWIDTH

	const simpleQueueName = clientName; // Use the actual client name provided (e.g. "MBAH TINI")

	// Check if Simple Queue already exists
	const simpleQueues = await getSimpleQueues(config);
	const existingQueue = simpleQueues.find(q => q.name === simpleQueueName || q.target === `${cleanIp}/32`);

	// Check if a "Parent Package Queue" exists (for SHARED BANDWIDTH Mode)
	// Concept: If a Simple Queue exists with the EXACT NAME of the Package, we treat it as a Parent.
	//          All clients will be children of this Parent and share its bandwidth.
	const parentPackageQueue = simpleQueues.find(q => q.name === pkg.name);

	let maxLimit = `${pkg.max_limit_upload || '1M'}/${pkg.max_limit_download || '1M'}`;
	let parentName: string | undefined = undefined;
	let limitAt: string | undefined = (pkg.child_limit_at_upload && pkg.child_limit_at_download)
		? `${pkg.child_limit_at_upload}/${pkg.child_limit_at_download}`
		: undefined;

	if (parentPackageQueue) {
		// === SHARED BANDWIDTH MODE ===
		// 10 Clients share 10Mbps (Parent)
		console.log(`[StaticIP] 👥 Detected Shared Bandwidth Mode via Parent: "${pkg.name}"`);

		parentName = pkg.name;

		// In Shared Mode, the child (client) usually has the SAME max-limit as the parent 
		// to allow them to use full bandwidth if others are idle.
		maxLimit = `${pkg.max_limit_upload || '1M'}/${pkg.max_limit_download || '1M'}`;
	} else {
		// === DEDICATED BANDWIDTH MODE ===
		// 10 Clients each get 10Mbps
		console.log(`[StaticIP] 👤 Detected Dedicated Bandwidth Mode (No Parent "${pkg.name}" found)`);

		parentName = undefined; // No parent
	}

	// Prepare Data
	const queueData = {
		name: simpleQueueName,
		target: `${cleanIp}/32`, // Specific target
		maxLimit: maxLimit,
		limitAt: limitAt,
		parent: parentName,
		comment: `[BILLING] Static IP Client: ${clientName} (${pkg.name}) [${parentName ? 'SHARED' : 'DEDICATED'}]`,
		queue: 'default-small/default-small' // standard queue type
	};

	if (existingQueue) {
		console.log(`[StaticIP] Updating existing Simple Queue: ${existingQueue.name}`);
		await updateSimpleQueue(config, existingQueue['.id'], queueData);
	} else {
		console.log(`[StaticIP] Creating new Simple Queue: ${simpleQueueName}`);
		await createSimpleQueue(config, queueData);
	}

	console.log(`[StaticIP] ✅ Successfully synced Simple Queue for ${clientName} (${cleanIp})`);
}



export async function syncAllMikrotikQueues(): Promise<void> {
	const packages = await listStaticIpPackages();
	console.log('[SyncAll] Found ' + packages.length + ' packages to sync.');

	for (const pkg of packages) {
		try {
			await createMikrotikQueues(pkg.id);
		} catch (error) {
			console.error('[SyncAll] Failed to sync package ' + pkg.name + ':', error);
			// Continue with next package
		}
	}
}
