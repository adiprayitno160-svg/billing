/**
 * AUTO FIX DATABASE - Add missing columns
 * This will run automatically on server start
 */

import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

/**
 * Ensure purchase_codes and payment_verifications tables exist
 */
export async function ensurePurchaseTables(): Promise<void> {
  try {
    console.log('🔧 [AutoFix] Checking purchase_codes and payment_verifications tables...');

    // Create purchase_codes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        customer_id INT NOT NULL,
        package_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'paid', 'expired', 'cancelled') DEFAULT 'pending',
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_customer_id (customer_id),
        INDEX idx_status (status),
        INDEX idx_expires_at (expires_at),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (package_id) REFERENCES prepaid_packages(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create payment_verifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        package_id INT NULL,
        invoice_id INT NULL,
        purchase_code VARCHAR(50) NULL,
        amount DECIMAL(10,2) NOT NULL,
        bank_account VARCHAR(255) NULL,
        transfer_date DATETIME NULL,
        status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
        verification_method ENUM('manual', 'ocr', 'ai') DEFAULT 'manual',
        confidence_score DECIMAL(5,2) NULL,
        notes TEXT NULL,
        verified_at DATETIME NULL,
        verified_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_purchase_code (purchase_code),
        INDEX idx_customer_id (customer_id),
        INDEX idx_invoice_id (invoice_id),
        INDEX idx_status (status),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (package_id) REFERENCES prepaid_packages(id) ON DELETE CASCADE,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add invoice_id column if it doesn't exist (for existing tables)
    try {
      const [columns] = await pool.query<RowDataPacket[]>(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'payment_verifications' 
        AND COLUMN_NAME = 'invoice_id'
      `);

      if (columns.length === 0) {
        await pool.query(`
          ALTER TABLE payment_verifications 
          ADD COLUMN invoice_id INT NULL
        `);
        await pool.query(`
          ALTER TABLE payment_verifications 
          ADD INDEX idx_invoice_id (invoice_id)
        `);
        await pool.query(`
          ALTER TABLE payment_verifications 
          ADD FOREIGN KEY fk_invoice_id (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        `);
        console.log('✅ [AutoFix] Added invoice_id column to payment_verifications');
      }
    } catch (error: any) {
      // Column might already exist, ignore error
      if (!error.message.includes('Duplicate column') && !error.message.includes('already exists') && !error.message.includes('Duplicate key')) {
        console.warn('⚠️ [AutoFix] Could not add invoice_id column:', error.message);
      }
    }

    // Make package_id and purchase_code nullable (for postpaid payments)
    try {
      const [packageIdCol] = await pool.query<RowDataPacket[]>(`
        SELECT IS_NULLABLE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'payment_verifications' 
        AND COLUMN_NAME = 'package_id'
      `);

      if (packageIdCol.length > 0 && packageIdCol[0].IS_NULLABLE === 'NO') {
        await pool.query(`
          ALTER TABLE payment_verifications 
          MODIFY COLUMN package_id INT NULL
        `);
      }

      const [purchaseCodeCol] = await pool.query<RowDataPacket[]>(`
        SELECT IS_NULLABLE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'payment_verifications' 
        AND COLUMN_NAME = 'purchase_code'
      `);

      if (purchaseCodeCol.length > 0 && purchaseCodeCol[0].IS_NULLABLE === 'NO') {
        await pool.query(`
          ALTER TABLE payment_verifications 
          MODIFY COLUMN purchase_code VARCHAR(50) NULL
        `);
      }
    } catch (error: any) {
      console.warn('⚠️ [AutoFix] Could not modify columns:', error.message);
    }

    console.log('✅ [AutoFix] Purchase tables ensured');

  } catch (error: any) {
    console.error('❌ [AutoFix] Error ensuring purchase tables:', error);
    // Don't throw, continue startup
  }
}

export async function autoFixPrepaidPackagesTable(): Promise<void> {
  try {
    console.log('🔧 [AutoFix] Checking prepaid_packages table...');

    // Check if table exists
    const [tables] = await pool.query(
      "SHOW TABLES LIKE 'prepaid_packages'"
    );

    if ((tables as any[]).length === 0) {
      console.log('⚠️  [AutoFix] Table prepaid_packages not found, creating...');
      
      // Create table if not exists
      await pool.query(`
        CREATE TABLE prepaid_packages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT NULL,
          connection_type ENUM('pppoe', 'static', 'both') NOT NULL DEFAULT 'pppoe',
          mikrotik_profile_name VARCHAR(100) NULL,
          parent_download_queue VARCHAR(100) NULL,
          parent_upload_queue VARCHAR(100) NULL,
          download_mbps DECIMAL(10,2) NOT NULL,
          upload_mbps DECIMAL(10,2) NOT NULL,
          duration_days INT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          is_active TINYINT(1) DEFAULT 1,
          allow_custom_speed TINYINT(1) DEFAULT 0,
          download_limit VARCHAR(50) NULL,
          upload_limit VARCHAR(50) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_connection_type (connection_type),
          INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ [AutoFix] prepaid_packages table created');
      return;
    }

    // Get current columns
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM prepaid_packages"
    );

    const existingColumns = (columns as any[]).map((col: any) => col.Field);
    let fixed = 0;

    // Required columns
    const requiredColumns = [
      { name: 'name', type: 'VARCHAR(100) NOT NULL', after: 'id' },
      { name: 'description', type: 'TEXT NULL', after: 'name' },
      { name: 'connection_type', type: "ENUM('pppoe', 'static', 'both') NOT NULL DEFAULT 'pppoe'", after: 'description' },
      { name: 'mikrotik_profile_name', type: 'VARCHAR(100) NULL', after: 'connection_type' },
      { name: 'parent_download_queue', type: 'VARCHAR(100) NULL', after: 'mikrotik_profile_name' },
      { name: 'parent_upload_queue', type: 'VARCHAR(100) NULL', after: 'parent_download_queue' },
      { name: 'download_mbps', type: 'DECIMAL(10,2) NOT NULL', after: 'parent_upload_queue' },
      { name: 'upload_mbps', type: 'DECIMAL(10,2) NOT NULL', after: 'download_mbps' },
      { name: 'duration_days', type: 'INT NOT NULL', after: 'upload_mbps' },
      { name: 'price', type: 'DECIMAL(10,2) NOT NULL', after: 'duration_days' },
      { name: 'is_active', type: 'TINYINT(1) DEFAULT 1', after: 'price' },
      { name: 'allow_custom_speed', type: 'TINYINT(1) DEFAULT 0', after: 'is_active' },
      { name: 'download_limit', type: 'VARCHAR(50) NULL', after: 'allow_custom_speed' },
      { name: 'upload_limit', type: 'VARCHAR(50) NULL', after: 'download_limit' }
    ];

    // Add missing columns
    for (const col of requiredColumns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`  Adding column: ${col.name}...`);
        try {
          await pool.query(`
            ALTER TABLE prepaid_packages 
            ADD COLUMN ${col.name} ${col.type}
          `);
          console.log(`  ✅ ${col.name} added`);
          fixed++;
        } catch (err) {
          console.error(`  ❌ Failed to add ${col.name}:`, err);
        }
      }
    }

    if (fixed > 0) {
      console.log(`✅ [AutoFix] Fixed ${fixed} missing columns in prepaid_packages`);
    } else {
      console.log('✅ [AutoFix] prepaid_packages table is OK');
    }

  } catch (error) {
    console.error('❌ [AutoFix] Error fixing prepaid_packages:', error);
    // Don't throw - let the app continue even if fix fails
  }
}

/**
 * Auto-fix prepaid_package_subscriptions table
 * Add columns for custom speed selection for static IP
 */
export async function autoFixPrepaidSubscriptionsTable(): Promise<void> {
  try {
    console.log('🔧 [AutoFix] Checking prepaid_package_subscriptions table...');

    // Check if table exists
    const [tables] = await pool.query(
      "SHOW TABLES LIKE 'prepaid_package_subscriptions'"
    );

    if ((tables as any[]).length === 0) {
      console.log('⚠️  [AutoFix] Table prepaid_package_subscriptions not found, skipping...');
      return;
    }

    // Get current columns
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM prepaid_package_subscriptions"
    );

    const existingColumns = (columns as any[]).map((col: any) => col.Field);
    let fixed = 0;

    // Add custom speed columns for static IP packages
    const customSpeedColumns = [
      { name: 'custom_download_mbps', type: 'DECIMAL(10,2) NULL', after: 'purchase_price' },
      { name: 'custom_upload_mbps', type: 'DECIMAL(10,2) NULL', after: 'custom_download_mbps' }
    ];

    for (const col of customSpeedColumns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`  Adding column: ${col.name}...`);
        try {
          await pool.query(`
            ALTER TABLE prepaid_package_subscriptions 
            ADD COLUMN ${col.name} ${col.type}
          `);
          console.log(`  ✅ ${col.name} added`);
          fixed++;
        } catch (err) {
          console.error(`  ❌ Failed to add ${col.name}:`, err);
        }
      }
    }

    if (fixed > 0) {
      console.log(`✅ [AutoFix] Fixed ${fixed} missing columns in prepaid_package_subscriptions`);
    } else {
      console.log('✅ [AutoFix] prepaid_package_subscriptions table is OK');
    }

  } catch (error) {
    console.error('❌ [AutoFix] Error fixing prepaid_package_subscriptions:', error);
    // Don't throw - let the app continue even if fix fails
  }
}

/**
 * Auto-fix prepaid_transactions table
 * Create table if not exists
 */
export async function autoFixPrepaidTransactionsTable(): Promise<void> {
  try {
    console.log('🔧 [AutoFix] Checking prepaid_transactions table...');

    // Check if table exists
    const [tables] = await pool.query(
      "SHOW TABLES LIKE 'prepaid_transactions'"
    );

    if ((tables as any[]).length === 0) {
      console.log('⚠️  [AutoFix] Table prepaid_transactions not found, creating...');
      
      await pool.query(`
        CREATE TABLE prepaid_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          package_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          payment_method ENUM('manual_transfer', 'payment_gateway', 'cash', 'admin_credit') NOT NULL,
          payment_status ENUM('pending', 'verified', 'rejected', 'paid', 'expired') DEFAULT 'pending',
          payment_proof_url VARCHAR(500) NULL,
          payment_gateway_reference VARCHAR(255) NULL,
          payment_gateway_type VARCHAR(50) NULL,
          payment_notes TEXT NULL,
          verified_at TIMESTAMP NULL,
          verified_by INT NULL,
          rejected_reason TEXT NULL,
          expired_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_customer_id (customer_id),
          INDEX idx_package_id (package_id),
          INDEX idx_payment_status (payment_status),
          INDEX idx_created_at (created_at),
          CONSTRAINT fk_prepaid_trans_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
          CONSTRAINT fk_prepaid_trans_package FOREIGN KEY (package_id) REFERENCES prepaid_packages(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ [AutoFix] prepaid_transactions table created');
      return;
    }

    console.log('✅ [AutoFix] prepaid_transactions table exists');
  } catch (error) {
    console.error('❌ [AutoFix] Error fixing prepaid_transactions:', error);
    // Don't throw - let the app continue even if fix fails
  }
}

/**
 * Auto-fix portal_customers table
 * Create table if not exists
 */
export async function autoFixPortalCustomersTable(): Promise<void> {
  try {
    console.log('🔧 [AutoFix] Checking portal_customers table...');

    // Check if table exists
    const [tables] = await pool.query(
      "SHOW TABLES LIKE 'portal_customers'"
    );

    if ((tables as any[]).length === 0) {
      console.log('⚠️  [AutoFix] Table portal_customers not found, creating...');
      
      await pool.query(`
        CREATE TABLE portal_customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL UNIQUE,
          portal_id VARCHAR(50) NOT NULL UNIQUE,
          portal_pin VARCHAR(255) NOT NULL,
          status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
          login_attempts INT DEFAULT 0,
          last_login TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_customer_id (customer_id),
          INDEX idx_portal_id (portal_id),
          INDEX idx_status (status),
          CONSTRAINT fk_portal_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ [AutoFix] portal_customers table created');
      return;
    }

    console.log('✅ [AutoFix] portal_customers table exists');
  } catch (error) {
    console.error('❌ [AutoFix] Error fixing portal_customers:', error);
    // Don't throw - let the app continue even if fix fails
  }
}

/**
 * Auto-fix prepaid_package_subscriptions table
 * Create table if not exists (full table creation)
 */
export async function autoFixPrepaidSubscriptionsTableFull(): Promise<void> {
  try {
    console.log('🔧 [AutoFix] Checking prepaid_package_subscriptions table (full)...');

    // Check if table exists
    const [tables] = await pool.query(
      "SHOW TABLES LIKE 'prepaid_package_subscriptions'"
    );

    if ((tables as any[]).length === 0) {
      console.log('⚠️  [AutoFix] Table prepaid_package_subscriptions not found, creating...');
      
      await pool.query(`
        CREATE TABLE prepaid_package_subscriptions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          package_id INT NOT NULL,
          activation_date TIMESTAMP NOT NULL,
          expiry_date TIMESTAMP NOT NULL,
          status ENUM('active', 'expired', 'cancelled', 'suspended') DEFAULT 'active',
          auto_renew TINYINT(1) DEFAULT 0,
          purchase_price DECIMAL(10,2) NOT NULL,
          invoice_id INT NULL,
          pppoe_username VARCHAR(191) NULL,
          custom_download_mbps DECIMAL(10,2) NULL,
          custom_upload_mbps DECIMAL(10,2) NULL,
          last_notified_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_customer_id (customer_id),
          INDEX idx_package_id (package_id),
          INDEX idx_status (status),
          INDEX idx_expiry_date (expiry_date),
          INDEX idx_customer_status (customer_id, status),
          CONSTRAINT fk_prepaid_sub_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
          CONSTRAINT fk_prepaid_sub_package FOREIGN KEY (package_id) REFERENCES prepaid_packages(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ [AutoFix] prepaid_package_subscriptions table created');
      return;
    }

    console.log('✅ [AutoFix] prepaid_package_subscriptions table exists');
  } catch (error) {
    console.error('❌ [AutoFix] Error fixing prepaid_package_subscriptions:', error);
    // Don't throw - let the app continue even if fix fails
  }
}

