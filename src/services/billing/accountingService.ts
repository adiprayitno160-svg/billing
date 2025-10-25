import { databasePool } from '../../db/pool';

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

export class AccountingService {
    /**
     * Get all chart of accounts
     */
    static async getChartOfAccounts(): Promise<ChartOfAccount[]> {
        const query = `
            SELECT * FROM chart_of_accounts 
            WHERE is_active = TRUE 
            ORDER BY account_code
        `;
        
        const [result] = await databasePool.query(query);
        return result as ChartOfAccount[];
    }

    /**
     * Create new chart of account
     */
    static async createChartOfAccount(account: Omit<ChartOfAccount, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
        const query = `
            INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_id, is_active)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const [result] = await databasePool.query(query, [
            account.account_code,
            account.account_name,
            account.account_type,
            account.parent_id,
            account.is_active
        ]);
        
        return (result as any).insertId;
    }

    /**
     * Create journal entry with lines
     */
    static async createJournalEntry(
        entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>,
        lines: Omit<JournalEntryLine, 'id' | 'journal_id' | 'created_at'>[]
    ): Promise<number> {
        const connection = await databasePool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Validate debit = credit
            const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
            const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
            
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                throw new Error('Total debit must equal total credit');
            }
            
            // Create journal entry
            const entryQuery = `
                INSERT INTO journal_entries (entry_date, reference, description, total_debit, total_credit, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            const [entryResult] = await connection.query(entryQuery, [
                entry.entry_date,
                entry.reference,
                entry.description,
                totalDebit,
                totalCredit,
                entry.created_by
            ]);
            
            const journalId = (entryResult as any).insertId;
            
            // Create journal entry lines
            for (const line of lines) {
                const lineQuery = `
                    INSERT INTO journal_entry_lines (journal_id, account_id, debit, credit, description)
                    VALUES (?, ?, ?, ?, ?)
                `;
                
                await connection.query(lineQuery, [
                    journalId,
                    line.account_id,
                    line.debit,
                    line.credit,
                    line.description
                ]);
            }
            
            await connection.commit();
            return journalId;
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Auto generate journal entry for invoice creation
     */
    static async generateInvoiceJournalEntry(invoiceId: number): Promise<number> {
        // Get invoice data
        const invoiceQuery = `
            SELECT i.*, c.name as customer_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `;
        
        const [invoiceResult] = await databasePool.query(invoiceQuery, [invoiceId]);
        const invoice = (invoiceResult as any[])[0];
        
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        
        // Get account codes
        const accounts = await this.getChartOfAccounts();
        const accountsMap = new Map(accounts.map(acc => [acc.account_type, acc.id]));
        
        const entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'> = {
            entry_date: new Date(invoice.created_at),
            reference: `INV-${invoice.invoice_number}`,
            description: `Invoice ${invoice.invoice_number} - ${invoice.customer_name}`,
            total_debit: parseFloat(invoice.total_amount),
            total_credit: parseFloat(invoice.total_amount),
            created_by: undefined
        };
        
        const lines: Omit<JournalEntryLine, 'id' | 'journal_id' | 'created_at'>[] = [
            {
                account_id: accountsMap.get('asset')!, // Piutang Usaha
                debit: parseFloat(invoice.total_amount),
                credit: 0,
                description: `Piutang dari ${invoice.customer_name}`
            },
            {
                account_id: accountsMap.get('revenue')!, // Pendapatan Internet
                debit: 0,
                credit: parseFloat(invoice.total_amount),
                description: `Pendapatan internet ${invoice.period}`
            }
        ];
        
        return await this.createJournalEntry(entry, lines);
    }

    /**
     * Auto generate journal entry for payment received
     */
    static async generatePaymentJournalEntry(paymentId: number): Promise<number> {
        // Get payment data
        const paymentQuery = `
            SELECT p.*, i.invoice_number, c.name as customer_name
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            JOIN customers c ON i.customer_id = c.id
            WHERE p.id = ?
        `;
        
        const [paymentResult] = await databasePool.query(paymentQuery, [paymentId]);
        const payment = (paymentResult as any[])[0];
        
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        // Get account codes
        const accounts = await this.getChartOfAccounts();
        const accountsMap = new Map(accounts.map(acc => [acc.account_type, acc.id]));
        
        const entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'> = {
            entry_date: new Date(payment.payment_date),
            reference: `PAY-${payment.id}`,
            description: `Pembayaran ${payment.invoice_number} - ${payment.customer_name}`,
            total_debit: parseFloat(payment.amount),
            total_credit: parseFloat(payment.amount),
            created_by: undefined
        };
        
        const lines: Omit<JournalEntryLine, 'id' | 'journal_id' | 'created_at'>[] = [
            {
                account_id: accountsMap.get('asset')!, // Bank/Kas
                debit: parseFloat(payment.amount),
                credit: 0,
                description: `Pembayaran dari ${payment.customer_name}`
            },
            {
                account_id: accountsMap.get('asset')!, // Piutang Usaha
                debit: 0,
                credit: parseFloat(payment.amount),
                description: `Pelunasan piutang ${payment.invoice_number}`
            }
        ];
        
        return await this.createJournalEntry(entry, lines);
    }

    /**
     * Get trial balance
     */
    static async getTrialBalance(startDate?: string, endDate?: string) {
        let dateFilter = '';
        const params: any[] = [];
        
        if (startDate && endDate) {
            dateFilter = 'WHERE je.entry_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }
        
        const query = `
            SELECT 
                coa.account_code,
                coa.account_name,
                coa.account_type,
                COALESCE(SUM(jel.debit), 0) as total_debit,
                COALESCE(SUM(jel.credit), 0) as total_credit,
                COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as balance
            FROM chart_of_accounts coa
            LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
            LEFT JOIN journal_entries je ON jel.journal_id = je.id
            ${dateFilter}
            GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
            ORDER BY coa.account_code
        `;
        
        const [result] = await databasePool.query(query, params);
        return result;
    }

    /**
     * Get profit and loss statement
     */
    static async getProfitLossStatement(startDate: string, endDate: string) {
        const query = `
            SELECT 
                coa.account_code,
                coa.account_name,
                coa.account_type,
                COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0) as amount
            FROM chart_of_accounts coa
            LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
            LEFT JOIN journal_entries je ON jel.journal_id = je.id
            WHERE coa.account_type IN ('revenue', 'expense')
            AND je.entry_date BETWEEN ? AND ?
            GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
            ORDER BY coa.account_type, coa.account_code
        `;
        
        const [result] = await databasePool.query(query, [startDate, endDate]);
        return result;
    }

    /**
     * Get balance sheet
     */
    static async getBalanceSheet(date: string) {
        const query = `
            SELECT 
                coa.account_code,
                coa.account_name,
                coa.account_type,
                COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as balance
            FROM chart_of_accounts coa
            LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
            LEFT JOIN journal_entries je ON jel.journal_id = je.id
            WHERE coa.account_type IN ('asset', 'liability', 'equity')
            AND je.entry_date <= ?
            GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
            ORDER BY coa.account_type, coa.account_code
        `;
        
        const [result] = await databasePool.query(query, [date]);
        return result;
    }

    /**
     * Get journal entries with lines
     */
    static async getJournalEntries(startDate?: string, endDate?: string, limit: number = 50) {
        let dateFilter = '';
        const params: any[] = [];
        
        if (startDate && endDate) {
            dateFilter = 'WHERE je.entry_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }
        
        const query = `
            SELECT 
                je.*,
                GROUP_CONCAT(
                    CONCAT(
                        coa.account_code, ' - ', coa.account_name, 
                        ' (D:', jel.debit, ', C:', jel.credit, ')'
                    ) 
                    SEPARATOR '; '
                ) as lines_summary
            FROM journal_entries je
            LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_id
            LEFT JOIN chart_of_accounts coa ON jel.account_id = coa.id
            ${dateFilter}
            GROUP BY je.id
            ORDER BY je.entry_date DESC, je.id DESC
            LIMIT ?
        `;
        
        params.push(limit);
        const [result] = await databasePool.query(query, params);
        return result;
    }

    /**
     * Get journal entry details with lines
     */
    static async getJournalEntryDetails(journalId: number) {
        const entryQuery = `
            SELECT * FROM journal_entries WHERE id = ?
        `;
        
        const linesQuery = `
            SELECT 
                jel.*,
                coa.account_code,
                coa.account_name,
                coa.account_type
            FROM journal_entry_lines jel
            JOIN chart_of_accounts coa ON jel.account_id = coa.id
            WHERE jel.journal_id = ?
            ORDER BY jel.id
        `;
        
        const [entryResult] = await databasePool.query(entryQuery, [journalId]);
        const [linesResult] = await databasePool.query(linesQuery, [journalId]);
        
        return {
            entry: (entryResult as any[])[0],
            lines: linesResult
        };
    }
}
