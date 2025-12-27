"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenieacsService = void 0;
const axios_1 = __importDefault(require("axios"));
class GenieacsService {
    constructor(config) {
        this.config = config || {
            host: '192.168.239.154',
            port: 7557
        };
        this.client = axios_1.default.create({
            baseURL: `http://${this.config.host}:${this.config.port}`,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (this.config.username && this.config.password) {
            this.client.defaults.auth = {
                username: this.config.username,
                password: this.config.password
            };
        }
    }
    static getInstance(config) {
        if (!GenieacsService.instance) {
            GenieacsService.instance = new GenieacsService(config);
        }
        return GenieacsService.instance;
    }
    async testConnection() {
        try {
            await this.client.get('/devices/?query={}', { params: { limit: 1 } });
            return { success: true, message: 'Connected to GenieACS' };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    }
    async getDevices(limit = 100, skip = 0) {
        const response = await this.client.get('/devices/', { params: { limit, skip } });
        return response.data || [];
    }
    async getDevice(deviceId) {
        const response = await this.client.get('/devices/', {
            params: { query: JSON.stringify({ _id: deviceId }) }
        });
        return (response.data && response.data.length > 0) ? response.data[0] : null;
    }
    async getDeviceCount() {
        try {
            const response = await this.client.head('/devices/');
            return parseInt(response.headers['x-total-count'] || '0', 10);
        }
        catch (e) {
            return 0;
        }
    }
    /**
     * Reboot device - Enhanced for Huawei HG8245A
     */
    async rebootDevice(deviceId) {
        try {
            const encodedId = encodeURIComponent(deviceId);
            // 1. Bersihkan antrean
            try {
                const tasks = await this.getDeviceTasks(deviceId);
                for (const t of tasks) {
                    await this.deleteTask(t._id);
                }
            }
            catch (e) { }
            // 2. Perintah Pertama: Standard Reboot
            const response = await this.client.post(`/devices/${encodedId}/tasks?connection_request`, {
                name: 'reboot'
            });
            // 3. Perintah Kedua: Huawei Fallback Parameter (Kunci untuk HG8245A)
            try {
                await this.client.post(`/devices/${encodedId}/tasks`, {
                    name: 'setParameterValues',
                    parameterValues: [
                        ['InternetGatewayDevice.DeviceConfig.Reboot', '1', 'xsd:boolean'],
                        ['InternetGatewayDevice.X_HW_Reboot', '1', 'xsd:string']
                    ]
                });
            }
            catch (e) { }
            return {
                success: true,
                taskId: response.data._id,
                message: 'Perintah Reboot (Standard + Huawei Trigger) Terkirim!'
            };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    }
    /**
     * Refresh device
     */
    async refreshDevice(deviceId) {
        try {
            const encodedId = encodeURIComponent(deviceId);
            const response = await this.client.post(`/devices/${encodedId}/tasks?connection_request`, {
                name: 'refreshObject',
                objectName: ''
            });
            return { success: true, taskId: response.data._id, message: 'Refresh dikirim' };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    }
    async getDeviceTasks(deviceId) {
        try {
            const response = await this.client.get('/tasks/', {
                params: { query: JSON.stringify({ device: deviceId }) }
            });
            return response.data || [];
        }
        catch (e) {
            return [];
        }
    }
    async deleteTask(taskId) {
        try {
            await this.client.delete(`/tasks/${taskId}`);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    /**
     * Change WiFi SSID and Password - Yang sudah fix
     */
    async changeWiFiCredentials(deviceId, ssid, password) {
        try {
            const encodedId = encodeURIComponent(deviceId);
            // Bersihkan antrean
            try {
                const tasks = await this.getDeviceTasks(deviceId);
                for (const t of tasks) {
                    await this.deleteTask(t._id);
                }
            }
            catch (e) { }
            // Kirim Perintah WiFi satu paket
            const response = await this.client.post(`/devices/${encodedId}/tasks?connection_request`, {
                name: 'setParameterValues',
                parameterValues: [
                    ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', ssid, 'xsd:string'],
                    ['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase', password, 'xsd:string']
                ]
            });
            return {
                success: true,
                taskId: response.data._id,
                message: 'Perintah Ganti WiFi telah dikirim!'
            };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    }
    getWiFiDetails(device) {
        const findValue = (paths) => {
            for (const path of paths) {
                const val = this.getDeviceParameter(device, path);
                if (val && typeof val !== 'object')
                    return String(val);
            }
            return '-';
        };
        const ssid = findValue(['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', 'Device.WiFi.SSID.1.SSID']);
        const password = findValue(['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase', 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase']);
        return { ssid, password };
    }
    getSignalInfo(device) {
        const getVal = (path) => this.getDeviceParameter(device, path);
        const rx = getVal('InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.RxOpticalPower') || 'N/A';
        const tx = getVal('InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.TxOpticalPower') || 'N/A';
        const temp = getVal('InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.Temperature') || 'N/A';
        return { rxPower: `${rx} dBm`, txPower: `${tx} dBm`, temperature: `${temp}°C`, wifiClients: '0 Perangkat' };
    }
    getDeviceParameter(device, path) {
        const parts = path.split('.');
        let current = device;
        for (const part of parts) {
            if (current && current[part] !== undefined)
                current = current[part];
            else
                return null;
        }
        return (current && typeof current === 'object' && '_value' in current) ? current._value : current;
    }
    /**
     * Status Online Threshold: 70 Menit
     */
    extractDeviceInfo(device) {
        const lastInform = device._lastInform ? new Date(device._lastInform) : null;
        const isOnline = lastInform ? (Date.now() - lastInform.getTime()) < 70 * 60 * 1000 : false;
        return {
            serialNumber: device._deviceId?._SerialNumber || 'Unknown',
            manufacturer: device._deviceId?._Manufacturer || 'Unknown',
            productClass: device._deviceId?._ProductClass || 'Unknown',
            model: device._deviceId?._ProductClass || 'Unknown',
            softwareVersion: 'Unknown',
            lastInform,
            isOnline
        };
    }
}
exports.GenieacsService = GenieacsService;
exports.default = GenieacsService;
//# sourceMappingURL=GenieacsService.js.map