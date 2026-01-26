"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenieacsWhatsAppController = void 0;
const GenieacsService_1 = require("../../services/genieacs/GenieacsService");
const pool_1 = require("../../db/pool");
class GenieacsWhatsAppController {
    /**
     * Helper to get customer by phone
     */
    static async getCustomer(phone) {
        // Normalize: remove all non-digits
        const cleanPhone = phone.replace(/\D/g, '');
        let body = cleanPhone;
        // remove leading 62
        if (body.startsWith('62'))
            body = body.substring(2);
        // remove leading 0
        if (body.startsWith('0'))
            body = body.substring(1);
        // Ensure body is long enough to be unique (at least 7 digits)
        if (body.length < 7) {
            // Fallback to exact match if too short
            const [rows] = await pool_1.databasePool.query(`SELECT * FROM customers WHERE phone = ? OR phone = ? LIMIT 1`, [cleanPhone, cleanPhone.replace(/^62/, '0')]);
            return rows[0] || null;
        }
        const [rows] = await pool_1.databasePool.query(`SELECT * FROM customers WHERE 
             phone = ? OR 
             phone = ? OR 
             phone LIKE ? OR
             phone LIKE ? LIMIT 1`, [
            cleanPhone, // 62812...
            '0' + body, // 0812...
            `%${body}`, // ...812...
            `%${body}%` // ...812... (wider match)
        ]);
        const res = rows;
        return res[0] || null;
    }
    /**
     * Handle WiFi password change via WhatsApp
     */
    static async changeWiFiPassword(phone, newPassword) {
        try {
            // Get customer by phone
            const customer = await this.getCustomer(phone);
            if (!customer) {
                return {
                    success: false,
                    message: '❌ Nomor tidak terdaftar. Silakan daftar terlebih dahulu.'
                };
            }
            // Validate password length
            if (newPassword.length < 8) {
                return {
                    success: false,
                    message: '⚠️ Password terlalu pendek. Minimal 8 karakter.'
                };
            }
            const genieacs = await GenieacsService_1.GenieacsService.getInstanceFromDb();
            // Find device
            let device = null;
            // Try by Serial Number
            if (customer.serial_number) {
                const devices = await genieacs.getDevicesBySerial(customer.serial_number);
                if (devices.length > 0)
                    device = devices[0];
            }
            // Fallback: Try by PPPoE Username
            if (!device && customer.pppoe_username) {
                const devices = await genieacs.getDevices(1, 0, [], {
                    "VirtualParameters.pppoeUsername": customer.pppoe_username
                });
                if (devices.length > 0)
                    device = devices[0];
            }
            if (!device) {
                return {
                    success: false,
                    message: '❌ Gagal menemukan perangkat Anda. Hubungi CS untuk bantuan.'
                };
            }
            // Get current WiFi SSID
            const wifiInfo = genieacs.getWiFiDetails(device);
            const ssid = wifiInfo.ssid || 'WIFI-KU';
            // Change WiFi credentials
            const result = await genieacs.changeWiFiCredentials(device._id, ssid, newPassword);
            if (result.success) {
                // Update database
                await pool_1.databasePool.query('UPDATE customers SET wifi_password = ? WHERE id = ?', [newPassword, customer.id]);
                return {
                    success: true,
                    message: `✅ *Password WiFi Berhasil Diganti!*

SSID: ${ssid}
Password: ${newPassword}

Mohon sambungkan ulang perangkat Anda.`
                };
            }
            else {
                return {
                    success: false,
                    message: `❌ Gagal mengganti password: ${result.message}`
                };
            }
        }
        catch (error) {
            console.error('[GenieacsWhatsApp] WiFi change error:', error);
            return {
                success: false,
                message: '❌ Terjadi kesalahan sistem saat mengganti password.'
            };
        }
    }
    /**
     * Handle ONT restart via WhatsApp
     */
    static async restartONT(phone) {
        try {
            // Get customer by phone
            const customer = await this.getCustomer(phone);
            if (!customer) {
                return {
                    success: false,
                    message: '❌ Nomor tidak terdaftar.'
                };
            }
            const genieacs = await GenieacsService_1.GenieacsService.getInstanceFromDb();
            // Find device
            let device = null;
            if (customer.serial_number) {
                const devices = await genieacs.getDevicesBySerial(customer.serial_number);
                if (devices.length > 0)
                    device = devices[0];
            }
            if (!device && customer.pppoe_username) {
                const devices = await genieacs.getDevices(1, 0, [], {
                    "VirtualParameters.pppoeUsername": customer.pppoe_username
                });
                if (devices.length > 0)
                    device = devices[0];
            }
            if (!device) {
                return {
                    success: false,
                    message: '❌ Perangkat tidak ditemukan. Hubungi CS.'
                };
            }
            // Restart device
            const result = await genieacs.rebootDevice(device._id);
            if (result.success) {
                return {
                    success: true,
                    message: '✅ *Perintah Restart ONT Terkirim!*\n\nPerangkat akan merestart dalam beberapa menit. Mohon tunggu ±5-10 menit untuk koneksi kembali.'
                };
            }
            else {
                return {
                    success: false,
                    message: `❌ Gagal merestart: ${result.message}`
                };
            }
        }
        catch (error) {
            console.error('[GenieacsWhatsApp] Restart error:', error);
            return {
                success: false,
                message: '❌ Terjadi kesalahan saat merestart perangkat.'
            };
        }
    }
    /**
     * Get current WiFi password via WhatsApp
     */
    static async getCurrentWiFiInfo(phone) {
        try {
            const customer = await this.getCustomer(phone);
            if (!customer) {
                return {
                    success: false,
                    message: '❌ Nomor tidak terdaftar.'
                };
            }
            // Check if WiFi info exists in database
            if (customer.wifi_ssid && customer.wifi_password) {
                return {
                    success: true,
                    message: `🔐 *Info WiFi Anda:*\n\nSSID: ${customer.wifi_ssid}\nPassword: ${customer.wifi_password}`
                };
            }
            // If not in DB, try to fetch from device
            const genieacs = await GenieacsService_1.GenieacsService.getInstanceFromDb();
            let device = null;
            if (customer.serial_number) {
                const devices = await genieacs.getDevicesBySerial(customer.serial_number);
                if (devices.length > 0)
                    device = devices[0];
            }
            if (!device && customer.pppoe_username) {
                const devices = await genieacs.getDevices(1, 0, [], {
                    "VirtualParameters.pppoeUsername": customer.pppoe_username
                });
                if (devices.length > 0)
                    device = devices[0];
            }
            if (device) {
                const wifiInfo = genieacs.getWiFiDetails(device);
                if (wifiInfo.ssid !== '-' && wifiInfo.password !== '-') {
                    // Update database with fetched info
                    await pool_1.databasePool.query('UPDATE customers SET wifi_ssid = ?, wifi_password = ? WHERE id = ?', [wifiInfo.ssid, wifiInfo.password, customer.id]);
                    return {
                        success: true,
                        message: `🔐 *Info WiFi Anda:*\n\nSSID: ${wifiInfo.ssid}\nPassword: ${wifiInfo.password}`
                    };
                }
            }
            return {
                success: false,
                message: '❌ Info WiFi tidak tersedia. Silakan hubungi CS.'
            };
        }
        catch (error) {
            console.error('[GenieacsWhatsApp] Get WiFi info error:', error);
            return {
                success: false,
                message: '❌ Terjadi kesalahan saat mengambil info WiFi.'
            };
        }
    }
    /**
     * Get device status via WhatsApp
     */
    static async getDeviceStatus(phone) {
        try {
            const customer = await this.getCustomer(phone);
            if (!customer) {
                return {
                    success: false,
                    message: '❌ Nomor tidak terdaftar.'
                };
            }
            const genieacs = await GenieacsService_1.GenieacsService.getInstanceFromDb();
            // Find device
            let device = null;
            if (customer.serial_number) {
                const devices = await genieacs.getDevicesBySerial(customer.serial_number);
                if (devices.length > 0)
                    device = devices[0];
            }
            if (!device && customer.pppoe_username) {
                const devices = await genieacs.getDevices(1, 0, [], {
                    "VirtualParameters.pppoeUsername": customer.pppoe_username
                });
                if (devices.length > 0)
                    device = devices[0];
            }
            if (!device) {
                return {
                    success: false,
                    message: '❌ Perangkat tidak ditemukan.'
                };
            }
            // Get device info
            const deviceInfo = genieacs.extractDeviceInfo(device);
            const signalInfo = genieacs.getSignalInfo(device);
            const wifiInfo = genieacs.getWiFiDetails(device);
            let status = deviceInfo.online ? '🟢 ONLINE' : '🔴 OFFLINE';
            let uptime = deviceInfo.uptime > 0
                ? `${Math.floor(deviceInfo.uptime / 3600)}h ${Math.floor((deviceInfo.uptime % 3600) / 60)}m`
                : '-';
            let message = `📊 *STATUS PERANGKAT ANDA*\n\n`;
            message += `Status: ${status}\n`;
            message += `Uptime: ${uptime}\n`;
            message += `IP Address: ${deviceInfo.ipAddress}\n`;
            message += `Model: ${deviceInfo.model}\n\n`;
            message += `📶 *SINYAL OPTIK*\n`;
            message += `RX Power: ${signalInfo.rxPower} dBm\n`;
            message += `TX Power: ${signalInfo.txPower} dBm\n`;
            message += `Suhu: ${signalInfo.temperature}°C\n\n`;
            message += `📡 *WIFI*\n`;
            message += `SSID: ${wifiInfo.ssid}\n`;
            message += `Clients: ${signalInfo.wifiClients} perangkat`;
            return {
                success: true,
                message
            };
        }
        catch (error) {
            console.error('[GenieacsWhatsApp] Device status error:', error);
            return {
                success: false,
                message: '❌ Terjadi kesalahan saat mengambil status perangkat.'
            };
        }
    }
}
exports.GenieacsWhatsAppController = GenieacsWhatsAppController;
