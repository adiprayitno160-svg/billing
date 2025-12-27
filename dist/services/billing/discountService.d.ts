export interface DiscountData {
    invoice_id: number;
    discount_type: 'manual' | 'sla' | 'promo';
    discount_value: number;
    discount_percent?: number;
    reason: string;
    applied_by: number;
}
export declare class DiscountService {
    /**
     * Apply manual discount
     */
    static applyManualDiscount(discountData: DiscountData): Promise<number>;
    /**
     * Apply SLA discount automatically
     */
    static applySLADiscount(customerId: number, period: string): Promise<number>;
    /**
     * Update invoice totals after discount
     */
    private static updateInvoiceTotals;
    /**
     * Get discounts for an invoice
     */
    static getInvoiceDiscounts(invoiceId: number): Promise<import("mysql2").QueryResult>;
    /**
     * Remove discount
     */
    static removeDiscount(discountId: number): Promise<void>;
    /**
     * Get discount history
     */
    static getDiscountHistory(customerId?: number, limit?: number): Promise<import("mysql2").QueryResult>;
    /**
     * Get discount statistics
     */
    static getDiscountStats(period?: string): Promise<import("mysql2").QueryResult>;
    /**
     * Validate discount data
     */
    static validateDiscount(discountData: DiscountData): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Calculate discount amount
     */
    static calculateDiscountAmount(originalAmount: number, discountPercent: number): number;
    /**
     * Calculate discount percentage
     */
    static calculateDiscountPercentage(originalAmount: number, discountAmount: number): number;
    /**
     * Get total discounts for an invoice
     */
    static getTotalDiscountsForInvoice(invoiceId: number): Promise<number>;
    /**
     * Check if discount can be applied
     */
    static canApplyDiscount(invoiceId: number, discountAmount: number): Promise<{
        canApply: boolean;
        reason?: string;
    }>;
    /**
     * Get all discounts with pagination and filters
     */
    static getAllDiscounts(options: {
        page: number;
        limit: number;
        customer_id?: number;
        invoice_id?: number;
        discount_type?: string;
    }): Promise<{
        data: import("mysql2").QueryResult;
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
}
//# sourceMappingURL=discountService.d.ts.map