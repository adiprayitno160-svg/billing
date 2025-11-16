/**
 * Advanced Prepaid Package Service
 * 
 * Handles all operations for prepaid packages with advanced features:
 * - Multi-tier packages
 * - Bundle packages
 * - Dynamic pricing
 * - Package features
 */

import { databasePool } from '../../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface AdvancedPackage {
  id?: number;
  name: string;
  description?: string;
  package_code: string;
  package_type: 'basic' | 'premium' | 'vip' | 'unlimited';
  tier_level?: number;
  connection_type: 'pppoe' | 'static_ip' | 'both';
  download_mbps: number;
  upload_mbps: number;
  mikrotik_profile_name?: string;
  speed_profile_id?: number;
  parent_download_queue?: string;
  parent_upload_queue?: string;
  duration_days: number;
  duration_hours?: number;
  base_price: number;
  discount_price?: number;
  promo_price?: number;
  data_quota_gb?: number;
  data_quota_type?: 'download' | 'upload' | 'total' | 'none';
  is_bundle?: boolean;
  bundle_items?: any[];
  features?: string[];
  max_devices?: number;
  allow_sharing?: boolean;
  allow_rollover?: boolean;
  rollover_days?: number;
  auto_renew_enabled?: boolean;
  auto_renew_discount?: number;
  is_active?: boolean;
  is_featured?: boolean;
  is_popular?: boolean;
  sort_order?: number;
  tags?: string[];
  image_url?: string;
}

export interface PackageListItem extends AdvancedPackage {
  id: number;
  current_price: number;
  is_on_sale: boolean;
  discount_percentage: number;
}

export class AdvancedPackageService {
  /**
   * Get all packages with filters
   */
  async getAllPackages(filters?: {
    connection_type?: 'pppoe' | 'static_ip' | 'both';
    package_type?: 'basic' | 'premium' | 'vip' | 'unlimited';
    is_active?: boolean;
    is_featured?: boolean;
    min_price?: number;
    max_price?: number;
    tags?: string[];
  }): Promise<PackageListItem[]> {
    let query = `
      SELECT 
        p.*,
        CASE 
          WHEN p.promo_price IS NOT NULL AND p.promo_price > 0 THEN p.promo_price
          WHEN p.discount_price IS NOT NULL AND p.discount_price > 0 THEN p.discount_price
          ELSE p.base_price
        END as current_price,
        CASE 
          WHEN p.promo_price IS NOT NULL AND p.promo_price > 0 THEN 1
          WHEN p.discount_price IS NOT NULL AND p.discount_price > 0 THEN 1
          ELSE 0
        END as is_on_sale,
        CASE 
          WHEN p.promo_price IS NOT NULL AND p.promo_price > 0 
            THEN ROUND(((p.base_price - p.promo_price) / p.base_price) * 100, 0)
          WHEN p.discount_price IS NOT NULL AND p.discount_price > 0 
            THEN ROUND(((p.base_price - p.discount_price) / p.base_price) * 100, 0)
          ELSE 0
        END as discount_percentage
      FROM prepaid_packages_v2 p
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (filters) {
      if (filters.connection_type) {
        query += ` AND (p.connection_type = ? OR p.connection_type = 'both')`;
        params.push(filters.connection_type);
      }
      
      if (filters.package_type) {
        query += ` AND p.package_type = ?`;
        params.push(filters.package_type);
      }
      
      if (filters.is_active !== undefined) {
        query += ` AND p.is_active = ?`;
        params.push(filters.is_active ? 1 : 0);
      }
      
      if (filters.is_featured !== undefined) {
        query += ` AND p.is_featured = ?`;
        params.push(filters.is_featured ? 1 : 0);
      }
      
      if (filters.min_price !== undefined) {
        query += ` AND base_price >= ?`;
        params.push(filters.min_price);
      }
      
      if (filters.max_price !== undefined) {
        query += ` AND base_price <= ?`;
        params.push(filters.max_price);
      }
    }
    
    query += ` ORDER BY p.sort_order ASC, p.tier_level ASC, p.base_price ASC`;
    
    const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
    
    return (rows as any[]).map(row => this.mapRowToPackage(row));
  }
  
  /**
   * Get package by ID
   */
  async getPackageById(id: number): Promise<AdvancedPackage | null> {
    const [rows] = await databasePool.query<RowDataPacket[]>(
      'SELECT * FROM prepaid_packages_v2 WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToPackage(rows[0]);
  }
  
  /**
   * Get package by code
   */
  async getPackageByCode(code: string): Promise<AdvancedPackage | null> {
    const [rows] = await databasePool.query<RowDataPacket[]>(
      'SELECT * FROM prepaid_packages_v2 WHERE package_code = ?',
      [code]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToPackage(rows[0]);
  }
  
  /**
   * Create new package
   */
  async createPackage(pkg: AdvancedPackage): Promise<number> {
    const connection = await databasePool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Generate package code if not provided
      if (!pkg.package_code) {
        pkg.package_code = await this.generatePackageCode();
      }
      
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO prepaid_packages_v2 (
          name, description, package_code, package_type, tier_level,
          connection_type, download_mbps, upload_mbps,
          mikrotik_profile_name, speed_profile_id,
          parent_download_queue, parent_upload_queue,
          duration_days, duration_hours,
          base_price, discount_price, promo_price,
          data_quota_gb, data_quota_type,
          is_bundle, bundle_items,
          features, max_devices, allow_sharing,
          allow_rollover, rollover_days,
          auto_renew_enabled, auto_renew_discount,
          is_active, is_featured, is_popular, sort_order,
          tags, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pkg.name,
          pkg.description || null,
          pkg.package_code,
          pkg.package_type || 'basic',
          pkg.tier_level || 1,
          pkg.connection_type,
          pkg.download_mbps,
          pkg.upload_mbps,
          pkg.mikrotik_profile_name || null,
          pkg.speed_profile_id || null,
          pkg.parent_download_queue || null,
          pkg.parent_upload_queue || null,
          pkg.duration_days,
          pkg.duration_hours || 0,
          pkg.base_price,
          pkg.discount_price || null,
          pkg.promo_price || null,
          pkg.data_quota_gb || null,
          pkg.data_quota_type || 'none',
          pkg.is_bundle ? 1 : 0,
          pkg.bundle_items ? JSON.stringify(pkg.bundle_items) : null,
          pkg.features ? JSON.stringify(pkg.features) : null,
          pkg.max_devices || 1,
          pkg.allow_sharing ? 1 : 0,
          pkg.allow_rollover ? 1 : 0,
          pkg.rollover_days || 7,
          pkg.auto_renew_enabled ? 1 : 0,
          pkg.auto_renew_discount || 0,
          pkg.is_active !== false ? 1 : 0,
          pkg.is_featured ? 1 : 0,
          pkg.is_popular ? 1 : 0,
          pkg.sort_order || 0,
          pkg.tags ? JSON.stringify(pkg.tags) : null,
          pkg.image_url || null
        ]
      );
      
      await connection.commit();
      
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Update package
   */
  async updatePackage(id: number, pkg: Partial<AdvancedPackage>): Promise<boolean> {
    const connection = await databasePool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const updateFields: string[] = [];
      const params: any[] = [];
      
      const allowedFields: (keyof AdvancedPackage)[] = [
        'name', 'description', 'package_type', 'tier_level',
        'connection_type', 'download_mbps', 'upload_mbps',
        'mikrotik_profile_name', 'speed_profile_id',
        'parent_download_queue', 'parent_upload_queue',
        'duration_days', 'duration_hours',
        'base_price', 'discount_price', 'promo_price',
        'data_quota_gb', 'data_quota_type',
        'is_bundle', 'bundle_items',
        'features', 'max_devices', 'allow_sharing',
        'allow_rollover', 'rollover_days',
        'auto_renew_enabled', 'auto_renew_discount',
        'is_active', 'is_featured', 'is_popular', 'sort_order',
        'tags', 'image_url'
      ];
      
      for (const field of allowedFields) {
        if (pkg[field] !== undefined) {
          if (field === 'bundle_items' || field === 'features' || field === 'tags') {
            updateFields.push(`${field} = ?`);
            params.push(Array.isArray(pkg[field]) ? JSON.stringify(pkg[field]) : pkg[field]);
          } else if (typeof pkg[field] === 'boolean') {
            updateFields.push(`${field} = ?`);
            params.push(pkg[field] ? 1 : 0);
          } else {
            updateFields.push(`${field} = ?`);
            params.push(pkg[field]);
          }
        }
      }
      
      if (updateFields.length === 0) {
        return false;
      }
      
      params.push(id);
      
      await connection.query(
        `UPDATE prepaid_packages_v2 SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );
      
      await connection.commit();
      
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Delete package (soft delete by setting is_active = 0)
   */
  async deletePackage(id: number): Promise<boolean> {
    const [result] = await databasePool.query<ResultSetHeader>(
      'UPDATE prepaid_packages_v2 SET is_active = 0 WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  }
  
  /**
   * Calculate final price with discounts
   */
  calculateFinalPrice(pkg: AdvancedPackage, voucherDiscount?: number): {
    basePrice: number;
    discount: number;
    finalPrice: number;
    savings: number;
  } {
    const basePrice = pkg.base_price;
    
    // Determine current price (promo > discount > base)
    let currentPrice = basePrice;
    if (pkg.promo_price && pkg.promo_price > 0) {
      currentPrice = pkg.promo_price;
    } else if (pkg.discount_price && pkg.discount_price > 0) {
      currentPrice = pkg.discount_price;
    }
    
    // Apply voucher discount
    let finalPrice = currentPrice;
    let totalDiscount = basePrice - currentPrice;
    
    if (voucherDiscount) {
      if (voucherDiscount < 1) {
        // Percentage discount
        finalPrice = currentPrice * (1 - voucherDiscount);
      } else {
        // Fixed discount
        finalPrice = Math.max(0, currentPrice - voucherDiscount);
      }
      totalDiscount = basePrice - finalPrice;
    }
    
    return {
      basePrice,
      discount: totalDiscount,
      finalPrice: Math.max(0, finalPrice),
      savings: totalDiscount
    };
  }
  
  /**
   * Get featured packages
   */
  async getFeaturedPackages(limit: number = 3): Promise<PackageListItem[]> {
    const packages = await this.getAllPackages({
      is_featured: true,
      is_active: true
    });
    
    return packages.slice(0, limit);
  }
  
  /**
   * Get popular packages
   */
  async getPopularPackages(limit: number = 5): Promise<PackageListItem[]> {
    const packages = await this.getAllPackages({
      is_popular: true,
      is_active: true
    });
    
    return packages.slice(0, limit);
  }
  
  /**
   * Generate unique package code
   */
  private async generatePackageCode(): Promise<string> {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `PKG-${timestamp}-${random}`;
    
    // Check if code exists
    const existing = await this.getPackageByCode(code);
    if (existing) {
      return this.generatePackageCode(); // Retry
    }
    
    return code;
  }
  
  /**
   * Map database row to package object
   */
  private mapRowToPackage(row: any): AdvancedPackage {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      package_code: row.package_code,
      package_type: row.package_type,
      tier_level: row.tier_level,
      connection_type: row.connection_type,
      download_mbps: parseFloat(row.download_mbps) || 0,
      upload_mbps: parseFloat(row.upload_mbps) || 0,
      mikrotik_profile_name: row.mikrotik_profile_name,
      speed_profile_id: row.speed_profile_id,
      parent_download_queue: row.parent_download_queue,
      parent_upload_queue: row.parent_upload_queue,
      duration_days: row.duration_days,
      duration_hours: row.duration_hours || 0,
      base_price: parseFloat(row.base_price) || 0,
      discount_price: row.discount_price ? parseFloat(row.discount_price) : undefined,
      promo_price: row.promo_price ? parseFloat(row.promo_price) : undefined,
      data_quota_gb: row.data_quota_gb ? parseFloat(row.data_quota_gb) : undefined,
      data_quota_type: row.data_quota_type,
      is_bundle: row.is_bundle === 1,
      bundle_items: row.bundle_items ? JSON.parse(row.bundle_items) : undefined,
      features: row.features ? JSON.parse(row.features) : undefined,
      max_devices: row.max_devices || 1,
      allow_sharing: row.allow_sharing === 1,
      allow_rollover: row.allow_rollover === 1,
      rollover_days: row.rollover_days || 7,
      auto_renew_enabled: row.auto_renew_enabled === 1,
      auto_renew_discount: row.auto_renew_discount ? parseFloat(row.auto_renew_discount) : undefined,
      is_active: row.is_active === 1,
      is_featured: row.is_featured === 1,
      is_popular: row.is_popular === 1,
      sort_order: row.sort_order || 0,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      image_url: row.image_url
    };
  }
}

export default new AdvancedPackageService();




