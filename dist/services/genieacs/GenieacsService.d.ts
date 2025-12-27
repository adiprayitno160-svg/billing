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
export declare class GenieacsService {
    private static instance;
    private client;
    private config;
    constructor(config?: GenieacsConfig);
    static getInstance(config?: GenieacsConfig): GenieacsService;
    testConnection(): Promise<{
        success: boolean;
        message: string;
    }>;
    getDevices(limit?: number, skip?: number): Promise<GenieacsDevice[]>;
    getDevice(deviceId: string): Promise<GenieacsDevice | null>;
    getDeviceCount(): Promise<number>;
    /**
     * Reboot device - Enhanced for Huawei HG8245A
     */
    rebootDevice(deviceId: string): Promise<{
        success: boolean;
        taskId?: string;
        message: string;
    }>;
    /**
     * Refresh device
     */
    refreshDevice(deviceId: string): Promise<{
        success: boolean;
        taskId?: string;
        message: string;
    }>;
    getDeviceTasks(deviceId: string): Promise<GenieacsTask[]>;
    deleteTask(taskId: string): Promise<boolean>;
    /**
     * Change WiFi SSID and Password - Yang sudah fix
     */
    changeWiFiCredentials(deviceId: string, ssid: string, password: string): Promise<{
        success: boolean;
        taskId?: string;
        message: string;
    }>;
    getWiFiDetails(device: any): {
        ssid: string;
        password: string;
    };
    getSignalInfo(device: any): any;
    getDeviceParameter(device: any, path: string): any;
    /**
     * Status Online Threshold: 10 Menit (lebih responsif)
     */
    extractDeviceInfo(device: GenieacsDevice): {
        serialNumber: string;
        manufacturer: string;
        productClass: string;
        model: string;
        softwareVersion: string;
        ipAddress: any;
        lastInform: Date | null;
        isOnline: boolean;
        signal: any;
    };
}
export default GenieacsService;
//# sourceMappingURL=GenieacsService.d.ts.map