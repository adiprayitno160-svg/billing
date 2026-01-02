import axios, { AxiosInstance } from 'axios';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

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

    /**
     * Get GenieACS configuration from database
     */
    static async getConfigFromDb(): Promise<GenieacsConfig> {
        try {
            const [rows] = await databasePool.query<RowDataPacket[]>(
                `SELECT setting_key, setting_value FROM system_settings 
                 WHERE setting_key IN ('genieacs_host', 'genieacs_port', 'genieacs_username', 'genieacs_password')`
            );

            const settings: Record<string, string> = {};
            for (const row of rows) {
                settings[row.setting_key] = row.setting_value;
            }

            return {
                host: settings['genieacs_host'] || '192.168.239.154',
                port: parseInt(settings['genieacs_port'] || '7557', 10),
                username: settings['genieacs_username'] || undefined,
                password: settings['genieacs_password'] || undefined
            };
        } catch (error) {
            console.warn('[GenieACS] Failed to load config from database, using defaults:', error);
            return {
                host: '192.168.239.154',
                port: 7557
            };
        }
    }

    static getInstance(config?: GenieacsConfig): GenieacsService {
        if (!GenieacsService.instance) {
            GenieacsService.instance = new GenieacsService(config);
        }
        return GenieacsService.instance;
    }

    /**
     * Get instance with config from database (async)
     */
    static async getInstanceFromDb(): Promise<GenieacsService> {
        if (!GenieacsService.instance) {
            const config = await GenieacsService.getConfigFromDb();
            GenieacsService.instance = new GenieacsService(config);
        }
        return GenieacsService.instance;
    }

    /**
     * Reload configuration from database
     */
    static async reloadConfig(): Promise<void> {
        const config = await GenieacsService.getConfigFromDb();
        GenieacsService.instance = new GenieacsService(config);
        console.log(`[GenieACS] Configuration reloaded: ${config.host}:${config.port}`);
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

    async getFaults(limit: number = 10): Promise<GenieacsTask[]> {
        try {
            const response = await this.client.get('/faults/', {
                params: { limit }
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
        const findVal = (paths: string[]) => {
            for (const path of paths) {
                const val = this.getDeviceParameter(device, path);
                if (val !== null && val !== undefined && val !== '') return val;
            }
            return null;
        };

        // Aggressive optical info paths for Huawei, common ZTE & TR-181 standard
        const rx = findVal([
            'VirtualParameters.RXPower', // GenieACS Virtual Parameter (usually normalized)
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_GponInterafceConfig.RXPower',
            'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower',
            'InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.RxOpticalPower',
            'InternetGatewayDevice.WANDevice.1.X_HUAWEI_PONInterfaceConfig.RxOpticalInfo.RxOpticalPower',
            'InternetGatewayDevice.WANDevice.1.X_HW_OpticalInfo.RxOpticalPower',
            'Device.Optical.Interface.1.Stats.RxOpticalPower',
            'Device.Optical.Interface.1.RXPower'
        ]);

        const tx = findVal([
            'VirtualParameters.TXPower',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_GponInterafceConfig.TXPower',
            'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TXPower',
            'InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.TxOpticalPower',
            'InternetGatewayDevice.WANDevice.1.X_HUAWEI_PONInterfaceConfig.RxOpticalInfo.TxOpticalPower',
            'InternetGatewayDevice.WANDevice.1.X_HW_OpticalInfo.TxOpticalPower',
            'Device.Optical.Interface.1.Stats.TxOpticalPower',
            'Device.Optical.Interface.1.TXPower'
        ]);

        const temp = findVal([
            'VirtualParameters.gettemp',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_GponInterafceConfig.TransceiverTemperature',
            'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TransceiverTemperature',
            'InternetGatewayDevice.WANDevice.1.X_HUAWEI_OpticalInfo.Temperature',
            'InternetGatewayDevice.WANDevice.1.X_HUAWEI_PONInterfaceConfig.RxOpticalInfo.Temperature',
            'Device.Optical.Interface.1.Stats.Temperature',
            'InternetGatewayDevice.WANDevice.1.X_HW_OpticalInfo.Temperature'
        ]);

        const clients = findVal([
            'VirtualParameters.activedevices',
            'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations',
            'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.AssociatedDeviceNumberOfEntities',
            'Device.WiFi.SSID.1.Stats.TotalAssociations',
            'Device.WiFi.AccessPoint.1.AssociatedDeviceNumberOfEntities'
        ]);

        // Helper to format power values (some report -2705 for -27.05 dBm)
        const formatPower = (val: any) => {
            if (val === null || val === undefined || val === '') return 'N/A';
            const num = parseFloat(val);
            if (isNaN(num)) return val;
            // If value is like -2500, it's likely -25.00 dBm
            if (num < -100 || num > 100) return (num / 100).toFixed(2);
            return num.toString();
        };

        return {
            rxPower: formatPower(rx),
            txPower: formatPower(tx),
            temperature: temp || 'N/A',
            wifiClients: clients !== null ? clients : '0'
        };
    }

    getDeviceParameter(device: any, path: string): any {
        if (!device) return null;

        // 1. Try direct access first (some GenieACS responses are flat)
        if (device[path] !== undefined) {
            const node = device[path];
            return (node && typeof node === 'object' && '_value' in node) ? node._value : node;
        }

        // 2. Try nested access
        const parts = path.split('.');
        let current = device;
        for (const part of parts) {
            if (current && current[part] !== undefined) {
                current = current[part];
            } else {
                return null;
            }
        }

        // Handle GenieACS _value format or direct value
        if (current && typeof current === 'object') {
            return ('_value' in current) ? current._value : null;
        }
        return current;
    }

    /**
     * Get PPPoE Credentials
     */
    getPPPoEDetails(device: any): { username: string; password: string; } {
        const findValue = (paths: string[]) => {
            for (const path of paths) {
                const val = this.getDeviceParameter(device, path);
                if (val && typeof val !== 'object') return String(val);
            }
            return '-';
        };

        const username = findValue([
            'VirtualParameters.pppoeUsername',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
            'Device.PPP.Interface.1.Username'
        ]);
        const password = findValue([
            'VirtualParameters.pppoePassword',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password',
            'Device.PPP.Interface.1.Password'
        ]);

        return { username, password };
    }

    /**
     * Update PPPoE Credentials
     */
    async updatePPPoECredentials(deviceId: string, username: string, password: string): Promise<{ success: boolean; taskId?: string; message: string }> {
        try {
            const encodedId = encodeURIComponent(deviceId);

            // Bersihkan antrean
            try {
                const tasks = await this.getDeviceTasks(deviceId);
                for (const t of tasks) {
                    await this.deleteTask(t._id);
                }
            } catch (e) { }

            // Kirim Perintah PPPoE
            const response = await this.client.post(`/devices/${encodedId}/tasks?connection_request`, {
                name: 'setParameterValues',
                parameterValues: [
                    ['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username', username, 'xsd:string'],
                    ['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password', password, 'xsd:string']
                ]
            });

            return {
                success: true,
                taskId: response.data._id,
                message: 'Perintah Update PPPoE telah dikirim!'
            };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Configure WAN PPP Connection with VLAN (Huawei HG8245A)
     * This method sets up a WAN PPP connection with username, password, and VLAN ID
     */
    async configureWanPPP(
        deviceId: string,
        options: {
            wanDeviceIndex: number;
            connectionDeviceIndex: number;
            pppConnectionIndex: number;
            username: string;
            password: string;
            vlanId: number;
            enable?: boolean;
        }
    ): Promise<{ success: boolean; taskId?: string; message: string }> {
        try {
            const encodedId = encodeURIComponent(deviceId);
            const {
                wanDeviceIndex = 1,
                connectionDeviceIndex = 1,
                pppConnectionIndex = 1,
                username,
                password,
                vlanId,
                enable = true
            } = options;

            // Clear task queue
            try {
                const tasks = await this.getDeviceTasks(deviceId);
                for (const t of tasks) {
                    await this.deleteTask(t._id);
                }
            } catch (e) { }

            // Build parameter paths for Huawei HG8245A
            const basePath = `InternetGatewayDevice.WANDevice.${wanDeviceIndex}.WANConnectionDevice.${connectionDeviceIndex}.WANPPPConnection.${pppConnectionIndex}`;

            const parameterValues: Array<[string, any, string]> = [
                // PPP Username
                [`${basePath}.Username`, username, 'xsd:string'],
                // PPP Password
                [`${basePath}.Password`, password, 'xsd:string'],
                // VLAN ID (Huawei-specific parameter)
                [`${basePath}.X_HW_VLAN`, vlanId.toString(), 'xsd:unsignedInt'],
                // Enable the connection
                [`${basePath}.Enable`, enable ? '1' : '0', 'xsd:boolean'],
                // Set NAT Enable (commonly needed for internet access)
                [`${basePath}.NATEnabled`, 'true', 'xsd:boolean'],
                // Connection Type
                [`${basePath}.ConnectionType`, 'IP_Routed', 'xsd:string'],
            ];

            // Send task to GenieACS
            const response = await this.client.post(`/devices/${encodedId}/tasks?connection_request`, {
                name: 'setParameterValues',
                parameterValues
            });

            return {
                success: true,
                taskId: response.data._id,
                message: `WAN PPP Configuration dikirim! VLAN: ${vlanId}, User: ${username}`
            };
        } catch (error: any) {
            console.error('[GenieACS] Error configuring WAN PPP:', error.message);
            return { success: false, message: error.message };
        }
    }

    /**
     * Get current WAN PPP Connection details
     */
    getWanPPPDetails(device: any, wanDeviceIndex: number = 1, connectionDeviceIndex: number = 1, pppConnectionIndex: number = 1): {
        username: string;
        vlanId: string;
        enabled: string;
        connectionType: string;
        externalIP: string;
    } {
        const basePath = `InternetGatewayDevice.WANDevice.${wanDeviceIndex}.WANConnectionDevice.${connectionDeviceIndex}.WANPPPConnection.${pppConnectionIndex}`;

        const findValue = (suffix: string) => {
            const val = this.getDeviceParameter(device, `${basePath}.${suffix}`);
            if (val && typeof val !== 'object') return String(val);
            return '-';
        };

        return {
            username: findValue('Username'),
            vlanId: this.getDeviceParameter(device, `${basePath}.X_HW_VLAN`) || '-',
            enabled: findValue('Enable'),
            connectionType: findValue('ConnectionType'),
            externalIP: findValue('ExternalIPAddress')
        };
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
