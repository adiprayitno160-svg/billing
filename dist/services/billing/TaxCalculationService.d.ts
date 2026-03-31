interface TaxCalculation {
    id: number;
    transaction_id: number;
    transaction_type: 'invoice' | 'payment' | 'refund' | 'adjustment';
    base_amount: number;
    tax_rate: number;
    tax_amount: number;
    total_with_tax: number;
    tax_code: string | null;
    created_at: Date;
}
export declare class TaxCalculationService {
    /**
     * Get all tax calculations with pagination and filters
     */
    static getAllTaxCalculations(options: {
        page: number;
        limit: number;
        transactionType?: string;
    }): Promise<{
        calculations: TaxCalculation[];
        total: number;
        page: number;
        limit: number;
    }>;
    /**
     * Calculate tax for a given amount and rate
     */
    static calculateTax(baseAmount: number, taxRate: number): {
        taxAmount: number;
        totalWithTax: number;
    };
    /**
     * Create a tax calculation record
     */
    static createTaxCalculation(calculation: Omit<TaxCalculation, 'id' | 'created_at'>): Promise<number>;
    /**
     * Get tax calculation by transaction ID
     */
    static getTaxCalculation(transactionId: number, transactionType: string): Promise<TaxCalculation | null>;
    /**
     * Get all tax calculations for a transaction
     */
    static getTaxCalculationsForTransaction(transactionId: number): Promise<TaxCalculation[]>;
    /**
     * Get tax summary for a date range
     */
    static getTaxSummary(startDate: Date, endDate: Date): Promise<{
        totalBaseAmount: number;
        totalTaxAmount: number;
        totalWithTax: number;
        taxRates: Array<{
            rate: number;
            amount: number;
            count: number;
        }>;
    }>;
    /**
     * Calculate tax for an invoice
     */
    static calculateInvoiceTax(invoiceId: number): Promise<{
        taxAmount: number;
        totalWithTax: number;
    }>;
    /**
     * Process tax for an invoice
     */
    static processInvoiceTax(invoiceId: number): Promise<TaxCalculation>;
    /**
     * Get monthly tax report
     */
    static getMonthlyTaxReport(year: number, month: number): Promise<{
        month: number;
        year: number;
        totalBaseAmount: number;
        totalTaxAmount: number;
        totalWithTax: number;
        breakdown: Array<{
            date: Date;
            baseAmount: number;
            taxAmount: number;
            totalWithTax: number;
            transactionType: string;
            transactionId: number;
        }>;
    }>;
    /**
     * Get tax calculations by type
     */
    static getTaxCalculationsByType(transactionType: 'invoice' | 'payment' | 'refund' | 'adjustment', limit?: number): Promise<TaxCalculation[]>;
}
export default TaxCalculationService;
//# sourceMappingURL=TaxCalculationService.d.ts.map