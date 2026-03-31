"use strict";
/**
 * Invoice Matching Service
 * Match extracted payment data with customer invoices
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceMatchingService = void 0;
const pool_1 = require("../../db/pool");
class InvoiceMatchingService {
    /**
     * Match payment data with customer invoices
     */
    static async matchPaymentWithInvoices(customerId, extractedData) {
        try {
            console.log(`🔍 Matching payment for customer ${customerId}...`);
            // Get pending invoices for customer
            const invoices = await this.getPendingInvoices(customerId);
            if (invoices.length === 0) {
                return {
                    matched: false,
                    invoices: [],
                    confidence: 0
                };
            }
            // Score each invoice
            const scoredInvoices = invoices.map(invoice => {
                const match = this.scoreInvoiceMatch(invoice, extractedData);
                return {
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    customer_id: invoice.customer_id,
                    customer_name: invoice.customer_name,
                    amount: invoice.total_amount,
                    remaining_amount: invoice.remaining_amount,
                    match_score: match.score,
                    match_reasons: match.reasons
                };
            });
            // Sort by match score (highest first)
            scoredInvoices.sort((a, b) => b.match_score - a.match_score);
            // Get best match
            const bestMatch = scoredInvoices[0];
            const isMatched = bestMatch && bestMatch.match_score >= 50; // Minimum 50% match
            return {
                matched: isMatched,
                invoices: scoredInvoices,
                bestMatch: isMatched ? bestMatch : undefined,
                confidence: bestMatch ? bestMatch.match_score : 0
            };
        }
        catch (error) {
            console.error('Error matching invoices:', error);
            throw error;
        }
    }
    /**
     * Get pending invoices for customer
     */
    static async getPendingInvoices(customerId) {
        const query = `
            SELECT 
                i.*,
                c.name as customer_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.customer_id = ?
            AND i.status IN ('sent', 'partial', 'overdue')
            AND i.remaining_amount > 0
            ORDER BY i.due_date ASC, i.created_at DESC
        `;
        const [result] = await pool_1.databasePool.query(query, [customerId]);
        return result;
    }
    /**
     * Score how well an invoice matches the payment data
     */
    static scoreInvoiceMatch(invoice, extractedData) {
        let score = 0;
        const reasons = [];
        // Amount matching (0-60 points)
        if (extractedData.amount) {
            const invoiceRemaining = invoice.remaining_amount || invoice.total_amount;
            const diff = Math.abs(extractedData.amount - invoiceRemaining);
            const diffPercent = (diff / invoiceRemaining) * 100;
            if (diffPercent === 0) {
                score += 60;
                reasons.push('Nominal cocok 100%');
            }
            else if (diffPercent <= 1) {
                score += 50;
                reasons.push('Nominal hampir cocok (beda <1%)');
            }
            else if (diffPercent <= 5) {
                score += 30;
                reasons.push('Nominal mendekati (beda <5%)');
            }
            else if (diffPercent <= 10) {
                score += 15;
                reasons.push('Nominal agak berbeda (beda <10%)');
            }
            else {
                reasons.push('Nominal berbeda signifikan');
            }
        }
        else {
            reasons.push('Nominal tidak terdeteksi dari bukti');
        }
        // Date matching (0-30 points)
        if (extractedData.date) {
            const paymentDate = new Date(extractedData.date);
            const invoiceDueDate = new Date(invoice.due_date);
            const daysDiff = Math.abs((paymentDate.getTime() - invoiceDueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 3) {
                score += 30;
                reasons.push('Tanggal pembayaran sesuai jatuh tempo');
            }
            else if (daysDiff <= 7) {
                score += 20;
                reasons.push('Tanggal pembayaran mendekati jatuh tempo');
            }
            else if (daysDiff <= 14) {
                score += 10;
                reasons.push('Tanggal pembayaran agak jauh dari jatuh tempo');
            }
            else {
                reasons.push('Tanggal pembayaran jauh dari jatuh tempo');
            }
        }
        else {
            reasons.push('Tanggal tidak terdeteksi dari bukti');
        }
        // Invoice priority (0-10 points) - older invoices get higher priority
        const invoiceAge = (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24);
        if (invoiceAge > 30) {
            score += 10;
            reasons.push('Tagihan sudah lewat jatuh tempo lama');
        }
        else if (invoiceAge > 14) {
            score += 5;
            reasons.push('Tagihan sudah lewat jatuh tempo');
        }
        return {
            score: Math.min(score, 100), // Cap at 100
            reasons
        };
    }
    /**
     * Find invoice by invoice number (optional, from customer message)
     */
    static async findInvoiceByNumber(customerId, invoiceNumber) {
        try {
            const query = `
                SELECT 
                    i.*,
                    c.name as customer_name
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.customer_id = ?
                AND i.invoice_number = ?
                AND i.remaining_amount > 0
            `;
            const [result] = await pool_1.databasePool.query(query, [customerId, invoiceNumber]);
            const invoices = result;
            return invoices.length > 0 ? invoices[0] : null;
        }
        catch (error) {
            console.error('Error finding invoice by number:', error);
            return null;
        }
    }
}
exports.InvoiceMatchingService = InvoiceMatchingService;
//# sourceMappingURL=InvoiceMatchingService.js.map