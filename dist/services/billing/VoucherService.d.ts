/**
 * Voucher Service
 * Handles voucher/promo code management and validation
 */
import { RowDataPacket } from 'mysql2';
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
export declare class VoucherService {
    /**
     * Validate voucher code untuk customer
     */
    static validateVoucher(code: string, customerId: number, originalAmount: number): Promise<VoucherValidation>;
    /**
     * Log voucher usage
     */
    static logVoucherUsage(voucherId: number, customerId: number, paymentRequestId: number | null, discountAmount: number, originalAmount: number, finalAmount: number): Promise<void>;
    /**
     * Get all active vouchers
     */
    static getActiveVouchers(): Promise<Voucher[]>;
    /**
     * Create new voucher
     */
    static createVoucher(voucherData: Partial<Voucher>): Promise<number>;
    /**
     * Get voucher by ID
     */
    static getVoucherById(id: number): Promise<Voucher | null>;
    /**
     * Update voucher
     */
    static updateVoucher(id: number, voucherData: Partial<Voucher>): Promise<boolean>;
    /**
     * Delete voucher
     */
    static deleteVoucher(id: number): Promise<boolean>;
    /**
     * Get voucher usage statistics
     */
    static getVoucherStats(voucherId: number): Promise<RowDataPacket>;
}
//# sourceMappingURL=VoucherService.d.ts.map