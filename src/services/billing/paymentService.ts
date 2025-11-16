import { databasePool } from '../../db/pool';

export interface PaymentData {
    invoice_id: number;
    payment_method: string;
    amount: number;
    reference_number?: string;
    gateway_transaction_id?: string;
    gateway_status?: string;
    notes?: string;
}

export class PaymentService {
    /**
     * Catat pembayaran
     */
    static async recordPayment(paymentData: PaymentData): Promise<number> {
        const connection = await databasePool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Insert payment
            const paymentQuery = `
                INSERT INTO payments (
                    invoice_id, payment_method, amount, reference_number,
                    gateway_transaction_id, gateway_status, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            const [paymentResult] = await connection.execute(paymentQuery, [
                paymentData.invoice_id,
                paymentData.payment_method,
                paymentData.amount,
                paymentData.reference_number,
                paymentData.gateway_transaction_id,
                paymentData.gateway_status,
                paymentData.notes
            ]);
            
            const paymentId = (paymentResult as any).insertId;
            
            // Update invoice payment status
            await this.updateInvoicePaymentStatus(paymentData.invoice_id);
            
            await connection.commit();
            
            // Track late payment (async, don't wait)
            this.trackLatePayment(paymentData.invoice_id, paymentId).catch(error => {
                console.error('[PaymentService] Error tracking late payment:', error);
            });
            
            return paymentId;
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Update status pembayaran invoice
     */
    static async updateInvoicePaymentStatus(invoiceId: number): Promise<void> {
        // Hitung total pembayaran
        const paymentQuery = `
            SELECT COALESCE(SUM(amount), 0) as total_paid
            FROM payments 
            WHERE invoice_id = ?
        `;
        
        const [paymentResult] = await databasePool.execute(paymentQuery, [invoiceId]);
        const totalPaid = parseFloat(((paymentResult as any[])[0] as any).total_paid);
        
        // Get invoice details
        const invoiceQuery = `
            SELECT total_amount, due_date, status
            FROM invoices 
            WHERE id = ?
        `;
        
        const [invoiceResult] = await databasePool.execute(invoiceQuery, [invoiceId]);
        const invoice = (invoiceResult as any[])[0];
        
        const totalAmount = parseFloat(invoice.total_amount || 0);
        const remainingAmount = totalAmount - totalPaid;
        
        let newStatus = invoice.status || 'draft';
        
        if (totalPaid >= totalAmount) {
            newStatus = 'paid';
        } else if (totalPaid > 0) {
            newStatus = 'partial';
        } else {
            // Check if overdue
            const dueDate = new Date(invoice.due_date || new Date().toISOString().split('T')[0]);
            const today = new Date();
            if (today > dueDate) {
                newStatus = 'overdue';
            }
        }
        
        // Update invoice
        const updateQuery = `
            UPDATE invoices 
            SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        await databasePool.execute(updateQuery, [totalPaid, remainingAmount, newStatus, invoiceId]);
    }

    /**
     * Handle pembayaran parsial dan kekurangan
     */
    static async handlePartialPayment(invoiceId: number, paymentAmount: number, paymentMethod: string, notes?: string): Promise<{paymentId: number, carryOverAmount?: number}> {
        const connection = await databasePool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Get invoice details
            const invoiceQuery = `
                SELECT total_amount, paid_amount, remaining_amount, customer_id, period
                FROM invoices 
                WHERE id = ?
            `;
            
            const [invoiceResult] = await connection.execute(invoiceQuery, [invoiceId]);
            const invoice = (invoiceResult as any[])[0];
            
            const totalAmount = parseFloat(invoice.total_amount || 0);
            const currentPaid = parseFloat(invoice.paid_amount || 0);
            const remainingAmount = parseFloat(invoice.remaining_amount);
            
            // Catat pembayaran
            const paymentData: PaymentData = {
                invoice_id: invoiceId,
                payment_method: paymentMethod,
                amount: paymentAmount,
                notes: notes
            };
            
            const paymentId = await this.recordPayment(paymentData);
            
            let carryOverAmount = 0;
            
            // Jika pembayaran kurang dari total, buat invoice untuk bulan depan
            if (paymentAmount < remainingAmount) {
                carryOverAmount = remainingAmount - paymentAmount;
                
                // Generate periode bulan depan
                const currentPeriod = invoice.period;
                const [year, month] = currentPeriod.split('-');
                const nextMonth = new Date(parseInt(year), parseInt(month), 10);
                const nextPeriod = `${nextMonth.getFullYear()}-${(nextMonth.getMonth() + 1).toString().padStart(2, '0')}`;
                
                // Buat invoice untuk kekurangan
                const carryOverInvoiceData = {
                    customer_id: invoice.customer_id,
                    period: nextPeriod,
                    due_date: new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 7).toISOString().split('T')[0],
                    subtotal: carryOverAmount,
                    total_amount: carryOverAmount,
                    notes: `Kekurangan dari periode ${currentPeriod}`
                };
                
                const carryOverItems = [{
                    description: `Kekurangan periode ${currentPeriod}`,
                    quantity: 1,
                    unit_price: carryOverAmount,
                    total_price: carryOverAmount
                }];
                
                // Import InvoiceService untuk membuat invoice
                const { InvoiceService } = await import('./invoiceService');
                await InvoiceService.createInvoice(carryOverInvoiceData as any, carryOverItems);
            }
            
            await connection.commit();
            return { paymentId, carryOverAmount };
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Get payment history untuk invoice
     */
    static async getPaymentHistory(invoiceId: number) {
        const query = `
            SELECT p.*, i.invoice_number
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            WHERE p.invoice_id = ?
            ORDER BY p.payment_date DESC
        `;
        
        const [result] = await databasePool.execute(query, [invoiceId]);
        return result as any[];
    }


    /**
     * Rekonsiliasi pembayaran gateway
     */
    static async reconcileGatewayPayment(transactionId: string, status: string, amount: number): Promise<void> {
        const query = `
            UPDATE payments 
            SET gateway_status = ?, amount = ?, updated_at = CURRENT_TIMESTAMP
            WHERE gateway_transaction_id = ?
        `;
        
        await databasePool.execute(query, [status, amount, transactionId]);
        
        // Update invoice status
        const paymentQuery = `
            SELECT invoice_id FROM payments 
            WHERE gateway_transaction_id = ?
        `;
        
        const [paymentResult] = await databasePool.execute(paymentQuery, [transactionId]);
        if ((paymentResult as any[]).length > 0) {
            await this.updateInvoicePaymentStatus(((paymentResult as any[])[0] as any).invoice_id);
        }
    }

    /**
     * Dapatkan daftar pembayaran dengan pagination dan filter
     */
    static async getPaymentList(options: {
        page: number;
        limit: number;
        filters: {
            status?: string;
            method?: string;
            date_from?: string;
            date_to?: string;
        };
    }): Promise<{
        data: any[];
        pagination: {
            currentPage: number;
            totalPages: number;
            totalItems: number;
            startIndex: number;
            endIndex: number;
        };
    }> {
        try {
            const { page, limit, filters } = options;
            const offset = (page - 1) * limit;
            
            let whereClause = 'WHERE 1=1';
            const params: any[] = [];

            // Filter by status (using gateway_status instead)
            if (filters.status) {
                whereClause += ` AND p.gateway_status = ?`;
                params.push(filters.status);
            }

            // Filter by payment method
            if (filters.method) {
                whereClause += ` AND p.payment_method = ?`;
                params.push(filters.method);
            }

            // Filter by date range
            if (filters.date_from) {
                whereClause += ` AND DATE(p.payment_date) >= ?`;
                params.push(filters.date_from);
            }

            if (filters.date_to) {
                whereClause += ` AND DATE(p.payment_date) <= ?`;
                params.push(filters.date_to);
            }

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN customers c ON i.customer_id = c.id
                ${whereClause}
            `;
            
        const [countResult] = await databasePool.execute(countQuery, params);
        const totalItems = parseInt((countResult as any)[0]?.total || 0);

            // Get payments with pagination
            const paymentsQuery = `
                SELECT 
                    p.id,
                    p.invoice_id,
                    p.payment_method,
                    p.amount,
                    p.reference_number,
                    p.gateway_status,
                    p.payment_date,
                    p.notes,
                    i.invoice_number,
                    c.name as customer_name,
                    c.phone as customer_phone
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN customers c ON i.customer_id = c.id
                ${whereClause}
                ORDER BY p.payment_date DESC
                LIMIT ? OFFSET ?
            `;
            
        const paymentsParams = [...params, parseInt(limit.toString()), parseInt(offset.toString())];
        const [payments] = await databasePool.execute(paymentsQuery, paymentsParams);

            const totalPages = Math.ceil(totalItems / limit) || 1;
            const startIndex = totalItems > 0 ? offset + 1 : 0;
            const endIndex = Math.min(offset + limit, totalItems);

            return {
                data: payments as any[] || [],
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems,
                    startIndex,
                    endIndex
                }
            };
        } catch (error) {
            console.error('Error in getPaymentList:', error);
            throw error;
        }
    }

    /**
     * Dapatkan statistik pembayaran untuk dashboard
     */
    static async getPaymentStats(): Promise<{
        total_payments: number;
        today_payments: number;
        pending_count: number;
        failed_count: number;
    }> {
        const today = new Date().toISOString().split('T')[0];
        
        const statsQuery = `
            SELECT 
                COALESCE(SUM(amount), 0) as total_payments,
                COALESCE(SUM(CASE WHEN DATE(payment_date) = ? THEN amount ELSE 0 END), 0) as today_payments,
                COUNT(CASE WHEN gateway_status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN gateway_status = 'failed' THEN 1 END) as failed_count
            FROM payments
        `;
        
        const [result] = await databasePool.execute(statsQuery, [today]);
        
        const stats = (result as any)[0];
        return {
            total_payments: parseFloat(stats.total_payments) || 0,
            today_payments: parseFloat(stats.today_payments) || 0,
            pending_count: parseInt(stats.pending_count) || 0,
            failed_count: parseInt(stats.failed_count) || 0
        };
    }

    /**
     * Track late payment (internal helper)
     */
    private static async trackLatePayment(invoiceId: number, paymentId: number): Promise<void> {
        try {
            // Get invoice and payment info
            const [invoiceRows] = await databasePool.execute(
                `SELECT i.due_date, i.id, COALESCE(p.payment_date, p.created_at) as payment_date, p.id as payment_id
                 FROM invoices i
                 JOIN payments p ON i.id = p.invoice_id
                 WHERE i.id = ? AND p.id = ?`,
                [invoiceId, paymentId]
            );

            const invoice = (invoiceRows as any[])[0];
            if (!invoice || !invoice.payment_date || !invoice.due_date) {
                return;
            }

            const paymentDate = new Date(invoice.payment_date);
            const dueDate = new Date(invoice.due_date);

            // Import and track
            const { LatePaymentTrackingService } = await import('./LatePaymentTrackingService');
            await LatePaymentTrackingService.trackPayment(
                invoiceId,
                paymentId,
                paymentDate,
                dueDate
            );
        } catch (error) {
            console.error('[PaymentService] Error in trackLatePayment:', error);
            // Don't throw - this is non-critical
        }
    }
}
