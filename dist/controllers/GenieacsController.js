"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenieacsController = void 0;
const GenieacsService_1 = require("../services/genieacs/GenieacsService");
const pool_1 = require("../db/pool");
class GenieacsController {
    /**
     * Dashboard GenieACS
     */
    static async dashboard(req, res) {
        try {
            const genieacs = GenieacsService_1.GenieacsService.getInstance();
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
                    }
                    else {
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
        }
        catch (error) {
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
    static async devices(req, res) {
        try {
            const genieacs = GenieacsService_1.GenieacsService.getInstance();
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            const devices = await genieacs.getDevices(limit, skip);
            const totalCount = await genieacs.getDeviceCount();
            const totalPages = Math.ceil(totalCount / limit);
            // Get all customers with device_id from billing
            const [customers] = await pool_1.databasePool.query('SELECT id, name, phone, device_id FROM customers WHERE device_id IS NOT NULL');
            // Create a map of device_id to customer
            const customerMap = new Map();
            customers.forEach((customer) => {
                customerMap.set(customer.device_id, customer);
            });
            // Extract device info and add customer name
            const devicesList = devices.map(device => {
                const deviceInfo = {
                    id: device._id,
                    ...genieacs.extractDeviceInfo(device),
                    tags: device._tags || [],
                    customer: null
                };
                // Try to match customer by device serial number
                const customer = customerMap.get(deviceInfo.serialNumber);
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
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });
        }
        catch (error) {
            console.error('Error loading devices:', error);
            req.flash('error', `Gagal memuat daftar devices: ${error.message}`);
            res.redirect('/genieacs');
        }
    }
    /**
     * Device detail
     */
    static async deviceDetail(req, res) {
        try {
            const { id } = req.params;
            const genieacs = GenieacsService_1.GenieacsService.getInstance();
            const device = await genieacs.getDevice(id);
            if (!device) {
                req.flash('error', 'Device tidak ditemukan');
                return res.redirect('/genieacs/devices');
            }
            const deviceInfo = genieacs.extractDeviceInfo(device);
            const tasks = await genieacs.getDeviceTasks(id);
            const signalInfo = genieacs.getSignalInfo(device);
            const wifiSettings = genieacs.getWiFiDetails(device);
            // Get customer info from billing
            const [customers] = await pool_1.databasePool.query('SELECT id, name, phone, address FROM customers WHERE device_id = ? LIMIT 1', [deviceInfo.serialNumber]);
            const customer = customers.length > 0 ? customers[0] : null;
            res.render('genieacs/device-detail', {
                title: `Device ${deviceInfo.serialNumber} - GenieACS`,
                currentPath: '/genieacs/devices',
                device,
                deviceInfo,
                tasks,
                signalInfo,
                wifiSettings,
                customer
            });
        }
        catch (error) {
            console.error('Error loading device detail:', error);
            req.flash('error', `Gagal memuat detail device: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }
    /**
     * Reboot device
     */
    static async rebootDevice(req, res) {
        try {
            const { id } = req.params;
            const genieacs = GenieacsService_1.GenieacsService.getInstance();
            const result = await genieacs.rebootDevice(id);
            if (result.success) {
                req.flash('success', 'Perintah reboot berhasil dikirim');
            }
            else {
                req.flash('error', `Gagal mengirim perintah reboot: ${result.message}`);
            }
            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        }
        catch (error) {
            console.error('Error rebooting device:', error);
            req.flash('error', `Gagal reboot device: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }
    /**
     * Refresh device
     */
    static async refreshDevice(req, res) {
        try {
            const { id } = req.params;
            const genieacs = GenieacsService_1.GenieacsService.getInstance();
            const result = await genieacs.refreshDevice(id);
            if (result.success) {
                req.flash('success', 'Perintah refresh berhasil dikirim');
            }
            else {
                req.flash('error', `Gagal mengirim perintah refresh: ${result.message}`);
            }
            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        }
        catch (error) {
            console.error('Error refreshing device:', error);
            req.flash('error', `Gagal refresh device: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }
    /**
     * API: Get devices (JSON)
     */
    static async apiGetDevices(req, res) {
        try {
            const genieacs = GenieacsService_1.GenieacsService.getInstance();
            const limit = parseInt(req.query.limit) || 100;
            const skip = parseInt(req.query.skip) || 0;
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
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    /**
     * API: Test connection
     */
    static async apiTestConnection(req, res) {
        try {
            const genieacs = GenieacsService_1.GenieacsService.getInstance();
            const result = await genieacs.testConnection();
            res.json(result);
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    /**
     * Change WiFi credentials
     */
    static async changeWiFiCredentials(req, res) {
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
            const genieacs = GenieacsService_1.GenieacsService.getInstance();
            const result = await genieacs.changeWiFiCredentials(id, ssid, password);
            if (result.success) {
                req.flash('success', `WiFi credentials berhasil diubah! SSID: ${ssid}`);
            }
            else {
                req.flash('error', `Gagal mengubah WiFi credentials: ${result.message}`);
            }
            res.redirect(`/genieacs/devices/${encodeURIComponent(id)}`);
        }
        catch (error) {
            console.error('Error changing WiFi credentials:', error);
            req.flash('error', `Gagal mengubah WiFi credentials: ${error.message}`);
            res.redirect('/genieacs/devices');
        }
    }
}
exports.GenieacsController = GenieacsController;
exports.default = GenieacsController;
//# sourceMappingURL=GenieacsController.js.map