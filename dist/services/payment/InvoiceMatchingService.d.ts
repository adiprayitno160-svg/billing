/**
 * Invoice Matching Service
 * Match extracted payment data with customer invoices
 */
import { ExtractedPaymentData } from './OCRService';
export interface MatchedInvoice {
    invoice_id: number;
    invoice_number: string;
    customer_id: number;
    customer_name: string;
    amount: number;
    remaining_amount: number;
    match_score: number;
    match_reasons: string[];
}
export interface MatchingResult {
    matched: boolean;
    invoices: MatchedInvoice[];
    bestMatch?: MatchedInvoice;
    confidence: number;
}
export declare class InvoiceMatchingService {
    /**
     * Match payment data with customer invoices
     */
    static matchPaymentWithInvoices(customerId: number, extractedData: ExtractedPaymentData): Promise<MatchingResult>;
    /**
     * Get pending invoices for customer
     */
    private static getPendingInvoices;
    /**
     * Score how well an invoice matches the payment data
     */
    private static scoreInvoiceMatch;
    /**
     * Find invoice by invoice number (optional, from customer message)
     */
    static findInvoiceByNumber(customerId: number, invoiceNumber: string): Promise<any | null>;
}
//# sourceMappingURL=InvoiceMatchingService.d.ts.map