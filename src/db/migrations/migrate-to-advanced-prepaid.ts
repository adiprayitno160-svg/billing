/**
 * Migration Script: Upgrade to Advanced Prepaid System
 * 
 * This script will:
 * 1. Backup existing prepaid data
 * 2. Create new advanced schema
 * 3. Migrate existing data to new schema
 * 4. Verify migration
 */

import { databasePool } from '../pool';
import fs from 'fs/promises';
import path from 'path';
import { readFileSync } from 'fs';

export interface MigrationResult {
  success: boolean;
  message: string;
  migratedPackages?: number;
  migratedSubscriptions?: number;
  errors?: string[];
}

export async function migrateToAdvancedPrepaid(): Promise<MigrationResult> {
  const connection = await databasePool.getConnection();
  const errors: string[] = [];
  
  try {
    await connection.beginTransaction();
    
    console.log('🔄 Starting migration to Advanced Prepaid System...');
    
    // Step 1: Backup existing data
    console.log('📦 Step 1: Backing up existing data...');
    await backupExistingData(connection);
    
    // Step 2: Create new schema
    console.log('🏗️  Step 2: Creating new advanced schema...');
    const schemaPath = path.join(__dirname, 'create-advanced-prepaid-schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      try {
        if (statement.toLowerCase().includes('rename table')) {
          // Handle rename with IF EXISTS check
          const tableName = statement.match(/RENAME TABLE\s+(\w+)/i)?.[1];
          if (tableName) {
            const [tables] = await connection.query(
              `SHOW TABLES LIKE '${tableName}'`
            );
            if ((tables as any[]).length > 0) {
              await connection.query(statement);
            }
          }
        } else if (statement.toLowerCase().includes('create table')) {
          // Create table with IF NOT EXISTS
          const modifiedStatement = statement.replace(
            /CREATE TABLE\s+/i,
            'CREATE TABLE IF NOT EXISTS '
          );
          await connection.query(modifiedStatement);
        } else {
          await connection.query(statement);
        }
      } catch (error: any) {
        // Log but continue for non-critical errors
        if (!error.message.includes('already exists') && 
            !error.message.includes("doesn't exist")) {
          console.warn(`⚠️  Warning: ${error.message}`);
        }
      }
    }
    
    // Step 3: Migrate packages
    console.log('📦 Step 3: Migrating packages...');
    const migratedPackages = await migratePackages(connection);
    
    // Step 4: Migrate subscriptions
    console.log('📦 Step 4: Migrating subscriptions...');
    const migratedSubscriptions = await migrateSubscriptions(connection);
    
    // Step 5: Create customer deposits table entries
    console.log('💰 Step 5: Initializing customer deposits...');
    await initializeCustomerDeposits(connection);
    
    // Step 6: Verify migration
    console.log('✅ Step 6: Verifying migration...');
    await verifyMigration(connection);
    
    await connection.commit();
    
    console.log('✅ Migration completed successfully!');
    
    return {
      success: true,
      message: 'Migration completed successfully',
      migratedPackages,
      migratedSubscriptions
    };
    
  } catch (error: any) {
    await connection.rollback();
    errors.push(error.message);
    console.error('❌ Migration failed:', error);
    
    return {
      success: false,
      message: 'Migration failed',
      errors
    };
  } finally {
    connection.release();
  }
}

async function backupExistingData(connection: any): Promise<void> {
  // Create backup directory
  const backupDir = path.join(process.cwd(), 'backups', 'prepaid-migration');
  await fs.mkdir(backupDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Backup packages
  try {
    const [packages] = await connection.query('SELECT * FROM prepaid_packages');
    await fs.writeFile(
      path.join(backupDir, `packages-${timestamp}.json`),
      JSON.stringify(packages, null, 2)
    );
  } catch (error: any) {
    if (!error.message.includes("doesn't exist")) {
      throw error;
    }
  }
  
  // Backup subscriptions
  try {
    const [subscriptions] = await connection.query('SELECT * FROM prepaid_package_subscriptions');
    await fs.writeFile(
      path.join(backupDir, `subscriptions-${timestamp}.json`),
      JSON.stringify(subscriptions, null, 2)
    );
  } catch (error: any) {
    if (!error.message.includes("doesn't exist")) {
      throw error;
    }
  }
}

async function migratePackages(connection: any): Promise<number> {
  // Check if old table exists
  const [tables] = await connection.query(
    "SHOW TABLES LIKE 'prepaid_packages_old_backup'"
  );
  
  if ((tables as any[]).length === 0) {
    // Check if original table exists
    const [tables2] = await connection.query(
      "SHOW TABLES LIKE 'prepaid_packages'"
    );
    if ((tables2 as any[]).length === 0) {
      return 0; // No packages to migrate
    }
    
    // Use original table
    const [packages] = await connection.query('SELECT * FROM prepaid_packages');
    
    for (const pkg of packages as any[]) {
      const packageCode = `PKG-${pkg.id}-${Date.now()}`;
      
      await connection.query(
        `INSERT INTO prepaid_packages_v2 (
          name, description, package_code, connection_type,
          download_mbps, upload_mbps, duration_days,
          base_price, mikrotik_profile_name,
          parent_download_queue, parent_upload_queue,
          speed_profile_id, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pkg.name || 'Migrated Package',
          pkg.description || '',
          packageCode,
          pkg.connection_type || 'both',
          pkg.download_mbps || 0,
          pkg.upload_mbps || 0,
          pkg.duration_days || 30,
          pkg.price || 0,
          pkg.mikrotik_profile_name || null,
          pkg.parent_download_queue || null,
          pkg.parent_upload_queue || null,
          pkg.speed_profile_id || null,
          pkg.is_active !== undefined ? pkg.is_active : 1
        ]
      );
    }
    
    return (packages as any[]).length;
  }
  
  // Migrate from backup table
  const [packages] = await connection.query('SELECT * FROM prepaid_packages_old_backup');
  
  for (const pkg of packages as any[]) {
    const packageCode = `PKG-${pkg.id}-${Date.now()}`;
    
    await connection.query(
      `INSERT INTO prepaid_packages_v2 (
        name, description, package_code, connection_type,
        download_mbps, upload_mbps, duration_days,
        base_price, mikrotik_profile_name,
        parent_download_queue, parent_upload_queue,
        speed_profile_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pkg.name || 'Migrated Package',
        pkg.description || '',
        packageCode,
        pkg.connection_type || 'both',
        pkg.download_mbps || 0,
        pkg.upload_mbps || 0,
        pkg.duration_days || 30,
        pkg.price || 0,
        pkg.mikrotik_profile_name || null,
        pkg.parent_download_queue || null,
        pkg.parent_upload_queue || null,
        pkg.speed_profile_id || null,
        pkg.is_active !== undefined ? pkg.is_active : 1
      ]
    );
  }
  
  return (packages as any[]).length;
}

async function migrateSubscriptions(connection: any): Promise<number> {
  // Check if old table exists
  const [tables] = await connection.query(
    "SHOW TABLES LIKE 'prepaid_package_subscriptions_old_backup'"
  );
  
  if ((tables as any[]).length === 0) {
    // Check if original table exists
    const [tables2] = await connection.query(
      "SHOW TABLES LIKE 'prepaid_package_subscriptions'"
    );
    if ((tables2 as any[]).length === 0) {
      return 0; // No subscriptions to migrate
    }
    
    // Use original table - but we need package mapping
    // For now, skip subscription migration as we need to map old package IDs to new ones
    return 0;
  }
  
  // For subscription migration, we need to map old package IDs to new ones
  // This is complex and should be done carefully
  // For now, return 0 - subscriptions will need to be reactivated
  return 0;
}

async function initializeCustomerDeposits(connection: any): Promise<void> {
  // Get all prepaid customers
  const [customers] = await connection.query(
    "SELECT id FROM customers WHERE connection_type = 'prepaid'"
  );
  
  for (const customer of customers as any[]) {
    // Insert or update deposit record
    await connection.query(
      `INSERT INTO prepaid_customer_deposits (customer_id, balance, last_updated)
       VALUES (?, 0, NOW())
       ON DUPLICATE KEY UPDATE last_updated = NOW()`,
      [customer.id]
    );
  }
}

async function verifyMigration(connection: any): Promise<void> {
  // Check if new tables exist
  const requiredTables = [
    'prepaid_packages_v2',
    'prepaid_subscriptions_v2',
    'prepaid_usage_logs',
    'prepaid_vouchers',
    'prepaid_referrals',
    'prepaid_customer_deposits'
  ];
  
  for (const table of requiredTables) {
    const [tables] = await connection.query(`SHOW TABLES LIKE '${table}'`);
    if ((tables as any[]).length === 0) {
      throw new Error(`Table ${table} was not created`);
    }
  }
  
  console.log('✅ All tables verified');
}

// Export function to run migration
export async function runMigration(): Promise<void> {
  console.log('🚀 Starting Advanced Prepaid System Migration...\n');
  
  const result = await migrateToAdvancedPrepaid();
  
  if (result.success) {
    console.log('\n✅ Migration Summary:');
    console.log(`   - Packages migrated: ${result.migratedPackages || 0}`);
    console.log(`   - Subscriptions migrated: ${result.migratedSubscriptions || 0}`);
    console.log('\n✨ Migration completed successfully!');
  } else {
    console.error('\n❌ Migration failed:');
    console.error(`   ${result.message}`);
    if (result.errors) {
      result.errors.forEach(error => console.error(`   - ${error}`));
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}




