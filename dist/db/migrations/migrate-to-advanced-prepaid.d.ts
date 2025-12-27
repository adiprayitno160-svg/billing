/**
 * Migration Script: Upgrade to Advanced Prepaid System
 *
 * This script will:
 * 1. Backup existing prepaid data
 * 2. Create new advanced schema
 * 3. Migrate existing data to new schema
 * 4. Verify migration
 */
export interface MigrationResult {
    success: boolean;
    message: string;
    migratedPackages?: number;
    migratedSubscriptions?: number;
    errors?: string[];
}
export declare function migrateToAdvancedPrepaid(): Promise<MigrationResult>;
export declare function runMigration(): Promise<void>;
//# sourceMappingURL=migrate-to-advanced-prepaid.d.ts.map