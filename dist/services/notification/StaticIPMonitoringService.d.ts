export interface StaticIPStatus {
    ipAddress: string;
    customerId: number;
    customerName: string;
    customerPhone: string;
    area?: string;
    isReachable: boolean;
    lastChecked: Date;
    responseTime?: number;
}
export declare class StaticIPMonitoringService {
    /**
     * Check reachability of static IP addresses
     * This method pings the IP addresses assigned to static IP customers
     */
    checkStaticIPConnectivity(): Promise<StaticIPStatus[]>;
    /**
     * Ping an IP address to check if it's reachable
     */
    private pingIPAddress;
    /**
     * Alternative method to check connectivity using TCP connection
     * This might be more reliable than ping in some networks
     */
    checkTCPConnectivity(ipAddress: string, port?: number): Promise<{
        isReachable: boolean;
        responseTime?: number;
    }>;
    /**
     * Get static IP status for a specific customer
     */
    getCustomerStaticIPStatus(customerId: number): Promise<StaticIPStatus | null>;
    /**
     * Bulk update customer connection status in database
     */
    updateCustomerConnectionStatus(statuses: StaticIPStatus[]): Promise<void>;
}
//# sourceMappingURL=StaticIPMonitoringService.d.ts.map