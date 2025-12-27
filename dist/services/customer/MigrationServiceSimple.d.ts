/**
 * Migration Service - JavaScript Murni
 * Versi sederhana untuk mengatasi masalah migrasi
 */
interface MigrationResult {
    success: boolean;
    message: string;
    portal_id?: string;
    portal_pin?: string;
    error?: string;
}
declare class MigrationServiceSimple {
    /**
     * Ensure migration_history table exists
     */
    private ensureMigrationHistoryTable;
    /**
     * Get IP address for customer - multiple fallback methods
     */
    private getCustomerIP;
    /**
     * Calculate customer IP from CIDR (handle /30 subnet)
     * @deprecated Use calculateCustomerIP from utils/ipHelper instead
     */
    private calculateCustomerIP;
    /**
     * Migrate customer to prepaid - Versi JavaScript Murni Sederhana
     */
    migrateToPrepaid(customerId: number, adminId?: number): Promise<MigrationResult>;
    /**
     * Migrate customer to postpaid - Versi JavaScript Murni Sederhana
     */
    migrateToPostpaid(customerId: number, adminId?: number): Promise<MigrationResult>;
}
declare const _default: MigrationServiceSimple;
export default _default;
//# sourceMappingURL=MigrationServiceSimple.d.ts.map