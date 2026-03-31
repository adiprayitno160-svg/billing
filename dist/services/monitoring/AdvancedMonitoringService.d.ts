/**
 * Advanced Monitoring Service
 * Handles optimized PPPoE and Static IP monitoring with:
 * - Efficient caching for performance
 * - Real-time offline detection (excluding isolated customers)
 * - Map clustering for nearby customers
 * - Audio notification triggers for offline alerts
 */
interface OfflineAlertCustomer {
    id: number;
    name: string;
    customer_code: string;
    connection_type: string;
    status: string;
    offline_since?: Date;
    phone?: string;
    latitude?: number;
    longitude?: number;
}
export declare class AdvancedMonitoringService {
    /**
     * Get all customers with status (Helper for both Map and ODP Problems)
     * Optimized for performance with caching
     */
    static getAllCustomersWithStatus(requireCoordinates?: boolean): Promise<{
        customers: any[];
        stats: {
            total: number;
            online: number;
            offline: number;
            isolated: number;
            pppoe: {
                total: number;
                online: number;
                offline: number;
            };
            static_ip: {
                total: number;
                online: number;
                offline: number;
            };
        };
    }>;
    /**
     * Get all customers for map display with status
     * Optimized for performance with caching
     */
    static getCustomersForMap(forceRefresh?: boolean): Promise<{
        customers: any[];
        stats: any;
    }>;
    /**
     * Get offline customers for alarm notification
     * EXCLUDES isolated customers - they should not trigger alarms
     */
    static getOfflineCustomersForAlarm(): Promise<OfflineAlertCustomer[]>;
    /**
     * Get nearby customers to a specific location
     * For map "fly to nearest customer" feature
     */
    static getNearbyCustomers(latitude: number, longitude: number, radiusKm?: number, limit?: number): Promise<any[]>;
    /**
     * Force refresh monitoring cache
     */
    static refreshCache(): Promise<void>;
    /**
     * Refresh cache if stale
     */
    static refreshCacheIfNeeded(): Promise<void>;
    /**
     * Batch ping multiple IPs for Static IP monitoring
     * More efficient than doing one-by-one
     */
    static batchPingStaticIPs(ips: string[]): Promise<Map<string, boolean>>;
    /**
     * Run optimized monitoring cycle
     */
    static runOptimizedMonitoringCycle(): Promise<{
        pppoe_checked: number;
        static_ip_checked: number;
        offline_alerts: number;
    }>;
    /**
     * Handle customer status transition and trigger AI support if needed
     */
    private static readonly MASS_OUTAGE_THRESHOLD;
    private static handleStatusTransition;
    /**
     * Check for PPPoE customers that just went offline
     */
    private static checkPPPoETransitions;
    /**
     * Get cache statistics for debugging
     */
    static getCacheStats(): {
        pppoe_sessions: number;
        static_ip_statuses: number;
        last_refresh: Date | null;
    };
}
export default AdvancedMonitoringService;
//# sourceMappingURL=AdvancedMonitoringService.d.ts.map