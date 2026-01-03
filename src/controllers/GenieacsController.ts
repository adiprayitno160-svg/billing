import { Request, Response } from 'express';
import { GenieacsService } from '../services/genieacs/GenieacsService';
import { databasePool } from '../db/pool';
import { RowDataPacket } from 'mysql2';

export class GenieacsController {
    /**
     * Dashboard GenieACS
     */
    static async dashboard(req: Request, res: Response) {
        try {
            const genieacs = await GenieacsService.getInstanceFromDb();

            // Test connection
            const connectionTest = await genieacs.testConnection();

            let stats = {
                totalDevices: 0,
                onlineDevices: 0,
                offlineDevices: 0,
                recentFaults: 0
            };

            if (connectionTest.success) {
                // Get devices
                const devices = await genieacs.getDevices(100);
                const faults = await genieacs.getFaults(10);

                stats.totalDevices = devices.length;

                // Count online/offline
                const now = Date.now();
                const fiveMinutes = 5 * 60 * 1000;

                devices.forEach(device => {
                    const lastInform = device._lastInform ? new Date(device._lastInform).getTime() : 0;
                    if ((now - lastInform) < fiveMinutes) {
                        stats.onlineDevices++;
                    } else {
                        stats.offlineDevices++;
                    }
                });

                stats.recentFaults = faults.length;
            }

            res.render('genieacs/dashboard', {
                title: 'GenieACS Dashboard',
                currentPath: '/genieacs',
                connectionStatus: connectionTest,
                stats
            });
        } catch (error: any) {
            console.error('Error loading GenieACS dashboard:', error);
            res.render('genieacs/dashboard', {
                title: 'GenieACS Dashboard',
                currentPath: '/genieacs',
                connectionStatus: { success: false, message: error.message },
                stats: { totalDevices: 0, onlineDevices: 0, offlineDevices: 0, recentFaults: 0 }
            });
        }
    }

    /**
     * Device list
     */
    static async devices(req: Request, res: Response) {
        try {
            const genieacs = await GenieacsService.getInstanceFromDb();
            const page = parseInt(req.query.page as string) || 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            const statusFilter = req.query.status as string || '';

            // 1. Prepare Filter Query
            const query: any = {};
            const fiveMinutes = 5 * 60 * 1000;
            const thresholdTime = new Date(Date.now() - fiveMinutes).toISOString();

            if (statusFilter === 'online') {
                query._lastInform = { $gt: thresholdTime };
            } else if (statusFilter === 'offline') {
                query._lastInform = { $lt: thresholdTime };
            }

            // 2. Get List for View (Filtered)
            const devices = await genieacs.getDevices(limit, skip, [], query);
            const totalCount = await genieacs.getDeviceCount(query);
            const totalPages = Math.ceil(totalCount / limit);

            // 3. Calculate Global Stats (Unaffected by filter)
            // Note: In production with thousands of devices, use MongoDB count queries internally.
            const allDevicesStats = await genieacs.getDevices(1000, 0, ['_id', '_lastInform']);
            const now = Date.now();

            let onlineCount = 0;
            let offlineCount = 0;

            allDevicesStats.forEach(d => {
                const lastInform = d._lastInform ? new Date(d._lastInform).getTime() : 0;
                if ((now - lastInform) < fiveMinutes) onlineCount++;
                else offlineCount++;
            });

            const stats = {
                total: allDevicesStats.length,
                online: onlineCount,
                offline: offlineCount
            };

            // 4. Get Customers for Matching
            const [customers] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name, phone, pppoe_username FROM customers'
            );

            // Map by PPPoE Username (lowercase)
            const customerByPPPoE = new Map();
            const customerById = new Map();
            customers.forEach((c: any) => {
                customerById.set(c.id, c);
                if (c.pppoe_username) customerByPPPoE.set(c.pppoe_username.toLowerCase(), c);
            });

            // 5. Get Network Devices
            const [netDevices] = await databasePool.query<RowDataPacket[]>(
                'SELECT customer_id, genieacs_serial FROM network_devices WHERE device_type="ont" AND genieacs_serial IS NOT NULL'
            );
            const customerBySerial = new Map();
            netDevices.forEach((nd: any) => {
                const c = customerById.get(nd.customer_id);
                if (c) customerBySerial.set(nd.genieacs_serial, c);
            });

            // 6. Extract device info & Match
            const devicesList = devices.map(device => {
                const deviceInfo = {
                    id: device._id,
                    ...genieacs.extractDeviceInfo(device),
                    tags: device._tags || [],
                    customer: null as any
                };

                // Match Customer
                let customer = customerBySerial.get(deviceInfo.serialNumber);
                if (!customer) {
                    const pppoe = genieacs.getPPPoEDetails(device);
                    if (pppoe.username && pppoe.username !== '-') {
                        customer = customerByPPPoE.get(pppoe.username.toLowerCase());
                    }
                }

                if (customer) {
                    deviceInfo.customer = {
                        id: customer.id,
                        name: customer.name,
                        phone: customer.phone
                    };
                }

                return deviceInfo;
            });

            res.render('genieacs/devices', {
                title: 'Daftar Devices - GenieACS',
                currentPath: '/genieacs/devices',
                devices: devicesList,
                stats,
                statusFilter,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit
                }
            });
        } catch (error: any) {
            console.error('Error getting devices:', error);
            res.status(500).render('error', {
                title: 'Error',
                message: error.message
            });
        }
    }

    /**
     * Device detail
     */
    static async deviceDetail(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const genieacs = await GenieacsService.getInstanceFromDb();

            const device = await genieacs.getDevice(id);
            if (!device) {
                req.flash('error', 'Device tidak ditemukan');
                return res.redirect('/genieacs/devices');
            }

            const deviceInfo = genieacs.extractDeviceInfo(device);
            const tasks = await genieacs.getDeviceTasks(id);
            const signalInfo = genieacs.getSignalInfo(device);
            const wifiSettings = genieacs.getWiFiDetails(device);

            // Use generic WAN Status instead of just PPPoE
            const wanStatus = genieacs.getWanStatus(device);

            // Legacy support for view (can be removed if view is updated completely)
            const pppoeSettings = { username: wanStatus.username, password: '' };

            // Robust Customer Fetching
            let customer = null;

            // 1. Try via network_devices (Serial)
            const [netDevices] = await databasePool.query<RowDataPacket[]>(
                'SELECT customer_id FROM network_devices WHERE device_type="ont" AND genieacs_serial = ? LIMIT 1',
                [deviceInfo.serialNumber]
            );

            if (netDevices.length > 0 && netDevices[0].customer_id) {
                const [custs] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id, name, phone, address FROM customers WHERE id = ?',
                    [netDevices[0].customer_id]
                );
                if (custs.length > 0) customer = custs[0];
            }

            // 2. Try via PPPoE Username
            if (!customer && wanStatus.username && wanStatus.username !== '-') {
                const [custs] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id, name, phone, address FROM customers WHERE pppoe_username = ?',
                    [wanStatus.username]
                );
                if (custs.length > 0) customer = custs[0];
            }

            res.render('genieacs/device-detail', {
                title: `Device ${deviceInfo.serialNumber} - GenieACS`,
                currentPath: '/genieacs/devices',
                device,
                deviceInfo,
                tasks,
                signalInfo,
                wifiSettings,
                wanStatus, // Pass full WAN status
                pppoeSettings,
                customer
            });
        } catch (error: any) {
            console.error('Error loading device detail:', error);
            req.flash('error', `Gagal memuat detail device: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }

    /**
     * Reboot device
     */
    static async rebootDevice(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const genieacs = await GenieacsService.getInstanceFromDb();

            const result = await genieacs.rebootDevice(id);

            if (result.success) {
                req.flash('success', 'Perintah reboot berhasil dikirim');
            } else {
                req.flash('error', `Gagal mengirim perintah reboot: ${result.message}`);
            }

            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        } catch (error: any) {
            console.error('Error rebooting device:', error);
            req.flash('error', `Gagal reboot device: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }

    /**
     * Refresh device
     */
    static async refreshDevice(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const genieacs = await GenieacsService.getInstanceFromDb();

            const result = await genieacs.refreshDevice(id);

            if (result.success) {
                req.flash('success', 'Perintah refresh berhasil dikirim');
            } else {
                req.flash('error', `Gagal mengirim perintah refresh: ${result.message}`);
            }

            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        } catch (error: any) {
            console.error('Error refreshing device:', error);
            req.flash('error', `Gagal refresh device: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }

    /**
     * API: Get devices (JSON)
     */
    static async apiGetDevices(req: Request, res: Response) {
        try {
            const genieacs = await GenieacsService.getInstanceFromDb();
            const limit = parseInt(req.query.limit as string) || 100;
            const skip = parseInt(req.query.skip as string) || 0;

            const devices = await genieacs.getDevices(limit, skip);
            const devicesList = devices.map(device => ({
                id: device._id,
                ...genieacs.extractDeviceInfo(device),
                tags: device._tags || []
            }));

            res.json({
                success: true,
                data: devicesList,
                count: devicesList.length
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * API: Test connection
     */
    static async apiTestConnection(req: Request, res: Response) {
        try {
            const genieacs = await GenieacsService.getInstanceFromDb();
            const result = await genieacs.testConnection();
            res.json(result);
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Change WiFi credentials
     */
    static async changeWiFiCredentials(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { ssid, password } = req.body;

            if (!ssid || !password) {
                req.flash('error', 'SSID dan Password wajib diisi');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            if (password.length < 8) {
                req.flash('error', 'Password WiFi minimal 8 karakter');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            const genieacs = await GenieacsService.getInstanceFromDb();
            const result = await genieacs.changeWiFiCredentials(id, ssid, password);

            if (result.success) {
                req.flash('success', `WiFi credentials berhasil diubah! SSID: ${ssid}`);
            } else {
                req.flash('error', `Gagal mengubah WiFi credentials: ${result.message}`);
            }

            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        } catch (error: any) {
            console.error('Error changing WiFi credentials:', error);
            req.flash('error', `Gagal mengubah WiFi credentials: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }

    /**
     * Change PPPoE credentials
     */
    static async changePPPoECredentials(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { username, password } = req.body;

            if (!username || !password) {
                req.flash('error', 'PPPoE Username dan Password wajib diisi');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            const genieacs = await GenieacsService.getInstanceFromDb();
            const result = await genieacs.updatePPPoECredentials(id, username, password);

            if (result.success) {
                req.flash('success', `PPPoE credentials berhasil di-update! User: ${username}`);
            } else {
                req.flash('error', `Gagal meng-update PPPoE credentials: ${result.message}`);
            }

            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        } catch (error: any) {
            console.error('Error changing PPPoE credentials:', error);
            req.flash('error', `Gagal meng-update PPPoE credentials: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }

    /**
     * Configure WAN Connection (PPPoE/Bridge/Static/DHCP)
     */
    static async configureWan(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const {
                wanMode, // 'pppoe', 'bridge', 'static', 'dhcp'
                vlanId,
                pppUsername,
                pppPassword,
                ipAddress,
                subnetMask,
                gateway,
                dnsServers,
                enableConnection
            } = req.body;

            const genieacs = await GenieacsService.getInstanceFromDb();
            const vlanIdNum = parseInt(vlanId, 10);

            if (isNaN(vlanIdNum) || vlanIdNum < 1 || vlanIdNum > 4094) {
                req.flash('error', 'VLAN ID harus valid (1-4094)');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            const enable = enableConnection === '1' || enableConnection === 'on' || enableConnection === true;
            let result;

            if (wanMode === 'pppoe') {
                if (!pppUsername || !pppPassword) {
                    req.flash('error', 'Username & Password wajib untuk PPPoE');
                    return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
                }
                result = await genieacs.configureWanPPP(id, {
                    wanDeviceIndex: 1,
                    connectionDeviceIndex: 1,
                    pppConnectionIndex: 1,
                    username: pppUsername,
                    password: pppPassword,
                    vlanId: vlanIdNum,
                    enable
                });
            } else if (wanMode === 'bridge') {
                result = await genieacs.configureWanIP(id, {
                    connectionType: 'IP_Bridged',
                    addressingType: 'DHCP', // Usually irrelevant for Bridge but required by schema
                    vlanId: vlanIdNum,
                    enable
                });
            } else if (wanMode === 'static') {
                if (!ipAddress || !subnetMask) {
                    req.flash('error', 'IP Address & Subnet Mask wajib untuk Static IP');
                    return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
                }
                result = await genieacs.configureWanIP(id, {
                    connectionType: 'IP_Routed',
                    addressingType: 'Static',
                    ipAddress,
                    subnetMask,
                    gateway,
                    dnsServers,
                    vlanId: vlanIdNum,
                    enable
                });
            } else if (wanMode === 'dhcp') {
                result = await genieacs.configureWanIP(id, {
                    connectionType: 'IP_Routed',
                    addressingType: 'DHCP',
                    vlanId: vlanIdNum,
                    enable
                });
            } else {
                req.flash('error', 'Mode WAN tidak valid');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            if (result.success) {
                req.flash('success', `Konfigurasi WAN (${wanMode.toUpperCase()}) berhasil dikirim!`);
            } else {
                req.flash('error', `Gagal konfigurasi WAN: ${result.message}`);
            }

            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        } catch (error: any) {
            console.error('Error configuring WAN:', error);
            req.flash('error', `Gagal konfigurasi WAN: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }

    /**
     * Sync All Tags (Bulk)
     */
    static async syncAllTags(req: Request, res: Response) {
        try {
            const genieacs = await GenieacsService.getInstanceFromDb();
            // Fetch up to 200 devices for sync to avoid timeout
            const devices = await genieacs.getDevices(200, 0);

            // 1. Get Customers
            const [customers] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name, pppoe_username FROM customers'
            );
            const customerByPPPoE = new Map();
            const customerById = new Map();
            customers.forEach((c: any) => {
                customerById.set(c.id, c);
                if (c.pppoe_username) customerByPPPoE.set(c.pppoe_username.toLowerCase(), c);
            });

            // 2. Get Network Devices
            const [netDevices] = await databasePool.query<RowDataPacket[]>(
                'SELECT customer_id, genieacs_serial FROM network_devices WHERE device_type="ont" AND genieacs_serial IS NOT NULL'
            );
            const customerBySerial = new Map();
            netDevices.forEach((nd: any) => {
                const c = customerById.get(nd.customer_id);
                if (c) customerBySerial.set(nd.genieacs_serial, c);
            });

            let syncedCount = 0;
            const updates = [];

            for (const device of devices) {
                const serialNumber = device._deviceId?._SerialNumber;
                if (!serialNumber) continue;

                let customer = customerBySerial.get(serialNumber);
                if (!customer) {
                    const pppoe = genieacs.getPPPoEDetails(device);
                    if (pppoe.username && pppoe.username !== '-') {
                        customer = customerByPPPoE.get(pppoe.username.toLowerCase());
                    }
                }

                if (customer) {
                    const tagName = customer.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                    // Check if tag already exists
                    if (!device._tags || !device._tags.includes(tagName)) {
                        updates.push(genieacs.addDeviceTag(device._id, tagName));
                        syncedCount++;
                    }
                }
            }

            // Process in chunks of 10 to avoid overwhelming GenieACS
            for (let i = 0; i < updates.length; i += 10) {
                const chunk = updates.slice(i, i + 10);
                await Promise.all(chunk);
            }

            req.flash('success', `Berhasil sinkronisasi tag untuk ${syncedCount} devices.`);
            res.redirect('/genieacs/devices');

        } catch (error: any) {
            console.error('Error syncing all tags:', error);
            req.flash('error', `Gagal sync tags: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }

    /**
     * Sync Customer Name as Tag to GenieACS
     */
    static async syncCustomerTag(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const genieacs = await GenieacsService.getInstanceFromDb();

            // 1. Get device first to get Serial Number
            const device = await genieacs.getDevice(id);
            if (!device) {
                req.flash('error', 'Device tidak ditemukan');
                return res.redirect('/genieacs/devices');
            }
            const serialNumber = device._deviceId._SerialNumber;

            // 2. Find Customer (Robust Match)
            let customerName = null;

            // A. Try via network_devices (Serial)
            const [netDevices] = await databasePool.query<RowDataPacket[]>(
                'SELECT customer_id FROM network_devices WHERE device_type="ont" AND genieacs_serial = ? LIMIT 1',
                [serialNumber]
            );

            if (netDevices.length > 0 && netDevices[0].customer_id) {
                const [custs] = await databasePool.query<RowDataPacket[]>(
                    'SELECT name FROM customers WHERE id = ?',
                    [netDevices[0].customer_id]
                );
                if (custs.length > 0) customerName = custs[0].name;
            }

            // B. Try via PPPoE Username (if needed)
            if (!customerName) {
                const pppoe = genieacs.getPPPoEDetails(device);
                if (pppoe.username && pppoe.username !== '-') {
                    const [custs] = await databasePool.query<RowDataPacket[]>(
                        'SELECT name FROM customers WHERE pppoe_username = ?',
                        [pppoe.username]
                    );
                    if (custs.length > 0) customerName = custs[0].name;
                }
            }

            if (!customerName) {
                req.flash('error', 'Tidak ada customer yang terhubung dengan device ini (Serial/PPPoE mismatch).');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            // 3. Sanitize Tag Name (GenieACS tags might have restrictions, keeping it alphanumeric + simple chars)
            // Replace spaces with underscores, remove weird chars
            const tagName = customerName.replace(/[^a-zA-Z0-9_-]/g, '_');

            // 4. Push Tag
            const success = await genieacs.addDeviceTag(id, tagName);

            if (success) {
                req.flash('success', `Tag berhasil ditambahkan: ${tagName}`);
            } else {
                req.flash('error', 'Gagal menambahkan tag ke GenieACS.');
            }

            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        } catch (error: any) {
            console.error('Error syncing customer tag:', error);
            req.flash('error', `Error system: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }
}

export default GenieacsController;
