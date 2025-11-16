/**
 * Voucher Service
 * 
 * Handles voucher creation, validation, and application:
 * - Create vouchers with different discount types
 * - Validate voucher codes
 * - Apply vouchers to purchases
 * - Track voucher usage
 */

import { databasePool } from '../../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Voucher {
  id?: number;
  voucher_code: string;
  voucher_name?: string;
  description?: string;
  discount_type: 'percentage' | 'fixed' | 'free_days';
  discount_value: number;
  applicable_packages?: number[]; // Package IDs, empty = all
  min_purchase_amount?: number;
  valid_from: Date;
  valid_until: Date;
  max_usage_count?: number;
  max_usage_per_customer?: number;
  usage_count?: number;
  is_active?: boolean;
}

export interface VoucherValidationResult {
  valid: boolean;
  voucher?: Voucher;
  discount_amount?: number;
  error?: string;
}

export class VoucherService {
  /**
   * Create new voucher
   */
  async createVoucher(voucher: Voucher): Promise<number> {
    const connection = await databasePool.getConnection();
    
    try {
      // Validate voucher code uniqueness
      const existing = await this.getVoucherByCode(voucher.voucher_code);
      if (existing) {
        throw new Error('Voucher code already exists');
      }
      
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO prepaid_vouchers (
          voucher_code, voucher_name, description,
          discount_type, discount_value,
          applicable_packages, min_purchase_amount,
          valid_from, valid_until,
          max_usage_count, max_usage_per_customer,
          is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          voucher.voucher_code.toUpperCase(),
          voucher.voucher_name || null,
          voucher.description || null,
          voucher.discount_type,
          voucher.discount_value,
          voucher.applicable_packages && voucher.applicable_packages.length > 0
            ? JSON.stringify(voucher.applicable_packages)
            : null,
          voucher.min_purchase_amount || 0,
          voucher.valid_from,
          voucher.valid_until,
          voucher.max_usage_count || 1,
          voucher.max_usage_per_customer || 1,
          voucher.is_active !== false ? 1 : 0
        ]
      );
      
      return result.insertId;
      
    } finally {
      connection.release();
    }
  }
  
  /**
   * Validate voucher code
   */
  async validateVoucher(
    voucherCode: string,
    packageId: number,
    purchaseAmount: number,
    customerId?: number
  ): Promise<VoucherValidationResult> {
    const voucher = await this.getVoucherByCode(voucherCode);
    
    if (!voucher) {
      return {
        valid: false,
        error: 'Voucher code not found'
      };
    }
    
    if (!voucher.is_active) {
      return {
        valid: false,
        error: 'Voucher is inactive'
      };
    }
    
    const now = new Date();
    if (now < new Date(voucher.valid_from)) {
      return {
        valid: false,
        error: 'Voucher is not yet valid'
      };
    }
    
    if (now > new Date(voucher.valid_until)) {
      return {
        valid: false,
        error: 'Voucher has expired'
      };
    }
    
    // Check usage limits
    if (voucher.max_usage_count && (voucher.usage_count || 0) >= voucher.max_usage_count) {
      return {
        valid: false,
        error: 'Voucher usage limit reached'
      };
    }
    
    // Check per-customer usage limit
    if (customerId && voucher.max_usage_per_customer) {
      const customerUsage = await this.getCustomerVoucherUsage(customerId, voucher.id!);
      if (customerUsage >= voucher.max_usage_per_customer) {
        return {
          valid: false,
          error: 'You have already used this voucher maximum times'
        };
      }
    }
    
    // Check applicable packages
    if (voucher.applicable_packages && voucher.applicable_packages.length > 0) {
      if (!voucher.applicable_packages.includes(packageId)) {
        return {
          valid: false,
          error: 'Voucher is not applicable for this package'
        };
      }
    }
    
    // Check minimum purchase amount
    if (voucher.min_purchase_amount && purchaseAmount < voucher.min_purchase_amount) {
      return {
        valid: false,
        error: `Minimum purchase amount is ${voucher.min_purchase_amount}`
      };
    }
    
    // Calculate discount amount
    let discountAmount = 0;
    if (voucher.discount_type === 'percentage') {
      discountAmount = purchaseAmount * (voucher.discount_value / 100);
    } else if (voucher.discount_type === 'fixed') {
      discountAmount = Math.min(voucher.discount_value, purchaseAmount);
    } else if (voucher.discount_type === 'free_days') {
      // For free days, discount would be calculated based on daily rate
      // This needs package information
      discountAmount = 0; // Placeholder
    }
    
    return {
      valid: true,
      voucher,
      discount_amount: discountAmount
    };
  }
  
  /**
   * Apply voucher to purchase
   */
  async applyVoucher(
    voucherId: number,
    customerId: number,
    subscriptionId: number,
    transactionId: number,
    discountAmount: number
  ): Promise<boolean> {
    const connection = await databasePool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get voucher
      const voucher = await this.getVoucherById(voucherId);
      if (!voucher) {
        throw new Error('Voucher not found');
      }
      
      // Record voucher usage
      await connection.query(
        `INSERT INTO prepaid_voucher_usage (
          voucher_id, voucher_code, customer_id,
          subscription_id, transaction_id, discount_amount, used_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          voucherId,
          voucher.voucher_code,
          customerId,
          subscriptionId,
          transactionId,
          discountAmount
        ]
      );
      
      // Update voucher usage count
      await connection.query(
        `UPDATE prepaid_vouchers 
         SET usage_count = usage_count + 1 
         WHERE id = ?`,
        [voucherId]
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
   * Get voucher by code
   */
  async getVoucherByCode(code: string): Promise<Voucher | null> {
    const [rows] = await databasePool.query<RowDataPacket[]>(
      'SELECT * FROM prepaid_vouchers WHERE voucher_code = ?',
      [code.toUpperCase()]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToVoucher(rows[0]);
  }
  
  /**
   * Get voucher by ID
   */
  async getVoucherById(id: number): Promise<Voucher | null> {
    const [rows] = await databasePool.query<RowDataPacket[]>(
      'SELECT * FROM prepaid_vouchers WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToVoucher(rows[0]);
  }
  
  /**
   * Get all vouchers
   */
  async getAllVouchers(activeOnly: boolean = false): Promise<Voucher[]> {
    let query = 'SELECT * FROM prepaid_vouchers';
    const params: any[] = [];
    
    if (activeOnly) {
      query += ' WHERE is_active = 1';
    }
    
    query += ' ORDER BY valid_until DESC, created_at DESC';
    
    const [rows] = await databasePool.query<RowDataPacket[]>(query, params);
    
    return (rows as any[]).map(row => this.mapRowToVoucher(row));
  }
  
  /**
   * Update voucher
   */
  async updateVoucher(id: number, updates: Partial<Voucher>): Promise<boolean> {
    const connection = await databasePool.getConnection();
    
    try {
      const updateFields: string[] = [];
      const params: any[] = [];
      
      if (updates.voucher_name !== undefined) {
        updateFields.push('voucher_name = ?');
        params.push(updates.voucher_name);
      }
      
      if (updates.description !== undefined) {
        updateFields.push('description = ?');
        params.push(updates.description);
      }
      
      if (updates.discount_value !== undefined) {
        updateFields.push('discount_value = ?');
        params.push(updates.discount_value);
      }
      
      if (updates.applicable_packages !== undefined) {
        updateFields.push('applicable_packages = ?');
        params.push(
          updates.applicable_packages && updates.applicable_packages.length > 0
            ? JSON.stringify(updates.applicable_packages)
            : null
        );
      }
      
      if (updates.min_purchase_amount !== undefined) {
        updateFields.push('min_purchase_amount = ?');
        params.push(updates.min_purchase_amount);
      }
      
      if (updates.valid_from !== undefined) {
        updateFields.push('valid_from = ?');
        params.push(updates.valid_from);
      }
      
      if (updates.valid_until !== undefined) {
        updateFields.push('valid_until = ?');
        params.push(updates.valid_until);
      }
      
      if (updates.max_usage_count !== undefined) {
        updateFields.push('max_usage_count = ?');
        params.push(updates.max_usage_count);
      }
      
      if (updates.is_active !== undefined) {
        updateFields.push('is_active = ?');
        params.push(updates.is_active ? 1 : 0);
      }
      
      if (updateFields.length === 0) {
        return false;
      }
      
      params.push(id);
      
      await connection.query(
        `UPDATE prepaid_vouchers 
         SET ${updateFields.join(', ')}, updated_at = NOW() 
         WHERE id = ?`,
        params
      );
      
      return true;
      
    } finally {
      connection.release();
    }
  }
  
  /**
   * Get customer voucher usage count
   */
  private async getCustomerVoucherUsage(
    customerId: number,
    voucherId: number
  ): Promise<number> {
    const [rows] = await databasePool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM prepaid_voucher_usage 
       WHERE customer_id = ? AND voucher_id = ?`,
      [customerId, voucherId]
    );
    
    return rows[0]?.count || 0;
  }
  
  /**
   * Map database row to voucher object
   */
  private mapRowToVoucher(row: any): Voucher {
    return {
      id: row.id,
      voucher_code: row.voucher_code,
      voucher_name: row.voucher_name,
      description: row.description,
      discount_type: row.discount_type,
      discount_value: parseFloat(row.discount_value) || 0,
      applicable_packages: row.applicable_packages
        ? JSON.parse(row.applicable_packages)
        : undefined,
      min_purchase_amount: row.min_purchase_amount ? parseFloat(row.min_purchase_amount) : 0,
      valid_from: new Date(row.valid_from),
      valid_until: new Date(row.valid_until),
      max_usage_count: row.max_usage_count || undefined,
      max_usage_per_customer: row.max_usage_per_customer || undefined,
      usage_count: row.usage_count || 0,
      is_active: row.is_active === 1
    };
  }
}

export default new VoucherService();




