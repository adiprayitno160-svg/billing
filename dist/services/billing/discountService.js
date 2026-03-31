"use strict";
/**
 * Discount Service
 * Handles application of manual, SLA, and downtime discounts on invoices
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountService = void 0;
const pool_1 = require("../../db/pool");
class DiscountService {
    /**
     * Apply manual discount to an invoice
     */
    static async applyManualDiscount(discount, existingConnection) {
        const connection = existingConnection || await pool_1.databasePool.getConnection();
        const isNewConnection = !existingConnection;
        try {
            if (isNewConnection) {
                await connection.execute('SET innodb_lock_wait_timeout = 30');
                await connection.beginTransaction();
            }
            // Insert discount record
            const [result] = await connection.execute(`INSERT INTO discounts (invoice_id, discount_type, discount_value, reason, approved_by, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`, [
                discount.invoice_id,
                discount.discount_type,
                discount.amount,
                discount.reason,
                discount.approved_by || null
            ]);
            // Update invoice totals
            await this.updateInvoiceTotals(discount.invoice_id, connection);
            if (isNewConnection)
                await connection.commit();
            return result.insertId;
        }
        catch (error) {
            if (isNewConnection)
                await connection.rollback();
            throw error;
        }
        finally {
            if (isNewConnection)
                connection.release();
        }
    }
    /**
     * Apply downtime discount (gangguan)
     */
    static async applyDowntimeDiscount(invoiceId, days, reason, existingConnection) {
        const connection = existingConnection || await pool_1.databasePool.getConnection();
        const isNewConnection = !existingConnection;
        try {
            if (isNewConnection) {
                await connection.execute('SET innodb_lock_wait_timeout = 30');
                await connection.beginTransaction();
            }
            // Get invoice info (subtotal)
            const [invoiceRows] = await connection.execute('SELECT subtotal, customer_id FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
            if (invoiceRows.length === 0)
                throw new Error('Invoice not found');
            const subtotal = parseFloat(invoiceRows[0].subtotal);
            const dailyRate = subtotal / 30;
            const discountAmount = Math.ceil(dailyRate * days);
            // Insert discount
            await connection.execute(`INSERT INTO discounts (invoice_id, discount_type, discount_value, reason, created_at)
                 VALUES (?, 'disturbance', ?, ?, NOW())`, [invoiceId, discountAmount, `Kompensasi Gangguan: ${days} hari. ${reason}`]);
            // Update invoice totals
            await this.updateInvoiceTotals(invoiceId, connection);
            if (isNewConnection)
                await connection.commit();
        }
        catch (error) {
            if (isNewConnection)
                await connection.rollback();
            throw error;
        }
        finally {
            if (isNewConnection)
                connection.release();
        }
    }
    /**
     * Remove a discount from an invoice
     */
    static async removeDiscount(discountId, existingConnection) {
        const connection = existingConnection || await pool_1.databasePool.getConnection();
        const isNewConnection = !existingConnection;
        try {
            if (isNewConnection)
                await connection.beginTransaction();
            // Get invoice ID first
            const [rows] = await connection.query('SELECT invoice_id FROM discounts WHERE id = ?', [discountId]);
            if (rows.length > 0) {
                const invoiceId = rows[0].invoice_id;
                await connection.execute('DELETE FROM discounts WHERE id = ?', [discountId]);
                await this.updateInvoiceTotals(invoiceId, connection);
            }
            if (isNewConnection)
                await connection.commit();
        }
        catch (error) {
            if (isNewConnection)
                await connection.rollback();
            throw error;
        }
        finally {
            if (isNewConnection)
                connection.release();
        }
    }
    /**
     * Recalculate invoice totals based on items and discounts
     */
    static async updateInvoiceTotals(invoiceId, existingConnection) {
        const connection = existingConnection || await pool_1.databasePool.getConnection();
        const isNewConnection = !existingConnection;
        try {
            // Get total from items
            const [itemRows] = await connection.query('SELECT SUM(total_price) as item_total FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
            const itemTotal = parseFloat(itemRows[0].item_total || 0);
            // Get total from discounts
            const [discountRows] = await connection.query('SELECT SUM(discount_value) as discount_total FROM discounts WHERE invoice_id = ?', [invoiceId]);
            const discountTotal = parseFloat(discountRows[0].discount_total || 0);
            // Get invoice details for tax calculation
            const invoiceQuery = `SELECT subtotal, paid_amount, ppn_amount, device_fee, status FROM invoices WHERE id = ? FOR UPDATE`;
            const [invoiceResult] = await connection.execute(invoiceQuery, [invoiceId]);
            if (invoiceResult.length === 0)
                return;
            const invoice = invoiceResult[0];
            const ppnAmount = parseFloat(invoice.ppn_amount || 0);
            const deviceFee = parseFloat(invoice.device_fee || 0);
            const paidAmount = parseFloat(invoice.paid_amount || 0);
            // Calculate new total
            const newTotalAmount = Math.max(0, (itemTotal + ppnAmount + deviceFee) - discountTotal);
            const remainingAmount = Math.max(0, newTotalAmount - paidAmount);
            // Update invoice
            const updateQuery = `
                UPDATE invoices 
                SET subtotal = ?, 
                    discount_amount = ?, 
                    total_amount = ?, 
                    remaining_amount = ?,
                    status = CASE WHEN ? > 0 AND ? <= 0 THEN 'paid' ELSE status END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            await connection.execute(updateQuery, [
                itemTotal,
                discountTotal,
                newTotalAmount,
                remainingAmount,
                newTotalAmount,
                remainingAmount,
                invoiceId
            ]);
            // If we are on connection pool (not in transaction), no need to commit
        }
        finally {
            if (isNewConnection)
                connection.release();
        }
    }
    /**
     * Get discount history for an invoice
     */
    static async getInvoiceDiscounts(invoiceId) {
        const [rows] = await pool_1.databasePool.query(`SELECT d.*, u.username as approver_name
             FROM discounts d
             LEFT JOIN users u ON d.approved_by = u.id
             WHERE d.invoice_id = ?
             ORDER BY d.created_at DESC`, [invoiceId]);
        return rows;
    }
    /**
     * Apply marketing discount code
     */
    static async applyMarketingDiscount(invoiceId, code, userId = 0) {
        const connection = await pool_1.databasePool.getConnection();
        try {
            await connection.beginTransaction();
            // 1. Check if code exists and is active
            const [codeRows] = await connection.query(`SELECT * FROM marketing_codes WHERE code = ? AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())`, [code]);
            if (codeRows.length === 0) {
                return { success: false, message: 'Kode diskon tidak valid atau sudah kadaluarsa' };
            }
            const promo = codeRows[0];
            // 2. Check usage limit
            if (promo.usage_limit > 0 && promo.used_count >= promo.usage_limit) {
                return { success: false, message: 'Kode diskon sudah mencapai batas penggunaan' };
            }
            // 3. Apply discount
            await connection.execute(`INSERT INTO discounts (invoice_id, discount_type, discount_value, reason, approved_by, created_at)
                 VALUES (?, 'promo', ?, ?, ?, NOW())`, [invoiceId, promo.discount_value, `Promo Code: ${code}`, userId]);
            // 4. Update code usage
            await connection.execute(`UPDATE marketing_codes SET used_count = used_count + 1 WHERE id = ?`, [promo.id]);
            // 5. Update invoice totals
            await this.updateInvoiceTotals(invoiceId, connection);
            await connection.commit();
            return { success: true, message: `Berhasil menerapkan diskon ${promo.discount_value}` };
        }
        catch (error) {
            await connection.rollback();
            console.error('[DiscountService] Error applying marketing discount:', error);
            return { success: false, message: error.message || 'Gagal menerapkan diskon' };
        }
        finally {
            connection.release();
        }
    }
}
exports.DiscountService = DiscountService;
//# sourceMappingURL=discountService.js.map