"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WiFiManagementService = void 0;
const GenieacsService_1 = require("./GenieacsService");
const pool_1 = require("../../db/pool");
class WiFiManagementService {
    constructor() {
        this.genieacs = GenieacsService_1.GenieacsService.getInstance();
    }
    /**
     * Get WiFi configuration from device
     */
    async getWiFiConfig(deviceId) {
        try {
            const device = await this.genieacs.getDevice(deviceId);
            if (!device) {
                throw new Error('Device not found');
            }
            // Try different paths for different CPE models
            const ssid = this.getWiFiParameter(device, 'SSID');
            const password = this.getWiFiParameter(device, 'KeyPassphrase') ||
                this.getWiFiParameter(device, 'PreSharedKey');
            const encryption = this.getWiFiParameter(device, 'BeaconType') ||
                this.getWiFiParameter(device, 'ModeEnabled');
            const enabled = this.getWiFiParameter(device, 'Enable') === true ||
                this.getWiFiParameter(device, 'Enable') === '1';
            return {
                ssid: ssid || '',
                password: password || '',
                encryption: encryption || 'WPA2-PSK',
                enabled
            };
        }
        catch (error) {
            console.error('Error getting WiFi config:', error);
            throw error;
        }
    }
    /**
     * Change WiFi SSID and/or Password
     */
    async changeWiFiCredentials(deviceId, newSSID, newPassword) {
        try {
            if (!newSSID && !newPassword) {
                return {
                    success: false,
                    message: 'Minimal satu parameter (SSID atau Password) harus diisi'
                };
            }
            const device = await this.genieacs.getDevice(deviceId);
            if (!device) {
                return {
                    success: false,
                    message: 'Device tidak ditemukan'
                };
            }
            // Determine the parameter paths based on device model
            const paths = this.getWiFiParameterPaths(device);
            const parameters = [];
            // Set SSID if provided
            if (newSSID) {
                parameters.push([paths.ssid, newSSID, 'xsd:string']);
            }
            // Set Password if provided
            if (newPassword) {
                // Validate password length (WPA2 requires 8-63 characters)
                if (newPassword.length < 8 || newPassword.length > 63) {
                    return {
                        success: false,
                        message: 'Password harus antara 8-63 karakter'
                    };
                }
                parameters.push([paths.password, newPassword, 'xsd:string']);
            }
            // Execute parameter changes
            const result = await this.genieacs.setParameterValues(deviceId, parameters);
            if (!result.success) {
                return result;
            }
            // Optionally reboot device to apply changes
            // await this.genieacs.rebootDevice(deviceId);
            return {
                success: true,
                message: 'Perubahan WiFi berhasil dikirim. Perubahan akan diterapkan dalam beberapa saat.',
                taskId: result.taskId
            };
        }
        catch (error) {
            console.error('Error changing WiFi credentials:', error);
            return {
                success: false,
                message: `Gagal mengubah WiFi: ${error.message}`
            };
        }
    }
    /**
     * Get WiFi parameter from device (helper)
     */
    getWiFiParameter(device, paramName) {
        // Try InternetGatewayDevice model (TR-098)
        const igdPaths = [
            `InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.${paramName}`,
            `InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.${paramName}`,
            `InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.${paramName}` // 5GHz
        ];
        // Try Device model (TR-181)
        const devicePaths = [
            `Device.WiFi.SSID.1.${paramName}`,
            `Device.WiFi.SSID.2.${paramName}`,
            `Device.WiFi.AccessPoint.1.Security.${paramName}`,
            `Device.WiFi.AccessPoint.2.Security.${paramName}`
        ];
        const allPaths = [...igdPaths, ...devicePaths];
        for (const path of allPaths) {
            const value = this.genieacs.getDeviceParameter(device, path);
            if (value !== null && value !== undefined) {
                return value;
            }
        }
        return null;
    }
    /**
     * Get WiFi parameter paths based on device model
     */
    getWiFiParameterPaths(device) {
        // Check if device uses TR-098 or TR-181
        const isTR098 = device.InternetGatewayDevice !== undefined;
        if (isTR098) {
            return {
                ssid: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
                password: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase',
                encryption: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.BeaconType',
                enable: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable'
            };
        }
        else {
            return {
                ssid: 'Device.WiFi.SSID.1.SSID',
                password: 'Device.WiFi.AccessPoint.1.Security.KeyPassphrase',
                encryption: 'Device.WiFi.AccessPoint.1.Security.ModeEnabled',
                enable: 'Device.WiFi.SSID.1.Enable'
            };
        }
    }
    /**
     * Save WiFi change request to database
     */
    async saveWiFiChangeRequest(request) {
        try {
            const [result] = await pool_1.databasePool.execute(`INSERT INTO wifi_change_requests 
                (customer_id, customer_name, phone, device_id, new_ssid, new_password, 
                 requested_at, status, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                request.customerId,
                request.customerName,
                request.phone,
                request.deviceId,
                request.newSSID || null,
                request.newPassword || null,
                request.requestedAt,
                request.status,
                request.errorMessage || null
            ]);
            return result.insertId;
        }
        catch (error) {
            console.error('Error saving WiFi change request:', error);
            throw error;
        }
    }
    /**
     * Update WiFi change request status
     */
    async updateWiFiChangeRequestStatus(requestId, status, errorMessage) {
        try {
            await pool_1.databasePool.execute(`UPDATE wifi_change_requests 
                SET status = ?, error_message = ?, updated_at = NOW()
                WHERE id = ?`, [status, errorMessage || null, requestId]);
        }
        catch (error) {
            console.error('Error updating WiFi change request status:', error);
            throw error;
        }
    }
    /**
     * Get customer's device ID from database
     */
    async getCustomerDeviceId(customerId) {
        try {
            const [rows] = await pool_1.databasePool.execute(`SELECT device_id FROM customers WHERE id = ? AND device_id IS NOT NULL`, [customerId]);
            if (rows.length === 0 || !rows[0]) {
                return null;
            }
            return rows[0].device_id || null;
        }
        catch (error) {
            console.error('Error getting customer device ID:', error);
            return null;
        }
    }
    /**
     * Get WiFi change request history for customer
     */
    async getCustomerWiFiHistory(customerId, limit = 10) {
        try {
            const [rows] = await pool_1.databasePool.execute(`SELECT * FROM wifi_change_requests 
                WHERE customer_id = ? 
                ORDER BY requested_at DESC 
                LIMIT ?`, [customerId, limit]);
            return rows;
        }
        catch (error) {
            console.error('Error getting WiFi history:', error);
            return [];
        }
    }
    /**
     * Reboot customer device
     */
    async rebootCustomerDevice(customerId) {
        try {
            const deviceId = await this.getCustomerDeviceId(customerId);
            if (!deviceId) {
                return {
                    success: false,
                    message: 'Device tidak ditemukan'
                };
            }
            const result = await this.genieacs.rebootDevice(deviceId);
            return {
                success: result.success,
                message: result.message
            };
        }
        catch (error) {
            console.error('Error rebooting customer device:', error);
            return {
                success: false,
                message: `Gagal me-reboot device: ${error.message}`
            };
        }
    }
}
exports.WiFiManagementService = WiFiManagementService;
exports.default = WiFiManagementService;
//# sourceMappingURL=WiFiManagementService.js.map