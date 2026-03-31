/**
 * Discount Service
 * Handles application of manual, SLA, and downtime discounts on invoices
 */
import { Pool, PoolConnection } from 'mysql2/promise';
export interface DiscountData {
    invoice_id: number;
    discount_type: 'manual' | 'sla' | 'downtime' | 'promo';
    amount: number;
    reason?: string;
    approved_by?: number;
}
export declare class DiscountService {
    /**
     * Apply manual discount to an invoice
     */
    static applyManualDiscount(discount: DiscountData, existingConnection?: PoolConnection | Pool): Promise<number>;
    /**
     * Apply downtime discount (gangguan)
     */
    static applyDowntimeDiscount(invoiceId: number, days: number, reason: string, existingConnection?: PoolConnection | Pool): Promise<void>;
    /**
     * Remove a discount from an invoice
     */
    static removeDiscount(discountId: number, existingConnection?: PoolConnection | Pool): Promise<void>;
    /**
     * Recalculate invoice totals based on items and discounts
     */
    static updateInvoiceTotals(invoiceId: number, existingConnection?: PoolConnection | Pool): Promise<void>;
    /**
     * Get discount history for an invoice
     */
    static getInvoiceDiscounts(invoiceId: number): Promise<any[]>;
    /**
     * Apply marketing discount code
     */
    static applyMarketingDiscount(invoiceId: number, code: string, userId?: number): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=discountService.d.ts.map