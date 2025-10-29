/**
 * Prepaid Package Service
 * Handles CRUD operations for prepaid packages
 * Supports both PPPoE and Static IP connection types
 */

import pool from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { PrepaidQueueService } from './PrepaidQueueService';
import { AutoMigrationService } from './AutoMigrationService';

export interface PrepaidPackage {
  id?: number;
  name: string;
  description: string;
  connection_type: 'pppoe' | 'static' | 'both';
  mikrotik_profile_name?: string; // For PPPoE
  parent_download_queue?: string; // For Static IP
  parent_upload_queue?: string; // For Static IP
  download_mbps: number;
  upload_mbps: number;
  duration_days: number;
  price: number;
  is_active: boolean;
}

export interface PackageListItem extends PrepaidPackage {
  id: number;
  created_at: Date;
  updated_at: Date;
}

export class PrepaidPackageService {
  /**
   * Get all packages (for admin)
   */
  static async getAllPackages(): Promise<PackageListItem[]> {
    try {
      console.log('[PrepaidPackageService] Querying packages...');
      
      // Try dengan description first
      try {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT 
            id, name, description, connection_type,
            mikrotik_profile_name, parent_download_queue, parent_upload_queue,
            download_mbps, upload_mbps, duration_days, price, is_active,
            created_at, updated_at
          FROM prepaid_packages
          ORDER BY connection_type, price ASC`
        );
        console.log('[PrepaidPackageService] Found', rows.length, 'packages');
        return rows as PackageListItem[];
      } catch (descError: any) {
        // Jika ada kolom yang missing, AUTO-RUN MIGRATION!
        if (descError.message && (descError.message.includes("description") || descError.message.includes("connection_type"))) {
          console.warn('[PrepaidPackageService] 🔧 Missing columns detected!');
          console.warn('[PrepaidPackageService] Error:', descError.message);
          console.log('[PrepaidPackageService] 🚀 AUTO-RUNNING MIGRATION...');
          
          try {
            // AUTO-FIX: Run migration automatically
            const fixed = await AutoMigrationService.fixPrepaidPackagesTable();
            
            if (fixed) {
              console.log('[PrepaidPackageService] ✅ AUTO-MIGRATION SUCCESS!');
              console.log('[PrepaidPackageService] 🔄 Retrying query with new columns...');
              
              // Retry original query now that columns exist
              const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT 
                  id, name, description, connection_type,
                  mikrotik_profile_name, parent_download_queue, parent_upload_queue,
                  download_mbps, upload_mbps, duration_days, price, is_active,
                  created_at, updated_at
                FROM prepaid_packages
                ORDER BY connection_type, price ASC`
              );
              console.log('[PrepaidPackageService] ✅ Query successful after migration!');
              return rows as PackageListItem[];
            }
            
          } catch (migrationError) {
            console.error('[PrepaidPackageService] ❌ Auto-migration failed:', migrationError);
            console.log('[PrepaidPackageService] Using fallback query...');
          }
          
          // Fallback jika migration gagal
          const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT 
              id, 
              name, 
              '' as description,
              'pppoe' as connection_type,
              mikrotik_profile_name, 
              NULL as parent_download_queue, 
              NULL as parent_upload_queue,
              download_mbps, 
              upload_mbps, 
              duration_days, 
              price, 
              is_active,
              created_at, 
              updated_at
            FROM prepaid_packages
            ORDER BY price ASC`
          );
          console.log('[PrepaidPackageService] Found', rows.length, 'packages (fallback mode)');
          return rows as PackageListItem[];
        }
        throw descError;
      }
    } catch (error) {
      console.error('[PrepaidPackageService] Database error:', error);
      
      // Check if table exists
      if (error instanceof Error && error.message.includes("doesn't exist")) {
        throw new Error('Table prepaid_packages not found. Please run migration: migrations/complete_prepaid_system.sql');
      }
      
      throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get active packages by connection type (for customer portal)
   */
  static async getActivePackagesByType(connectionType: 'pppoe' | 'static'): Promise<PackageListItem[]> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          id, name, description, connection_type,
          mikrotik_profile_name, parent_download_queue, parent_upload_queue,
          download_mbps, upload_mbps, duration_days, price, is_active,
          created_at, updated_at
        FROM prepaid_packages
        WHERE is_active = 1
          AND (connection_type = ? OR connection_type = 'both')
        ORDER BY price ASC`,
        [connectionType]
      );

      return rows as PackageListItem[];
    } catch (error) {
      console.error('[PrepaidPackageService] Error fetching packages by type:', error);
      throw new Error('Failed to fetch packages');
    }
  }

  /**
   * Get package by ID
   */
  static async getPackageById(packageId: number): Promise<PackageListItem | null> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          id, name, description, connection_type,
          mikrotik_profile_name, parent_download_queue, parent_upload_queue,
          download_mbps, upload_mbps, duration_days, price, is_active,
          created_at, updated_at
        FROM prepaid_packages
        WHERE id = ?`,
        [packageId]
      );

      return rows.length > 0 ? (rows[0] as PackageListItem) : null;
    } catch (error) {
      console.error('[PrepaidPackageService] Error fetching package by ID:', error);
      throw new Error('Failed to fetch package');
    }
  }

  /**
   * Create new package
   */
  static async createPackage(packageData: PrepaidPackage): Promise<number> {
    try {
      // Validate based on connection type
      this.validatePackageData(packageData);

      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO prepaid_packages (
          name, description, connection_type,
          mikrotik_profile_name, parent_download_queue, parent_upload_queue,
          download_mbps, upload_mbps, duration_days, price, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          packageData.name,
          packageData.description,
          packageData.connection_type,
          packageData.mikrotik_profile_name || null,
          packageData.parent_download_queue || null,
          packageData.parent_upload_queue || null,
          packageData.download_mbps,
          packageData.upload_mbps,
          packageData.duration_days,
          packageData.price,
          packageData.is_active ? 1 : 0,
        ]
      );

      console.log(`[PrepaidPackageService] Package created: ${packageData.name} (ID: ${result.insertId})`);
      return result.insertId;
    } catch (error) {
      console.error('[PrepaidPackageService] Error creating package:', error);
      throw new Error('Failed to create package');
    }
  }

  /**
   * Update existing package
   */
  static async updatePackage(packageId: number, packageData: Partial<PrepaidPackage>): Promise<void> {
    try {
      // Get existing package to validate
      const existingPackage = await this.getPackageById(packageId);
      if (!existingPackage) {
        throw new Error('Package not found');
      }

      // Merge existing with updates
      const updatedData = { ...existingPackage, ...packageData };
      this.validatePackageData(updatedData);

      await pool.query(
        `UPDATE prepaid_packages SET
          name = ?,
          description = ?,
          connection_type = ?,
          mikrotik_profile_name = ?,
          parent_download_queue = ?,
          parent_upload_queue = ?,
          download_mbps = ?,
          upload_mbps = ?,
          duration_days = ?,
          price = ?,
          is_active = ?
        WHERE id = ?`,
        [
          updatedData.name,
          updatedData.description,
          updatedData.connection_type,
          updatedData.mikrotik_profile_name || null,
          updatedData.parent_download_queue || null,
          updatedData.parent_upload_queue || null,
          updatedData.download_mbps,
          updatedData.upload_mbps,
          updatedData.duration_days,
          updatedData.price,
          updatedData.is_active ? 1 : 0,
          packageId,
        ]
      );

      console.log(`[PrepaidPackageService] Package updated: ${updatedData.name} (ID: ${packageId})`);
    } catch (error) {
      console.error('[PrepaidPackageService] Error updating package:', error);
      throw new Error('Failed to update package');
    }
  }

  /**
   * Delete package (soft delete - set inactive)
   */
  static async deletePackage(packageId: number): Promise<void> {
    try {
      // Check if package has active subscriptions
      const [subscriptions] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM prepaid_subscriptions 
         WHERE package_id = ? AND status = 'active'`,
        [packageId]
      );

      if (subscriptions[0].count > 0) {
        throw new Error('Cannot delete package with active subscriptions');
      }

      // Soft delete
      await pool.query('UPDATE prepaid_packages SET is_active = 0 WHERE id = ?', [packageId]);

      console.log(`[PrepaidPackageService] Package deleted (soft): ID ${packageId}`);
    } catch (error) {
      console.error('[PrepaidPackageService] Error deleting package:', error);
      throw error;
    }
  }

  /**
   * Get parent queues from Mikrotik (for admin dropdown)
   */
  static async getParentQueuesFromMikrotik(): Promise<{ download: string[]; upload: string[] }> {
    try {
      const mikrotikConfig = await PrepaidQueueService.getMikrotikConfig();
      if (!mikrotikConfig) {
        throw new Error('Mikrotik not configured');
      }

      const queueService = new PrepaidQueueService(mikrotikConfig);
      return await queueService.getParentQueues();
    } catch (error) {
      console.error('[PrepaidPackageService] Error getting parent queues:', error);
      throw new Error('Failed to get parent queues from Mikrotik');
    }
  }

  /**
   * Validate package data based on connection type
   */
  private static validatePackageData(packageData: PrepaidPackage): void {
    if (!packageData.name || packageData.name.trim() === '') {
      throw new Error('Package name is required');
    }

    if (!packageData.connection_type) {
      throw new Error('Connection type is required');
    }

    // PPPoE validation
    if (
      packageData.connection_type === 'pppoe' &&
      (!packageData.mikrotik_profile_name || packageData.mikrotik_profile_name.trim() === '')
    ) {
      throw new Error('Mikrotik profile name is required for PPPoE packages');
    }

    // Static IP validation
    if (packageData.connection_type === 'static') {
      if (!packageData.parent_download_queue || packageData.parent_download_queue.trim() === '') {
        throw new Error('Parent download queue is required for Static IP packages');
      }
      if (!packageData.parent_upload_queue || packageData.parent_upload_queue.trim() === '') {
        throw new Error('Parent upload queue is required for Static IP packages');
      }
    }

    // Speed validation
    if (packageData.download_mbps <= 0 || packageData.upload_mbps <= 0) {
      throw new Error('Download and upload speed must be greater than 0');
    }

    // Duration validation
    if (packageData.duration_days <= 0) {
      throw new Error('Duration must be greater than 0 days');
    }

    // Price validation
    if (packageData.price < 0) {
      throw new Error('Price cannot be negative');
    }
  }

  /**
   * Check if customer connection type is detected
   */
  static async getCustomerConnectionType(customerId: number): Promise<'pppoe' | 'static' | null> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT connection_type, pppoe_username, ip_address FROM customers WHERE id = ?',
        [customerId]
      );

      if (rows.length === 0) {
        return null;
      }

      const customer = rows[0];

      // If explicitly set
      if (customer.connection_type) {
        return customer.connection_type as 'pppoe' | 'static';
      }

      // Auto-detect based on data
      if (customer.pppoe_username && customer.pppoe_username.trim() !== '') {
        return 'pppoe';
      }

      if (customer.ip_address && customer.ip_address.trim() !== '') {
        return 'static';
      }

      return null;
    } catch (error) {
      console.error('[PrepaidPackageService] Error getting customer connection type:', error);
      return null;
    }
  }
}

export default PrepaidPackageService;

