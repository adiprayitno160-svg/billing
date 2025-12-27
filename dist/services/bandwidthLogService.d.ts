/**
 * Bandwidth Log Service - Collect and store PPPoE bandwidth usage
 * Collects data from MikroTik every 5 minutes via API
 */
interface PPPoECustomer {
    customer_id: number;
    customer_name: string;
    username: string;
    mikrotik_id: number;
    mikrotik_host: string;
    mikrotik_port: number;
    mikrotik_username: string;
    mikrotik_password: string;
}
interface PPPoEActiveSession {
    name: string;
    'caller-id': string;
    address: string;
    uptime: string;
    'bytes-in': string;
    'bytes-out': string;
    'packets-in': string;
    'packets-out': string;
}
interface BandwidthData {
    customer_id: number;
    username: string;
    bytes_in: number;
    bytes_out: number;
    packets_in: number;
    packets_out: number;
    session_uptime: number;
    caller_id: string;
    address: string;
}
export declare class BandwidthLogService {
    /**
     * Get all active PPPoE customers with their MikroTik config
     */
    getPPPoECustomers(): Promise<PPPoECustomer[]>;
    /**
     * Get active PPPoE sessions from MikroTik
     */
    getActiveSessions(mikrotik: {
        host: string;
        port: number;
        username: string;
        password: string;
    }): Promise<PPPoEActiveSession[]>;
    /**
     * Parse uptime string to seconds
     */
    parseUptime(uptime: string): number;
    /**
     * Save bandwidth data to database
     */
    saveBandwidthLog(data: BandwidthData): Promise<void>;
    /**
     * Log PPPoE connection status
     */
    logConnectionStatus(customerId: number, username: string, isOnline: boolean): Promise<void>;
    /**
     * Collect bandwidth from single MikroTik
     */
    collectFromMikroTik(mikrotikConfig: {
        host: string;
        port: number;
        username: string;
        password: string;
    }, customers: PPPoECustomer[]): Promise<void>;
    /**
     * Main function: Collect bandwidth from all MikroTik devices
     * Called by scheduler every 5 minutes
     */
    collectAllBandwidth(): Promise<void>;
    /**
     * Get bandwidth statistics for a customer (last 24 hours)
     */
    getCustomerBandwidth24h(customerId: number): Promise<{
        total_download_gb: number;
        total_upload_gb: number;
        avg_download_mbps: number;
        avg_upload_mbps: number;
        peak_download_mbps: number;
        peak_upload_mbps: number;
        data_points: number;
    } | null>;
    /**
     * Get bandwidth trend (hourly for last 24 hours)
     */
    getBandwidthTrend24h(customerId: number): Promise<any[]>;
}
declare const _default: BandwidthLogService;
export default _default;
//# sourceMappingURL=bandwidthLogService.d.ts.map