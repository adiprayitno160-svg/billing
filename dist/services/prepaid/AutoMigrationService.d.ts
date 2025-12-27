/**
 * Auto Migration Service
 * Automatically fix missing database columns
 * Runs on-demand when errors detected
 */
export declare class AutoMigrationService {
    /**
     * Check and add missing columns to prepaid_packages table
     */
    static fixPrepaidPackagesTable(): Promise<boolean>;
    /**
     * Verify table structure
     */
    static verifyPrepaidPackagesTable(): Promise<boolean>;
}
export default AutoMigrationService;
//# sourceMappingURL=AutoMigrationService.d.ts.map