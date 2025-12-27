/**
 * Monitoring Analytics Service
 * - Total bandwidth aggregation (PPPoE + Static IP)
 * - Network health statistics
 * - Top customers & areas analysis
 * - Bandwidth usage trends
 */
interface BandwidthStats {
    total_bytes: number;
    total_gb: number;
    total_tb: number;
    bytes_in: number;
    bytes_out: number;
    customer_count: number;
    avg_bandwidth_per_customer: number;
}
interface DailyBandwidth {
    date: string;
    total_bytes: number;
    total_gb: number;
    bytes_in: number;
    bytes_out: number;
    customer_count: number;
}
interface TopCustomer {
    customer_id: number;
    customer_name: string;
    username?: string;
    ip_address?: string;
    service_type: 'pppoe' | 'static_ip';
    total_bytes: number;
    total_gb: number;
    bytes_in: number;
    bytes_out: number;
}
interface NetworkHealth {
    total_customers: number;
    online_customers: number;
    offline_customers: number;
    degraded_customers: number;
    uptime_percentage: number;
    avg_latency_ms: number;
    avg_packet_loss: number;
}
export declare class MonitoringAnalyticsService {
    /**
     * Get total bandwidth statistics for today
     */
    static getTodayBandwidthStats(): Promise<BandwidthStats>;
    /**
     * Get total bandwidth for last N days
     */
    static getBandwidthTrend(days?: number): Promise<DailyBandwidth[]>;
    /**
     * Get top N customers by bandwidth usage
     */
    static getTopCustomersByBandwidth(limit?: number, days?: number): Promise<TopCustomer[]>;
    /**
     * Get network health overview
     */
    static getNetworkHealth(): Promise<NetworkHealth>;
    /**
     * Get bandwidth by area/ODC
     */
    static getBandwidthByArea(days?: number): Promise<any[]>;
    /**
     * Get bandwidth summary (current hour, today, week, month)
     */
    static getBandwidthSummary(): Promise<any>;
    /**
     * Helper: Get empty bandwidth stats
     */
    private static getEmptyBandwidthStats;
}
export default MonitoringAnalyticsService;
//# sourceMappingURL=monitoringAnalyticsService.d.ts.map