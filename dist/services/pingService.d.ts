/**
 * Ping Service - Real-time IP Monitoring for Static IP Customers
 * Uses ping library to check connectivity and response time
 */
interface PingResult {
    host: string;
    alive: boolean;
    time: number | string;
    packetLoss: string;
}
interface StaticIPCustomer {
    customer_id: number;
    customer_name: string;
    ip_address: string;
    current_status?: string;
}
interface PingStatus {
    customer_id: number;
    ip_address: string;
    status: 'online' | 'offline' | 'degraded';
    response_time_ms: number | null;
    packet_loss_percent: number;
    consecutive_failures: number;
}
export declare class PingService {
    private readonly PING_TIMEOUT;
    private readonly MAX_CONSECUTIVE_FAILURES;
    private readonly DEGRADED_THRESHOLD_MS;
    /**
     * Ping a single IP address
     */
    pingHost(ipAddress: string): Promise<PingResult>;
    /**
     * Calculate peer IP (router client IP) from CIDR
     * IMPORTANT: Ping router IP (192.168.1.2), NOT MikroTik gateway IP (192.168.1.1)
     * Uses utility function calculateCustomerIP for consistency
     * @deprecated Use calculateCustomerIP from utils/ipHelper directly
     */
    private calculatePeerIP;
    /**
     * Get all Static IP customers for monitoring
     * FIXED: Get from static_ip_clients table ONLY (using INNER JOIN with customers)
     * This ensures only customers who are registered in static_ip_clients table will appear
     */
    getStaticIPCustomers(): Promise<StaticIPCustomer[]>;
    /**
     * Update ping status in database
     */
    updatePingStatus(status: PingStatus): Promise<void>;
    /**
     * Log ping result to connection_logs
     */
    logConnectionStatus(customerId: number, ipAddress: string, isOnline: boolean, responseTimeMs: number | null, packetLoss: number): Promise<void>;
    /**
     * Calculate 24h uptime percentage
     */
    calculate24hUptime(customerId: number): Promise<number>;
    /**
     * Update 24h uptime in status table
     */
    update24hUptime(customerId: number): Promise<void>;
    /**
     * Monitor all Static IP customers (Main function called by scheduler)
     */
    monitorAllStaticIPs(): Promise<void>;
    /**
     * Monitor single customer
     * IMPORTANT: Ping router IP (192.168.1.2), NOT MikroTik gateway IP (192.168.1.1)
     * The router IP is calculated from the CIDR address stored in database
     */
    monitorSingleCustomer(customer: StaticIPCustomer): Promise<void>;
    /**
     * Get current status for a customer
     */
    getCustomerStatus(customerId: number): Promise<PingStatus | null>;
}
declare const _default: PingService;
export default _default;
//# sourceMappingURL=pingService.d.ts.map