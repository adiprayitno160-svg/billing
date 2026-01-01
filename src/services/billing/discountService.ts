import { databasePool } from '../../db/pool';

export interface DiscountData {
    invoice_id: number;
    discount_type: 'manual' | 'sla' | 'promo';
    discount_value: number;
    discount_percent?: number;
    reason: string;
    applied_by: number;
}

export class DiscountService {
    /**
     * Apply manual discount
     */
    static async applyManualDiscount(discountData: DiscountData): Promise<number> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // Insert discount record
            const discountQuery = `
                INSERT INTO discounts (
                    invoice_id, discount_type, discount_value, discount_percent, 
                    reason, applied_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;

            const [discountResult] = await connection.execute(discountQuery, [
                discountData.invoice_id,
                discountData.discount_type,
                discountData.discount_value,
                discountData.discount_percent,
                discountData.reason,
                discountData.applied_by
            ]);

            const discountId = (discountResult as any).insertId;

            // Update invoice totals
            await this.updateInvoiceTotals(discountData.invoice_id);

            await connection.commit();
            return discountId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Apply SLA discount automatically
     */
    static async applySLADiscount(customerId: number, period: string): Promise<number> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // Get customer SLA settings
            const customerQuery = `
                SELECT compensation_type, compensation_value 
                FROM customers 
                WHERE id = ?
            `;

            const [customerResult] = await connection.execute(customerQuery, [customerId]);
            const customer = (customerResult as any)[0];

            if (!customer || !customer.compensation_type) {
                throw new Error('Customer SLA settings not found');
            }

            // Get invoice for the period
            const invoiceQuery = `
                SELECT id, subtotal FROM invoices 
                WHERE customer_id = ? AND period = ? AND status != 'cancelled'
                ORDER BY created_at DESC LIMIT 1
            `;

            const [invoiceResult] = await connection.execute(invoiceQuery, [customerId, period]);
            const invoice = (invoiceResult as any)[0];

            if (!invoice) {
                throw new Error('Invoice not found for SLA discount');
            }

            // Calculate discount amount
            let discountAmount = 0;
            if (customer.compensation_type === 'percentage') {
                discountAmount = (invoice.subtotal * customer.compensation_value) / 100;
            } else if (customer.compensation_type === 'fixed') {
                discountAmount = customer.compensation_value;
            }

            // Insert SLA discount
            const discountQuery = `
                INSERT INTO discounts (
                    invoice_id, discount_type, discount_value, reason, applied_by, created_at
                ) VALUES (?, 'sla', ?, 'SLA Compensation', 1, NOW())
            `;

            const [discountResult] = await connection.execute(discountQuery, [
                invoice.id,
                discountAmount
            ]);

            const discountId = (discountResult as any).insertId;

            // Update invoice totals
            await this.updateInvoiceTotals(invoice.id);

            await connection.commit();
            return discountId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Update invoice totals after discount
     */
    private static async updateInvoiceTotals(invoiceId: number): Promise<void> {
        const connection = await databasePool.getConnection();

        try {
            // Get total discount amount
            const discountQuery = `
                SELECT COALESCE(SUM(discount_value), 0) as total_discount 
                FROM discounts 
                WHERE invoice_id = ?
            `;

            const [discountResult] = await connection.execute(discountQuery, [invoiceId]);
            const totalDiscount = parseFloat((discountResult as any)[0].total_discount);

            // Get invoice details
            const invoiceQuery = `SELECT subtotal, paid_amount FROM invoices WHERE id = ?`;
            const [invoiceResult] = await connection.execute(invoiceQuery, [invoiceId]);
            const invoice = (invoiceResult as any)[0];

            const newTotalAmount = Math.max(0, (invoice.subtotal || 0) - totalDiscount);
            const newRemainingAmount = Math.max(0, newTotalAmount - (invoice.paid_amount || 0));

            // Update invoice
            const updateQuery = `
                UPDATE invoices 
                SET discount_amount = ?, total_amount = ?, remaining_amount = ?
                WHERE id = ?
            `;

            await connection.execute(updateQuery, [totalDiscount, newTotalAmount, newRemainingAmount, invoiceId]);

        } finally {
            connection.release();
        }
    }

    /**
     * Get discounts for an invoice
     */
    static async getInvoiceDiscounts(invoiceId: number) {
        const query = `
            SELECT d.*, u.username as applied_by_name
            FROM discounts d
            LEFT JOIN users u ON d.applied_by = u.id
            WHERE d.invoice_id = ?
            ORDER BY d.created_at DESC
        `;

        const [result] = await databasePool.execute(query, [invoiceId]);
        return result;
    }

    /**
     * Remove discount
     */
    static async removeDiscount(discountId: number): Promise<void> {
        const connection = await databasePool.getConnection();

        try {
            await connection.beginTransaction();

            // Get discount details
            const discountQuery = `SELECT invoice_id FROM discounts WHERE id = ?`;
            const [discountResult] = await connection.execute(discountQuery, [discountId]);
            const discount = (discountResult as any)[0];

            if (!discount) {
                throw new Error('Discount not found');
            }

            // Delete discount
            const deleteQuery = `DELETE FROM discounts WHERE id = ?`;
            await connection.execute(deleteQuery, [discountId]);

            // Update invoice totals
            await this.updateInvoiceTotals(discount.invoice_id);

            await connection.commit();

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get discount history
     */
    static async getDiscountHistory(customerId?: number, limit: number = 50) {
        let whereClause = '';
        let params: any[] = [];

        if (customerId) {
            whereClause = 'WHERE i.customer_id = ?';
            params.push(customerId);
        }

        const query = `
            SELECT 
                d.*,
                i.invoice_number,
                i.customer_id,
                c.name as customer_name,
                u.username as applied_by_name
            FROM discounts d
            LEFT JOIN invoices i ON d.invoice_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN users u ON d.applied_by = u.id
            ${whereClause}
            ORDER BY d.created_at DESC
            LIMIT ?
        `;

        params.push(limit);

        const [result] = await databasePool.execute(query, params);
        return result;
    }

    /**
     * Get discount statistics
     */
    static async getDiscountStats(period?: string) {
        let whereClause = '';
        let params: any[] = [];

        if (period) {
            whereClause = 'WHERE DATE(d.created_at) >= DATE_SUB(NOW(), INTERVAL ? DAY)';
            params.push(period === 'week' ? 7 : period === 'month' ? 30 : 365);
        }

        const query = `
            SELECT 
                COUNT(*) as total_discounts,
                SUM(discount_value) as total_amount,
                AVG(discount_value) as average_amount,
                discount_type,
                COUNT(*) as count_by_type
            FROM discounts d
            ${whereClause}
            GROUP BY discount_type
        `;

        const [result] = await databasePool.execute(query, params);
        return result;
    }

    /**
     * Validate discount data
     */
    static validateDiscount(discountData: DiscountData): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!discountData.invoice_id || discountData.invoice_id <= 0) {
            errors.push('Invoice ID harus diisi');
        }

        if (!discountData.discount_type) {
            errors.push('Tipe diskon harus diisi');
        }

        if (!discountData.discount_value || discountData.discount_value <= 0) {
            errors.push('Nilai diskon harus lebih dari 0');
        }

        if (discountData.discount_type === 'manual' && discountData.discount_percent && (discountData.discount_percent <= 0 || discountData.discount_percent > 100)) {
            errors.push('Persentase diskon harus antara 1-100%');
        }

        if (!discountData.reason || discountData.reason.trim().length === 0) {
            errors.push('Alasan diskon harus diisi');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Calculate discount amount
     */
    static calculateDiscountAmount(originalAmount: number, discountPercent: number): number {
        return (originalAmount * discountPercent) / 100;
    }

    /**
     * Calculate discount percentage
     */
    static calculateDiscountPercentage(originalAmount: number, discountAmount: number): number {
        if (originalAmount === 0) return 0;
        return (discountAmount / originalAmount) * 100;
    }

    /**
     * Get total discounts for an invoice
     */
    static async getTotalDiscountsForInvoice(invoiceId: number): Promise<number> {
        const query = `
            SELECT COALESCE(SUM(discount_value), 0) as total_discount 
            FROM discounts 
            WHERE invoice_id = ?
        `;

        const [result] = await databasePool.execute(query, [invoiceId]);
        return parseFloat((result as any)[0].total_discount);
    }

    /**
     * Check if discount can be applied
     */
    static async canApplyDiscount(invoiceId: number, discountAmount: number): Promise<{ canApply: boolean; reason?: string }> {
        const query = `
            SELECT subtotal, status FROM invoices WHERE id = ?
        `;

        const [result] = await databasePool.execute(query, [invoiceId]);
        const invoice = (result as any)[0];

        if (!invoice) {
            return { canApply: false, reason: 'Invoice tidak ditemukan' };
        }

        if (invoice.status === 'paid') {
            return { canApply: false, reason: 'Invoice sudah lunas' };
        }

        if (invoice.status === 'cancelled') {
            return { canApply: false, reason: 'Invoice sudah dibatalkan' };
        }

        const currentDiscounts = await this.getTotalDiscountsForInvoice(invoiceId);

        if (currentDiscounts + discountAmount > invoice.subtotal) {
            return { canApply: false, reason: 'Jumlah diskon melebihi subtotal invoice' };
        }

        return { canApply: true };
    }

    /**
     * Get all discounts with pagination and filters
     */
    static async getAllDiscounts(options: {
        page: number;
        limit: number;
        customer_id?: number;
        invoice_id?: number;
        discount_type?: string;
    }) {
        const { page, limit, customer_id, invoice_id, discount_type } = options;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams: any[] = [];

        if (customer_id) {
            whereConditions.push('i.customer_id = ?');
            queryParams.push(customer_id);
        }

        if (invoice_id) {
            whereConditions.push('d.invoice_id = ?');
            queryParams.push(invoice_id);
        }

        if (discount_type) {
            whereConditions.push('d.discount_type = ?');
            queryParams.push(discount_type);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : 'WHERE 1=1';

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM discounts d
            LEFT JOIN invoices i ON d.invoice_id = i.id
            ${whereClause}
        `;

        const [countResult] = await databasePool.execute(countQuery, queryParams);
        const total = parseInt((countResult as any)[0].total);

        // Get discounts with pagination - simplified query
        const dataQuery = `
            SELECT 
                d.*,
                i.invoice_number,
                i.customer_id,
                c.name as customer_name,
                c.email as customer_email,
                'System' as applied_by_name
            FROM discounts d
            LEFT JOIN invoices i ON d.invoice_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            ${whereClause}
            ORDER BY d.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        console.log('DiscountService.getAllDiscounts - Query:', dataQuery);
        console.log('DiscountService.getAllDiscounts - queryParams:', queryParams);

        const [dataResult] = await databasePool.execute(dataQuery, queryParams);

        return {
            data: dataResult,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    /**
     * Apply Marketing/Referral Discount
     */
    static async applyMarketingDiscount(invoiceId: number, code: string, appliedBy: number): Promise<{ success: boolean; message: string; discountId?: number }> {
        // Simple referral code logic (can be expanded to DB table)
        // Code format: REF-[AMOUNT/PERCENT]-[VALUE] e.g., REF-FIXED-5000 or REF-PERCENT-10
        // Or simple hardcoded codes for now

        let discountType: 'manual' | 'promo' = 'promo';
        let discountValue = 0;
        let discountPercent = 0;
        let valid = false;

        const ucCode = code.toUpperCase();

        if (ucCode === 'PROMO2025') {
            discountValue = 10000;
            valid = true;
        } else if (ucCode.startsWith('REF-')) {
            // Mock logic
            discountValue = 5000;
            valid = true;
        }

        if (!valid) {
            return { success: false, message: 'Kode diskon tidak valid' };
        }

        // Check compatibility
        const check = await this.canApplyDiscount(invoiceId, discountValue);
        if (!check.canApply) {
            return { success: false, message: check.reason || 'Tidak dapat menggunakan diskon ini' };
        }

        // Apply
        const discountId = await this.applyManualDiscount({

            // The interface DiscountData uses snake_case: invoice_id. But applyManualDiscount implementation takes camelCase object?
            // Let's check the interface definition in this file.
            // Interface DiscountData uses snake_case: invoice_id, discount_type...
            // So we must pass snake_case.
            invoice_id: invoiceId,
            discount_type: 'promo',
            discount_value: discountValue,
            discount_percent: discountPercent,
            reason: `Marketing Code: ${ucCode}`,
            applied_by: appliedBy
        });

        return { success: true, message: 'Diskon berhasil digunakan', discountId };
    }
}