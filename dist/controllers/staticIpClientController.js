"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaticIpClientList = getStaticIpClientList;
exports.getStaticIpClientAdd = getStaticIpClientAdd;
exports.postStaticIpClientCreate = postStaticIpClientCreate;
exports.postStaticIpClientDelete = postStaticIpClientDelete;
exports.getStaticIpClientEdit = getStaticIpClientEdit;
exports.postStaticIpClientUpdate = postStaticIpClientUpdate;
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
                interfaces,
                odpData: odpRows,
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
        // Validasi format IP CIDR
        const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[12][0-9]|3[0-2]))$/;
        if (!cidrRegex.test(String(ip_address))) {
            throw new Error('Format IP harus CIDR, contoh: 192.168.1.1/30');
        }
        // Pastikan interface diisi agar IP dapat ditambahkan ke MikroTik
        if (!iface) {
            throw new Error('Interface MikroTik wajib dipilih untuk memasang IP address');
        }
        // Hitung network untuk disimpan
        const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
        const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
        const [ipOnlyRaw, prefixStrRaw] = String(ip_address).split('/');
        const ipOnly = ipOnlyRaw || '';
        const prefix = Number(prefixStrRaw || '0');
        const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
        const networkInt = ipOnly ? (ipToInt(ipOnly) & mask) : 0;
        const network = intToIp(networkInt);
        const { customerId: newCustomerId } = await (0, staticIpClientService_1.addClientToPackage)(packageId, {
            client_name,
            ip_address,
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
        console.log('IP Address:', ip_address);
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
                // 1) Tambah IP address ke interface
                console.log('Adding IP address to MikroTik...');
                await (0, mikrotikService_1.addIpAddress)(cfg, { interface: iface, address: ip_address, comment: `Client ${client_name}` });
                console.log('IP address added successfully');
            }
            catch (error) {
                console.error('Failed to add IP address:', error);
                throw new Error(`Gagal menambahkan IP ke MikroTik: ${error.message}`);
            }
            // 2) Hitung peer dan marks
            const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
            const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
            const [ipOnlyRaw, prefixStrRaw] = String(ip_address).split('/');
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
            await (0, mikrotikService_1.addMangleRulesForClient)(cfg, { peerIp, downloadMark, uploadMark });
            const mlDownload = pkg.child_download_limit || pkg.shared_download_limit || pkg.max_limit_download;
            const mlUpload = pkg.child_upload_limit || pkg.shared_upload_limit || pkg.max_limit_upload;
            const packageDownloadQueue = pkg.name;
            const packageUploadQueue = `UP-${pkg.name}`;
            await (0, mikrotikService_1.createQueueTree)(cfg, {
                name: client_name,
                parent: packageDownloadQueue,
                packetMarks: downloadMark,
                maxLimit: mlDownload,
                queue: pkg.child_queue_type_download || 'pcq-download-default',
                priority: pkg.child_priority_download || '8'
            });
            await (0, mikrotikService_1.createQueueTree)(cfg, {
                name: `UP-${client_name}`,
                parent: packageUploadQueue,
                packetMarks: uploadMark,
                maxLimit: mlUpload,
                queue: pkg.child_queue_type_upload || 'pcq-upload-default',
                priority: pkg.child_priority_upload || '8'
            });
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
                await (0, mikrotikService_1.removeIpAddress)(cfg, client.ip_address);
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
        if (!packageData || !client) {
            req.flash('error', 'Paket atau client tidak ditemukan');
            return res.redirect(`/packages/static-ip/${packageId}/clients`);
        }
        const cfg = await (0, staticIpPackageService_2.getMikrotikConfig)();
        const interfaces = cfg ? await (0, mikrotikService_1.getInterfaces)(cfg) : [];
        // Get ODP data with OLT and ODC info
        const conn = await pool_1.databasePool.getConnection();
        try {
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
                client,
                interfaces,
                odpData: odpRows,
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
        const packageId = Number(req.params.packageId);
        const clientId = Number(req.params.clientId);
        const { client_name, ip_address, interface: iface, address, phone_number, latitude, longitude, olt_id, odc_id, odp_id } = req.body;
        if (!client_name)
            throw new Error('Nama client wajib diisi');
        if (!ip_address)
            throw new Error('IP address wajib diisi');
        // Ambil data lama untuk sinkronisasi Mikrotik
        const oldClient = await (0, staticIpClientService_1.getClientById)(clientId);
        const pkg = await (0, staticIpPackageService_2.getStaticIpPackageById)(packageId);
        const cfg = await (0, staticIpPackageService_2.getMikrotikConfig)();
        // Jika ada perubahan IP/interface/nama, lakukan update ke Mikrotik
        if (cfg && pkg && oldClient) {
            // 1) Hapus resource lama (IP, mangle, queues)
            if (oldClient.ip_address) {
                await (0, mikrotikService_1.removeIpAddress)(cfg, oldClient.ip_address);
            }
            {
                const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
                const [ipOnlyRaw, prefixStrRaw] = String(oldClient.ip_address || '').split('/');
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
            }
            await (0, mikrotikService_1.deleteClientQueuesByClientName)(cfg, oldClient.client_name);
            // 2) Tambahkan resource baru sesuai input
            if (iface) {
                await (0, mikrotikService_1.addIpAddress)(cfg, { interface: iface, address: ip_address, comment: `Client ${client_name}` });
            }
            {
                const ipToInt = (ip) => ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0) >>> 0;
                const intToIp = (int) => [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
                const [ipOnlyRaw, prefixStrRaw] = String(ip_address).split('/');
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
                await (0, mikrotikService_1.addMangleRulesForClient)(cfg, { peerIp, downloadMark, uploadMark });
                const mlDownload = pkg.child_download_limit || pkg.shared_download_limit || pkg.max_limit_download;
                const mlUpload = pkg.child_upload_limit || pkg.shared_upload_limit || pkg.max_limit_upload;
                await (0, mikrotikService_1.createQueueTree)(cfg, {
                    name: `${client_name}_DOWNLOAD`,
                    parent: pkg.parent_download_name,
                    packetMarks: downloadMark,
                    maxLimit: mlDownload,
                    queue: pkg.child_queue_type_download || 'pcq-download-default',
                    priority: pkg.child_priority_download || '8',
                    comment: `Download queue for ${client_name}`
                });
                await (0, mikrotikService_1.createQueueTree)(cfg, {
                    name: `${client_name}_UPLOAD`,
                    parent: pkg.parent_upload_name,
                    packetMarks: uploadMark,
                    maxLimit: mlUpload,
                    queue: pkg.child_queue_type_upload || 'pcq-upload-default',
                    priority: pkg.child_priority_upload || '8',
                    comment: `Upload queue for ${client_name}`
                });
            }
        }
        // Update database
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
            odp_id: odp_id ? Number(odp_id) : null
        });
        req.flash('success', 'Client berhasil diperbarui');
        res.redirect(`/packages/static-ip/${packageId}/clients`);
    }
    catch (err) {
        req.flash('error', err instanceof Error ? err.message : 'Gagal memperbarui client');
        res.redirect(`/packages/static-ip/${req.params.packageId}/clients`);
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