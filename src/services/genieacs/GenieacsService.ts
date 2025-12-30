import axios, { AxiosInstance } from 'axios';

export interface GenieacsDevice {
    _id: string;
    _deviceId: {
        _Manufacturer: string;
        _OUI: string;
        _ProductClass: string;
        _SerialNumber: string;
    };
    _registered: string;
    _lastInform: string;
    _lastBoot?: string;
    _lastBootstrap?: string;
    _tags?: string[];
    InternetGatewayDevice?: any;
    Device?: any;
}

export interface GenieacsTask {
    _id: string;
    device: string;
    name: string;
    status: string;
    fault?: any;
    timestamp: string;
}

export interface GenieacsConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
}

export class GenieacsService {
    private static instance: GenieacsService;
    private client: AxiosInstance;
    private config: GenieacsConfig;

    constructor(config?: GenieacsConfig) {
        this.config = config || {
            host: '192.168.239.154',
            port: 7557
        };

        this.client = axios.create({
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

    static getInstance(config?: GenieacsConfig): GenieacsService {
        if (!GenieacsService.instance) {
            GenieacsService.instance = new GenieacsService(config);
        }
        return GenieacsService.instance;
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            await this.client.get('/devices/?query={}', { params: { limit: 1 } });
            return { success: true, message: 'Connected to GenieACS' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getDevices(limit: number = 100, skip: number = 0): Promise<GenieacsDevice[]> {
        const response = await this.client.get('/devices/', { params: { limit, skip } });
        return response.data || [];
    }

    async getDevice(deviceId: string): Promise<GenieacsDevice | null> {
        const response = await this.client.get('/devices/', {
            params: { query: JSON.stringify({ _id: deviceId }) }
        });
        return (response.data && response.data.length > 0) ? response.data[0] : null;
    }

    async getDeviceCount(): Promise<number> {
        try {
            const response = await this.client.head('/devices/');
            return parseInt(response.headers['x-total-count'] || '0', 10);
        } catch (e) { return 0; }
    }

    /**
     * Reboot device - Enhanced for Huawei HG8245A
     */
    async rebootDevice(deviceId: string): Promise<{ success: boolean; taskId?: string; message: string }> {
        try {
            const encodedId = encodeURIComponent(deviceId);

            // 1. Bersihkan antrean
            try {
                const tasks = await this.getDeviceTasks(deviceId);
                for (const t of tasks) {
                    await this.deleteTask(t._id);
                }
            } catch (e) { }

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
            } catch (e) { }

            return {
                success: true,
                taskId: response.data._id,
                message: 'Perintah Reboot (Standard + Huawei Trigger) Terkirim!'
            };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Refresh device
     */
    async refreshDevice(deviceId: string): Promise<{ success: boolean; taskId?: string; message: string }> {
        try {
            const encodedId = encodeURIComponent(deviceId);
            const response = await this.client.post(`/devices/${encodedId}/tasks?connection_request`, {
                name: 'refreshObject',
                objectName: ''
            });
            return { success: true, taskId: response.data._id, message: 'Refresh dikirim' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async getDeviceTasks(deviceId: string): Promise<GenieacsTask[]> {
        try {
            const response = await this.client.get('/tasks/', {
                params: { query: JSON.stringify({ device: deviceId }) }
            });
            return response.data || [];
        } catch (e) { return []; }
    }

    async deleteTask(taskId: string): Promise<boolean> {
        try {
            await this.client.delete(`/tasks/${taskId}`);
            return true;
        } catch (e) { return false; }
    }

    /**
     * Change WiFi SSID and Password - Yang sudah fix
     */
    async changeWiFiCredentials(deviceId: string, ssid: string, password: string): Promise<{ success: boolean; taskId?: string; message: string }> {
        try {
            const encodedId = encodeURIComponent(deviceId);

            // Bersihkan antrean
            try {
                const tasks = await this.getDeviceTasks(deviceId);
                for (const t of tasks) {
                    await this.deleteTask(t._id);
                }
            } catch (e) { }

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
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Set parameter values (generic method for setting any parameters)
     */
    async setParameterValues(
        deviceId: string,
        parameters: Array<[string, any, string]>
    ): Promise<{ success: boolean; taskId?: string; message: string }> {
        try {
            const encodedId = encodeURIComponent(deviceId);

            // Clear task queue
            try {
                const tasks = await this.getDeviceTasks(deviceId);
                for (const t of tasks) {
                    await this.deleteTask(t._id);
                }
            } catch (e) { }

            // Send parameter values
            const response = await this.client.post(`/devices/${encodedId}/tasks?connection_request`, {
                name: 'setParameterValues',
                parameterValues: parameters
            });

            return {
                success: true,
                taskId: response.data._id,
                message: 'Parameter values sent successfully'
            };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    getWiFiDetails(device: any): { ssid: string; password: string; } {
        const findValue = (paths: string[]) => {
            for (const path of paths) {
                const val = this.getDeviceParameter(device, path);
                if (val && typeof val !== 'object') return String(val);
            }
            return '-';
        };
        const ssid = findValue(['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', 'Device.WiFi.SSID.1.SSID']);
        const password = findValue(['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase', 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase']);
        return { ssid, password };
    }

    getSignalInfo(device: any): any {
        const getVal = (path: string) => this.getDeviceParameter(device, path);
        const rx = getVal('InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.RxOpticalPower') || 'N/A';
        const tx = getVal('InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.TxOpticalPower') || 'N/A';
        const temp = getVal('InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.Temperature') || 'N/A';
        return { rxPower: `${rx} dBm`, txPower: `${tx} dBm`, temperature: `${temp}°C`, wifiClients: '0 Perangkat' };
    }

    getDeviceParameter(device: any, path: string): any {
        const parts = path.split('.');
        let current = device;
        for (const part of parts) {
            if (current && current[part] !== undefined) current = current[part];
            else return null;
        }
        return (current && typeof current === 'object' && '_value' in current) ? current._value : current;
    }

    /**
     * Status Online Threshold: 10 Menit (lebih responsif)
     */
    extractDeviceInfo(device: GenieacsDevice) {
        const lastInform = device._lastInform ? new Date(device._lastInform) : null;
        // Threshold 10 menit (600000 ms). Jika last inform > 10 menit lalu, anggap offline
        const isOnline = lastInform ? (Date.now() - lastInform.getTime()) < 10 * 60 * 1000 : false;

        const signalInfo = this.getSignalInfo(device);

        // Get IP Addr
        const ip = this.getDeviceParameter(device, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress') ||
            this.getDeviceParameter(device, 'Device.IP.Interface.1.IPv4Address.1.IPAddress');

        return {
            serialNumber: device._deviceId?._SerialNumber || 'Unknown',
            manufacturer: device._deviceId?._Manufacturer || 'Unknown',
            productClass: device._deviceId?._ProductClass || 'Unknown',
            model: device._deviceId?._ProductClass || 'Unknown',
            softwareVersion: 'Unknown',
            ipAddress: ip,
            lastInform,
            isOnline,
            signal: signalInfo
        };
    }
}

export default GenieacsService;
