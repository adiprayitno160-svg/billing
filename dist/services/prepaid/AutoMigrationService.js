"use strict";
/**
 * Auto Migration Service
 * Automatically fix missing database columns
 * Runs on-demand when errors detected
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoMigrationService = void 0;
const pool_1 = __importDefault(require("../../db/pool"));
class AutoMigrationService {
    /**
     * Check and add missing columns to prepaid_packages table
     */
    static async fixPrepaidPackagesTable() {
        const connection = await pool_1.default.getConnection();
        try {
            console.log('[AutoMigration] Checking prepaid_packages table...');
            // Get current columns
            const [columns] = await connection.query(`SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'prepaid_packages'`);
            const existingColumns = columns.map(col => col.COLUMN_NAME);
            console.log('[AutoMigration] Existing columns:', existingColumns.join(', '));
            let fixed = false;
            // Add description if missing
            if (!existingColumns.includes('description')) {
                console.log('[AutoMigration] Adding column: description');
                await connection.query(`ALTER TABLE prepaid_packages 
           ADD COLUMN description TEXT NULL 
           AFTER name`);
                console.log('[AutoMigration] ✅ Column description added');
                fixed = true;
            }
            // Add connection_type if missing
            if (!existingColumns.includes('connection_type')) {
                console.log('[AutoMigration] Adding column: connection_type');
                await connection.query(`ALTER TABLE prepaid_packages 
           ADD COLUMN connection_type ENUM('pppoe', 'static', 'both') NOT NULL DEFAULT 'pppoe' 
           AFTER mikrotik_profile_name`);
                console.log('[AutoMigration] ✅ Column connection_type added');
                fixed = true;
            }
            // Add parent_download_queue if missing
            if (!existingColumns.includes('parent_download_queue')) {
                console.log('[AutoMigration] Adding column: parent_download_queue');
                await connection.query(`ALTER TABLE prepaid_packages 
           ADD COLUMN parent_download_queue VARCHAR(100) NULL 
           AFTER connection_type`);
                console.log('[AutoMigration] ✅ Column parent_download_queue added');
                fixed = true;
            }
            // Add parent_upload_queue if missing
            if (!existingColumns.includes('parent_upload_queue')) {
                console.log('[AutoMigration] Adding column: parent_upload_queue');
                await connection.query(`ALTER TABLE prepaid_packages 
           ADD COLUMN parent_upload_queue VARCHAR(100) NULL 
           AFTER parent_download_queue`);
                console.log('[AutoMigration] ✅ Column parent_upload_queue added');
                fixed = true;
            }
            // Add indexes if columns were added
            if (fixed) {
                try {
                    await connection.query(`ALTER TABLE prepaid_packages 
             ADD INDEX IF NOT EXISTS idx_connection_type (connection_type)`);
                    console.log('[AutoMigration] ✅ Index idx_connection_type added');
                }
                catch (indexError) {
                    // Index might already exist, ignore
                    console.log('[AutoMigration] Index already exists or not needed');
                }
                try {
                    await connection.query(`ALTER TABLE prepaid_packages 
             ADD INDEX IF NOT EXISTS idx_is_active (is_active)`);
                    console.log('[AutoMigration] ✅ Index idx_is_active added');
                }
                catch (indexError) {
                    // Index might already exist, ignore
                    console.log('[AutoMigration] Index already exists or not needed');
                }
            }
            if (fixed) {
                console.log('[AutoMigration] 🎉 AUTO-MIGRATION COMPLETE!');
                console.log('[AutoMigration] Table prepaid_packages updated successfully');
            }
            else {
                console.log('[AutoMigration] ✅ All columns already exist, no migration needed');
            }
            return fixed;
        }
        catch (error) {
            console.error('[AutoMigration] ERROR during auto-migration:', error);
            throw error;
        }
        finally {
            connection.release();
        }
    }
    /**
     * Verify table structure
     */
    static async verifyPrepaidPackagesTable() {
        try {
            const [columns] = await pool_1.default.query(`SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'prepaid_packages'`);
            const existingColumns = columns.map(col => col.COLUMN_NAME);
            const requiredColumns = [
                'id', 'name', 'description', 'connection_type',
                'mikrotik_profile_name', 'parent_download_queue', 'parent_upload_queue',
                'download_mbps', 'upload_mbps', 'duration_days', 'price', 'is_active'
            ];
            const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
            if (missingColumns.length > 0) {
                console.warn('[AutoMigration] Missing columns:', missingColumns.join(', '));
                return false;
            }
            console.log('[AutoMigration] ✅ Table structure verified');
            return true;
        }
        catch (error) {
            console.error('[AutoMigration] Error verifying table:', error);
            return false;
        }
    }
}
exports.AutoMigrationService = AutoMigrationService;
exports.default = AutoMigrationService;
//# sourceMappingURL=AutoMigrationService.js.map