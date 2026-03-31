/**
 * WiFi Database Auto Setup
 * Automatically creates required tables and columns
 */
export declare class WiFiDatabaseSetup {
    /**
     * Initialize WiFi database schema
     * Creates tables and columns if they don't exist
     */
    static initialize(): Promise<void>;
    /**
     * Ensure device_id column exists in customers table
     */
    private static ensureCustomerDeviceIdColumn;
    /**
     * Ensure wifi_change_requests table exists
     */
    private static ensureWiFiChangeRequestsTable;
    /**
     * Cleanup unused tables
     * Remove test/unused tables to keep database clean
     */
    private static cleanupUnusedTables;
    /**
     * Get database statistics
     */
    static getStats(): Promise<{
        customersWithDevice: number;
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
    }>;
}
export default WiFiDatabaseSetup;
//# sourceMappingURL=WiFiDatabaseSetup.d.ts.map