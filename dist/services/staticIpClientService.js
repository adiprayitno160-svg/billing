"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPackageFull = isPackageFull;
exports.addClientToPackage = addClientToPackage;
exports.removeClientFromPackage = removeClientFromPackage;
exports.getPackageClients = getPackageClients;
exports.getClientById = getClientById;
exports.updateClient = updateClient;
exports.calculateSharedLimit = calculateSharedLimit;
exports.getAllStaticIpClients = getAllStaticIpClients;
const pool_1 = require("../db/pool");
const customerIdGenerator_1 = require("../utils/customerIdGenerator");
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
        // Generate customer code dengan format YYYYMMDDHHMMSS
        const customerCode = customerIdGenerator_1.CustomerIdGenerator.generateCustomerId();
        // Insert ke tabel customers terlebih dahulu
        console.log('Inserting customer to customers table:', {
            customerCode,
            client_name: clientData.client_name,
            phone: clientData.phone_number || null,
            address: clientData.address || null,
            odc_id: clientData.odc_id || null,
            odp_id: clientData.odp_id || null,
            latitude: clientData.latitude || null,
            longitude: clientData.longitude || null
        });
        const [customerResult] = await conn.execute(`
            INSERT INTO customers (
                customer_code, name, phone, email, address, odc_id, odp_id,
                connection_type, status, latitude, longitude,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'static_ip', 'active', ?, ?, NOW(), NOW())
        `, [
            customerCode,
            clientData.client_name,
            clientData.phone_number || null,
            null, // email
            clientData.address || null,
            clientData.odc_id || null,
            clientData.odp_id || null,
            clientData.latitude || null,
            clientData.longitude || null
        ]);
        const customerId = customerResult.insertId;
        console.log('Customer inserted with ID:', customerId);
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
        // Hapus dari tabel static_ip_clients
        await conn.execute('DELETE FROM static_ip_clients WHERE id = ?', [clientId]);
        // Hapus dari tabel customers juga jika ada
        await conn.execute('DELETE FROM customers WHERE id IN (SELECT customer_id FROM static_ip_clients WHERE id = ?)', [clientId]);
        console.log(`Client with ID ${clientId} deleted from database`);
    }
    finally {
        conn.release();
    }
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
async function updateClient(clientId, data) {
    const conn = await pool_1.databasePool.getConnection();
    try {
        const fields = [];
        const values = [];
        if (data.client_name !== undefined) {
            fields.push('client_name = ?');
            values.push(data.client_name);
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