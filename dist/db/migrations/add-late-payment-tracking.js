"use strict";
/**
 * Migration: Add Late Payment Tracking System
 * Creates tables and columns for tracking late payments
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const pool_1 = __importDefault(require("../pool"));
async function up() {
    const connection = await pool_1.default.getConnection();
    try {
        await connection.beginTransaction();
        // 1. Create customer_late_payment_tracking table
        await connection.query(`
      CREATE TABLE IF NOT EXISTS customer_late_payment_tracking (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        invoice_id INT NOT NULL,
        payment_id INT NOT NULL,
        due_date DATE NOT NULL,
        payment_date DATE NOT NULL,
        is_late BOOLEAN NOT NULL DEFAULT FALSE,
        days_late INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_customer_id (customer_id),
        INDEX idx_invoice_id (invoice_id),
        INDEX idx_payment_id (payment_id),
        INDEX idx_payment_date (payment_date),
        INDEX idx_is_late (is_late),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // 2. Create late_payment_audit_log table
        await connection.query(`
      CREATE TABLE IF NOT EXISTS late_payment_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_count INT NOT NULL,
        new_count INT NOT NULL,
        reason TEXT,
        performed_by INT NULL,
        performed_by_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_customer_id (customer_id),
        INDEX idx_created_at (created_at),
        INDEX idx_action (action),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
        // 3. Add columns to customers table
        try {
            await connection.query(`
        ALTER TABLE customers 
        ADD COLUMN late_payment_count INT DEFAULT 0,
        ADD COLUMN last_late_payment_date DATE NULL,
        ADD COLUMN consecutive_on_time_payments INT DEFAULT 0,
        ADD COLUMN last_payment_date DATE NULL
      `);
        }
        catch (error) {
            // Columns might already exist, ignore error
            if (!error.message.includes('Duplicate column name')) {
                throw error;
            }
        }
        // 4. Add indexes for performance
        try {
            await connection.query(`
        ALTER TABLE customers 
        ADD INDEX idx_late_payment_count (late_payment_count)
      `);
        }
        catch (error) {
            // Indexes might already exist, ignore
            if (!error.message.includes('Duplicate key name')) {
                throw error;
            }
        }
        // 5. Insert default system settings for late payment
        await connection.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_description, category) VALUES
      ('late_payment_threshold', '5', 'Jumlah late payment threshold untuk sanksi/warning', 'late_payment'),
      ('late_payment_rolling_months', '12', 'Periode rolling count (bulan)', 'late_payment'),
      ('consecutive_on_time_reset', '3', 'Jumlah pembayaran tepat waktu berturut-turut untuk reset counter', 'late_payment'),
      ('late_payment_warning_at_3', '1', 'Kirim warning setelah 3x late payment (1=enabled, 0=disabled)', 'late_payment'),
      ('late_payment_warning_at_4', '1', 'Kirim final warning setelah 4x late payment (1=enabled, 0=disabled)', 'late_payment')
    `);
        await connection.commit();
        console.log('✅ Late payment tracking migration completed successfully');
    }
    catch (error) {
        await connection.rollback();
        console.error('❌ Late payment tracking migration failed:', error);
        throw error;
    }
    finally {
        connection.release();
    }
}
async function down() {
    const connection = await pool_1.default.getConnection();
    try {
        await connection.beginTransaction();
        // Drop tables
        await connection.query('DROP TABLE IF EXISTS customer_late_payment_tracking');
        await connection.query('DROP TABLE IF EXISTS late_payment_audit_log');
        // Remove columns from customers
        try {
            await connection.query(`
        ALTER TABLE customers 
        DROP COLUMN late_payment_count,
        DROP COLUMN last_late_payment_date,
        DROP COLUMN consecutive_on_time_payments,
        DROP COLUMN last_payment_date
      `);
        }
        catch (error) {
            // Columns might not exist
            console.warn('Warning dropping columns:', error.message);
        }
        // Remove indexes
        try {
            await connection.query(`
        ALTER TABLE customers 
        DROP INDEX idx_late_payment_count
      `);
        }
        catch (error) {
            console.warn('Warning dropping indexes:', error.message);
        }
        // Remove settings
        await connection.query(`
      DELETE FROM system_settings 
      WHERE setting_key IN (
        'late_payment_threshold',
        'late_payment_rolling_months',
        'consecutive_on_time_reset',
        'late_payment_warning_at_3',
        'late_payment_warning_at_4'
      )
    `);
        await connection.commit();
        console.log('✅ Late payment tracking rollback completed');
    }
    catch (error) {
        await connection.rollback();
        console.error('❌ Late payment tracking rollback failed:', error);
        throw error;
    }
    finally {
        connection.release();
    }
}
//# sourceMappingURL=add-late-payment-tracking.js.map