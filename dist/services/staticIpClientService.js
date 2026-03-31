"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPackageFull = isPackageFull;
exports.addClientToPackage = addClientToPackage;
exports.removeClientFromPackage = removeClientFromPackage;
exports.changeCustomerStaticIpPackage = changeCustomerStaticIpPackage;
exports.getPackageClients = getPackageClients;
exports.getClientById = getClientById;
exports.getStaticIpClientByCustomerId = getStaticIpClientByCustomerId;
exports.updateClient = updateClient;
exports.calculateSharedLimit = calculateSharedLimit;
exports.getAllStaticIpClients = getAllStaticIpClients;
const pool_1 = require("../db/pool");
const customerIdGenerator_1 = require("../utils/customerIdGenerator");
const mikrotikConfigHelper_1 = require("../utils/mikrotikConfigHelper");
// Fungsi untuk mengecek apakah paket sudah penuh
async function isPackageFull(packageId) {
    const conn = await pool_1.databasePool.getConnection();
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
        const result = Array.isArray(rows) ? rows[0] : null;
        if (!result)
            return true;
        return result.current_clients >= result.max_clients;
    }
    finally {
        conn.release();
    }
}
// Fungsi untuk menambahkan client ke paket
async function addClientToPackage(packageId, clientData) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        // Cek apakah paket penuh
        const isFull = await isPackageFull(packageId);
        if (isFull) {
            throw new Error('Paket sudah penuh, tidak bisa menambah client baru');
        }
        // Cek apakah IP sudah digunakan
        const [existingIp] = await conn.execute('SELECT id FROM static_ip_clients WHERE ip_address = ? AND status = "active"', [clientData.ip_address]);
        if (Array.isArray(existingIp) && existingIp.length > 0) {
            throw new Error('IP address sudah digunakan oleh client lain');
        }
        await conn.beginTransaction();
        // Generate customer code
        const customerCode = clientData.customer_code || customerIdGenerator_1.CustomerIdGenerator.generateCustomerId();
        let customerId = clientData.customer_id;
        if (!customerId) {
            // Pelanggan baru: Jika prepaid, status awal 'inactive' agar tidak langsung internetan
            const initialStatus = clientData.billing_mode === 'prepaid' ? 'inactive' : 'active';
            const initialIsolated = clientData.billing_mode === 'prepaid' ? 1 : 0;
            // Insert ke tabel customers terlebih dahulu
            const [customerResult] = await conn.execute(`
                INSERT INTO customers (
                    customer_code, name, phone, email, address, odc_id, odp_id,
                    connection_type, status, is_isolated, latitude, longitude,
                    created_at, updated_at,
                    is_taxable, use_device_rental, serial_number, billing_mode,
                    activation_date, custom_payment_deadline
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'static_ip', ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?)
            `, [
                customerCode,
                clientData.client_name,
                clientData.phone_number || null,
                null, // email
                clientData.address || null,
                clientData.odc_id || null,
                clientData.odp_id || null,
                initialStatus,
                initialIsolated,
                clientData.latitude || null,
                clientData.longitude || null,
                clientData.is_taxable || 0,
                clientData.use_device_rental || 0,
                clientData.serial_number || null,
                clientData.billing_mode || 'postpaid',
                clientData.activation_date || new Date().toISOString().split('T')[0],
                clientData.custom_payment_deadline || null
            ]);
            customerId = customerResult.insertId;
        }
        else {
            console.log('Using EXISTING customer with ID:', customerId);
            // Untuk existing customer yang jadi prepaid, pastikan status diupdate
            const updateStatus = clientData.billing_mode === 'prepaid' ? 'inactive' : 'active';
            const updateIsolated = clientData.billing_mode === 'prepaid' ? 1 : 0;
            await conn.execute(`
                UPDATE customers SET connection_type = 'static_ip', status = ?, is_isolated = ?, updated_at = NOW() 
                WHERE id = ?
            `, [updateStatus, updateIsolated, customerId]);
        }
        console.log('Customer resolved with ID:', customerId);
        // 3. Get Package Details
        const [packageRows] = await conn.execute('SELECT id, name, price, duration_days FROM static_ip_packages WHERE id = ?', [packageId]);
        const pkg = packageRows[0];
        if (!pkg)
            throw new Error('Paket tidak ditemukan');
        // 4. Create Initial Subscription (Prepaid starts as 'inactive' until paid)
        const registrationDate = new Date();
        const startDate = registrationDate.toISOString().slice(0, 10);
        let endDateStr = null;
        let subStatus = 'active';
        if (clientData.billing_mode === 'prepaid') {
            subStatus = 'inactive'; // Menunggu pembayaran pertama
            // Jangan beri masa aktif dulu sampai bayar
        }
        else {
            // Postpaid atau jika sudah ada logic expiry default
        }
        await conn.execute(`
            INSERT INTO subscriptions (
                customer_id, package_id, package_name, price, 
                start_date, end_date, status, created_at, updated_at,
                is_activated, activation_date, next_block_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 0, NULL, NULL)
        `, [
            customerId,
            pkg.id,
            pkg.name,
            pkg.price,
            startDate,
            endDateStr,
            subStatus
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
        // NOTIFIKASI WHATSAPP UNTUK PREPAID
        if (clientData.billing_mode === 'prepaid' && clientData.phone_number) {
            try {
                const { whatsappService } = await Promise.resolve().then(() => __importStar(require('./whatsapp/WhatsAppService')));
                const message = `Halo *${clientData.client_name}*,\n\nSelamat datang di layanan internet kami! Akun Anda telah berhasil didaftarkan sebagai pelanggan *Prabayar*.\n\nStatus saat ini: *Menunggu Pembayaran*\n\nSilakan pilih paket internet Anda melalui Bot ini dengan mengetik *MENU* atau *BELI* untuk memulai aktivasi layanan.\n\nTerima kasih.`;
                await whatsappService.sendMessage(clientData.phone_number, message);
            }
            catch (waErr) {
                console.error('Gagal mengirim notifikasi pendaftaran prepaid:', waErr);
            }
        }
        const insertResult = result;
        return { customerId, clientId: insertResult.insertId };
    }
    catch (error) {
        await conn.rollback();
        throw error;
    }
    finally {
        conn.release();
    }
}
// Fungsi untuk menghapus client dari paket
async function removeClientFromPackage(clientId) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        await conn.beginTransaction();
        // 1. Dapatkan customer_id sebelum menghapus client
        const [clientRows] = await conn.execute('SELECT customer_id FROM static_ip_clients WHERE id = ?', [clientId]);
        const client = clientRows[0];
        if (client) {
            const customerId = client.customer_id;
            // 2. Hapus dari tabel static_ip_clients
            await conn.execute('DELETE FROM static_ip_clients WHERE id = ?', [clientId]);
            // 3. Hapus dari tabel customers jika ada
            if (customerId) {
                await conn.execute('DELETE FROM customers WHERE id = ?', [customerId]);
            }
        }
        await conn.commit();
        console.log(`Client (ID: ${clientId}) and associated customer deleted successfully.`);
    }
    catch (error) {
        await conn.rollback();
        throw error;
    }
    finally {
        conn.release();
    }
}
// Fungsi untuk mengganti paket IP statis pelanggan
async function changeCustomerStaticIpPackage(customerId, newPackageId) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        await conn.beginTransaction();
        // Dapatkan data client lama
        const [oldClientRows] = await conn.execute(`SELECT sic.*, c.connection_type, c.is_active 
             FROM static_ip_clients sic 
             LEFT JOIN customers c ON c.id = sic.customer_id 
             WHERE sic.customer_id = ?`, [customerId]);
        if (!Array.isArray(oldClientRows) || oldClientRows.length === 0) {
            throw new Error('Client tidak ditemukan');
        }
        const oldClient = oldClientRows[0];
        // Dapatkan data paket lama dan baru
        const [oldPackageRows] = await conn.execute('SELECT * FROM static_ip_packages WHERE id = ?', [oldClient.package_id]);
        const [newPackageRows] = await conn.execute('SELECT * FROM static_ip_packages WHERE id = ?', [newPackageId]);
        if (!Array.isArray(oldPackageRows) || oldPackageRows.length === 0) {
            throw new Error('Paket lama tidak ditemukan');
        }
        if (!Array.isArray(newPackageRows) || newPackageRows.length === 0) {
            throw new Error('Paket baru tidak ditemukan');
        }
        const oldPackage = oldPackageRows[0];
        const newPackage = newPackageRows[0];
        // Validasi bahwa paket baru tidak penuh
        const [currentClientsRows] = await conn.execute(`SELECT COUNT(*) as count FROM static_ip_clients 
             WHERE package_id = ? AND status = 'active'`, [newPackageId]);
        const currentClients = currentClientsRows[0].count;
        if (currentClients >= newPackage.max_clients) {
            throw new Error('Paket tujuan sudah penuh');
        }
        // Update paket di database
        await conn.execute('UPDATE static_ip_clients SET package_id = ? WHERE customer_id = ?', [newPackageId, customerId]);
        // Jika customer aktif, update MikroTik juga
        if (oldClient.is_active) {
            // Dapatkan konfigurasi MikroTik
            const mikrotikConfig = await (0, mikrotikConfigHelper_1.getMikrotikConfig)();
            if (mikrotikConfig) {
                // Hapus konfigurasi lama dari MikroTik
                await removeOldStaticIpConfiguration(mikrotikConfig, oldClient, oldPackage);
                // Buat konfigurasi baru sesuai paket baru
                await createNewStaticIpConfiguration(mikrotikConfig, oldClient, newPackage);
            }
        }
        await conn.commit();
        console.log(`Customer ${customerId} moved from package ${oldClient.package_id} to ${newPackageId}`);
    }
    catch (error) {
        await conn.rollback();
        throw error;
    }
    finally {
        conn.release();
    }
}
// Helper function untuk menghapus konfigurasi lama dari MikroTik
async function removeOldStaticIpConfiguration(config, client, packageData) {
    const mikrotikService = await Promise.resolve().then(() => __importStar(require('./mikrotikService')));
    // Hapus IP address lama
    if (client.ip_address) {
        await mikrotikService.removeIpAddress(config, client.ip_address);
    }
    // Hapus mangle rules lama
    const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
    const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
    const [ipOnlyRaw, prefixStrRaw] = String(client.ip_address || '').split('/');
    const ipOnly = ipOnlyRaw || '';
    const prefix = Number(prefixStrRaw || '0');
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
    let peerIp = ipOnly;
    if (prefix === 30) {
        const firstHost = networkInt + 1;
        const secondHost = networkInt + 2;
        const ipInt = ipOnly ? ipToInt(ipOnly) : firstHost;
        peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
    }
    const downloadMark = peerIp;
    const uploadMark = `UP-${peerIp}`;
    await mikrotikService.removeMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });
    // Hapus queue lama
    await mikrotikService.deleteClientQueuesByClientName(config, client.client_name);
}
// Helper function untuk membuat konfigurasi baru di MikroTik
async function createNewStaticIpConfiguration(config, client, newPackage) {
    const mikrotikService = await Promise.resolve().then(() => __importStar(require('./mikrotikService')));
    // Tambahkan IP address baru
    if (client.interface) {
        await mikrotikService.addIpAddress(config, {
            interface: client.interface,
            address: client.ip_address,
            comment: client.client_name
        });
    }
    // Hitung peer dan marks
    const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
    const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
    const [ipOnlyRaw, prefixStrRaw] = String(client.ip_address || '').split('/');
    const ipOnly = ipOnlyRaw || '';
    const prefix = Number(prefixStrRaw || '0');
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
    let peerIp = ipOnly;
    if (prefix === 30) {
        const firstHost = networkInt + 1;
        const secondHost = networkInt + 2;
        const ipInt = ipOnly ? ipToInt(ipOnly) : firstHost;
        peerIp = (ipInt === firstHost) ? intToIp(secondHost) : (ipInt === secondHost ? intToIp(firstHost) : intToIp(secondHost));
    }
    const downloadMark = peerIp;
    const uploadMark = `UP-${peerIp}`;
    await mikrotikService.addMangleRulesForClient(config, { peerIp, downloadMark, uploadMark });
    // Dapatkan limit baru
    const mlDownload = newPackage.child_download_limit || newPackage.shared_download_limit || newPackage.max_limit_download;
    const mlUpload = newPackage.child_upload_limit || newPackage.shared_upload_limit || newPackage.max_limit_upload;
    const packageDownloadQueue = newPackage.name;
    const packageUploadQueue = `UP-${newPackage.name}`;
    // Buat parent queue jika belum ada
    const ensureParentQueue = async (parentName, direction) => {
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
async function getPackageClients(packageId) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const [rows] = await conn.execute(`
			SELECT * FROM static_ip_clients 
			WHERE package_id = ? AND status = 'active'
			ORDER BY created_at DESC
		`, [packageId]);
        return Array.isArray(rows) ? rows : [];
    }
    finally {
        conn.release();
    }
}
async function getClientById(clientId) {
    const conn = await pool_1.databasePool.getConnection();
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
        const list = Array.isArray(rows) ? rows : [];
        return list.length ? list[0] : null;
    }
    finally {
        conn.release();
    }
}
async function getStaticIpClientByCustomerId(customerId) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        // Simplified Query (No JOINs) to prevent lookup failure on bad related data
        const [rows] = await conn.execute(`
            SELECT sic.* 
            FROM static_ip_clients sic
            WHERE sic.customer_id = ? 
            LIMIT 1
        `, [customerId]);
        const list = Array.isArray(rows) ? rows : [];
        return list.length ? list[0] : null;
    }
    finally {
        conn.release();
    }
}
async function updateClient(clientId, data) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const fields = [];
        const values = [];
        if (data.client_name !== undefined) {
            fields.push('client_name = ?');
            values.push(data.client_name);
        }
        if (data.package_id !== undefined) {
            fields.push('package_id = ?');
            values.push(data.package_id);
        }
        if (data.ip_address !== undefined) {
            fields.push('ip_address = ?');
            values.push(data.ip_address);
        }
        if (data.network !== undefined) {
            fields.push('network = ?');
            values.push(data.network);
        }
        if (data.interface !== undefined) {
            fields.push('interface = ?');
            values.push(data.interface);
        }
        if (data.customer_id !== undefined) {
            fields.push('customer_id = ?');
            values.push(data.customer_id);
        }
        if (data.status !== undefined) {
            fields.push('status = ?');
            values.push(data.status);
        }
        if (data.address !== undefined) {
            fields.push('address = ?');
            values.push(data.address);
        }
        if (data.phone_number !== undefined) {
            fields.push('phone_number = ?');
            values.push(data.phone_number);
        }
        if (data.latitude !== undefined) {
            fields.push('latitude = ?');
            values.push(data.latitude);
        }
        if (data.longitude !== undefined) {
            fields.push('longitude = ?');
            values.push(data.longitude);
        }
        if (data.olt_id !== undefined) {
            fields.push('olt_id = ?');
            values.push(data.olt_id);
        }
        if (data.odc_id !== undefined) {
            fields.push('odc_id = ?');
            values.push(data.odc_id);
        }
        if (data.odp_id !== undefined) {
            fields.push('odp_id = ?');
            values.push(data.odp_id);
        }
        if (fields.length === 0)
            return;
        values.push(clientId);
        await conn.execute(`UPDATE static_ip_clients SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
    }
    finally {
        conn.release();
    }
}
// Fungsi untuk menghitung shared limit per client
function calculateSharedLimit(maxLimit, maxClients) {
    if (maxClients <= 1)
        return maxLimit;
    // Extract numeric value from limit (e.g., "10M" -> 10)
    const numericValue = parseInt(maxLimit.replace(/[^0-9]/g, ''));
    const unit = maxLimit.replace(/[0-9]/g, '');
    if (isNaN(numericValue))
        return maxLimit;
    const sharedValue = Math.floor(numericValue / maxClients);
    return `${sharedValue}${unit}`;
}
// Fungsi untuk mendapatkan semua client aktif lintas semua paket
async function getAllStaticIpClients() {
    const conn = await pool_1.databasePool.getConnection();
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
        return Array.isArray(rows) ? rows : [];
    }
    finally {
        conn.release();
    }
}
//# sourceMappingURL=staticIpClientService.js.map