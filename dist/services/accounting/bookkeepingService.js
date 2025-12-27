"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookkeepingService = void 0;
const pool_1 = require("../../db/pool");
class BookkeepingService {
    /**
     * Get unpaid invoices (hutang/kurang)
     */
    static async getUnpaidInvoices(startDate, endDate) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            let query = `
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.period,
                    i.due_date,
                    i.total_amount,
                    i.paid_amount,
                    i.remaining_amount,
                    i.status,
                    i.created_at,
                    i.updated_at,
                    c.id as customer_id,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone,
                    c.address as customer_address,
                    pp.name as package_name,
                    DATEDIFF(NOW(), i.due_date) as days_overdue
                FROM invoices i
                INNER JOIN customers c ON i.customer_id = c.id
                LEFT JOIN pppoe_profiles pp ON c.pppoe_profile_id = pp.id
                WHERE i.status IN ('sent', 'partial', 'overdue')
                  AND i.remaining_amount > 0
            `;
            const params = [];
            if (startDate) {
                query += ' AND DATE(i.created_at) >= ?';
                params.push(startDate);
            }
            if (endDate) {
                query += ' AND DATE(i.created_at) <= ?';
                params.push(endDate);
            }
            query += ' ORDER BY i.due_date ASC, i.remaining_amount DESC';
            const [rows] = await conn.query(query, params);
            return rows;
        }
        catch (error) {
            console.error('Error in getUnpaidInvoices:', error);
            throw new Error(`Gagal mengambil data invoice belum dibayar: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            conn.release();
        }
    }
    /**
     * Get paid invoices
     */
    static async getPaidInvoices(startDate, endDate) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            let query = `
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.period,
                    i.due_date,
                    i.total_amount,
                    i.paid_amount,
                    i.remaining_amount,
                    i.status,
                    i.last_payment_date,
                    i.created_at,
                    i.updated_at,
                    c.id as customer_id,
                    c.name as customer_name,
                    c.customer_code,
                    c.phone as customer_phone,
                    c.address as customer_address,
                    pp.name as package_name,
                    (SELECT COUNT(*) FROM payments WHERE invoice_id = i.id) as payment_count,
                    (SELECT MAX(payment_date) FROM payments WHERE invoice_id = i.id) as last_payment,
                    (SELECT MAX(payment_date) FROM payments WHERE invoice_id = i.id) as paid_at
                FROM invoices i
                INNER JOIN customers c ON i.customer_id = c.id
                LEFT JOIN pppoe_profiles pp ON c.pppoe_profile_id = pp.id
                WHERE i.status = 'paid'
            `;
            const params = [];
            if (startDate || endDate) {
                // Use HAVING clause for subquery filtering
                query = `
                    SELECT 
                        i.id,
                        i.invoice_number,
                        i.period,
                        i.due_date,
                        i.total_amount,
                        i.paid_amount,
                        i.remaining_amount,
                        i.status,
                        i.last_payment_date,
                        i.created_at,
                        i.updated_at,
                        c.id as customer_id,
                        c.name as customer_name,
                        c.customer_code,
                        c.phone as customer_phone,
                        c.address as customer_address,
                        pp.name as package_name,
                        (SELECT COUNT(*) FROM payments WHERE invoice_id = i.id) as payment_count,
                        (SELECT MAX(payment_date) FROM payments WHERE invoice_id = i.id) as last_payment,
                        (SELECT MAX(payment_date) FROM payments WHERE invoice_id = i.id) as paid_at
                    FROM invoices i
                    INNER JOIN customers c ON i.customer_id = c.id
                    LEFT JOIN pppoe_profiles pp ON c.pppoe_profile_id = pp.id
                    WHERE i.status = 'paid'
                `;
                if (startDate) {
                    query += ' AND (SELECT MAX(payment_date) FROM payments WHERE invoice_id = i.id) >= ?';
                    params.push(startDate + ' 00:00:00');
                }
                if (endDate) {
                    query += ' AND (SELECT MAX(payment_date) FROM payments WHERE invoice_id = i.id) <= ?';
                    params.push(endDate + ' 23:59:59');
                }
            }
            query += ' ORDER BY (SELECT MAX(payment_date) FROM payments WHERE invoice_id = i.id) DESC, i.invoice_number DESC';
            const [rows] = await conn.query(query, params);
            return rows;
        }
        catch (error) {
            console.error('Error in getPaidInvoices:', error);
            throw new Error(`Gagal mengambil data invoice sudah dibayar: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            conn.release();
        }
    }
    /**
     * Get complete bookkeeping data
     */
    static async getBookkeepingData(startDate, endDate) {
        try {
            const unpaid = await this.getUnpaidInvoices(startDate, endDate);
            const paid = await this.getPaidInvoices(startDate, endDate);
            const unpaidTotal = unpaid.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
            const unpaidRemaining = unpaid.reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || 0), 0);
            const paidTotal = paid.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
            const paidPaid = paid.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0);
            return {
                unpaid: {
                    invoices: unpaid,
                    totalAmount: unpaidTotal,
                    totalRemaining: unpaidRemaining,
                    count: unpaid.length
                },
                paid: {
                    invoices: paid,
                    totalAmount: paidTotal,
                    totalPaid: paidPaid,
                    count: paid.length
                },
                summary: {
                    totalReceivable: unpaidTotal,
                    totalReceived: paidPaid,
                    totalOutstanding: unpaidRemaining
                }
            };
        }
        catch (error) {
            console.error('Error in getBookkeepingData:', error);
            throw new Error(`Gagal mengambil data pembukuan: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get payment details for an invoice
     */
    static async getInvoicePayments(invoiceId) {
        const conn = await pool_1.databasePool.getConnection();
        try {
            const [rows] = await conn.query(`
                SELECT 
                    p.id,
                    p.amount,
                    p.payment_method,
                    p.payment_date,
                    p.reference_number,
                    p.notes,
                    p.created_at,
                    u.username as created_by
                FROM payments p
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.invoice_id = ?
                ORDER BY p.payment_date DESC, p.created_at DESC
            `, [invoiceId]);
            return rows;
        }
        catch (error) {
            console.error('Error in getInvoicePayments:', error);
            throw new Error(`Gagal mengambil data pembayaran invoice: ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            conn.release();
        }
    }
}
exports.BookkeepingService = BookkeepingService;
//# sourceMappingURL=bookkeepingService.js.map