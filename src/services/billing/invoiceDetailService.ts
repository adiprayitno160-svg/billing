import { databasePool } from '../../db/pool';

export interface InvoiceDetailData {
    id: number;
    invoice_number: string;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    period: string;
    due_date: string;
    subtotal: number;
    discount_amount: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    status: string;
    partial_payment_allowed: boolean;
    debt_tracking_enabled: boolean;
    last_payment_date?: string;
    payment_installments?: any;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface PaymentSessionData {
    invoice_id: number;
    payment_amount: number;
    payment_method: string;
    session_token: string;
    expires_at: string;
}

export interface DebtTrackingData {
    customer_id: number;
    invoice_id: number;
    debt_amount: number;
    debt_reason: string;
    debt_date: string;
    due_date?: string;
    notes?: string;
}

export class InvoiceDetailService {
    /**
     * Get invoice detail dengan informasi lengkap
     */
    static async getInvoiceDetail(invoiceId: number): Promise<InvoiceDetailData | null> {
        try {
            const query = `
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    c.email as customer_email,
                    c.address as customer_address
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `;
            
            const [rows] = await databasePool.execute(query, [invoiceId]);
            const invoice = (rows as any[])[0];
            
            if (!invoice) {
                return null;
            }
            
            return {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                customer_id: invoice.customer_id,
                customer_name: invoice.customer_name,
                customer_phone: invoice.customer_phone,
                customer_email: invoice.customer_email,
                period: invoice.period,
                due_date: invoice.due_date,
                subtotal: parseFloat(invoice.subtotal || 0),
                discount_amount: parseFloat(invoice.discount_amount || 0),
                total_amount: parseFloat(invoice.total_amount || 0),
                paid_amount: parseFloat(invoice.paid_amount || 0),
                remaining_amount: parseFloat(invoice.remaining_amount || 0),
                status: invoice.status,
                partial_payment_allowed: Boolean(invoice.partial_payment_allowed),
                debt_tracking_enabled: Boolean(invoice.debt_tracking_enabled),
                last_payment_date: invoice.last_payment_date,
                payment_installments: invoice.payment_installments,
                notes: invoice.notes,
                created_at: invoice.created_at,
                updated_at: invoice.updated_at
            };
        } catch (error) {
            console.error('Error getting invoice detail:', error);
            throw error;
        }
    }

    /**
     * Get payment history untuk invoice
     */
    static async getPaymentHistory(invoiceId: number): Promise<any[]> {
        try {
            const query = `
                SELECT 
                    p.*,
                    pp.proof_file_path,
                    pp.verification_status,
                    pp.verification_notes
                FROM payments p
                LEFT JOIN payment_proofs pp ON p.id = pp.payment_id
                WHERE p.invoice_id = ?
                ORDER BY p.payment_date DESC
            `;
            
            const [rows] = await databasePool.execute(query, [invoiceId]);
            return rows as any[];
        } catch (error) {
            console.error('Error getting payment history:', error);
            throw error;
        }
    }

    /**
     * Get debt tracking untuk customer
     */
    static async getDebtTracking(customerId: number): Promise<any[]> {
        try {
            const query = `
                SELECT 
                    dt.*,
                    i.invoice_number,
                    i.period,
                    i.total_amount
                FROM debt_tracking dt
                JOIN invoices i ON dt.invoice_id = i.id
                WHERE dt.customer_id = ? AND dt.status = 'active'
                ORDER BY dt.debt_date DESC
            `;
            
            const [rows] = await databasePool.execute(query, [customerId]);
            return rows as any[];
        } catch (error) {
            console.error('Error getting debt tracking:', error);
            throw error;
        }
    }

    /**
     * Create payment session untuk pembayaran
     */
    static async createPaymentSession(invoiceId: number, paymentAmount: number, paymentMethod: string): Promise<PaymentSessionData> {
        const connection = await databasePool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Generate session token
            const sessionToken = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Set expiration time (1 hour from now)
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            
            const query = `
                INSERT INTO invoice_payment_sessions 
                (invoice_id, session_token, payment_amount, payment_method, expires_at)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            await connection.execute(query, [
                invoiceId,
                sessionToken,
                paymentAmount,
                paymentMethod,
                expiresAt
            ]);
            
            await connection.commit();
            
            return {
                invoice_id: invoiceId,
                payment_amount: paymentAmount,
                payment_method: paymentMethod,
                session_token: sessionToken,
                expires_at: expiresAt.toISOString()
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Process payment dari Detail Invoice
     */
    static async processPaymentFromDetail(
        sessionToken: string, 
        paymentData: {
            amount: number;
            payment_method: string;
            reference_number?: string;
            notes?: string;
            proof_file_path?: string;
        }
    ): Promise<{success: boolean, message: string, payment_id?: number}> {
        const connection = await databasePool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Get session data
            const [sessionRows] = await connection.execute(
                'SELECT * FROM invoice_payment_sessions WHERE session_token = ? AND status = "pending" AND expires_at > NOW()',
                [sessionToken]
            );
            
            if (!sessionRows || (sessionRows as any[]).length === 0) {
                throw new Error('Session tidak valid atau sudah expired');
            }
            
            const session = (sessionRows as any[])[0];
            
            // Get invoice data
            const invoice = await this.getInvoiceDetail(session.invoice_id);
            if (!invoice) {
                throw new Error('Invoice tidak ditemukan');
            }
            
            // Validate payment amount
            if (paymentData.amount > invoice.remaining_amount) {
                throw new Error('Jumlah pembayaran melebihi sisa tagihan');
            }
            
            // Record payment
            const paymentQuery = `
                INSERT INTO payments 
                (invoice_id, payment_method, amount, reference_number, notes, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            `;
            
            const [paymentResult] = await connection.execute(paymentQuery, [
                session.invoice_id,
                paymentData.payment_method,
                paymentData.amount,
                paymentData.reference_number,
                paymentData.notes
            ]);
            
            const paymentId = (paymentResult as any).insertId;
            
            // Record payment proof if provided
            if (paymentData.proof_file_path) {
                const proofQuery = `
                    INSERT INTO payment_proofs 
                    (invoice_id, payment_id, proof_type, proof_file_path, proof_description, created_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                `;
                
                await connection.execute(proofQuery, [
                    session.invoice_id,
                    paymentId,
                    paymentData.payment_method === 'transfer' ? 'transfer' : 'receipt',
                    paymentData.proof_file_path,
                    `Bukti pembayaran untuk invoice ${invoice.invoice_number}`
                ]);
            }
            
            // Update invoice status
            await this.updateInvoicePaymentStatus(session.invoice_id);
            
            // Update session status
            await connection.execute(
                'UPDATE invoice_payment_sessions SET status = "completed" WHERE session_token = ?',
                [sessionToken]
            );
            
            // Handle debt tracking if needed
            const updatedInvoice = await this.getInvoiceDetail(session.invoice_id);
            if (updatedInvoice && updatedInvoice.remaining_amount > 0 && updatedInvoice.debt_tracking_enabled) {
                await this.createDebtTracking({
                    customer_id: updatedInvoice.customer_id,
                    invoice_id: updatedInvoice.id,
                    debt_amount: updatedInvoice.remaining_amount,
                    debt_reason: 'Pembayaran parsial - sisa tagihan',
                    debt_date: new Date().toISOString().split('T')[0] || '',
                    notes: `Sisa pembayaran dari invoice ${updatedInvoice.invoice_number}`
                });
            }
            
            
            await connection.commit();
            
            return {
                success: true,
                message: 'Pembayaran berhasil diproses',
                payment_id: paymentId
            };
            
        } catch (error) {
            await connection.rollback();
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses pembayaran'
            };
        } finally {
            connection.release();
        }
    }

    /**
     * Update invoice payment status
     */
    private static async updateInvoicePaymentStatus(invoiceId: number): Promise<void> {
        const connection = await databasePool.getConnection();
        
        try {
            // Calculate total payments
            const [paymentRows] = await connection.execute(
                'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ?',
                [invoiceId]
            );
            
            const totalPaid = parseFloat(((paymentRows as any[])[0] as any).total_paid);
            
            // Get invoice details
            const [invoiceRows] = await connection.execute(
                'SELECT total_amount, due_date, status FROM invoices WHERE id = ?',
                [invoiceId]
            );
            
            const invoice = (invoiceRows as any[])[0];
            const totalAmount = parseFloat(invoice.total_amount);
            const remainingAmount = totalAmount - totalPaid;
            
            let newStatus = invoice.status;
            
            if (totalPaid >= totalAmount) {
                newStatus = 'paid';
            } else if (totalPaid > 0) {
                newStatus = 'partial';
            } else {
                const dueDate = new Date(invoice.due_date);
                const today = new Date();
                if (today > dueDate) {
                    newStatus = 'overdue';
                }
            }
            
            // Update invoice
            await connection.execute(
                `UPDATE invoices 
                 SET paid_amount = ?, remaining_amount = ?, status = ?, last_payment_date = NOW(), updated_at = NOW()
                 WHERE id = ?`,
                [totalPaid, remainingAmount, newStatus, invoiceId]
            );
            
        } finally {
            connection.release();
        }
    }

    /**
     * Create debt tracking record
     */
    private static async createDebtTracking(debtData: DebtTrackingData): Promise<void> {
        const connection = await databasePool.getConnection();
        
        try {
            const query = `
                INSERT INTO debt_tracking 
                (customer_id, invoice_id, debt_amount, debt_reason, debt_date, due_date, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            
            await connection.execute(query, [
                debtData.customer_id,
                debtData.invoice_id,
                debtData.debt_amount,
                debtData.debt_reason,
                debtData.debt_date,
                debtData.due_date,
                debtData.notes
            ]);
            
        } finally {
            connection.release();
        }
    }


    /**
     * Get payment session by token
     */
    static async getPaymentSession(sessionToken: string): Promise<any> {
        try {
            const query = `
                SELECT 
                    ips.*,
                    i.invoice_number,
                    i.total_amount,
                    i.remaining_amount,
                    c.name as customer_name,
                    c.phone as customer_phone
                FROM invoice_payment_sessions ips
                JOIN invoices i ON ips.invoice_id = i.id
                JOIN customers c ON i.customer_id = c.id
                WHERE ips.session_token = ? AND ips.status = 'pending' AND ips.expires_at > NOW()
            `;
            
            const [rows] = await databasePool.execute(query, [sessionToken]);
            return (rows as any[])[0] || null;
        } catch (error) {
            console.error('Error getting payment session:', error);
            throw error;
        }
    }

    /**
     * Clean expired payment sessions
     */
    static async cleanExpiredSessions(): Promise<void> {
        try {
            await databasePool.execute(
                'UPDATE invoice_payment_sessions SET status = "expired" WHERE expires_at < NOW() AND status = "pending"'
            );
        } catch (error) {
            console.error('Error cleaning expired sessions:', error);
        }
    }
}
