"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WiFiDatabaseSetup = void 0;
const pool_1 = require("../../db/pool");
/**
 * WiFi Database Auto Setup
 * Automatically creates required tables and columns
 */
class WiFiDatabaseSetup {
    /**
     * Initialize WiFi database schema
     * Creates tables and columns if they don't exist
     */
    static async initialize() {
        try {
            console.log('🔧 [WiFi Setup] Checking WiFi database schema...');
            // 1. Check and add device_id column to customers table
            await this.ensureCustomerDeviceIdColumn();
            // 2. Create wifi_change_requests table
            await this.ensureWiFiChangeRequestsTable();
            // 3. Cleanup unused tables (optional)
            await this.cleanupUnusedTables();
            console.log('✅ [WiFi Setup] WiFi database schema ready!');
        }
        catch (error) {
            console.error('❌ [WiFi Setup] Error initializing WiFi database:', error);
            throw error;
        }
    }
    /**
     * Ensure device_id column exists in customers table
     */
    static async ensureCustomerDeviceIdColumn() {
        try {
            // Check if column exists
            const [columns] = await pool_1.databasePool.query(`SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'customers' 
                AND COLUMN_NAME = 'device_id'`);
            if (columns.length === 0) {
                console.log('  📝 Adding device_id column to customers table...');
                await pool_1.databasePool.query(`ALTER TABLE customers 
                    ADD COLUMN device_id VARCHAR(255) DEFAULT NULL 
                    COMMENT 'GenieACS Device ID for CPE management'`);
                // Add index
                await pool_1.databasePool.query(`ALTER TABLE customers ADD INDEX idx_device_id (device_id)`);
                console.log('  ✅ device_id column added to customers table');
            }
            else {
                console.log('  ✓ device_id column already exists in customers table');
            }
        }
        catch (error) {
            // Ignore duplicate column error
            if (!error.message.includes('Duplicate column')) {
                throw error;
            }
        }
    }
    /**
     * Ensure wifi_change_requests table exists
     */
    static async ensureWiFiChangeRequestsTable() {
        try {
            // Check if table exists
            const [tables] = await pool_1.databasePool.query(`SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'wifi_change_requests'`);
            if (tables.length === 0) {
                console.log('  📝 Creating wifi_change_requests table...');
                await pool_1.databasePool.query(`
                    CREATE TABLE wifi_change_requests (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        customer_id INT NOT NULL,
                        customer_name VARCHAR(255) NOT NULL,
                        phone VARCHAR(20) NOT NULL,
                        device_id VARCHAR(255) NOT NULL,
                        new_ssid VARCHAR(255) DEFAULT NULL,
                        new_password VARCHAR(255) DEFAULT NULL,
                        requested_at DATETIME NOT NULL,
                        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
                        error_message TEXT DEFAULT NULL,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        
                        INDEX idx_customer_id (customer_id),
                        INDEX idx_phone (phone),
                        INDEX idx_device_id (device_id),
                        INDEX idx_status (status),
                        INDEX idx_requested_at (requested_at),
                        
                        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);
                console.log('  ✅ wifi_change_requests table created');
            }
            else {
                console.log('  ✓ wifi_change_requests table already exists');
            }
        }
        catch (error) {
            console.error('  ❌ Error creating wifi_change_requests table:', error);
            throw error;
        }
    }
    /**
     * Cleanup unused tables
     * Remove test/unused tables to keep database clean
     */
    static async cleanupUnusedTables() {
        try {
            const unusedTables = [
                'ujian',
                'test_table',
                'temp_data',
                'old_invoices',
                'backup_customers',
                // Add more unused table names here
            ];
            for (const tableName of unusedTables) {
                const [tables] = await pool_1.databasePool.query(`SELECT TABLE_NAME 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = ?`, [tableName]);
                if (tables.length > 0) {
                    console.log(`  🗑️  Dropping unused table: ${tableName}`);
                    await pool_1.databasePool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
                    console.log(`  ✅ Dropped table: ${tableName}`);
                }
            }
        }
        catch (error) {
            console.warn('  ⚠️  Warning during cleanup:', error.message);
            // Don't throw error, cleanup is optional
        }
    }
    /**
     * Get database statistics
     */
    static async getStats() {
        try {
            // Count customers with device_id
            const [customersResult] = await pool_1.databasePool.query(`SELECT COUNT(*) as count FROM customers WHERE device_id IS NOT NULL`);
            // Count total requests
            const [totalResult] = await pool_1.databasePool.query(`SELECT COUNT(*) as count FROM wifi_change_requests`);
            // Count successful requests
            const [successResult] = await pool_1.databasePool.query(`SELECT COUNT(*) as count FROM wifi_change_requests WHERE status = 'completed'`);
            // Count failed requests
            const [failedResult] = await pool_1.databasePool.query(`SELECT COUNT(*) as count FROM wifi_change_requests WHERE status = 'failed'`);
            return {
                customersWithDevice: customersResult[0]?.count || 0,
                totalRequests: totalResult[0]?.count || 0,
                successfulRequests: successResult[0]?.count || 0,
                failedRequests: failedResult[0]?.count || 0
            };
        }
        catch (error) {
            console.error('Error getting WiFi stats:', error);
            return {
                customersWithDevice: 0,
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0
            };
        }
    }
}
exports.WiFiDatabaseSetup = WiFiDatabaseSetup;
exports.default = WiFiDatabaseSetup;
//# sourceMappingURL=WiFiDatabaseSetup.js.map