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
    VirtualParameters?: any;
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
    /**
     * Get GenieACS configuration from database
     */
    static getConfigFromDb(): Promise<GenieacsConfig>;
    static getInstance(config?: GenieacsConfig): GenieacsService;
    /**
     * Get instance with config from database (async)
     */
    static getInstanceFromDb(): Promise<GenieacsService>;
    /**
     * Reload configuration from database
     */
    static reloadConfig(): Promise<void>;
    testConnection(): Promise<{
        success: boolean;
        message: string;
    }>;
    getDevices(limit?: number, skip?: number, projection?: string[], query?: any): Promise<GenieacsDevice[]>;
    /**
     * Get devices by Serial Number
     */
    getDevicesBySerial(serialNumber: string): Promise<GenieacsDevice[]>;
    /**
     * Extract normalized device info
     */
    extractDeviceInfo(device: any): any;
    /**
    * Configure WAN IP Connection (Bridge/Static/DHCP)
    */
    configureWanIP(deviceId: string, options: {
        wanDeviceIndex?: number;
        connectionDeviceIndex?: number;
        ipConnectionIndex?: number;
        connectionType: 'IP_Routed' | 'IP_Bridged';
        addressingType: 'Static' | 'DHCP';
        ipAddress?: string;
        subnetMask?: string;
        gateway?: string;
        dnsServers?: string;
        vlanId: number;
        enable?: boolean;
    }): Promise<{
        success: boolean;
        taskId?: string;
        message: string;
    }>;
    /**
     * Get generic WAN Status
     */
    getWanStatus(device: any): any;
    getSignalInfo(device: any): any;
    getDevice(deviceId: string): Promise<GenieacsDevice | null>;
    getDeviceCount(query?: any): Promise<number>;
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
    getFaults(limit?: number): Promise<GenieacsTask[]>;
    deleteTask(taskId: string): Promise<boolean>;
    /**
     * Change WiFi SSID and Password - Yang sudah fix
     */
    changeWiFiCredentials(deviceId: string, ssid: string, password: string): Promise<{
        success: boolean;
        taskId?: string;
        message: string;
    }>;
    /**
     * Set parameter values (generic method for setting any parameters)
     */
    setParameterValues(deviceId: string, parameters: Array<[string, any, string]>): Promise<{
        success: boolean;
        taskId?: string;
        message: string;
    }>;
    getWiFiDetails(device: any): {
        ssid: string;
        password: string;
    };
    /**
     * Refresh WiFi Specific Parameters
     */
    refreshWiFi(deviceId: string): Promise<{
        success: boolean;
        taskId?: string;
        message: string;
    }>;
    getDeviceParameter(device: any, path: string): any;
    /**
     * Get PPPoE Credentials
     */
    getPPPoEDetails(device: any): {
        username: string;
        password: string;
    };
    /**
     * Update PPPoE Credentials
     */
    updatePPPoECredentials(deviceId: string, username: string, password: string): Promise<{
        success: boolean;
        taskId?: string;
        message: string;
    }>;
    /**
     * Configure WAN PPP Connection with VLAN (Huawei HG8245A)
     * This method sets up a WAN PPP connection with username, password, and VLAN ID
     */
    configureWanPPP(deviceId: string, options: {
        wanDeviceIndex: number;
        connectionDeviceIndex: number;
        pppConnectionIndex: number;
        username: string;
        password: string;
        vlanId: number;
        enable?: boolean;
    }): Promise<{
        success: boolean;
        taskId?: string;
        message: string;
    }>;
    /**
     * Get current WAN PPP Connection details
     */
    /**
     * Add a tag to a device
     */
    addDeviceTag(deviceId: string, tagName: string): Promise<boolean>;
    /**
     * Remove a tag from a device
     */
    removeDeviceTag(deviceId: string, tagName: string): Promise<boolean>;
}
export default GenieacsService;
//# sourceMappingURL=GenieacsService.d.ts.map