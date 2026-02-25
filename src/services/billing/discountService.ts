/**
 * Discount Service
 * Handles application of manual, SLA, and downtime discounts on invoices
 */

import { databasePool } from '../../db/pool';
import { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface DiscountData {
    invoice_id: number;
    discount_type: 'manual' | 'sla' | 'downtime' | 'promo';
    amount: number;
    reason?: string;
    approved_by?: number;
}

export class DiscountService {
    /**
     * Apply manual discount to an invoice
     */
    static async applyManualDiscount(discount: DiscountData, existingConnection?: PoolConnection | Pool): Promise<number> {
        const connection = existingConnection || await databasePool.getConnection();
        const isNewConnection = !existingConnection;

        try {
            if (isNewConnection) {
                await (connection as PoolConnection).execute('SET innodb_lock_wait_timeout = 30');
                await (connection as PoolConnection).beginTransaction();
            }

            // Insert discount record
            const [result] = await connection.execute<ResultSetHeader>(
                `INSERT INTO discounts (invoice_id, discount_type, amount, reason, approved_by, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    discount.invoice_id,
                    discount.discount_type,
                    discount.amount,
                    discount.reason,
                    discount.approved_by || null
                ]
            );

            // Update invoice totals
            await this.updateInvoiceTotals(discount.invoice_id, connection);

            if (isNewConnection) await (connection as PoolConnection).commit();
            return result.insertId;

        } catch (error) {
            if (isNewConnection) await (connection as PoolConnection).rollback();
            throw error;
        } finally {
            if (isNewConnection) connection.release();
        }
    }

    /**
     * Apply downtime discount (gangguan)
     */
    static async applyDowntimeDiscount(invoiceId: number, days: number, reason: string, existingConnection?: PoolConnection | Pool): Promise<void> {
        const connection = existingConnection || await databasePool.getConnection();
        const isNewConnection = !existingConnection;

        try {
            if (isNewConnection) {
                await (connection as PoolConnection).execute('SET innodb_lock_wait_timeout = 30');
                await (connection as PoolConnection).beginTransaction();
            }

            // Get invoice info (subtotal)
            const [invoiceRows] = await connection.execute<RowDataPacket[]>(
                'SELECT subtotal, customer_id FROM invoices WHERE id = ? FOR UPDATE',
                [invoiceId]
            );

            if (invoiceRows.length === 0) throw new Error('Invoice not found');

            const subtotal = parseFloat(invoiceRows[0].subtotal);
            const dailyRate = subtotal / 30;
            const discountAmount = Math.ceil(dailyRate * days);

            // Insert discount
            await connection.execute(
                `INSERT INTO discounts (invoice_id, discount_type, amount, reason, created_at)
                 VALUES (?, 'downtime', ?, ?, NOW())`,
                [invoiceId, discountAmount, `Kompensasi Gangguan: ${days} hari. ${reason}`]
            );

            // Update invoice totals
            await this.updateInvoiceTotals(invoiceId, connection);

            if (isNewConnection) await (connection as PoolConnection).commit();

        } catch (error) {
            if (isNewConnection) await (connection as PoolConnection).rollback();
            throw error;
        } finally {
            if (isNewConnection) connection.release();
        }
    }

    /**
     * Remove a discount from an invoice
     */
    static async removeDiscount(discountId: number, existingConnection?: PoolConnection | Pool): Promise<void> {
        const connection = existingConnection || await databasePool.getConnection();
        const isNewConnection = !existingConnection;

        try {
            if (isNewConnection) await (connection as PoolConnection).beginTransaction();

            // Get invoice ID first
            const [rows] = await connection.query<RowDataPacket[]>(
                'SELECT invoice_id FROM discounts WHERE id = ?', [discountId]
            );

            if (rows.length > 0) {
                const invoiceId = rows[0].invoice_id;
                await connection.execute('DELETE FROM discounts WHERE id = ?', [discountId]);
                await this.updateInvoiceTotals(invoiceId, connection);
            }

            if (isNewConnection) await (connection as PoolConnection).commit();
        } catch (error) {
            if (isNewConnection) await (connection as PoolConnection).rollback();
            throw error;
        } finally {
            if (isNewConnection) connection.release();
        }
    }

    /**
     * Recalculate invoice totals based on items and discounts
     */
    static async updateInvoiceTotals(invoiceId: number, existingConnection?: PoolConnection | Pool): Promise<void> {
        const connection = existingConnection || await databasePool.getConnection();
        const isNewConnection = !existingConnection;

        try {
            // Get total from items
            const [itemRows] = await connection.query<RowDataPacket[]>(
                'SELECT SUM(total_price) as item_total FROM invoice_items WHERE invoice_id = ?',
                [invoiceId]
            );
            const itemTotal = parseFloat(itemRows[0].item_total || 0);

            // Get total from discounts
            const [discountRows] = await connection.query<RowDataPacket[]>(
                'SELECT SUM(amount) as discount_total FROM discounts WHERE invoice_id = ?',
                [invoiceId]
            );
            const discountTotal = parseFloat(discountRows[0].discount_total || 0);

            // Get invoice details for tax calculation
            const invoiceQuery = `SELECT subtotal, paid_amount, ppn_amount, device_fee, status FROM invoices WHERE id = ? FOR UPDATE`;
            const [invoiceResult] = await connection.execute<RowDataPacket[]>(invoiceQuery, [invoiceId]);

            if (invoiceResult.length === 0) return;

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
        } finally {
            if (isNewConnection) connection.release();
        }
    }

    /**
     * Get discount history for an invoice
     */
    static async getInvoiceDiscounts(invoiceId: number): Promise<any[]> {
        const [rows] = await databasePool.query<RowDataPacket[]>(
            `SELECT d.*, u.username as approver_name
             FROM discounts d
             LEFT JOIN users u ON d.approved_by = u.id
             WHERE d.invoice_id = ?
             ORDER BY d.created_at DESC`,
            [invoiceId]
        );
        return rows;
    }
}