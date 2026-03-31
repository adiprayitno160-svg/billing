import { Pool, PoolConnection } from 'mysql2/promise';
export interface InvoiceData {
    customer_id: number;
    subscription_id?: number;
    period: string;
    due_date: string;
    subtotal: number;
    discount_amount?: number;
    ppn_rate?: number;
    ppn_amount?: number;
    device_fee?: number;
    total_amount: number;
    paid_amount?: number;
    notes?: string;
    status?: string;
}
export interface InvoiceItem {
    description: string;
    quantity?: number;
    unit_price: number;
    total_price: number;
}
export declare class InvoiceService {
    /**
     * Generate nomor invoice unik
     */
    static generateInvoiceNumber(period: string, existingConnection?: PoolConnection | Pool): Promise<string>;
    /**
     * Buat invoice baru
     */
    static createInvoice(invoiceData: InvoiceData, items: InvoiceItem[], existingConnection?: PoolConnection | Pool): Promise<number>;
    /**
     * Handle partial payment dengan debt tracking
     */
    static handlePartialPayment(invoiceId: number, paymentAmount: number, paymentMethod: string, notes?: string, existingConnection?: PoolConnection | Pool): Promise<{
        success: boolean;
        message: string;
        remainingAmount?: number;
    }>;
    private static getNextPeriod;
    /**
     * Process daily auto-pay for admin managed customers
     */
    static processAutoPayAdmin(): Promise<{
        paid: number;
        failed: number;
    }>;
    static getMonthName(period: string): string;
    /**
     * Generate invoice otomatis
     */
    static generateMonthlyInvoices(period: string, customerIds?: number | number[], forceAll?: boolean): Promise<number[]>;
    static updateInvoiceStatus(invoiceId: number, status: string): Promise<void>;
    static getInvoiceById(invoiceId: number): Promise<any>;
    static getInvoiceItems(invoiceId: number): Promise<any[]>;
    static getInvoices(filters?: any): Promise<any[]>;
    /**
     * Dapatkan tagihan yang sudah jatuh tempo
     */
    static getOverdueInvoices(): Promise<any[]>;
    /**
     * Bulk delete invoices
     */
    static bulkDeleteInvoices(invoiceIds: number[]): Promise<{
        deleted: number;
        failed: number;
        errors: any[];
    }>;
    /**
     * Set semua pelanggan aktif ke status "sent" (Pending) untuk periode tertentu
     */
    static massPendingInvoices(period: string): Promise<{
        created: number;
        updated: number;
        failed: number;
    }>;
}
//# sourceMappingURL=invoiceService.d.ts.map