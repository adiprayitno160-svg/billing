interface MigrationResult {
    success: boolean;
    message: string;
    portal_id?: string;
    portal_pin?: string;
    error?: string;
}
/**
 * Service untuk handle migrasi customer antara postpaid dan prepaid
 */
declare class MigrationService {
    /**
     * Auto-create migration_history table if not exists
     */
    private ensureMigrationHistoryTable;
    /**
     * Migrasi customer dari Postpaid ke Prepaid
     */
    migrateToPrepaid(customerId: number, adminId?: number): Promise<MigrationResult>;
    /**
     * Migrasi customer dari Prepaid ke Postpaid
     */
    migrateToPostpaid(customerId: number, adminId?: number): Promise<MigrationResult>;
    /**
     * Get migration history for customer
     */
    getMigrationHistory(customerId: number): Promise<any[]>;
    /**
     * Get customers by billing mode
     */
    getCustomersByBillingMode(billingMode: 'postpaid' | 'prepaid'): Promise<any[]>;
    /**
     * Check if customer can be migrated
     */
    canMigrate(customerId: number): Promise<{
        canMigrate: boolean;
        reason?: string;
    }>;
    /**
     * Fix/Prepare prepaid customer - ensure IP is in correct address-list
     * Useful untuk fix customer yang sudah di-migrasi tapi IP belum masuk address-list
     */
    fixPrepaidCustomer(customerId: number): Promise<MigrationResult>;
    /**
     * Debug customer migration status - check all potential issues
     * Useful untuk debugging customer yang gagal migrasi
     */
    debugCustomerMigration(customerId: number): Promise<{
        customer: any;
        issues: string[];
        recommendations: string[];
        canMigrate: boolean;
        ipFound: boolean;
        ipAddress?: string;
        portalExists: boolean;
        portalId?: string;
    }>;
    /**
     * Batch fix all prepaid customers - ensure all are in correct address-list
     */
    fixAllPrepaidCustomers(): Promise<{
        fixed: number;
        failed: number;
        messages: string[];
    }>;
}
declare const _default: MigrationService;
export default _default;
//# sourceMappingURL=MigrationService.d.ts.map