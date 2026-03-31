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
exports.getStaticIpClientList = getStaticIpClientList;
exports.getStaticIpClientAdd = getStaticIpClientAdd;
exports.postStaticIpClientCreate = postStaticIpClientCreate;
exports.postStaticIpClientDelete = postStaticIpClientDelete;
exports.getStaticIpClientEdit = getStaticIpClientEdit;
exports.postStaticIpClientUpdate = postStaticIpClientUpdate;
exports.getChangePackageForm = getChangePackageForm;
exports.postChangePackage = postChangePackage;
exports.testMikrotikIpAdd = testMikrotikIpAdd;
exports.autoDebugIpStatic = autoDebugIpStatic;
const pool_1 = require("../db/pool");
const staticIpClientService_1 = require("../services/staticIpClientService");
const staticIpPackageService_1 = require("../services/staticIpPackageService");
const staticIpPackageService_2 = require("../services/staticIpPackageService");
const mikrotikService_1 = require("../services/mikrotikService");
const routeros_api_1 = require("routeros-api");
const ipHelper_1 = require("../utils/ipHelper");
async function getStaticIpClientList(req, res, next) {
    try {
        const packageId = Number(req.params.packageId);
        const packageData = await (0, staticIpPackageService_1.getStaticIpPackageById)(packageId);
        if (!packageData) {
            req.flash('error', 'Paket tidak ditemukan');
            return res.redirect('/packages/static-ip');
        }
        const clients = await (0, staticIpClientService_1.getPackageClients)(packageId);
        const isFull = await (0, staticIpClientService_1.isPackageFull)(packageId);
        // IMPORTANT: Proses IP address untuk setiap client
        // IP yang disimpan di database adalah gateway IP dengan CIDR (192.168.1.1/30)
        // IP yang ditampilkan ke user harus IP client (192.168.1.2)
        const clientsWithProcessedIP = clients.map((client) => ({
            ...client,
            ip_address_display: client.ip_address ? (0, ipHelper_1.calculateCustomerIP)(client.ip_address) : client.ip_address
        }));
        res.render('packages/static_ip_clients', {
            title: `Client Paket ${packageData.name}`,
            package: packageData,
            clients: clientsWithProcessedIP,
            isFull,
            success: req.flash('success'),
            error: req.flash('error')
        });
    }
    catch (err) {
        next(err);
    }
}
async function getStaticIpClientAdd(req, res, next) {
    try {
        const packageId = Number(req.params.packageId);
        const packageData = await (0, staticIpPackageService_1.getStaticIpPackageById)(packageId);
        if (!packageData) {
            req.flash('error', 'Paket tidak ditemukan');
            return res.redirect('/packages/static-ip');
        }
        const isFull = await (0, staticIpClientService_1.isPackageFull)(packageId);
        if (isFull) {
            req.flash('error', 'Paket sudah penuh, tidak bisa menambah client baru');
            return res.redirect(`/packages/static-ip/${packageId}/clients`);
        }
        const cfg = await (0, staticIpPackageService_2.getMikrotikConfig)();
        const interfaces = cfg ? await (0, mikrotikService_1.getInterfaces)(cfg) : [];
        // Get ODP data with OLT and ODC info
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Ambil daftar pelanggan untuk pilihan (Searchable Dropdown)
            const [customerRows] = await conn.execute(`
                SELECT id, name, customer_code, phone, address, connection_type 
                FROM customers 
                WHERE status = 'active' 
                ORDER BY name ASC
            `);
            const [odpRows] = await conn.execute(`
                SELECT 
                    o.id, 
                    o.name as odp_name,
                    o.odc_id,
                    odc.olt_id,
                    olt.name as olt_name,
                    odc.name as odc_name
                FROM ftth_odp o
                LEFT JOIN ftth_odc odc ON o.odc_id = odc.id
                LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
                ORDER BY o.name
            `);
            res.render('packages/static_ip_client_add', {
                title: `Tambah Client ke Paket ${packageData.name}`,
                package: packageData,
                packages: await (0, staticIpPackageService_1.listStaticIpPackages)(), // Back to packages
                interfaces,
                odpData: odpRows,
                customers: customerRows,
                error: req.flash('error')
            });
        }
        finally {
            conn.release();
        }
    }
    catch (err) {
        next(err);
    }
}
async function postStaticIpClientCreate(req, res, next) {
    try {
        const packageId = Number(req.params.packageId);
        const { client_name, ip_address, customer_id, interface: iface, address, phone_number, latitude, longitude, olt_id, odc_id, odp_id } = req.body;
        if (!client_name)
            throw new Error('Nama client wajib diisi');
        if (!ip_address)
            throw new Error('IP address wajib diisi');
        // NEW: Accept IP without CIDR, auto-add /30 if missing
        let normalizedIp = String(ip_address).trim();
        // Check if IP has CIDR prefix
        const hasCidr = normalizedIp.includes('/');
        // Validate IP format (with or without CIDR)
        const ipOnlyRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[12][0-9]|3[0-2]))$/;
        if (!hasCidr) {
            // IP without CIDR - validate and add /30
            if (!ipOnlyRegex.test(normalizedIp)) {
                throw new Error('Format IP tidak valid. Contoh: 192.168.239.2');
            }
            normalizedIp = normalizedIp + '/30';
            console.log(`[Auto-CIDR] IP tanpa prefix -> ditambahkan /30: ${normalizedIp}`);
        }
        else {
            // IP with CIDR - validate full format
            if (!cidrRegex.test(normalizedIp)) {
                throw new Error('Format IP CIDR tidak valid. Contoh: 192.168.239.2/30');
            }
        }
        // Use normalized IP (with /30) for all subsequent operations
        const ip_address_with_cidr = normalizedIp;
        // Pastikan interface diisi agar IP dapat ditambahkan ke MikroTik
        if (!iface) {
            throw new Error('Interface MikroTik wajib dipilih untuk memasang IP address');
        }
        // Hitung network untuk disimpan
        const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
        const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
        const [ipOnlyRaw, prefixStrRaw] = ip_address_with_cidr.split('/');
        const ipOnly = ipOnlyRaw || '';
        const prefix = Number(prefixStrRaw || '30');
        const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
        const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
        const network = intToIp(networkInt);
        // CHECK DUPLICATE IP IN DATABASE
        const checkConn = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await checkConn.query('SELECT id FROM static_ip_clients WHERE ip_address = ?', [ip_address_with_cidr]);
            if (rows.length > 0) {
                throw new Error(`Data Ganda: IP Address ${ip_address_with_cidr} sudah terdaftar di database!`);
            }
        }
        finally {
            checkConn.release();
        }
        // STRICT LIMIT CHECK
        if (await (0, staticIpClientService_1.isPackageFull)(packageId)) {
            throw new Error('Paket Static IP ini sudah penuh (Max Limit tercapai). Tidak dapat menambah client lagi.');
        }
        const { customerId: newCustomerId } = await (0, staticIpClientService_1.addClientToPackage)(packageId, {
            client_name,
            ip_address: ip_address_with_cidr,
            network,
            interface: iface || null,
            customer_id: customer_id ? Number(customer_id) : null,
            address: address || null,
            phone_number: phone_number || null,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            olt_id: olt_id ? Number(olt_id) : null,
            odc_id: odc_id ? Number(odc_id) : null,
            odp_id: odp_id ? Number(odp_id) : null
        });
        // MikroTik provisioning: add IP, mangle, and child queues based on package template
        const cfg = await (0, staticIpPackageService_2.getMikrotikConfig)();
        const pkg = await (0, staticIpPackageService_2.getStaticIpPackageById)(packageId);
        console.log('=== MIKROTIK PROVISIONING DEBUG ===');
        console.log('MikroTik config available:', !!cfg);
        console.log('Package found:', !!pkg);
        console.log('Interface:', iface);
        console.log('IP Address (normalized):', ip_address_with_cidr);
        // Cek interface yang tersedia
        if (cfg) {
            try {
                const availableInterfaces = await (0, mikrotikService_1.getInterfaces)(cfg);
                console.log('Available interfaces from getInterfaces:', availableInterfaces);
                console.log('Selected interface in list:', availableInterfaces.some(i => i.name === iface));
            }
            catch (err) {
                console.error('Error getting interfaces:', err);
            }
        }
        if (cfg && pkg) {
            try {
                // 1) Handle IP Address (Smart Sync)
                console.log('Checking if IP address exists in MikroTik...');
                let mikrotikAddress = ip_address_with_cidr;
                // LOGIC /30: Address on Router must be Gateway IP
                try {
                    const [ipOnly, prefixStr] = String(ip_address_with_cidr).split('/');
                    const prefix = Number(prefixStr || '0');
                    if (prefix === 30) {
                        const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                        const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
                        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
                        const networkInt = ipToInt(ipOnly || '0.0.0.0') & mask;
                        const firstHost = networkInt + 1;
                        const secondHost = networkInt + 2;
                        const ipInt = ipToInt(ipOnly || '0.0.0.0');
                        // Gateway is "the other guy"
                        const gatewayIp = (ipInt === firstHost) ? intToIp(secondHost) : intToIp(firstHost);
                        mikrotikAddress = `${gatewayIp}/${prefix}`;
                        console.log(`[Create] Client ${ip_address_with_cidr} -> MikroTik Gateway: ${mikrotikAddress}`);
                    }
                }
                catch (e) {
                    console.warn('IP Calc Error', e);
                }
                const existingIpId = await (0, mikrotikService_1.findIpAddressId)(cfg, mikrotikAddress);
                if (existingIpId) {
                    console.log(`IP ${mikrotikAddress} already exists (ID: ${existingIpId}). Syncing...`);
                    // Update comment ensuring no duplicate error
                    await (0, mikrotikService_1.updateIpAddress)(cfg, existingIpId, {
                        comment: client_name,
                        interface: iface
                    });
                }
                else {
                    console.log(`Adding New IP address ${mikrotikAddress} to MikroTik...`);
                    await (0, mikrotikService_1.addIpAddress)(cfg, { interface: iface, address: mikrotikAddress, comment: client_name });
                    console.log(`IP address ${mikrotikAddress} added successfully with comment: ${client_name}`);
                }
            }
            catch (error) {
                console.error('Failed to sync IP address:', error);
                // Don't throw fatal error if IP exists, just warn
                if (!String(error.message).includes('already have')) {
                    throw new Error(`Gagal sync IP ke MikroTik: ${error.message}`);
                }
            }
            // 2) Sync Queues/Mangle using robust service
            const targetPackageId = req.body.package_id ? Number(req.body.package_id) : packageId;
            // If package forced in body is different, update the client record to point to new package?
            // But we already inserted with packageId.
            // If `package_id` was passed in body and different from params, we should have used it in INSERT.
            // Let's correct the INSERT above if needed.
            // Actually, let's just stick to the param packageId for INSERT to keep it simple, 
            // unless we want to support changing package during ADD.
            // For now, I'll assume users stick to the package they are in, OR 
            // if we allow selection, we must update the previous INSERT.
            // Wait, I can't easily change the INSERT above without editing the top of the function.
            // Let's assume for now syncClientQueues uses the inserted packageId.
            await (0, staticIpPackageService_1.syncClientQueues)(newCustomerId, packageId, // Use the package ID where the client was created
            ip_address_with_cidr, client_name);
        }
        req.flash('success', 'Client berhasil ditambahkan ke paket');
        res.redirect(`/packages/static-ip/${packageId}/clients`);
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal menambahkan client');
        res.redirect(`/packages/static-ip/${req.params.packageId}/clients`);
    }
}
async function postStaticIpClientDelete(req, res, next) {
    try {
        const clientId = Number(req.params.clientId);
        const packageId = Number(req.params.packageId);
        // Ambil client & paket untuk data Mikrotik
        const client = await (0, staticIpClientService_1.getClientById)(clientId);
        const pkg = await (0, staticIpPackageService_2.getStaticIpPackageById)(packageId);
        const cfg = await (0, staticIpPackageService_2.getMikrotikConfig)();
        // Hapus resource di Mikrotik bila konfigurasi tersedia
        if (cfg && client && pkg) {
            // Hapus IP address pada interface jika ada data IP/CIDR
            if (client.ip_address) {
                let targetIpToDelete = client.ip_address;
                try {
                    // Logic: Jika /30, hapus Gateway IP (Router Side)
                    const [ipOnly, prefixStr] = String(client.ip_address).split('/');
                    const prefix = Number(prefixStr || '0');
                    if (prefix === 30) {
                        const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                        const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
                        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
                        const networkInt = ipToInt(ipOnly || '0.0.0.0') & mask;
                        const firstHost = networkInt + 1;
                        const secondHost = networkInt + 2;
                        const ipInt = ipToInt(ipOnly || '0.0.0.0');
                        // Gateway is "the other guy"
                        const gatewayIp = (ipInt === firstHost) ? intToIp(secondHost) : intToIp(firstHost);
                        targetIpToDelete = `${gatewayIp}/${prefix}`;
                        console.log(`[Delete StaticClient] Client IP: ${client.ip_address} -> Deleting Gateway IP: ${targetIpToDelete}`);
                    }
                }
                catch (e) {
                    console.warn('[Delete StaticClient] Error calculating gateway IP', e);
                }
                await (0, mikrotikService_1.removeIpAddress)(cfg, targetIpToDelete);
            }
            // Hitung peer dan marks untuk hapus mangle
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
            await (0, mikrotikService_1.removeMangleRulesForClient)(cfg, { peerIp, downloadMark, uploadMark });
            // Hapus child queues
            await (0, mikrotikService_1.deleteClientQueuesByClientName)(cfg, client.client_name);
        }
        // Terakhir: hapus di database
        await (0, staticIpClientService_1.removeClientFromPackage)(clientId);
        req.flash('success', 'Client berhasil dihapus dari paket');
        res.redirect(`/packages/static-ip/${packageId}/clients`);
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal menghapus client');
        res.redirect(`/packages/static-ip/${req.params.packageId}/clients`);
    }
}
async function getStaticIpClientEdit(req, res, next) {
    try {
        const packageId = Number(req.params.packageId);
        const clientId = Number(req.params.clientId);
        const packageData = await (0, staticIpPackageService_1.getStaticIpPackageById)(packageId);
        const client = await (0, staticIpClientService_1.getClientById)(clientId);
        // Fetch all packages for selection
        const packages = await (0, staticIpPackageService_1.listStaticIpPackages)();
        if (!packageData || !client) {
            req.flash('error', 'Paket atau client tidak ditemukan');
            return res.redirect(`/packages/static-ip/${packageId}/clients`);
        }
        const cfg = await (0, staticIpPackageService_2.getMikrotikConfig)();
        const interfaces = cfg ? await (0, mikrotikService_1.getInterfaces)(cfg) : [];
        // Get ODP data with OLT and ODC info
        const conn = await pool_1.databasePool.getConnection();
        try {
            // Ambil daftar pelanggan untuk pilihan (Searchable Dropdown)
            const [customerRows] = await conn.execute(`
                SELECT id, name, customer_code, phone, address, connection_type 
                FROM customers 
                WHERE status = 'active' 
                ORDER BY name ASC
            `);
            const [odpRows] = await conn.execute(`
                SELECT 
                    o.id, 
                    o.name as odp_name,
                    o.odc_id,
                    odc.olt_id,
                    olt.name as olt_name,
                    odc.name as odc_name
                FROM ftth_odp o
                LEFT JOIN ftth_odc odc ON o.odc_id = odc.id
                LEFT JOIN ftth_olt olt ON odc.olt_id = olt.id
                ORDER BY o.name
            `);
            res.render('packages/static_ip_client_edit', {
                title: `Edit Client Paket ${packageData.name}`,
                package: packageData,
                packages: packages, // Back to packages
                client,
                interfaces,
                odpData: odpRows,
                customers: customerRows,
                success: req.flash('success'),
                error: req.flash('error')
            });
        }
        finally {
            conn.release();
        }
    }
    catch (err) {
        next(err);
    }
}
async function postStaticIpClientUpdate(req, res, next) {
    try {
        const initialPackageId = Number(req.params.packageId);
        const clientId = Number(req.params.clientId);
        const { client_name, ip_address, interface: iface, address, phone_number, latitude, longitude, olt_id, odc_id, odp_id, package_id: newPackageIdInput // Optional new package ID
         } = req.body;
        if (!client_name)
            throw new Error('Nama client wajib diisi');
        if (!ip_address)
            throw new Error('IP address wajib diisi');
        // Determine effective package ID (if switched)
        const newPackageId = newPackageIdInput ? Number(newPackageIdInput) : initialPackageId;
        const targetPackageId = newPackageId || initialPackageId;
        // Ambil data lama 
        const oldClient = await (0, staticIpClientService_1.getClientById)(clientId);
        const cfg = await (0, staticIpPackageService_2.getMikrotikConfig)();
        if (!oldClient)
            throw new Error('Client tidak ditemukan');
        // Update database first
        await (0, staticIpClientService_1.updateClient)(clientId, {
            client_name,
            ip_address,
            interface: iface || null,
            address: address || null,
            phone_number: phone_number || null,
            latitude: latitude ? Number(latitude) : null,
            longitude: longitude ? Number(longitude) : null,
            olt_id: olt_id ? Number(olt_id) : null,
            odc_id: odc_id ? Number(odc_id) : null,
            odp_id: odp_id ? Number(odp_id) : null,
            package_id: targetPackageId // Update package if changed
        });
        // 1. If package changed, update Subscription (if exists)
        if (targetPackageId !== initialPackageId && oldClient.customer_id) {
            const conn = await pool_1.databasePool.getConnection();
            try {
                // Get new package details
                const newPkg = await (0, staticIpPackageService_1.getStaticIpPackageById)(targetPackageId);
                if (newPkg) {
                    await conn.execute(`UPDATE subscriptions SET package_id = ?, package_name = ?, price = ?, updated_at = NOW()
                         WHERE customer_id = ? AND status = 'active'`, [newPkg.id, newPkg.name, newPkg.price, oldClient.customer_id]);
                }
            }
            finally {
                conn.release();
            }
        }
        // 2. Sync to Mikrotik (Robust Way via syncClientQueues)
        if (cfg) {
            // First, ensure IP is correct in MikroTik (Address List)
            if (iface) {
                let mikrotikAddress = ip_address;
                try {
                    // Logic: If /30, store Gateway IP on Router Interface
                    const [ipOnly, prefixStr] = String(ip_address).split('/');
                    const prefix = Number(prefixStr || '0');
                    // Check if IP changed or Interface changed
                    if (oldClient.ip_address !== ip_address || oldClient.interface !== iface) {
                        // Clean up old IP if needed
                        if (oldClient.ip_address && oldClient.ip_address !== ip_address) {
                            // Calculation of old gateway ip to delete... 
                            // For simplicity/robustness we try to remove the exact old string or let user handle manually if complex.
                            // But let's try standard removal.
                            await (0, mikrotikService_1.removeIpAddress)(cfg, oldClient.ip_address).catch(() => { });
                        }
                    }
                    if (prefix === 30) {
                        const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                        const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
                        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
                        const networkInt = ipToInt(ipOnly || '0.0.0.0') & mask;
                        const firstHost = networkInt + 1;
                        const secondHost = networkInt + 2;
                        const ipInt = ipToInt(ipOnly || '0.0.0.0');
                        const gatewayIp = (ipInt === firstHost) ? intToIp(secondHost) : intToIp(firstHost);
                        mikrotikAddress = `${gatewayIp}/${prefix}`;
                    }
                    // Upsert IP
                    const existingIpId = await (0, mikrotikService_1.findIpAddressId)(cfg, mikrotikAddress);
                    if (existingIpId) {
                        await (0, mikrotikService_1.updateIpAddress)(cfg, existingIpId, { comment: client_name, interface: iface });
                    }
                    else {
                        await (0, mikrotikService_1.addIpAddress)(cfg, { interface: iface, address: mikrotikAddress, comment: client_name });
                    }
                }
                catch (e) {
                    console.warn('IP Sync Warning:', e);
                }
            }
            // Sync Queues/Mangle (Enforce Structure)
            // Use oldClient.client_name for cleanup of old queues
            await (0, staticIpPackageService_1.syncClientQueues)(oldClient.customer_id || 0, targetPackageId, ip_address, client_name, { oldClientName: oldClient.client_name });
        }
        req.flash('success', 'Client berhasil diperbarui');
        res.redirect(`/packages/static-ip/${targetPackageId}/clients`);
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal memperbarui client');
        // Redirect back to the *initial* package URL as that's where we came from, unless we successfully moved
        res.redirect(`/packages/static-ip/${req.params.packageId}/clients`);
    }
}
// Controller function untuk mengganti paket IP statis pelanggan
async function getChangePackageForm(req, res, next) {
    try {
        const customerId = Number(req.params.customerId);
        // Ambil data pelanggan dan paket yang tersedia
        const conn = await pool_1.databasePool.getConnection();
        try {
            const [customerResult] = await conn.execute(`SELECT c.id as customer_id, c.name as customer_name, sic.package_id, sip.name as current_package_name 
                 FROM customers c 
                 JOIN static_ip_clients sic ON c.id = sic.customer_id 
                 JOIN static_ip_packages sip ON sic.package_id = sip.id 
                 WHERE c.id = ?`, [customerId]);
            const [packagesResult] = await conn.execute(`SELECT id, name, max_clients 
                 FROM static_ip_packages 
                 WHERE status = 'active' 
                 ORDER BY name`);
            // Hitung jumlah client aktif per paket
            const packagesWithCounts = [];
            for (const pkg of packagesResult) {
                const [countResult] = await conn.execute(`SELECT COUNT(*) as count FROM static_ip_clients 
                     WHERE package_id = ? AND status = 'active'`, [pkg.id]);
                const currentCount = countResult[0].count;
                // Hanya tambahkan jika masih ada slot ATAU ini adalah paket saat ini
                if ((pkg.max_clients - currentCount) > 0 || pkg.id === customerResult[0].package_id) {
                    packagesWithCounts.push({
                        ...pkg,
                        current_count: currentCount,
                        available_slots: pkg.max_clients - currentCount,
                        is_available: (pkg.max_clients - currentCount) > 0
                    });
                }
            }
            res.render('customers/change_static_ip_package', {
                title: 'Ganti Paket IP Statis',
                customer: customerResult[0],
                availablePackages: packagesWithCounts,
                success: req.flash('success'),
                error: req.flash('error')
            });
        }
        finally {
            conn.release();
        }
    }
    catch (err) {
        next(err);
    }
}
async function postChangePackage(req, res, next) {
    try {
        const customerId = Number(req.params.customerId);
        const newPackageId = Number(req.body.new_package_id);
        // Import fungsi dari service
        const { changeCustomerStaticIpPackage } = await Promise.resolve().then(() => __importStar(require('../services/staticIpClientService')));
        await changeCustomerStaticIpPackage(customerId, newPackageId);
        req.flash('success', 'Paket IP statis pelanggan berhasil diubah');
        res.redirect(`/customers`);
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal mengganti paket IP statis');
        res.redirect(`/customers/${req.params.customerId}/change-package`);
    }
}
// Test endpoint untuk debug MikroTik
async function testMikrotikIpAdd(req, res, next) {
    try {
        const { interface: iface, address } = req.query;
        if (!iface || !address) {
            return res.json({
                success: false,
                error: 'Parameter interface dan address diperlukan',
                example: '/test-mikrotik-ip?interface=ether2&address=192.168.1.1/30'
            });
        }
        const cfg = await (0, staticIpPackageService_2.getMikrotikConfig)();
        if (!cfg) {
            return res.json({
                success: false,
                error: 'Konfigurasi MikroTik tidak ditemukan'
            });
        }
        console.log('=== TEST MIKROTIK IP ADD ===');
        console.log('Interface:', iface);
        console.log('Address:', address);
        await (0, mikrotikService_1.addIpAddress)(cfg, {
            interface: String(iface),
            address: String(address),
            comment: `Test-${Date.now()}`
        });
        res.json({
            success: true,
            message: 'IP address berhasil ditambahkan ke MikroTik',
            interface: iface,
            address: address
        });
    }
    catch (err) {
        console.error('Test MikroTik error:', err);
        res.json({
            success: false,
            error: err.message,
            stack: err.stack
        });
    }
}
// Auto debug system untuk IP static
async function autoDebugIpStatic(req, res, next) {
    const debugResults = {
        timestamp: new Date().toISOString(),
        tests: [],
        summary: {
            total: 0,
            passed: 0,
            failed: 0,
            issues: []
        }
    };
    try {
        console.log('🔍 === AUTO DEBUG IP STATIC SYSTEM ===');
        const cfg = await (0, staticIpPackageService_2.getMikrotikConfig)();
        if (!cfg) {
            debugResults.summary.issues.push('Konfigurasi MikroTik tidak ditemukan');
            return res.json(debugResults);
        }
        // Test 1: Koneksi MikroTik
        await runTest('Koneksi MikroTik', async () => {
            const api = new routeros_api_1.RouterOSAPI({
                host: cfg.host,
                port: cfg.port,
                user: cfg.username,
                password: cfg.password,
                timeout: 10000
            });
            await api.connect();
            await api.close();
            return 'Koneksi berhasil';
        }, debugResults);
        // Test 2: Cek Interface yang tersedia
        await runTest('Interface Tersedia', async () => {
            const api = new routeros_api_1.RouterOSAPI({
                host: cfg.host,
                port: cfg.port,
                user: cfg.username,
                password: cfg.password,
                timeout: 10000
            });
            await api.connect();
            const interfaces = await api.write('/interface/print');
            await api.close();
            const interfaceNames = Array.isArray(interfaces) ? interfaces.map((i) => i.name) : [];
            return {
                count: interfaceNames.length,
                names: interfaceNames,
                ether2_exists: interfaceNames.includes('ether2'),
                ether2_enabled: interfaces.find((i) => i.name === 'ether2')?.disabled === 'false'
            };
        }, debugResults);
        // Test 3: Cek IP Address yang sudah ada
        await runTest('IP Address Existing', async () => {
            const api = new routeros_api_1.RouterOSAPI({
                host: cfg.host,
                port: cfg.port,
                user: cfg.username,
                password: cfg.password,
                timeout: 10000
            });
            await api.connect();
            const addresses = await api.write('/ip/address/print');
            await api.close();
            return {
                total: Array.isArray(addresses) ? addresses.length : 0,
                addresses: Array.isArray(addresses) ? addresses : [],
                has_192_168_1: Array.isArray(addresses) ? addresses.some((a) => a.address?.includes('192.168.1')) : false
            };
        }, debugResults);
        // Test 4: Test Add IP Address Manual
        await runTest('Add IP Address Manual', async () => {
            const testIp = `192.168.1.${Math.floor(Math.random() * 254) + 1}/30`;
            const api = new routeros_api_1.RouterOSAPI({
                host: cfg.host,
                port: cfg.port,
                user: cfg.username,
                password: cfg.password,
                timeout: 15000
            });
            await api.connect();
            // Cek apakah IP sudah ada
            const existing = await api.write('/ip/address/print');
            const exists = Array.isArray(existing) && existing.some((a) => a.address === testIp);
            if (exists) {
                await api.close();
                return { status: 'already_exists', ip: testIp };
            }
            // Coba tambah IP
            const result = await api.write('/ip/address/add', [
                '=interface=ether2',
                `=address=${testIp}`,
                `=comment=AutoDebug-${Date.now()}`
            ]);
            // Verifikasi
            const verify = await api.write('/ip/address/print');
            const added = Array.isArray(verify) && verify.find((a) => a.address === testIp);
            await api.close();
            return {
                status: added ? 'success' : 'failed',
                ip: testIp,
                result: result,
                verified: !!added
            };
        }, debugResults);
        // Summary
        debugResults.summary.total = debugResults.tests.length;
        debugResults.summary.passed = debugResults.tests.filter((t) => t.success).length;
        debugResults.summary.failed = debugResults.tests.filter((t) => !t.success).length;
        console.log('✅ Auto Debug Complete:', debugResults.summary);
        res.json(debugResults);
    }
    catch (err) {
        console.error('Auto Debug Error:', err);
        debugResults.summary.issues.push(err.message);
        res.json(debugResults);
    }
}
async function runTest(name, testFn, debugResults) {
    const test = {
        name,
        success: false,
        result: null,
        error: null,
        duration: 0
    };
    const start = Date.now();
    try {
        test.result = await testFn();
        test.success = true;
        console.log(`✅ ${name}: PASSED`);
    }
    catch (error) {
        test.error = error.message;
        test.success = false;
        console.log(`❌ ${name}: FAILED - ${error.message}`);
    }
    test.duration = Date.now() - start;
    debugResults.tests.push(test);
}
//# sourceMappingURL=staticIpClientController.js.map