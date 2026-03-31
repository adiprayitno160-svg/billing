"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxCalculationService = void 0;
const pool_1 = __importDefault(require("../../db/pool"));
class TaxCalculationService {
    /**
     * Get all tax calculations with pagination and filters
     */
    static async getAllTaxCalculations(options) {
        const { page, limit, transactionType } = options;
        const offset = (page - 1) * limit;
        let whereClause = '1=1';
        const params = [];
        if (transactionType) {
            whereClause += ' AND transaction_type = ?';
            params.push(transactionType);
        }
        // Get total count
        const [countResult] = await pool_1.default.query(`SELECT COUNT(*) as total FROM tax_calculations WHERE ${whereClause}`, params);
        const total = countResult[0].total;
        // Get paginated data
        const [rows] = await pool_1.default.query(`SELECT * FROM tax_calculations 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]);
        return {
            calculations: rows,
            total,
            page,
            limit
        };
    }
    /**
     * Calculate tax for a given amount and rate
     */
    static calculateTax(baseAmount, taxRate) {
        const taxAmount = Number((baseAmount * (taxRate / 100)).toFixed(2));
        const totalWithTax = Number((baseAmount + taxAmount).toFixed(2));
        return { taxAmount, totalWithTax };
    }
    /**
     * Create a tax calculation record
     */
    static async createTaxCalculation(calculation) {
        const { taxAmount, totalWithTax } = this.calculateTax(calculation.base_amount, calculation.tax_rate);
        const [result] = await pool_1.default.query(`INSERT INTO tax_calculations 
       (transaction_id, transaction_type, base_amount, tax_rate, tax_amount, total_with_tax, tax_code) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            calculation.transaction_id,
            calculation.transaction_type,
            calculation.base_amount,
            calculation.tax_rate,
            taxAmount,
            totalWithTax,
            calculation.tax_code
        ]);
        return result.insertId;
    }
    /**
     * Get tax calculation by transaction ID
     */
    static async getTaxCalculation(transactionId, transactionType) {
        const [rows] = await pool_1.default.query('SELECT * FROM tax_calculations WHERE transaction_id = ? AND transaction_type = ?', [transactionId, transactionType]);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Get all tax calculations for a transaction
     */
    static async getTaxCalculationsForTransaction(transactionId) {
        const [rows] = await pool_1.default.query('SELECT * FROM tax_calculations WHERE transaction_id = ? ORDER BY created_at DESC', [transactionId]);
        return rows;
    }
    /**
     * Get tax summary for a date range
     */
    static async getTaxSummary(startDate, endDate) {
        const [rows] = await pool_1.default.query(`SELECT 
         base_amount,
         tax_rate,
         tax_amount,
         total_with_tax
       FROM tax_calculations 
       WHERE created_at >= ? AND created_at <= ?
       ORDER BY created_at`, [startDate, endDate]);
        if (rows.length === 0) {
            return {
                totalBaseAmount: 0,
                totalTaxAmount: 0,
                totalWithTax: 0,
                taxRates: []
            };
        }
        // Calculate totals
        const totalBaseAmount = rows.reduce((sum, row) => sum + Number(row.base_amount), 0);
        const totalTaxAmount = rows.reduce((sum, row) => sum + Number(row.tax_amount), 0);
        const totalWithTax = rows.reduce((sum, row) => sum + Number(row.total_with_tax), 0);
        // Group by tax rate
        const rateMap = new Map();
        rows.forEach(row => {
            const rate = Number(row.tax_rate);
            if (rateMap.has(rate)) {
                const existing = rateMap.get(rate);
                rateMap.set(rate, {
                    amount: existing.amount + Number(row.tax_amount),
                    count: existing.count + 1
                });
            }
            else {
                rateMap.set(rate, {
                    amount: Number(row.tax_amount),
                    count: 1
                });
            }
        });
        const taxRates = Array.from(rateMap.entries()).map(([rate, data]) => ({
            rate,
            amount: data.amount,
            count: data.count
        }));
        return {
            totalBaseAmount,
            totalTaxAmount,
            totalWithTax,
            taxRates
        };
    }
    /**
     * Calculate tax for an invoice
     */
    static async calculateInvoiceTax(invoiceId) {
        // Get the invoice details
        const [invoiceRows] = await pool_1.default.query(`SELECT subtotal as amount, ppn_rate as tax_rate FROM invoices WHERE id = ?`, [invoiceId]);
        if (invoiceRows.length === 0) {
            throw new Error(`Invoice with ID ${invoiceId} not found`);
        }
        const invoice = invoiceRows[0];
        const baseAmount = Number(invoice.amount);
        const taxRate = invoice.tax_rate ? Number(invoice.tax_rate) : 0; // Use invoice-specific tax rate if available
        // If no tax rate is set on the invoice, try to get it from customer's location or business settings
        if (taxRate === 0) {
            // In a real implementation, you'd fetch the tax rate based on customer location
            // For now, we'll return 0 tax
            return { taxAmount: 0, totalWithTax: baseAmount };
        }
        return this.calculateTax(baseAmount, taxRate);
    }
    /**
     * Process tax for an invoice
     */
    static async processInvoiceTax(invoiceId) {
        const { taxAmount, totalWithTax } = await this.calculateInvoiceTax(invoiceId);
        // Get the current tax rate for this invoice
        const [invoiceRows] = await pool_1.default.query(`SELECT subtotal as amount, ppn_rate as tax_rate FROM invoices WHERE id = ?`, [invoiceId]);
        if (invoiceRows.length === 0) {
            throw new Error(`Invoice with ID ${invoiceId} not found`);
        }
        const taxRate = invoiceRows[0].tax_rate || 0;
        // Create or update tax calculation
        const existingTax = await this.getTaxCalculation(invoiceId, 'invoice');
        if (existingTax) {
            // Update existing tax calculation
            await pool_1.default.query(`UPDATE tax_calculations 
         SET base_amount = ?, tax_rate = ?, tax_amount = ?, total_with_tax = ?, created_at = NOW()
         WHERE transaction_id = ? AND transaction_type = 'invoice'`, [invoiceRows[0].amount, taxRate, taxAmount, totalWithTax, invoiceId]);
        }
        else {
            // Create new tax calculation
            await this.createTaxCalculation({
                transaction_id: invoiceId,
                transaction_type: 'invoice',
                base_amount: Number(invoiceRows[0].amount),
                tax_rate: taxRate,
                tax_amount: taxAmount,
                total_with_tax: totalWithTax,
                tax_code: null
            });
        }
        // Return the updated tax calculation
        const [updatedRows] = await pool_1.default.query(`SELECT * FROM tax_calculations 
       WHERE transaction_id = ? AND transaction_type = 'invoice' 
       ORDER BY created_at DESC LIMIT 1`, [invoiceId]);
        return updatedRows[0];
    }
    /**
     * Get monthly tax report
     */
    static async getMonthlyTaxReport(year, month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59); // Last day of the month
        const [summaryRows] = await pool_1.default.query(`SELECT 
         SUM(base_amount) as total_base,
         SUM(tax_amount) as total_tax,
         SUM(total_with_tax) as total_with_tax
       FROM tax_calculations 
       WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?`, [startDate, endDate]);
        const [breakdownRows] = await pool_1.default.query(`SELECT 
         DATE(created_at) as date,
         base_amount,
         tax_amount,
         total_with_tax,
         transaction_type,
         transaction_id
       FROM tax_calculations 
       WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
       ORDER BY created_at`, [startDate, endDate]);
        const summary = summaryRows[0];
        return {
            month,
            year,
            totalBaseAmount: Number(summary.total_base) || 0,
            totalTaxAmount: Number(summary.total_tax) || 0,
            totalWithTax: Number(summary.total_with_tax) || 0,
            breakdown: breakdownRows.map(row => ({
                date: new Date(row.date),
                baseAmount: Number(row.base_amount),
                taxAmount: Number(row.tax_amount),
                totalWithTax: Number(row.total_with_tax),
                transactionType: row.transaction_type,
                transactionId: Number(row.transaction_id)
            }))
        };
    }
    /**
     * Get tax calculations by type
     */
    static async getTaxCalculationsByType(transactionType, limit = 100) {
        const [rows] = await pool_1.default.query(`SELECT * FROM tax_calculations 
       WHERE transaction_type = ? 
       ORDER BY created_at DESC
       LIMIT ?`, [transactionType, limit]);
        return rows;
    }
}
exports.TaxCalculationService = TaxCalculationService;
exports.default = TaxCalculationService;
//# sourceMappingURL=TaxCalculationService.js.map