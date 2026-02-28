import { databasePool } from '../db/pool';
import { StaticIpClient } from './staticIpPackageService';
import { CustomerIdGenerator } from '../utils/customerIdGenerator';
import { getMikrotikConfig } from '../utils/mikrotikConfigHelper';

export type StaticIpClientWithPackage = StaticIpClient & {
    package_name: string;
};

// Fungsi untuk mengecek apakah paket sudah penuh
export async function isPackageFull(packageId: number): Promise<boolean> {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.execute(`
			SELECT 
				sip.max_clients,
				COUNT(sic.id) as current_clients
			FROM static_ip_packages sip
			LEFT JOIN static_ip_clients sic ON sip.id = sic.package_id AND sic.status = 'active'
			WHERE sip.id = ?
			GROUP BY sip.id
		`, [packageId]);

        const result = Array.isArray(rows) ? rows[0] as any : null;
        if (!result) return true;

        return result.current_clients >= result.max_clients;
    } finally {
        conn.release();
    }
}

// Fungsi untuk menambahkan client ke paket
export async function addClientToPackage(packageId: number, clientData: {
    client_name: string;
    ip_address: string; // CIDR or IP
    customer_id?: number | null;
    network?: string | null;
    interface?: string | null;
    address?: string | null;
    phone_number?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    olt_id?: number | null;
    odc_id?: number | null;
    odp_id?: number | null;
    customer_code?: string | null;
    is_taxable?: number | null;
    use_device_rental?: number | null;
    serial_number?: string | null;
    billing_mode?: string | null;
}): Promise<{ customerId: number, clientId: number }> {
    const conn = await databasePool.getConnection();
    try {
        // Cek apakah paket penuh
        const isFull = await isPackageFull(packageId);
        if (isFull) {
            throw new Error('Paket sudah penuh, tidak bisa menambah client baru');
        }

        // Cek apakah IP sudah digunakan
        const [existingIp] = await conn.execute(
            'SELECT id FROM static_ip_clients WHERE ip_address = ? AND status = "active"',
            [clientData.ip_address]
        );

        if (Array.isArray(existingIp) && existingIp.length > 0) {
            throw new Error('IP address sudah digunakan oleh client lain');
        }

        await conn.beginTransaction();

        // Generate customer code
        const customerCode = clientData.customer_code || CustomerIdGenerator.generateCustomerId();
        let customerId = clientData.customer_id;

        if (!customerId) {
            // Insert ke tabel customers terlebih dahulu
            const [customerResult] = await conn.execute(`
                INSERT INTO customers (
                    customer_code, name, phone, email, address, odc_id, odp_id,
                    connection_type, status, latitude, longitude,
                    created_at, updated_at,
                    is_taxable, use_device_rental, serial_number, billing_mode
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'static_ip', 'active', ?, ?, NOW(), NOW(), ?, ?, ?, ?)
            `, [
                customerCode,
                clientData.client_name,
                clientData.phone_number || null,
                null, // email
                clientData.address || null,
                clientData.odc_id || null,
                clientData.odp_id || null,
                clientData.latitude || null,
                clientData.longitude || null,
                clientData.is_taxable || 0,
                clientData.use_device_rental || 0,
                clientData.serial_number || null,
                clientData.billing_mode || 'postpaid'
            ]);

            customerId = (customerResult as any).insertId;
        } else {
            console.log('Using EXISTING customer with ID:', customerId);
            await conn.execute(`
                UPDATE customers SET connection_type = 'static_ip', status = 'active', updated_at = NOW() 
                WHERE id = ?
            `, [customerId]);
        }
        console.log('Customer resolved with ID:', customerId);

        // 3. Get Package Details
        const [packageRows] = await conn.execute(
            'SELECT id, name, price, duration_days FROM static_ip_packages WHERE id = ?',
            [packageId]
        );
        const pkg = (packageRows as any)[0];
        if (!pkg) throw new Error('Paket tidak ditemukan');

        // 4. Create Current Subscription
        const registrationDate = new Date();
        const startDate = registrationDate.toISOString().slice(0, 10);
        let endDateStr = null;

        if (clientData.billing_mode === 'prepaid') {
            const endDate = new Date(registrationDate);
            endDate.setDate(endDate.getDate() + (pkg.duration_days || 30));
            endDateStr = endDate.toISOString().slice(0, 10);
        }

        await conn.execute(`
            INSERT INTO subscriptions (
                customer_id, package_id, package_name, price, 
                start_date, end_date, status, created_at, updated_at,
                is_activated, activation_date, next_block_date
            ) VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW(), 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 MONTH))
        `, [
            customerId,
            pkg.id,
            pkg.name,
            pkg.price,
            startDate,
            endDateStr
        ]);

        const [result] = await conn.execute(`
            INSERT INTO static_ip_clients (package_id, client_name, ip_address, network, interface, customer_id, address, phone_number, latitude, longitude, olt_id, odc_id, odp_id, customer_code, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [
            packageId,
            clientData.client_name,
            clientData.ip_address,
            clientData.network ?? null,
            clientData.interface ?? null,
            customerId, // Use the new customer ID
            clientData.address ?? null,
            clientData.phone_number ?? null,
            clientData.latitude ?? null,
            clientData.longitude ?? null,
            clientData.olt_id ?? null,
            clientData.odc_id ?? null,
            clientData.odp_id ?? null,
            customerCode
        ]);

        await conn.commit();
        const insertResult = result as any;
        return { customerId, clientId: insertResult.insertId };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Fungsi untuk menghapus client dari paket
export async function removeClientFromPackage(clientId: number): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Dapatkan customer_id sebelum menghapus client
        const [clientRows] = await conn.execute(
            'SELECT customer_id FROM static_ip_clients WHERE id = ?',
            [clientId]
        );
        const client = (clientRows as any[])[0];

        if (client) {
            const customerId = client.customer_id;

            // 2. Hapus dari tabel static_ip_clients
            await conn.execute(
                'DELETE FROM static_ip_clients WHERE id = ?',
                [clientId]
            );

            // 3. Hapus dari tabel customers jika ada
            if (customerId) {
                await conn.execute(
                    'DELETE FROM customers WHERE id = ?',
                    [customerId]
                );
            }
        }

        await conn.commit();
        console.log(`Client (ID: ${clientId}) and associated customer deleted successfully.`);
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Fungsi untuk mengganti paket IP statis pelanggan
export async function changeCustomerStaticIpPackage(customerId: number, newPackageId: number): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        await conn.beginTransaction();

        // Dapatkan data client lama
        const [oldClientRows] = await conn.execute(
            `SELECT sic.*, c.connection_type, c.is_active 
             FROM static_ip_clients sic 
             LEFT JOIN customers c ON c.id = sic.customer_id 
             WHERE sic.customer_id = ?`,
            [customerId]
        );

        if (!Array.isArray(oldClientRows) || oldClientRows.length === 0) {
            throw new Error('Client tidak ditemukan');
        }

        const oldClient = oldClientRows[0] as any;

        // Dapatkan data paket lama dan baru
        const [oldPackageRows] = await conn.execute(
            'SELECT * FROM static_ip_packages WHERE id = ?',
            [oldClient.package_id]
        );

        const [newPackageRows] = await conn.execute(
            'SELECT * FROM static_ip_packages WHERE id = ?',
            [newPackageId]
        );

        if (!Array.isArray(oldPackageRows) || oldPackageRows.length === 0) {
            throw new Error('Paket lama tidak ditemukan');
        }

        if (!Array.isArray(newPackageRows) || newPackageRows.length === 0) {
            throw new Error('Paket baru tidak ditemukan');
        }

        const oldPackage = oldPackageRows[0];
        const newPackage = newPackageRows[0];

        // Validasi bahwa paket baru tidak penuh
        const [currentClientsRows] = await conn.execute(
            `SELECT COUNT(*) as count FROM static_ip_clients 
             WHERE package_id = ? AND status = 'active'`,
            [newPackageId]
        );

        const currentClients = (currentClientsRows as any[])[0].count;
        if (currentClients >= (newPackage as any).max_clients) {
            throw new Error('Paket tujuan sudah penuh');
        }

        // Update paket di database
        await conn.execute(
            'UPDATE static_ip_clients SET package_id = ? WHERE customer_id = ?',
            [newPackageId, customerId]
        );

        // Jika customer aktif, update MikroTik juga
        if (oldClient.is_active) {
            // Dapatkan konfigurasi MikroTik
            const mikrotikConfig = await getMikrotikConfig();
            if (mikrotikConfig) {
                // Hapus konfigurasi lama dari MikroTik
                await removeOldStaticIpConfiguration(mikrotikConfig, oldClient, oldPackage);

                // Buat konfigurasi baru sesuai paket baru
                await createNewStaticIpConfiguration(mikrotikConfig, oldClient, newPackage);
            }
        }

        await conn.commit();
        console.log(`Customer ${customerId} moved from package ${oldClient.package_id} to ${newPackageId}`);
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

// Helper function untuk menghapus konfigurasi lama dari MikroTik
async function removeOldStaticIpConfiguration(config: any, client: any, packageData: any) {
    const mikrotikService = await import('./mikrotikService');

    // Hapus IP address lama
    if (client.ip_address) {
        await mikrotikService.removeIpAddress(config, client.ip_address);
    }

    // Hapus mangle rules lama
    const ipToInt = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
    const intToIp = (int: number) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
    const [ipOnlyRaw, prefixStrRaw] = String(client.ip_address || '').split('/');
    const ipOnly: string = ipOnlyRaw || '';
    const prefix: number = Number(prefixStrRaw || '0');
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
    let peerIp = ipOnly;
    if (prefix === 30) {
        const firstHost = networkInt + 1;
        const secondHost = networkInt + 2;
        const ipInt = ipOnly ? ipToInt(ipOnly) : firstHost;
        peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
    }
    const downloadMark: string = peerIp;
    const uploadMark: string = `UP-${peerIp}`;
    await mikrotikService.removeMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });

    // Hapus queue lama
    await mikrotikService.deleteClientQueuesByClientName(config, client.client_name);
}

// Helper function untuk membuat konfigurasi baru di MikroTik
async function createNewStaticIpConfiguration(config: any, client: any, newPackage: any) {
    const mikrotikService = await import('./mikrotikService');

    // Tambahkan IP address baru
    if (client.interface) {
        await mikrotikService.addIpAddress(config, {
            interface: client.interface,
            address: client.ip_address,
            comment: client.client_name
        });
    }

    // Hitung peer dan marks
    const ipToInt = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
    const intToIp = (int: number) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
    const [ipOnlyRaw, prefixStrRaw] = String(client.ip_address || '').split('/');
    const ipOnly: string = ipOnlyRaw || '';
    const prefix: number = Number(prefixStrRaw || '0');
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
    let peerIp = ipOnly;
    if (prefix === 30) {
        const firstHost = networkInt + 1;
        const secondHost = networkInt + 2;
        const ipInt = ipOnly ? ipToInt(ipOnly) : firstHost;
        peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
    }
    const downloadMark: string = peerIp;
    const uploadMark: string = `UP-${peerIp}`;
    await mikrotikService.addMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });

    // Dapatkan limit baru
    const mlDownload = newPackage.child_download_limit || newPackage.shared_download_limit || newPackage.max_limit_download;
    const mlUpload = newPackage.child_upload_limit || newPackage.shared_upload_limit || newPackage.max_limit_upload;

    const packageDownloadQueue = newPackage.name;
    const packageUploadQueue = `UP-${newPackage.name}`;

    // Buat parent queue jika belum ada
    const ensureParentQueue = async (parentName: string, direction: 'upload' | 'download') => {
        let pId = await mikrotikService.findQueueTreeIdByName(config, parentName);
        if (!pId) {
            console.log(`Parent queue "${parentName}" not found. Auto-creating...`);
            const parentData = {
                name: parentName,
                parent: 'global',
                queue: 'default',
                maxLimit: direction === 'download' ? newPackage.max_limit_download : newPackage.max_limit_upload,
                comment: `Auto-created Parent for ${newPackage.name} (${direction})`
            };
            await mikrotikService.createQueueTree(config, parentData);
            console.log(`Parent queue "${parentName}" created.`);
        }
    };

    await ensureParentQueue(packageDownloadQueue, 'download');
    await ensureParentQueue(packageUploadQueue, 'upload');

    // Buat queue download
    const queueDownData = {
        name: client.client_name,
        parent: packageDownloadQueue,
        packetMarks: downloadMark,
        maxLimit: mlDownload,
        limitAt: newPackage.child_limit_at_download || undefined,
        burstLimit: newPackage.child_burst_download || undefined,
        burstThreshold: newPackage.child_burst_threshold_download || undefined,
        burstTime: newPackage.child_burst_time_download || undefined,
        queue: newPackage.child_queue_type_download || 'pcq',
        priority: newPackage.child_priority_download || '8',
        comment: `Download for ${client.client_name}`
    };

    await mikrotikService.createQueueTree(config, queueDownData);

    // Buat queue upload
    const queueUpData = {
        name: `UP-${client.client_name}`,
        parent: packageUploadQueue,
        packetMarks: uploadMark,
        maxLimit: mlUpload,
        limitAt: newPackage.child_limit_at_upload || undefined,
        burstLimit: newPackage.child_burst_upload || undefined,
        burstThreshold: newPackage.child_burst_threshold_upload || undefined,
        burstTime: newPackage.child_burst_time_upload || undefined,
        queue: newPackage.child_queue_type_upload || 'pcq',
        priority: newPackage.child_priority_upload || '8',
        comment: `Upload for ${client.client_name}`
    };

    await mikrotikService.createQueueTree(config, queueUpData);
}

// Fungsi untuk mendapatkan daftar client dalam paket
export async function getPackageClients(packageId: number): Promise<StaticIpClient[]> {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.execute(`
			SELECT * FROM static_ip_clients 
			WHERE package_id = ? AND status = 'active'
			ORDER BY created_at DESC
		`, [packageId]);
        return Array.isArray(rows) ? rows as StaticIpClient[] : [];
    } finally {
        conn.release();
    }
}

export async function getClientById(clientId: number): Promise<StaticIpClient | null> {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.execute(`
            SELECT 
                sic.*,
                olt.name as olt_name,
                odc.name as odc_name,
                odp.name as odp_name
            FROM static_ip_clients sic
            LEFT JOIN ftth_olt olt ON sic.olt_id = olt.id
            LEFT JOIN ftth_odc odc ON sic.odc_id = odc.id
            LEFT JOIN ftth_odp odp ON sic.odp_id = odp.id
            WHERE sic.id = ? LIMIT 1
        `, [clientId]);
        const list = Array.isArray(rows) ? rows as any[] : [];
        return list.length ? (list[0] as StaticIpClient) : null;
    } finally {
        conn.release();
    }
}

export async function getStaticIpClientByCustomerId(customerId: number | string): Promise<StaticIpClient | null> {
    const conn = await databasePool.getConnection();
    try {
        // Simplified Query (No JOINs) to prevent lookup failure on bad related data
        const [rows] = await conn.execute(`
            SELECT sic.* 
            FROM static_ip_clients sic
            WHERE sic.customer_id = ? 
            LIMIT 1
        `, [customerId]);

        const list = Array.isArray(rows) ? rows as any[] : [];
        return list.length ? (list[0] as StaticIpClient) : null;
    } finally {
        conn.release();
    }
}

export async function updateClient(clientId: number, data: {
    client_name?: string;
    package_id?: number;
    ip_address?: string;
    network?: string | null;
    interface?: string | null;
    customer_id?: number | null;
    status?: 'active' | 'inactive';
    address?: string | null;
    phone_number?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    olt_id?: number | null;
    odc_id?: number | null;
    odp_id?: number | null;
}): Promise<void> {
    const conn = await databasePool.getConnection();
    try {
        const fields: string[] = [];
        const values: any[] = [];
        if (data.client_name !== undefined) { fields.push('client_name = ?'); values.push(data.client_name); }
        if (data.package_id !== undefined) { fields.push('package_id = ?'); values.push(data.package_id); }
        if (data.ip_address !== undefined) { fields.push('ip_address = ?'); values.push(data.ip_address); }
        if (data.network !== undefined) { fields.push('network = ?'); values.push(data.network); }
        if (data.interface !== undefined) { fields.push('interface = ?'); values.push(data.interface); }
        if (data.customer_id !== undefined) { fields.push('customer_id = ?'); values.push(data.customer_id); }
        if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
        if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address); }
        if (data.phone_number !== undefined) { fields.push('phone_number = ?'); values.push(data.phone_number); }
        if (data.latitude !== undefined) { fields.push('latitude = ?'); values.push(data.latitude); }
        if (data.longitude !== undefined) { fields.push('longitude = ?'); values.push(data.longitude); }
        if (data.olt_id !== undefined) { fields.push('olt_id = ?'); values.push(data.olt_id); }
        if (data.odc_id !== undefined) { fields.push('odc_id = ?'); values.push(data.odc_id); }
        if (data.odp_id !== undefined) { fields.push('odp_id = ?'); values.push(data.odp_id); }
        if (fields.length === 0) return;
        values.push(clientId);
        await conn.execute(`UPDATE static_ip_clients SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
    } finally {
        conn.release();
    }
}

// Fungsi untuk menghitung shared limit per client
export function calculateSharedLimit(maxLimit: string, maxClients: number): string {
    if (maxClients <= 1) return maxLimit;

    // Extract numeric value from limit (e.g., "10M" -> 10)
    const numericValue = parseInt(maxLimit.replace(/[^0-9]/g, ''));
    const unit = maxLimit.replace(/[0-9]/g, '');

    if (isNaN(numericValue)) return maxLimit;

    const sharedValue = Math.floor(numericValue / maxClients);
    return `${sharedValue}${unit}`;
}

// Fungsi untuk mendapatkan semua client aktif lintas semua paket
export async function getAllStaticIpClients(): Promise<StaticIpClientWithPackage[]> {
    const conn = await databasePool.getConnection();
    try {
        const [rows] = await conn.execute(`
            SELECT 
                sic.id,
                sic.package_id,
                sic.client_name,
                sic.ip_address,
                sic.status,
                sic.created_at,
                sic.updated_at,
                sip.name AS package_name
            FROM static_ip_clients sic
            INNER JOIN static_ip_packages sip ON sip.id = sic.package_id
            WHERE sic.status = 'active'
            ORDER BY sic.created_at DESC
        `);
        return Array.isArray(rows) ? rows as StaticIpClientWithPackage[] : [];
    } finally {
        conn.release();
    }
}

