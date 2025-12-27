/**
 * Network Monitoring Service
 * Core service for network device monitoring
 */
export interface NetworkDevice {
    id: number;
    device_type: 'customer' | 'ont' | 'olt' | 'odc' | 'odp' | 'router' | 'switch' | 'access_point';
    name: string;
    ip_address?: string;
    mac_address?: string;
    genieacs_id?: string;
    genieacs_serial?: string;
    customer_id?: number;
    olt_id?: number;
    odc_id?: number;
    odp_id?: number;
    latitude?: number;
    longitude?: number;
    address?: string;
    status: 'online' | 'offline' | 'warning' | 'unknown';
    last_seen?: Date;
    last_check?: Date;
    latency_ms?: number;
    packet_loss_percent?: number;
    uptime_percent?: number;
    metadata?: any;
    icon?: string;
    color?: string;
    created_at: Date;
    updated_at: Date;
}
export interface DeviceStatus {
    status: 'online' | 'offline' | 'warning' | 'unknown';
    latency_ms?: number;
    packet_loss_percent?: number;
    error_message?: string;
}
export interface NetworkLink {
    id: number;
    source_device_id: number;
    target_device_id: number;
    link_type: 'fiber' | 'wireless' | 'ethernet' | 'virtual';
    bandwidth_mbps?: number;
    status: 'up' | 'down' | 'degraded';
    color?: string;
    width?: number;
    style?: 'solid' | 'dashed' | 'dotted';
}
export interface TopologyData {
    devices: NetworkDevice[];
    links: NetworkLink[];
    statistics: {
        total_devices: number;
        online_devices: number;
        offline_devices: number;
        warning_devices: number;
    };
}
export declare class NetworkMonitoringService {
    private static genieacsService;
    /**
     * Initialize service
     */
    static initialize(): Promise<void>;
    /**
     * Sync devices from GenieACS
     */
    static syncDevicesFromGenieACS(): Promise<{
        added: number;
        updated: number;
    }>;
    /**
     * Sync devices from customers table
     */
    static syncCustomerDevices(): Promise<{
        added: number;
        updated: number;
    }>;
    /**
     * Sync FTTH infrastructure (OLT, ODC, ODP)
     */
    static syncFTTHInfrastructure(): Promise<{
        added: number;
        updated: number;
    }>;
    /**
     * Check device status via ping
     */
    static checkDeviceStatus(deviceId: number): Promise<DeviceStatus>;
    /**
     * Get all devices with current status
     */
    static getAllDevices(): Promise<NetworkDevice[]>;
    /**
     * Get network topology data
     */
    static getNetworkTopology(): Promise<TopologyData>;
    /**
     * Update device status
     */
    static updateDeviceStatus(deviceId: number, statusData: DeviceStatus): Promise<void>;
    /**
     * Auto-create network links based on topology
     */
    static autoCreateLinks(): Promise<number>;
    /**
     * Handle device down event - check for mass outage and notify
     */
    static handleDeviceDown(deviceId: number, deviceType: string, deviceName: string): Promise<void>;
    /**
     * Get all troubled customers (Offline, Maintenance, High Latency, etc.)
     * Consolidated logic from dashboard
     */
    static getTroubleCustomers(): Promise<any[]>;
}
export default NetworkMonitoringService;
//# sourceMappingURL=NetworkMonitoringService.d.ts.map