import { databasePool } from '../db/pool';
import { createQueueTree, updateQueueTree, deleteQueueTree, getQueueTrees, MikroTikConfig } from './mikrotikService';

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
        
        // Create upload queue with custom name
        const uploadQueueName = `UP-${data.name}`;
        await createQueueTree(config, {
            name: uploadQueueName,
            parent: data.parent_upload_name,
            maxLimit: data.max_limit_upload
        });
        console.log('✅ Upload queue created:', uploadQueueName);
        
        // Create download queue with custom name
        const downloadQueueName = data.name;
        await createQueueTree(config, {
            name: downloadQueueName,
            parent: data.parent_download_name,
            maxLimit: data.max_limit_download
        });
        console.log('✅ Download queue created:', downloadQueueName);
		
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
		
        // Determine names
        const safeName = (data.name ?? currentPackage.name).replace(/[^a-zA-Z0-9]/g, '_');
        const uploadQueueName = `${safeName}UP-`;
        const downloadQueueName = safeName;

        // Use parent names directly if provided
        const parentUpload = data.parent_upload_name;
        const parentDownload = data.parent_download_name;

        // Update upload & download queues
        const queueTrees = await getQueueTrees(config);
        const uploadQueue = queueTrees.find(qt => qt.name === uploadQueueName);
        const downloadQueue = queueTrees.find(qt => qt.name === downloadQueueName);
        const newUploadLimit = data.max_limit_upload || currentPackage.max_limit_upload;
        const newDownloadLimit = data.max_limit_download || currentPackage.max_limit_download;

        if (uploadQueue) {
            await updateQueueTree(config, uploadQueue['.id'], {
                ...(parentUpload ? { parent: parentUpload } : {}),
                maxLimit: newUploadLimit,
                comment: `Upload queue for package: ${data.name || currentPackage.name}`
            });
        }
        if (downloadQueue) {
            await updateQueueTree(config, downloadQueue['.id'], {
                ...(parentDownload ? { parent: parentDownload } : {}),
                maxLimit: newDownloadLimit,
                comment: `Download queue for package: ${data.name || currentPackage.name}`
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
		if (data.child_upload_name !== undefined) {
			updateFields.push('child_upload_name = ?');
			updateValues.push(data.child_upload_name);
		}
		if (data.child_download_name !== undefined) {
			updateFields.push('child_download_name = ?');
			updateValues.push(data.child_download_name);
		}
		if (data.child_upload_limit !== undefined) {
			updateFields.push('child_upload_limit = ?');
			updateValues.push(data.child_upload_limit);
		}
		if (data.child_download_limit !== undefined) {
			updateFields.push('child_download_limit = ?');
			updateValues.push(data.child_download_limit);
		}
		if (data.child_limit_at_upload !== undefined) {
			updateFields.push('child_limit_at_upload = ?');
			updateValues.push(data.child_limit_at_upload);
		}
		if (data.child_limit_at_download !== undefined) {
			updateFields.push('child_limit_at_download = ?');
			updateValues.push(data.child_limit_at_download);
		}
		if (data.child_burst_upload !== undefined) {
			updateFields.push('child_burst_upload = ?');
			updateValues.push(data.child_burst_upload);
		}
		if (data.child_burst_download !== undefined) {
			updateFields.push('child_burst_download = ?');
			updateValues.push(data.child_burst_download);
		}
		if (data.child_queue_type_download !== undefined) { updateFields.push('child_queue_type_download = ?'); updateValues.push(data.child_queue_type_download); }
		if (data.child_queue_type_upload !== undefined) { updateFields.push('child_queue_type_upload = ?'); updateValues.push(data.child_queue_type_upload); }
		if (data.child_priority_download !== undefined) { updateFields.push('child_priority_download = ?'); updateValues.push(data.child_priority_download); }
		if (data.child_priority_upload !== undefined) { updateFields.push('child_priority_upload = ?'); updateValues.push(data.child_priority_upload); }
		if (data.child_burst_threshold_download !== undefined) { updateFields.push('child_burst_threshold_download = ?'); updateValues.push(data.child_burst_threshold_download); }
		if (data.child_burst_threshold_upload !== undefined) { updateFields.push('child_burst_threshold_upload = ?'); updateValues.push(data.child_burst_threshold_upload); }
		if (data.child_burst_time_download !== undefined) { updateFields.push('child_burst_time_download = ?'); updateValues.push(data.child_burst_time_download); }
		if (data.child_burst_time_upload !== undefined) { updateFields.push('child_burst_time_upload = ?'); updateValues.push(data.child_burst_time_upload); }
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
		if (data.description !== undefined) {
			updateFields.push('description = ?');
			updateValues.push(data.description);
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
