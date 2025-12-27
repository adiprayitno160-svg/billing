/**
 * Voucher Service
 *
 * Handles voucher creation, validation, and application:
 * - Create vouchers with different discount types
 * - Validate voucher codes
 * - Apply vouchers to purchases
 * - Track voucher usage
 */
export interface Voucher {
    id?: number;
    voucher_code: string;
    voucher_name?: string;
    description?: string;
    discount_type: 'percentage' | 'fixed' | 'free_days';
    discount_value: number;
    applicable_packages?: number[];
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
export declare class VoucherService {
    /**
     * Create new voucher
     */
    createVoucher(voucher: Voucher): Promise<number>;
    /**
     * Validate voucher code
     */
    validateVoucher(voucherCode: string, packageId: number, purchaseAmount: number, customerId?: number): Promise<VoucherValidationResult>;
    /**
     * Apply voucher to purchase
     */
    applyVoucher(voucherId: number, customerId: number, subscriptionId: number, transactionId: number, discountAmount: number): Promise<boolean>;
    /**
     * Get voucher by code
     */
    getVoucherByCode(code: string): Promise<Voucher | null>;
    /**
     * Get voucher by ID
     */
    getVoucherById(id: number): Promise<Voucher | null>;
    /**
     * Get all vouchers
     */
    getAllVouchers(activeOnly?: boolean): Promise<Voucher[]>;
    /**
     * Update voucher
     */
    updateVoucher(id: number, updates: Partial<Voucher>): Promise<boolean>;
    /**
     * Get customer voucher usage count
     */
    private getCustomerVoucherUsage;
    /**
     * Map database row to voucher object
     */
    private mapRowToVoucher;
}
declare const _default: VoucherService;
export default _default;
//# sourceMappingURL=VoucherService.d.ts.map