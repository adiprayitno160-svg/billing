/**
 * Voucher Service
 * Handles voucher/promo code management and validation
 */

import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface Voucher {
    id: number;
    code: string;
    name: string;
    description?: string;
    discount_type: 'percentage' | 'fixed' | 'free_days';
    discount_value: number;
    min_purchase: number;
    valid_from: Date;
    valid_until: Date;
    usage_limit: number | null;
    used_count: number;
    customer_type: 'all' | 'new' | 'existing' | 'prepaid' | 'postpaid';
    status: 'active' | 'inactive';
    created_by?: number;
    created_at: Date;
    updated_at: Date;
}

export interface VoucherValidation {
    valid: boolean;
    message: string;
    voucher?: Voucher;
    discount_amount?: number;
    final_amount?: number;
}

export class VoucherService {
    /**
     * Validate voucher code untuk customer
     */
    static async validateVoucher(
        code: string,
        customerId: number,
        originalAmount: number
    ): Promise<VoucherValidation> {
        try {
            // Get voucher
            const [vouchers] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM vouchers WHERE code = ? AND status = 'active'`,
                [code.toUpperCase()]
            );

            if (vouchers.length === 0) {
                return {
                    valid: false,
                    message: 'Kode voucher tidak valid atau sudah tidak aktif'
                };
            }

            const voucher = vouchers[0] as Voucher;

            // Check valid date
            const now = new Date();
            if (new Date(voucher.valid_from) > now) {
                return {
                    valid: false,
                    message: `Voucher ini belum berlaku. Mulai berlaku: ${new Date(voucher.valid_from).toLocaleDateString('id-ID')}`
                };
            }

            if (new Date(voucher.valid_until) < now) {
                return {
                    valid: false,
                    message: 'Voucher sudah kadaluarsa'
                };
            }

            // Check usage limit
            if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) {
                return {
                    valid: false,
                    message: 'Voucher sudah mencapai batas penggunaan'
                };
            }

            // Check if customer already used this voucher
            const [usageHistory] = await databasePool.query<RowDataPacket[]>(
                `SELECT COUNT(*) as count FROM voucher_usage WHERE voucher_id = ? AND customer_id = ?`,
                [voucher.id, customerId]
            );

            if (usageHistory[0].count > 0) {
                return {
                    valid: false,
                    message: 'Anda sudah pernah menggunakan voucher ini'
                };
            }

            // Check min purchase
            if (originalAmount < voucher.min_purchase) {
                return {
                    valid: false,
                    message: `Minimal pembelian Rp ${voucher.min_purchase.toLocaleString('id-ID')} untuk menggunakan voucher ini`
                };
            }

            // Check customer type
            if (voucher.customer_type !== 'all') {
                const [customers] = await databasePool.query<RowDataPacket[]>(
                    `SELECT billing_mode, created_at FROM customers WHERE id = ?`,
                    [customerId]
                );

                if (customers.length === 0) {
                    return { valid: false, message: 'Customer tidak ditemukan' };
                }

                const customer = customers[0];

                // Check if new customer (< 7 days)
                const isNewCustomer = (Date.now() - new Date(customer.created_at).getTime()) < (7 * 24 * 60 * 60 * 1000);

                if (voucher.customer_type === 'new' && !isNewCustomer) {
                    return {
                        valid: false,
                        message: 'Voucher ini hanya untuk customer baru'
                    };
                }

                if (voucher.customer_type === 'existing' && isNewCustomer) {
                    return {
                        valid: false,
                        message: 'Voucher ini hanya untuk customer existing'
                    };
                }

                if (voucher.customer_type === 'prepaid' && customer.billing_mode !== 'prepaid') {
                    return {
                        valid: false,
                        message: 'Voucher ini hanya untuk customer prepaid'
                    };
                }

                if (voucher.customer_type === 'postpaid' && customer.billing_mode !== 'postpaid') {
                    return {
                        valid: false,
                        message: 'Voucher ini hanya untuk customer postpaid'
                    };
                }
            }

            // Calculate discount
            let discountAmount = 0;

            if (voucher.discount_type === 'percentage') {
                discountAmount = Math.floor(originalAmount * (voucher.discount_value / 100));
            } else if (voucher.discount_type === 'fixed') {
                discountAmount = Math.min(voucher.discount_value, originalAmount);
            } else if (voucher.discount_type === 'free_days') {
                // For free days, discount is full amount
                discountAmount = originalAmount;
            }

            const finalAmount = Math.max(0, originalAmount - discountAmount);

            return {
                valid: true,
                message: 'Voucher berhasil digunakan!',
                voucher,
                discount_amount: discountAmount,
                final_amount: finalAmount
            };

        } catch (error) {
            console.error('Error validating voucher:', error);
            return {
                valid: false,
                message: 'Terjadi kesalahan saat memvalidasi voucher'
            };
        }
    }

    /**
     * Log voucher usage
     */
    static async logVoucherUsage(
        voucherId: number,
        customerId: number,
        paymentRequestId: number | null,
        discountAmount: number,
        originalAmount: number,
        finalAmount: number
    ): Promise<void> {
        try {
            // Insert usage log
            await databasePool.query(
                `INSERT INTO voucher_usage 
                (voucher_id, customer_id, payment_request_id, discount_amount, original_amount, final_amount) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [voucherId, customerId, paymentRequestId, discountAmount, originalAmount, finalAmount]
            );

            // Increment used_count
            await databasePool.query(
                `UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?`,
                [voucherId]
            );
        } catch (error) {
            console.error('Error logging voucher usage:', error);
            throw error;
        }
    }

    /**
     * Get all active vouchers
     */
    static async getActiveVouchers(): Promise<Voucher[]> {
        try {
            const [vouchers] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM vouchers 
                WHERE status = 'active' 
                AND valid_from <= NOW() 
                AND valid_until >= NOW()
                ORDER BY sort_order ASC, created_at DESC`
            );

            return vouchers as Voucher[];
        } catch (error) {
            console.error('Error fetching active vouchers:', error);
            return [];
        }
    }

    /**
     * Create new voucher
     */
    static async createVoucher(voucherData: Partial<Voucher>): Promise<number> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                `INSERT INTO vouchers 
                (code, name, description, discount_type, discount_value, min_purchase, 
                 valid_from, valid_until, usage_limit, customer_type, status, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    voucherData.code?.toUpperCase(),
                    voucherData.name,
                    voucherData.description || null,
                    voucherData.discount_type,
                    voucherData.discount_value,
                    voucherData.min_purchase || 0,
                    voucherData.valid_from,
                    voucherData.valid_until,
                    voucherData.usage_limit || null,
                    voucherData.customer_type || 'all',
                    voucherData.status || 'active',
                    voucherData.created_by || null
                ]
            );

            return result.insertId;
        } catch (error) {
            console.error('Error creating voucher:', error);
            throw error;
        }
    }

    /**
     * Get voucher by ID
     */
    static async getVoucherById(id: number): Promise<Voucher | null> {
        try {
            const [vouchers] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM vouchers WHERE id = ?`,
                [id]
            );

            return vouchers.length > 0 ? (vouchers[0] as Voucher) : null;
        } catch (error) {
            console.error('Error fetching voucher:', error);
            return null;
        }
    }

    /**
     * Update voucher
     */
    static async updateVoucher(id: number, voucherData: Partial<Voucher>): Promise<boolean> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                `UPDATE vouchers SET 
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                discount_type = COALESCE(?, discount_type),
                discount_value = COALESCE(?, discount_value),
                min_purchase = COALESCE(?, min_purchase),
                valid_from = COALESCE(?, valid_from),
                valid_until = COALESCE(?, valid_until),
                usage_limit = COALESCE(?, usage_limit),
                customer_type = COALESCE(?, customer_type),
                status = COALESCE(?, status)
                WHERE id = ?`,
                [
                    voucherData.name,
                    voucherData.description,
                    voucherData.discount_type,
                    voucherData.discount_value,
                    voucherData.min_purchase,
                    voucherData.valid_from,
                    voucherData.valid_until,
                    voucherData.usage_limit,
                    voucherData.customer_type,
                    voucherData.status,
                    id
                ]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error updating voucher:', error);
            return false;
        }
    }

    /**
     * Delete voucher
     */
    static async deleteVoucher(id: number): Promise<boolean> {
        try {
            const [result] = await databasePool.query<ResultSetHeader>(
                `DELETE FROM vouchers WHERE id = ?`,
                [id]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting voucher:', error);
            return false;
        }
    }

    /**
     * Get voucher usage statistics
     */
    static async getVoucherStats(voucherId: number) {
        try {
            const [stats] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    COUNT(*) as total_uses,
                    SUM(discount_amount) as total_discount,
                    AVG(discount_amount) as avg_discount,
                    COUNT(DISTINCT customer_id) as unique_customers
                FROM voucher_usage
                WHERE voucher_id = ?`,
                [voucherId]
            );

            return stats[0];
        } catch (error) {
            console.error('Error fetching voucher stats:', error);
            return null;
        }
    }
}
