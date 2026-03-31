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
            const config = await GenieacsService.getConfigFromDb();

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
                stats,
                config
            });
        } catch (error: any) {
            console.error('Error loading GenieACS dashboard:', error);
            res.render('genieacs/dashboard', {
                title: 'GenieACS Dashboard',
                currentPath: '/genieacs',
                connectionStatus: { success: false, message: error.message },
                stats: { totalDevices: 0, onlineDevices: 0, offlineDevices: 0, recentFaults: 0 },
                config: { host: '192.168.239.154', port: 7557 }
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
                'SELECT id, name, phone, pppoe_username, serial_number FROM customers'
            );

            const customerByPPPoE = new Map();
            const customerById = new Map();
            const customerByCustomerSerial = new Map();

            customers.forEach((c: any) => {
                customerById.set(c.id, c);
                if (c.pppoe_username) customerByPPPoE.set(c.pppoe_username.toLowerCase(), c);
                if (c.serial_number) customerByCustomerSerial.set(c.serial_number, c);
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
                    customer = customerByCustomerSerial.get(deviceInfo.serialNumber);
                }
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
                    limit,
                    hasPrev: page > 1,
                    hasNext: page < totalPages
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

            // 3. Try via customers.serial_number (Fallback)
            if (!customer) {
                const [custs] = await databasePool.query<RowDataPacket[]>(
                    'SELECT id, name, phone, address FROM customers WHERE serial_number = ?',
                    [deviceInfo.serialNumber]
                );
                if (custs.length > 0) customer = custs[0];
            }

            // Get all customers for assignment dropdown
            const [allCustomers] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name, customer_code, phone FROM customers ORDER BY name ASC'
            );

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
                customer,
                allCustomers // Pass all customers for dropdown
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

            // Handle AJAX request
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.json(result);
            }

            if (result.success) {
                req.flash('success', 'Perintah reboot berhasil dikirim');
            } else {
                req.flash('error', `Gagal mengirim perintah reboot: ${result.message}`);
            }

            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        } catch (error: any) {
            console.error('Error rebooting device:', error);
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.status(500).json({ success: false, message: error.message });
            }
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

            // Handle AJAX request
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.json(result);
            }

            if (result.success) {
                req.flash('success', 'Perintah refresh berhasil dikirim');
            } else {
                req.flash('error', `Gagal mengirim perintah refresh: ${result.message}`);
            }

            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        } catch (error: any) {
            console.error('Error refreshing device:', error);
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.status(500).json({ success: false, message: error.message });
            }
            req.flash('error', `Gagal refresh device: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }

    /**
     * Refresh WiFi Info
     */
    static async refreshWiFi(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const genieacs = await GenieacsService.getInstanceFromDb();
            const result = await genieacs.refreshWiFi(id);

            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.json(result);
            }

            if (result.success) {
                req.flash('success', 'Perintah Refresh WiFi terkiri!');
            } else {
                req.flash('error', `Gagal Refresh WiFi: ${result.message}`);
            }
            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        } catch (error: any) {
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.status(500).json({ success: false, message: error.message });
            }
            req.flash('error', `Error: ${error.message}`);
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
                // Save WiFi credentials to database for customer lookup
                try {
                    // Get device serial number
                    const device = await genieacs.getDevice(id);
                    const serialNumber = device?._deviceId?._SerialNumber;

                    if (serialNumber) {
                        // Find customer by serial number and update WiFi credentials
                        await databasePool.query(
                            `UPDATE customers SET wifi_ssid = ?, wifi_password = ?, updated_at = NOW() 
                             WHERE serial_number = ?`,
                            [ssid, password, serialNumber]
                        );
                        console.log(`✅ WiFi credentials saved for device ${serialNumber}: SSID=${ssid}`);
                    }
                } catch (dbError) {
                    console.error('⚠️ Failed to save WiFi credentials to database:', dbError);
                    // Don't fail the whole operation, just log the error
                }

                // Auto-reboot after WiFi Change as requested
                const reboot = await genieacs.rebootDevice(id);
                if (reboot.success) {
                    req.flash('success', `WiFi credentials diubah dan tersimpan! SSID: ${ssid}. Device sedang direboot...`);
                } else {
                    req.flash('warning', `WiFi diubah, tapi gagal auto-reboot: ${reboot.message}`);
                }
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
                // Auto-reboot after WAN Config as requested
                const reboot = await genieacs.rebootDevice(id);
                if (reboot.success) {
                    req.flash('success', `Konfigurasi WAN (${wanMode.toUpperCase()}) dikirim! Device sedang direboot...`);
                } else {
                    req.flash('warning', `WAN dikonfigurasi, tapi gagal auto-reboot: ${reboot.message}`);
                }
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
     * Sync All Tags (Billing Customers -> GenieACS)
     * Enhanced to match by Serial OR PPPoE username
     */
    static async syncAllTags(req: Request, res: Response) {
        try {
            console.log('[SyncTags] Starting enhanced full sync from Billing to GenieACS...');
            const genieacs = await GenieacsService.getInstanceFromDb();

            // 1. Get all customers from DB
            const [customers] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name, serial_number, pppoe_username FROM customers'
            );

            // 2. Fetch devices from GenieACS with PPPoE info
            // Projection includes common PPPoE paths
            const projection = [
                '_id',
                '_deviceId._SerialNumber',
                '_tags',
                'VirtualParameters.pppoeUsername',
                'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username'
            ];

            const allDevices = await genieacs.getDevices(5000, 0, projection);

            // Build maps for efficient matching
            const deviceBySerial = new Map<string, any>();
            const deviceByPPPoE = new Map<string, any>();

            allDevices.forEach(d => {
                if (d._deviceId?._SerialNumber) {
                    deviceBySerial.set(d._deviceId._SerialNumber, d);
                }

                // Try to get PPPoE username from device
                const pppoe = genieacs.getPPPoEDetails(d);
                if (pppoe.username && pppoe.username !== '-') {
                    deviceByPPPoE.set(pppoe.username.toLowerCase(), d);
                }
            });

            console.log(`[SyncTags] Loaded ${allDevices.length} devices from GenieACS for matching.`);

            let syncedCount = 0;
            let skippedCount = 0;
            const updates: Promise<any>[] = [];

            for (const customer of customers) {
                let device = null;

                // A. Match by explicit Serial Number (Highest Priority)
                if (customer.serial_number && deviceBySerial.has(customer.serial_number)) {
                    device = deviceBySerial.get(customer.serial_number);
                }
                // B. Match by PPPoE Username (Secondary Priority)
                else if (customer.pppoe_username && deviceByPPPoE.has(customer.pppoe_username.toLowerCase())) {
                    device = deviceByPPPoE.get(customer.pppoe_username.toLowerCase());
                }

                if (device) {
                    const deviceId = device._id;
                    const currentTags = device._tags || [];

                    // Sanitize Tag (Allow spaces and dots if GenieACS supports them, but usually safest to underscores)
                    // We'll use underscores for consistency but keep it readable
                    const tagName = customer.name.replace(/[^a-zA-Z0-9.\s_-]/g, '').trim();

                    // Check if tag already exists
                    if (!currentTags.includes(tagName)) {
                        updates.push(genieacs.addDeviceTag(deviceId, tagName));
                        syncedCount++;

                        // If we are setting a new name tag, we might want to remove others? 
                        // But we don't know which tags are names. So we just add.
                    } else {
                        skippedCount++;
                    }
                }
            }

            // Execute in batches
            const BATCH_SIZE = 10;
            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                const chunk = updates.slice(i, i + BATCH_SIZE);
                await Promise.all(chunk);
            }

            req.flash('success', `Sync Berhasil! ${syncedCount} perangkat diperbarui dengan tag nama pelanggan. (${skippedCount} sudah sinkron)`);
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

            // A. Try via direct serial_number column in customers (Highest Priority)
            if (!customerName) {
                const [custs] = await databasePool.query<RowDataPacket[]>(
                    'SELECT name FROM customers WHERE serial_number = ? LIMIT 1',
                    [serialNumber]
                );
                if (custs.length > 0) customerName = custs[0].name;
            }

            // B. Try via network_devices (Serial)
            if (!customerName) {
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
            }

            // C. Try via PPPoE Username
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

            // 3. Sanitize Tag Name
            const tagName = customerName.replace(/[^a-zA-Z0-9.\s_-]/g, '').trim();

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

    /**
     * Assign Customer to Device (Link Serial Number)
     */
    static async assignCustomer(req: Request, res: Response) {
        try {
            const { id } = req.params; // Device ID
            const { customer_id } = req.body;

            if (!customer_id) {
                req.flash('error', 'Customer harus dipilih');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            const genieacs = await GenieacsService.getInstanceFromDb();

            // Get device to extract serial number
            const device = await genieacs.getDevice(id);
            if (!device) {
                req.flash('error', 'Device tidak ditemukan di GenieACS');
                return res.redirect('/genieacs/devices');
            }

            const serialNumber = device._deviceId?._SerialNumber;
            if (!serialNumber) {
                req.flash('error', 'Device tidak memiliki Serial Number');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            // Update customer's serial_number field
            await databasePool.query(
                'UPDATE customers SET serial_number = ? WHERE id = ?',
                [serialNumber, customer_id]
            );

            // Get customer name for flash message
            const [customers] = await databasePool.query<RowDataPacket[]>(
                'SELECT name FROM customers WHERE id = ?',
                [customer_id]
            );

            const customerName = customers.length > 0 ? customers[0].name : 'Customer';

            req.flash('success', `✓ ONT (SN: ${serialNumber}) berhasil di-link ke ${customerName}`);
            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);

        } catch (error: any) {
            console.error('Error assigning customer:', error);
            req.flash('error', `Gagal assign customer: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }

    /**
     * Unlink Customer from Device (Remove Serial Number)
     */
    static async unlinkCustomer(req: Request, res: Response) {
        try {
            const { id } = req.params; // Device ID

            const genieacs = await GenieacsService.getInstanceFromDb();

            // Get device to extract serial number
            const device = await genieacs.getDevice(id);
            if (!device) {
                req.flash('error', 'Device tidak ditemukan di GenieACS');
                return res.redirect('/genieacs/devices');
            }

            const serialNumber = device._deviceId?._SerialNumber;
            if (!serialNumber) {
                req.flash('error', 'Device tidak memiliki Serial Number');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            // Find and unlink customer
            const [customers] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, name FROM customers WHERE serial_number = ?',
                [serialNumber]
            );

            if (customers.length === 0) {
                req.flash('warning', 'Tidak ada customer yang ter-link dengan ONT ini');
                return res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
            }

            const customer = customers[0];

            // Remove serial number from customer
            await databasePool.query(
                'UPDATE customers SET serial_number = NULL WHERE id = ?',
                [customer.id]
            );

            req.flash('success', `✓ Link antara ${customer.name} dan ONT (SN: ${serialNumber}) berhasil diputus`);
            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);

        } catch (error: any) {
            console.error('Error unlinking customer:', error);
            req.flash('error', `Gagal unlink customer: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }
}

export default GenieacsController;
