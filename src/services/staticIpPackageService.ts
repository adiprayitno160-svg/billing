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
		const queueTrees = await getQueueTrees(config);

		// --- UPLOAD QUEUE ---
		const uploadQueueName = `${data.name}_UPLOAD`;
		const existingUploadQueue = queueTrees.find(qt => qt.name === uploadQueueName);

		if (existingUploadQueue) {
			console.log('⚠️ Upload queue already exists, updating:', uploadQueueName);
			await updateQueueTree(config, existingUploadQueue['.id'], {
				parent: data.parent_upload_name,
				maxLimit: data.max_limit_upload,
				comment: `Upload queue for package: ${data.name}`
			});
		} else {
			console.log('Creating new Upload queue:', uploadQueueName);
			await createQueueTree(config, {
				name: uploadQueueName,
				parent: data.parent_upload_name,
				maxLimit: data.max_limit_upload,
				comment: `Upload queue for package: ${data.name}`
			});
		}
		console.log('✅ Upload queue synced:', uploadQueueName);

		// --- DOWNLOAD QUEUE ---
		const downloadQueueName = `${data.name}_DOWNLOAD`;
		const existingDownloadQueue = queueTrees.find(qt => qt.name === downloadQueueName);

		if (existingDownloadQueue) {
			console.log('⚠️ Download queue already exists, updating:', downloadQueueName);
			await updateQueueTree(config, existingDownloadQueue['.id'], {
				parent: data.parent_download_name,
				maxLimit: data.max_limit_download,
				comment: `Download queue for package: ${data.name}`
			});
		} else {
			console.log('Creating new Download queue:', downloadQueueName);
			await createQueueTree(config, {
				name: downloadQueueName,
				parent: data.parent_download_name,
				maxLimit: data.max_limit_download,
				comment: `Download queue for package: ${data.name}`
			});
		}
		console.log('✅ Download queue synced:', downloadQueueName);

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

		// New names (if name changed) or same as old
		const newPackageName = data.name || currentPackage.name;
		const newUploadQueueName = `${newPackageName}_UPLOAD`;
		const newDownloadQueueName = `${newPackageName}_DOWNLOAD`;

		// Update upload & download queues in MikroTik
		const queueTrees = await getQueueTrees(config);

		// Find by OLD name
		const uploadQueue = queueTrees.find(qt => qt.name === oldUploadQueueName);
		const downloadQueue = queueTrees.find(qt => qt.name === oldDownloadQueueName);

		const newUploadLimit = data.max_limit_upload || currentPackage.max_limit_upload;
		const newDownloadLimit = data.max_limit_download || currentPackage.max_limit_download;
		const parentUpload = data.parent_upload_name || currentPackage.parent_upload_name;
		const parentDownload = data.parent_download_name || currentPackage.parent_download_name;

		if (uploadQueue) {
			console.log(`Updating Upload Queue: ${oldUploadQueueName} -> ${newUploadQueueName}`);
			await updateQueueTree(config, uploadQueue['.id'], {
				name: newUploadQueueName, // Rename if needed
				parent: parentUpload,
				maxLimit: newUploadLimit,
				comment: `Upload queue for package: ${newPackageName}`
			});
		}
		if (downloadQueue) {
			console.log(`Updating Download Queue: ${oldDownloadQueueName} -> ${newDownloadQueueName}`);
			await updateQueueTree(config, downloadQueue['.id'], {
				name: newDownloadQueueName, // Rename if needed
				parent: parentDownload,
				maxLimit: newDownloadLimit,
				comment: `Download queue for package: ${newPackageName}`
			});
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

	// Use package name directly for custom queue names
	const uploadQueueName = `${packageData.name}_UPLOAD`;
	const downloadQueueName = `${packageData.name}_DOWNLOAD`;

	console.log('Creating MikroTik queues for package:', packageData.name);
	console.log('Upload queue:', uploadQueueName, 'Parent:', packageData.parent_upload_name);
	console.log('Download queue:', downloadQueueName, 'Parent:', packageData.parent_download_name);

	try {
		// Create upload queue
		await createQueueTree(config, {
			name: uploadQueueName,
			parent: packageData.parent_upload_name,
			maxLimit: packageData.max_limit_upload,
			comment: `Upload queue for package: ${packageData.name}`
		});

		// Create download queue  
		await createQueueTree(config, {
			name: downloadQueueName,
			parent: packageData.parent_download_name,
			maxLimit: packageData.max_limit_download,
			comment: `Download queue for package: ${packageData.name}`
		});

		console.log('MikroTik queues created successfully');
	} catch (error: any) {
		console.error('Error creating MikroTik queues:', error);
		throw error;
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

		// Delete upload and download queues from MikroTik
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

	// Hapus kedua queue tanpa menyentuh database paket
	const queueTrees = await getQueueTrees(config);
	const uploadQueueName = `${packageData.name}_UPLOAD`;
	const downloadQueueName = `${packageData.name}_DOWNLOAD`;

	const uploadQueue = queueTrees.find(qt => qt.name === uploadQueueName);
	const downloadQueue = queueTrees.find(qt => qt.name === downloadQueueName);

	if (!uploadQueue && !downloadQueue) {
		return;
	}

	if (uploadQueue) {
		await deleteQueueTree(config, uploadQueue['.id']);
	}
	if (downloadQueue) {
		await deleteQueueTree(config, downloadQueue['.id']);
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
	// We use a single Simple Queue for both Upload/Download or with Parent if needed.
	// Ideally for Static IP individual clients, a Simple Queue targeting their IP is best.

	const simpleQueueName = clientName; // Use the actual client name provided (e.g. "MBAH TINI")

	// Check if Simple Queue already exists
	const simpleQueues = await getSimpleQueues(config);
	const existingQueue = simpleQueues.find(q => q.name === simpleQueueName || q.target === `${cleanIp}/32`);

	// Construct Max Limit string (Upload/Download)
	// Format: upload/download (e.g. "5M/10M")
	const maxLimit = `${pkg.max_limit_upload || '1M'}/${pkg.max_limit_download || '1M'}`;

	// Construct Limit At (Guaranteed) string (optional)
	const limitAt = (pkg.limit_at_upload && pkg.limit_at_download)
		? `${pkg.limit_at_upload}/${pkg.limit_at_download}`
		: undefined;

	// Determine Parent (if configured in package)
	// Note: Simple Queue parents must also be Simple Queues. 
	// If your "Total Download" is a Simple Queue, this works. If it's a Queue Tree, it WON'T work directly.
	// For now, we will SKIP parent for Simple Queue unless explicitly requested, 
	// to ensure the limit actually works on the client IP first.
	// Use proper "parent" field if you setup a global Simple Queue parent.
	const parent = undefined;

	// Prepare Data
	const queueData = {
		name: simpleQueueName,
		target: `${cleanIp}/32`, // Specific target
		maxLimit: maxLimit,
		limitAt: limitAt,
		parent: parent,
		comment: `[BILLING] Static IP Client: ${clientName} (${pkg.name})`,
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


