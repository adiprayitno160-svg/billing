"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WiFiAdminController = void 0;
const WiFiManagementService_1 = require("../services/genieacs/WiFiManagementService");
const WiFiDatabaseSetup_1 = require("../services/genieacs/WiFiDatabaseSetup");
const GenieacsService_1 = require("../services/genieacs/GenieacsService");
const pool_1 = require("../db/pool");
class WiFiAdminController {
    /**
     * Dashboard WiFi Management
     */
    static async dashboard(req, res) {
        try {
            const stats = await WiFiDatabaseSetup_1.WiFiDatabaseSetup.getStats();
            // Get recent requests
            const [recentRequests] = await pool_1.databasePool.query(`SELECT * FROM wifi_change_requests 
                ORDER BY requested_at DESC 
                LIMIT 10`);
            res.render('wifi/dashboard', {
                title: 'WiFi Management - Dashboard',
                currentPath: '/wifi-admin',
                stats,
                recentRequests
            });
        }
        catch (error) {
            console.error('Error loading WiFi dashboard:', error);
            req.flash('error', `Gagal memuat dashboard: ${error.message}`);
            res.redirect('/dashboard');
        }
    }
    /**
     * Manage Customer Devices (Assign device_id)
     */
    static async manageDevices(req, res) {
        try {
            // Get all customers
            const [customers] = await pool_1.databasePool.query(`SELECT id, name, phone, device_id, address 
                FROM customers 
                ORDER BY name ASC`);
            // Get GenieACS devices
            const genieacs = GenieacsService_1.GenieacsService.getInstance();
            let genieacsDevices = [];
            try {
                const devices = await genieacs.getDevices(100);
                genieacsDevices = devices.map(device => ({
                    id: device._id,
                    ...genieacs.extractDeviceInfo(device)
                }));
            }
            catch (error) {
                console.error('Error fetching GenieACS devices:', error);
            }
            res.render('wifi/manage-devices', {
                title: 'WiFi Management - Assign Devices',
                currentPath: '/wifi-admin/devices',
                customers,
                genieacsDevices
            });
        }
        catch (error) {
            console.error('Error loading manage devices:', error);
            req.flash('error', `Gagal memuat halaman: ${error.message}`);
            res.redirect('/wifi-admin');
        }
    }
    /**
     * Assign device to customer
     */
    static async assignDevice(req, res) {
        try {
            const { customer_id, device_id } = req.body;
            if (!customer_id || !device_id) {
                req.flash('error', 'Customer ID dan Device ID harus diisi');
                return res.redirect('/wifi-admin/devices');
            }
            await pool_1.databasePool.execute(`UPDATE customers SET device_id = ? WHERE id = ?`, [device_id, customer_id]);
            req.flash('success', 'Device berhasil di-assign ke customer');
            res.redirect('/wifi-admin/devices');
        }
        catch (error) {
            console.error('Error assigning device:', error);
            req.flash('error', `Gagal assign device: ${error.message}`);
            res.redirect('/wifi-admin/devices');
        }
    }
    /**
     * Remove device from customer
     */
    static async removeDevice(req, res) {
        try {
            const { customer_id } = req.body;
            await pool_1.databasePool.execute(`UPDATE customers SET device_id = NULL WHERE id = ?`, [customer_id]);
            req.flash('success', 'Device berhasil dihapus dari customer');
            res.redirect('/wifi-admin/devices');
        }
        catch (error) {
            console.error('Error removing device:', error);
            req.flash('error', `Gagal hapus device: ${error.message}`);
            res.redirect('/wifi-admin/devices');
        }
    }
    /**
     * View WiFi change history
     */
    static async history(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 20;
            const offset = (page - 1) * limit;
            const status = req.query.status || 'all';
            const customerId = req.query.customer_id;
            let whereClause = '';
            const params = [];
            if (status !== 'all') {
                whereClause = 'WHERE status = ?';
                params.push(status);
            }
            if (customerId) {
                whereClause += (whereClause ? ' AND' : 'WHERE') + ' customer_id = ?';
                params.push(customerId);
            }
            // Get total count
            const [countResult] = await pool_1.databasePool.query(`SELECT COUNT(*) as total FROM wifi_change_requests ${whereClause}`, params);
            const total = countResult[0]?.total || 0;
            // Get requests
            const [requests] = await pool_1.databasePool.query(`SELECT * FROM wifi_change_requests 
                ${whereClause}
                ORDER BY requested_at DESC 
                LIMIT ? OFFSET ?`, [...params, limit, offset]);
            const totalPages = Math.ceil(total / limit);
            res.render('wifi/history', {
                title: 'WiFi Management - History',
                currentPath: '/wifi-admin/history',
                requests,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                },
                filters: {
                    status,
                    customerId
                }
            });
        }
        catch (error) {
            console.error('Error loading history:', error);
            req.flash('error', `Gagal memuat history: ${error.message}`);
            res.redirect('/wifi-admin');
        }
    }
    /**
     * Manual WiFi change by admin
     */
    static async manualChange(req, res) {
        try {
            const { customer_id, new_ssid, new_password } = req.body;
            if (!customer_id) {
                req.flash('error', 'Customer harus dipilih');
                return res.redirect('/wifi-admin');
            }
            if (!new_ssid && !new_password) {
                req.flash('error', 'SSID atau Password harus diisi');
                return res.redirect('/wifi-admin');
            }
            // Get customer
            const [customers] = await pool_1.databasePool.query(`SELECT * FROM customers WHERE id = ?`, [customer_id]);
            if (customers.length === 0) {
                req.flash('error', 'Customer tidak ditemukan');
                return res.redirect('/wifi-admin');
            }
            const customer = customers[0];
            if (!customer || !customer.device_id) {
                req.flash('error', 'Customer belum di-assign device');
                return res.redirect('/wifi-admin');
            }
            // Change WiFi
            const wifiService = new WiFiManagementService_1.WiFiManagementService();
            const result = await wifiService.changeWiFiCredentials(customer.device_id, new_ssid || undefined, new_password || undefined);
            // Save to database
            await wifiService.saveWiFiChangeRequest({
                customerId: customer.id,
                customerName: customer.name,
                phone: customer.phone || '-',
                deviceId: customer.device_id,
                newSSID: new_ssid || undefined,
                newPassword: new_password || undefined,
                requestedAt: new Date(),
                status: result.success ? 'completed' : 'failed',
                errorMessage: result.success ? undefined : result.message
            });
            if (result.success) {
                req.flash('success', `WiFi berhasil diubah untuk customer ${customer.name}`);
            }
            else {
                req.flash('error', `Gagal mengubah WiFi: ${result.message}`);
            }
            res.redirect('/wifi-admin');
        }
        catch (error) {
            console.error('Error manual WiFi change:', error);
            req.flash('error', `Gagal mengubah WiFi: ${error.message}`);
            res.redirect('/wifi-admin');
        }
    }
    /**
     * API: Get customer by ID (for AJAX)
     */
    static async apiGetCustomer(req, res) {
        try {
            const { id } = req.params;
            const [customers] = await pool_1.databasePool.query(`SELECT * FROM customers WHERE id = ?`, [id]);
            if (customers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer tidak ditemukan'
                });
            }
            res.json({
                success: true,
                data: customers[0]
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
     * API: Get WiFi config from device
     */
    static async apiGetWiFiConfig(req, res) {
        try {
            const { device_id } = req.params;
            const wifiService = new WiFiManagementService_1.WiFiManagementService();
            const config = await wifiService.getWiFiConfig(device_id);
            res.json({
                success: true,
                data: config
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}
exports.WiFiAdminController = WiFiAdminController;
exports.default = WiFiAdminController;
//# sourceMappingURL=WiFiAdminController.js.map