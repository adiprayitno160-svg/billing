/**
 * AUTO FIX DATABASE - Add missing columns
 * This will run automatically on server start
 */

import pool from '../db/pool';

/**
 * Auto-fix invoices and payments tables
 * Create tables if not exists - CRITICAL for bookkeeping functionality
 */
export async function autoFixInvoicesAndPaymentsTables(): Promise<void> {
  try {
    console.log('🔧 [AutoFix] Checking invoices and payments tables...');

    // Check if invoices table exists
    const [invoicesTables] = await pool.query(
      "SHOW TABLES LIKE 'invoices'"
    );

    if ((invoicesTables as any[]).length === 0) {
      console.log('⚠️  [AutoFix] Table invoices not found, creating...');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS invoices (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_number VARCHAR(191) UNIQUE NOT NULL,
          customer_id INT NOT NULL,
          period VARCHAR(50) NOT NULL,
          due_date DATE NOT NULL,
          subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
          discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          status ENUM('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
          partial_payment_allowed TINYINT(1) DEFAULT 0,
          debt_tracking_enabled TINYINT(1) DEFAULT 0,
          last_payment_date DATE NULL,
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_customer_id (customer_id),
          INDEX idx_invoice_number (invoice_number),
          INDEX idx_status (status),
          INDEX idx_due_date (due_date),
          INDEX idx_created_at (created_at),
          CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      console.log('✅ [AutoFix] invoices table created');
    } else {
      console.log('✅ [AutoFix] invoices table exists');
    }

    // Check if invoice_items table exists
    const [invoiceItemsTables] = await pool.query(
      "SHOW TABLES LIKE 'invoice_items'"
    );

    if ((invoiceItemsTables as any[]).length === 0) {
      console.log('⚠️  [AutoFix] Table invoice_items not found, creating...');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS invoice_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_id INT NOT NULL,
          description TEXT NOT NULL,
          quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
          unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
          total_price DECIMAL(15,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_invoice_id (invoice_id),
          CONSTRAINT fk_invoice_item_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      console.log('✅ [AutoFix] invoice_items table created');
    } else {
      console.log('✅ [AutoFix] invoice_items table exists');
    }

    // Check if payments table exists
    const [paymentsTables] = await pool.query(
      "SHOW TABLES LIKE 'payments'"
    );

    if ((paymentsTables as any[]).length === 0) {
      console.log('⚠️  [AutoFix] Table payments not found, creating...');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_id INT NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          payment_method ENUM('cash', 'transfer', 'credit_card', 'debit_card', 'other') NOT NULL DEFAULT 'cash',
          payment_date DATE NOT NULL,
          reference_number VARCHAR(191) NULL,
          notes TEXT NULL,
          created_by INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_invoice_id (invoice_id),
          INDEX idx_payment_date (payment_date),
          INDEX idx_created_at (created_at),
          CONSTRAINT fk_payment_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      console.log('✅ [AutoFix] payments table created');
    } else {
      console.log('✅ [AutoFix] payments table exists');
    }

    // Check if pppoe_profiles table exists (needed for bookkeeping queries)
    const [pppoeProfilesTables] = await pool.query(
      "SHOW TABLES LIKE 'pppoe_profiles'"
    );

    if ((pppoeProfilesTables as any[]).length === 0) {
      console.log('⚠️  [AutoFix] Table pppoe_profiles not found, creating...');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS pppoe_profiles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(191) NOT NULL UNIQUE,
          download_speed VARCHAR(50) NULL,
          upload_speed VARCHAR(50) NULL,
          price DECIMAL(15,2) NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_name (name),
          INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      console.log('✅ [AutoFix] pppoe_profiles table created');
    } else {
      console.log('✅ [AutoFix] pppoe_profiles table exists');
    }

    console.log('✅ [AutoFix] Invoices and payments tables ensured');
  } catch (error: any) {
    console.error('❌ [AutoFix] Error ensuring invoices and payments tables:', error);
    // Don't throw, continue startup
  }
}
