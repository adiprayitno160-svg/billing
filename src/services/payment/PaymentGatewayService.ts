import { XenditService } from './XenditService';
import { MitraService } from './MitraService';
import { TripayService } from './TripayService';
import { databasePool as pool } from '../../db/pool';

export interface PaymentGatewayConfig {
  xendit: {
    apiKey: string;
    secretKey: string;
    baseUrl?: string;
    webhookSecret?: string;
  };
  mitra: {
    apiKey: string;
    secretKey: string;
    baseUrl?: string;
    webhookSecret?: string;
  };
  tripay: {
    apiKey: string;
    secretKey: string;
    baseUrl?: string;
    webhookSecret?: string;
    merchantCode: string;
  };
}

export interface PaymentRequest {
  invoiceId: number;
  customerId: number;
  amount: number;
  currency: string;
  description: string;
  paymentMethod: string;
  gatewayCode: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  callbackUrl?: string;
  redirectUrl?: string;
  expiredAt?: Date;
}

export interface PaymentResponse {
  transactionId: string;
  status: string;
  paymentUrl?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  expiryDate?: string;
  instructions?: any[];
  metadata?: any;
}

export class PaymentGatewayService {
  private xenditService: XenditService;
  private mitraService: MitraService;
  private tripayService: TripayService;

  constructor(config: PaymentGatewayConfig) {
    this.xenditService = new XenditService({
      ...config.xendit,
      baseUrl: config.xendit.baseUrl || 'https://api.xendit.co'
    });
    this.mitraService = new MitraService({
      ...config.mitra,
      baseUrl: config.mitra.baseUrl || 'https://api.mitra.com'
    });
    this.tripayService = new TripayService({
      ...config.tripay,
      baseUrl: config.tripay.baseUrl || 'https://tripay.co.id'
    });
  }

  /**
   * Membuat payment request
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Simpan transaksi ke database
      const [result] = await connection.execute(
        `INSERT INTO payment_transactions 
         (invoice_id, customer_id, gateway_id, method_id, external_id, amount, currency, status, metadata, expired_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          request.invoiceId,
          request.customerId,
          await this.getGatewayId(request.gatewayCode),
          await this.getMethodId(request.gatewayCode, request.paymentMethod),
          this.generateExternalId(),
          request.amount,
          request.currency,
          JSON.stringify({
            description: request.description,
            customerName: request.customerName,
            customerEmail: request.customerEmail,
            customerPhone: request.customerPhone,
          }),
          request.expiredAt,
        ]
      );

      const transactionId = (result as any).insertId;
      const externalId = this.generateExternalId();

      // Update external_id
      await connection.execute(
        'UPDATE payment_transactions SET external_id = ? WHERE id = ?',
        [externalId, transactionId]
      );

      let paymentResponse: PaymentResponse;

      // Proses payment berdasarkan gateway
      switch (request.gatewayCode) {
        case 'xendit':
          paymentResponse = await this.processXenditPayment(request, externalId);
          break;
        case 'mitra':
          paymentResponse = await this.processMitraPayment(request, externalId);
          break;
        case 'tripay':
          paymentResponse = await this.processTripayPayment(request, externalId);
          break;
        default:
          throw new Error(`Unsupported payment gateway: ${request.gatewayCode}`);
      }

      // Update transaksi dengan response
      await connection.execute(
        `UPDATE payment_transactions 
         SET status = ?, payment_url = ?, gateway_response = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          paymentResponse.status,
          paymentResponse.paymentUrl,
          JSON.stringify(paymentResponse),
          transactionId,
        ]
      );

      await connection.commit();
      return paymentResponse;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Proses payment dengan Xendit
   */
  private async processXenditPayment(request: PaymentRequest, externalId: string): Promise<PaymentResponse> {
    const xenditRequest = {
      external_id: externalId,
      amount: request.amount,
      description: request.description,
      customer: {
        given_names: request.customerName,
        email: request.customerEmail,
        mobile_number: request.customerPhone,
      },
      success_redirect_url: request.redirectUrl,
      failure_redirect_url: request.redirectUrl,
      currency: request.currency,
    };

    let response;
    switch (request.paymentMethod) {
      case 'virtual_account':
        response = await this.xenditService.createVirtualAccount({
          ...xenditRequest,
          bank_code: 'BCA', // Default bank
          name: request.customerName,
        });
        break;
      case 'ewallet':
        response = await this.xenditService.createEwalletPayment({
          ...xenditRequest,
          ewallet_type: 'OVO', // Default ewallet
        });
        break;
      case 'retail_outlet':
        response = await this.xenditService.createRetailOutletPayment({
          ...xenditRequest,
          retail_outlet_name: 'ALFAMART', // Default retail outlet
          name: request.customerName,
          expected_amount: request.amount,
        });
        break;
      default:
        response = await this.xenditService.createInvoice(xenditRequest);
    }

    return {
      transactionId: externalId,
      status: response.status,
      paymentUrl: response.invoice_url || response.checkout_url,
      accountNumber: response.account_number,
      accountName: (response as any).customer_name,
      bankCode: response.bank_code,
      expiryDate: response.expiry_date,
      metadata: response,
    };
  }

  /**
   * Proses payment dengan Mitra
   */
  private async processMitraPayment(request: PaymentRequest, externalId: string): Promise<PaymentResponse> {
    const mitraRequest = {
      order_id: externalId,
      amount: request.amount,
      currency: request.currency,
      description: request.description,
      customer_name: request.customerName,
      customer_email: request.customerEmail,
      customer_phone: request.customerPhone,
      payment_method: request.paymentMethod as any,
      callback_url: request.callbackUrl,
      redirect_url: request.redirectUrl,
      expired_at: request.expiredAt?.toISOString(),
    };

    const response = await this.mitraService.createPayment(mitraRequest);

    return {
      transactionId: externalId,
      status: response.status,
      paymentUrl: response.payment_url,
      accountNumber: response.account_number,
      accountName: response.account_name,
      bankCode: response.bank_code,
      expiryDate: (response as any).expired_at,
      metadata: response,
    };
  }

  /**
   * Proses payment dengan Tripay
   */
  private async processTripayPayment(request: PaymentRequest, externalId: string): Promise<PaymentResponse> {
    const tripayRequest = {
      method: request.paymentMethod,
      merchant_ref: externalId,
      amount: request.amount,
      customer_name: request.customerName,
      customer_email: request.customerEmail,
      customer_phone: request.customerPhone,
      order_items: [
        {
          sku: `INV-${request.invoiceId}`,
          name: request.description,
          price: request.amount,
          quantity: 1,
        },
      ],
      return_url: request.redirectUrl,
      expired_time: request.expiredAt ? Math.floor(request.expiredAt.getTime() / 1000) : undefined,
    };

    const response = await this.tripayService.createTransaction(tripayRequest);

    return {
      transactionId: externalId,
      status: response.status,
      paymentUrl: response.checkout_url || response.pay_url,
      accountNumber: response.pay_code,
      expiryDate: new Date(response.expired_time * 1000).toISOString(),
      instructions: response.instructions,
      metadata: response,
    };
  }

  /**
   * Mendapatkan status payment
   */
  async getPaymentStatus(transactionId: string): Promise<any> {
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM payment_transactions WHERE external_id = ?',
        [transactionId]
      );

      if (!rows || (rows as any[]).length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = (rows as any[])[0];
      
      // Ambil status terbaru dari gateway
      let gatewayStatus;
      switch (transaction.gateway_id) {
        case 1: // Xendit
          const xenditStatus = await this.xenditService.getInvoice(transaction.external_id);
          gatewayStatus = xenditStatus.status;
          break;
        case 2: // Mitra
          const mitraStatus = await this.mitraService.getPaymentStatus(transaction.external_id);
          gatewayStatus = mitraStatus.status;
          break;
        case 3: // Tripay
          const tripayStatus = await this.tripayService.getTransactionDetail(transaction.external_id);
          gatewayStatus = tripayStatus.status;
          break;
      }

      // Update status jika berbeda
      if (gatewayStatus && gatewayStatus !== transaction.status) {
        await connection.execute(
          'UPDATE payment_transactions SET status = ?, updated_at = NOW() WHERE id = ?',
          [gatewayStatus, transaction.id]
        );
        transaction.status = gatewayStatus;
      }

      return transaction;

    } finally {
      connection.release();
    }
  }

  /**
   * Memproses webhook
   */
  async processWebhook(gatewayCode: string, payload: any, signature: string): Promise<void> {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Log webhook
      const [webhookResult] = await connection.execute(
        `INSERT INTO payment_webhook_logs (gateway_id, event_type, payload, signature)
         VALUES (?, ?, ?, ?)`,
        [
          await this.getGatewayId(gatewayCode),
          payload.event_type || 'payment_update',
          JSON.stringify(payload),
          signature,
        ]
      );

      // Verifikasi signature
      let isValid = false;
      switch (gatewayCode) {
        case 'xendit':
          isValid = this.xenditService.verifyWebhookSignature(JSON.stringify(payload), signature);
          break;
        case 'mitra':
          isValid = this.mitraService.verifyWebhookSignature(JSON.stringify(payload), signature);
          break;
        case 'tripay':
          isValid = this.tripayService.verifyWebhookSignature(JSON.stringify(payload), signature);
          break;
      }

      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      // Proses webhook
      let webhookData;
      switch (gatewayCode) {
        case 'xendit':
          webhookData = await this.xenditService.processWebhook(payload);
          break;
        case 'mitra':
          webhookData = await this.mitraService.processWebhook(payload);
          break;
        case 'tripay':
          webhookData = await this.tripayService.processWebhook(payload);
          break;
      }

      // Update transaksi
      if (webhookData) {
        await connection.execute(
          `UPDATE payment_transactions 
           SET status = ?, paid_at = ?, updated_at = NOW()
           WHERE external_id = ?`,
          [
            webhookData.status,
            webhookData.paidAt ? new Date(webhookData.paidAt) : null,
            webhookData.transactionId,
          ]
        );

        // Update invoice jika payment berhasil
        if (webhookData.status === 'completed' || webhookData.status === 'paid') {
          const [transaction] = await connection.execute(
            'SELECT invoice_id FROM payment_transactions WHERE external_id = ?',
            [webhookData.transactionId]
          );

          if (transaction && (transaction as any[]).length > 0) {
            const invoiceId = (transaction as any[])[0].invoice_id;
            
            // Update invoice status
            await connection.execute(
              'UPDATE invoices SET status = "paid", paid_at = NOW() WHERE id = ?',
              [invoiceId]
            );

            // Auto-restore customer if isolated
            const [custRows] = await connection.execute(
              `SELECT c.id, c.is_isolated FROM customers c
               JOIN invoices i ON i.customer_id = c.id
               WHERE i.id = ?`,
              [invoiceId]
            );
            if (custRows && (custRows as any[]).length > 0) {
              const customer = (custRows as any[])[0];
              if (customer.is_isolated) {
                await connection.execute('UPDATE customers SET is_isolated = FALSE WHERE id = ?', [customer.id]);
                await connection.execute(
                  `INSERT INTO isolation_logs (customer_id, action, reason, created_at)
                   VALUES (?, 'restore', 'Auto restore after payment (webhook)', NOW())`,
                  [customer.id]
                );
              }
            }
          }
        }
      }

      // Mark webhook as processed
      await connection.execute(
        'UPDATE payment_webhook_logs SET is_processed = TRUE, processed_at = NOW() WHERE id = ?',
        [(webhookResult as any).insertId]
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
   * Mendapatkan daftar payment methods
   */
  async getPaymentMethods(gatewayCode?: string): Promise<any[]> {
    const connection = await pool.getConnection();
    
    try {
      let query = `
        SELECT pm.*, pg.name as gateway_name, pg.code as gateway_code
        FROM payment_methods pm
        JOIN payment_gateways pg ON pm.gateway_id = pg.id
        WHERE pm.is_active = TRUE AND pg.is_active = TRUE
      `;
      
      const params: any[] = [];
      if (gatewayCode) {
        query += ' AND pg.code = ?';
        params.push(gatewayCode);
      }

      const [rows] = await connection.execute(query, params);
      return rows as any[];

    } finally {
      connection.release();
    }
  }

  /**
   * Mendapatkan riwayat transaksi
   */
  async getTransactionHistory(customerId?: number, status?: string, limit = 50, offset = 0): Promise<any[]> {
    const connection = await pool.getConnection();
    
    try {
      let query = `
        SELECT pt.*, pg.name as gateway_name, pm.method_name,
               c.name as customer_name, c.email as customer_email
        FROM payment_transactions pt
        JOIN payment_gateways pg ON pt.gateway_id = pg.id
        JOIN payment_methods pm ON pt.method_id = pm.id
        LEFT JOIN customers c ON pt.customer_id = c.id
        WHERE 1=1
      `;
      
      const params: any[] = [];
      
      if (customerId) {
        query += ' AND pt.customer_id = ?';
        params.push(customerId);
      }
      
      if (status) {
        query += ' AND pt.status = ?';
        params.push(status);
      }
      
      query += ` ORDER BY pt.created_at DESC LIMIT ${parseInt(limit.toString())} OFFSET ${parseInt(offset.toString())}`;

      const [rows] = await connection.execute(query, params);
      return rows as any[];

    } finally {
      connection.release();
    }
  }

  // Helper methods
  private async getGatewayId(gatewayCode: string): Promise<number> {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT id FROM payment_gateways WHERE code = ?',
        [gatewayCode]
      );
      return (rows as any[])[0]?.id;
    } finally {
      connection.release();
    }
  }

  private async getMethodId(gatewayCode: string, methodCode: string): Promise<number> {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT pm.id FROM payment_methods pm
         JOIN payment_gateways pg ON pm.gateway_id = pg.id
         WHERE pg.code = ? AND pm.method_code = ?`,
        [gatewayCode, methodCode]
      );
      return (rows as any[])[0]?.id;
    } finally {
      connection.release();
    }
  }

  private generateExternalId(): string {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
