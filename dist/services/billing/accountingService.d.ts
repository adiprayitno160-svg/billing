export interface ChartOfAccount {
    id: number;
    account_code: string;
    account_name: string;
    account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    parent_id?: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface JournalEntry {
    id: number;
    entry_date: Date;
    reference: string;
    description: string;
    total_debit: number;
    total_credit: number;
    created_by?: number;
    created_at: Date;
    updated_at: Date;
}
export interface JournalEntryLine {
    id: number;
    journal_id: number;
    account_id: number;
    debit: number;
    credit: number;
    description: string;
    created_at: Date;
}
export declare class AccountingService {
    /**
     * Get all chart of accounts
     */
    static getChartOfAccounts(): Promise<ChartOfAccount[]>;
    /**
     * Create new chart of account
     */
    static createChartOfAccount(account: Omit<ChartOfAccount, 'id' | 'created_at' | 'updated_at'>): Promise<number>;
    /**
     * Create journal entry with lines
     */
    static createJournalEntry(entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>, lines: Omit<JournalEntryLine, 'id' | 'journal_id' | 'created_at'>[]): Promise<number>;
    /**
     * Auto generate journal entry for invoice creation
     */
    static generateInvoiceJournalEntry(invoiceId: number): Promise<number>;
    /**
     * Auto generate journal entry for payment received
     */
    static generatePaymentJournalEntry(paymentId: number): Promise<number>;
    /**
     * Get trial balance
     */
    static getTrialBalance(startDate?: string, endDate?: string): Promise<import("mysql2").QueryResult>;
    /**
     * Get profit and loss statement
     */
    static getProfitLossStatement(startDate: string, endDate: string): Promise<import("mysql2").QueryResult>;
    /**
     * Get balance sheet
     */
    static getBalanceSheet(date: string): Promise<import("mysql2").QueryResult>;
    /**
     * Get journal entries with lines
     */
    static getJournalEntries(startDate?: string, endDate?: string, limit?: number): Promise<import("mysql2").QueryResult>;
    /**
     * Get journal entry details with lines
     */
    static getJournalEntryDetails(journalId: number): Promise<{
        entry: any;
        lines: import("mysql2").QueryResult;
    }>;
}
//# sourceMappingURL=accountingService.d.ts.map