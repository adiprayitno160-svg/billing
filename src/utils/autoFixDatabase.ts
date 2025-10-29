/**
 * AUTO FIX DATABASE - Add missing columns
 * This will run automatically on server start
 */

import pool from '../db/pool';

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
      { name: 'is_active', type: 'TINYINT(1) DEFAULT 1', after: 'price' }
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

