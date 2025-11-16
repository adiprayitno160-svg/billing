import { databasePool as pool } from '../../db/pool';
import { PaymentGatewayService, PaymentRequest } from './PaymentGatewayService';

export interface BillingPaymentRequest {
  invoiceId: number;
  customerId: number;
  gatewayCode: string;
  paymentMethod: string;
  callbackUrl?: string;
  redirectUrl?: string;
}

export class BillingPaymentIntegration {
  private paymentService: PaymentGatewayService;

  constructor(paymentService: PaymentGatewayService) {
    this.paymentService = paymentService;
  }

  /**
   * Membuat payment untuk invoice billing
   */
  async createInvoicePayment(request: BillingPaymentRequest): Promise<any> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Ambil data invoice dan customer
      const [invoiceRows] = await connection.execute(
        `SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.id = ? AND i.customer_id = ?`,
        [request.invoiceId, request.customerId]
      );

      if (!invoiceRows || (invoiceRows as any[]).length === 0) {
        throw new Error('Invoice tidak ditemukan');
      }

      const invoice = (invoiceRows as any[])[0];

      // Cek apakah invoice sudah dibayar
      if (invoice.status === 'paid') {
        throw new Error('Invoice sudah dibayar');
      }

      // Cek apakah ada payment transaction yang masih pending
      const [existingPayment] = await connection.execute(
        `SELECT * FROM payment_transactions 
         WHERE invoice_id = ? AND status IN ('pending', 'processing')`,
        [request.invoiceId]
      );

      if (existingPayment && (existingPayment as any[]).length > 0) {
        const existing = (existingPayment as any[])[0];
        return {
          success: true,
          message: 'Payment transaction sudah ada',
          data: {
            transactionId: existing.external_id,
            status: existing.status,
            paymentUrl: existing.payment_url,
          }
        };
      }

      // Buat payment request
      const paymentRequest: PaymentRequest = {
        invoiceId: request.invoiceId,
        customerId: request.customerId,
        amount: parseFloat(invoice.total_amount),
        currency: 'IDR',
        description: `Pembayaran Invoice #${invoice.invoice_number}`,
        paymentMethod: request.paymentMethod,
        gatewayCode: request.gatewayCode,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email,
        customerPhone: invoice.customer_phone,
        callbackUrl: request.callbackUrl,
        redirectUrl: request.redirectUrl,
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 jam
      };

      // Proses payment
      const paymentResult = await this.paymentService.createPayment(paymentRequest);

      // Update invoice status
      await connection.execute(
        'UPDATE invoices SET status = "processing" WHERE id = ?',
        [request.invoiceId]
      );

      await connection.commit();

      return {
        success: true,
        message: 'Payment berhasil dibuat',
        data: paymentResult,
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Memproses payment success
   */
  async processPaymentSuccess(transactionId: string): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Ambil data transaksi
      const [transactionRows] = await connection.execute(
        `SELECT pt.*, i.id as invoice_id, i.customer_id, i.total_amount
         FROM payment_transactions pt
         JOIN invoices i ON pt.invoice_id = i.id
         WHERE pt.external_id = ?`,
        [transactionId]
      );

      if (!transactionRows || (transactionRows as any[]).length === 0) {
        throw new Error('Transaction tidak ditemukan');
      }

      const transaction = (transactionRows as any[])[0];

      // Update payment transaction status
      await connection.execute(
        'UPDATE payment_transactions SET status = "completed", paid_at = NOW() WHERE external_id = ?',
        [transactionId]
      );

      // Update invoice status
      await connection.execute(
        'UPDATE invoices SET status = "paid", paid_at = NOW() WHERE id = ?',
        [transaction.invoice_id]
      );

      // Update customer status jika ada
      await connection.execute(
        'UPDATE customers SET is_isolated = FALSE WHERE id = ?',
        [transaction.customer_id]
      );

      // Log payment success
      await connection.execute(
        `INSERT INTO payment_logs (invoice_id, customer_id, transaction_id, action, amount, status, created_at)
         VALUES (?, ?, ?, 'payment_success', ?, 'completed', NOW())`,
        [transaction.invoice_id, transaction.customer_id, transactionId, transaction.amount]
      );

      await connection.commit();

      // Track late payment (async, don't wait)
      try {
        // Get payment_id if exists
        const [paymentRows] = await connection.execute(
          `SELECT id, COALESCE(payment_date, created_at) as payment_date FROM payments WHERE invoice_id = ? ORDER BY id DESC LIMIT 1`,
          [transaction.invoice_id]
        );
        const payment = (paymentRows as any[])[0];
        
        const [invoiceRows] = await connection.execute(
          `SELECT due_date FROM invoices WHERE id = ?`,
          [transaction.invoice_id]
        );
        const invoice = (invoiceRows as any[])[0];
        if (invoice && invoice.due_date && payment) {
          const { LatePaymentTrackingService } = await import('../billing/LatePaymentTrackingService');
          const paymentDate = new Date(payment.payment_date);
          const dueDate = new Date(invoice.due_date);
          LatePaymentTrackingService.trackPayment(transaction.invoice_id, payment.id, paymentDate, dueDate)
            .catch(err => console.error('[BillingPaymentIntegration] Error tracking late payment:', err));
        }
      } catch (error) {
        console.error('[BillingPaymentIntegration] Error in late payment tracking:', error);
      }

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Memproses payment failure
   */
  async processPaymentFailure(transactionId: string, reason: string): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Ambil data transaksi
      const [transactionRows] = await connection.execute(
        `SELECT pt.*, i.id as invoice_id, i.customer_id
         FROM payment_transactions pt
         JOIN invoices i ON pt.invoice_id = i.id
         WHERE pt.external_id = ?`,
        [transactionId]
      );

      if (!transactionRows || (transactionRows as any[]).length === 0) {
        throw new Error('Transaction tidak ditemukan');
      }

      const transaction = (transactionRows as any[])[0];

      // Update payment transaction status
      await connection.execute(
        'UPDATE payment_transactions SET status = "failed" WHERE external_id = ?',
        [transactionId]
      );

      // Update invoice status
      await connection.execute(
        'UPDATE invoices SET status = "sent" WHERE id = ?',
        [transaction.invoice_id]
      );

      // Log payment failure
      await connection.execute(
        `INSERT INTO payment_logs (invoice_id, customer_id, transaction_id, action, amount, status, notes, created_at)
         VALUES (?, ?, ?, 'payment_failed', ?, 'failed', ?, NOW())`,
        [transaction.invoice_id, transaction.customer_id, transactionId, transaction.amount, reason]
      );

      await connection.commit();

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Mendapatkan payment history untuk customer
   */
  async getCustomerPaymentHistory(customerId: number, limit = 50, offset = 0): Promise<any[]> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        `SELECT pt.*, i.invoice_number, i.total_amount, i.period,
                pg.name as gateway_name, pm.method_name
         FROM payment_transactions pt
         JOIN invoices i ON pt.invoice_id = i.id
         JOIN payment_gateways pg ON pt.gateway_id = pg.id
         JOIN payment_methods pm ON pt.method_id = pm.id
         WHERE pt.customer_id = ?
         ORDER BY pt.created_at DESC
         LIMIT ? OFFSET ?`,
        [customerId, limit, offset]
      );

      return rows as any[];

    } finally {
      connection.release();
    }
  }

  /**
   * Mendapatkan payment statistics untuk dashboard
   */
  async getPaymentStatistics(): Promise<any> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        `SELECT 
            COUNT(*) as total_transactions,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_payments,
            SUM(CASE WHEN status = 'pending' OR status = 'processing' THEN 1 ELSE 0 END) as pending_payments,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
            SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
            AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as average_payment
         FROM payment_transactions
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
      );

      return (rows as any[])[0];

    } finally {
      connection.release();
    }
  }

  /**
   * Mendapatkan payment methods yang tersedia untuk customer
   */
  async getAvailablePaymentMethods(customerId: number): Promise<any[]> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        `SELECT pm.*, pg.name as gateway_name, pg.code as gateway_code
         FROM payment_methods pm
         JOIN payment_gateways pg ON pm.gateway_id = pg.id
         WHERE pm.is_active = TRUE AND pg.is_active = TRUE
         ORDER BY pg.name, pm.method_name`
      );

      return rows as any[];

    } finally {
      connection.release();
    }
  }

  /**
   * Membuat payment link untuk invoice
   */
  async createPaymentLink(invoiceId: number, customerId: number): Promise<string> {
    const connection = await pool.getConnection();
    
    try {
      // Ambil data invoice
      const [invoiceRows] = await connection.execute(
        'SELECT * FROM invoices WHERE id = ? AND customer_id = ?',
        [invoiceId, customerId]
      );

      if (!invoiceRows || (invoiceRows as any[]).length === 0) {
        throw new Error('Invoice tidak ditemukan');
      }

      const invoice = (invoiceRows as any[])[0];

      // Generate payment link
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const paymentLink = `${baseUrl}/payment/status?id=${invoiceId}&customer=${customerId}`;

      return paymentLink;

    } finally {
      connection.release();
    }
  }

  /**
   * Mendapatkan invoice dengan payment options
   */
  async getInvoiceWithPaymentOptions(invoiceId: number, customerId: number): Promise<any> {
    const connection = await pool.getConnection();
    
    try {
      // Ambil data invoice
      const [invoiceRows] = await connection.execute(
        `SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.id = ? AND i.customer_id = ?`,
        [invoiceId, customerId]
      );

      if (!invoiceRows || (invoiceRows as any[]).length === 0) {
        throw new Error('Invoice tidak ditemukan');
      }

      const invoice = (invoiceRows as any[])[0];

      // Ambil payment methods
      const paymentMethods = await this.getAvailablePaymentMethods(customerId);

      // Ambil payment history untuk invoice ini
      const [paymentHistory] = await connection.execute(
        `SELECT pt.*, pg.name as gateway_name, pm.method_name
         FROM payment_transactions pt
         JOIN payment_gateways pg ON pt.gateway_id = pg.id
         JOIN payment_methods pm ON pt.method_id = pm.id
         WHERE pt.invoice_id = ?
         ORDER BY pt.created_at DESC`,
        [invoiceId]
      );

      return {
        invoice,
        paymentMethods,
        paymentHistory: paymentHistory as any[],
        paymentLink: await this.createPaymentLink(invoiceId, customerId),
      };

    } finally {
      connection.release();
    }
  }
}
