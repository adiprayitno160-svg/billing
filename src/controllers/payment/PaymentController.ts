import { Request, Response } from 'express';
import { PaymentGatewayService, PaymentRequest } from '../../services/payment/PaymentGatewayService';

export class PaymentController {
  private paymentService: PaymentGatewayService;

  constructor(paymentService: PaymentGatewayService) {
    this.paymentService = paymentService;
  }

  /**
   * Membuat payment request
   */
  async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const {
        invoiceId,
        customerId,
        amount,
        currency = 'IDR',
        description,
        paymentMethod,
        gatewayCode,
        customerName,
        customerEmail,
        customerPhone,
        callbackUrl,
        redirectUrl,
        expiredAt,
      } = req.body;

      // Validasi input
      if (!invoiceId || !customerId || !amount || !paymentMethod || !gatewayCode || !customerName) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
          errors: {
            invoiceId: !invoiceId ? 'Invoice ID is required' : undefined,
            customerId: !customerId ? 'Customer ID is required' : undefined,
            amount: !amount ? 'Amount is required' : undefined,
            paymentMethod: !paymentMethod ? 'Payment method is required' : undefined,
            gatewayCode: !gatewayCode ? 'Gateway code is required' : undefined,
            customerName: !customerName ? 'Customer name is required' : undefined,
          },
        });
        return;
      }

      const paymentRequest: PaymentRequest = {
        invoiceId: parseInt(invoiceId),
        customerId: parseInt(customerId),
        amount: parseFloat(amount),
        currency,
        description: description || `Payment for Invoice #${invoiceId}`,
        paymentMethod,
        gatewayCode,
        customerName,
        customerEmail,
        customerPhone,
        callbackUrl,
        redirectUrl,
        expiredAt: expiredAt ? new Date(expiredAt) : undefined,
      };

      const result = await this.paymentService.createPayment(paymentRequest);

      res.json({
        success: true,
        message: 'Payment request created successfully',
        data: result,
      });

    } catch (error: any) {
      console.error('Error creating payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment request',
        error: error.message,
      });
    }
  }

  /**
   * Mendapatkan status payment
   */
  async getPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;

      if (!transactionId) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID is required',
        });
        return;
      }

      const status = await this.paymentService.getPaymentStatus(transactionId);

      res.json({
        success: true,
        data: status,
      });

    } catch (error: any) {
      console.error('Error getting payment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment status',
        error: error.message,
      });
    }
  }

  /**
   * Mendapatkan daftar payment methods
   */
  async getPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const { gateway } = req.query;
      const methods = await this.paymentService.getPaymentMethods(gateway as string);

      res.json({
        success: true,
        data: methods,
      });

    } catch (error: any) {
      console.error('Error getting payment methods:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment methods',
        error: error.message,
      });
    }
  }

  /**
   * Mendapatkan riwayat transaksi
   */
  async getTransactionHistory(req: Request, res: Response): Promise<void> {
    try {
      const {
        customerId,
        status,
        limit = 50,
        offset = 0,
      } = req.query;

      const history = await this.paymentService.getTransactionHistory(
        customerId ? parseInt(customerId as string) : undefined,
        status as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        data: history,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: history.length,
        },
      });

    } catch (error: any) {
      console.error('Error getting transaction history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get transaction history',
        error: error.message,
      });
    }
  }

  /**
   * Webhook handler untuk Xendit
   */
  async xenditWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-xendit-signature'] as string;
      const payload = req.body;

      if (!signature) {
        res.status(400).json({
          success: false,
          message: 'Missing signature header',
        });
        return;
      }

      await this.paymentService.processWebhook('xendit', payload, signature);

      res.json({
        success: true,
        message: 'Webhook processed successfully',
      });

    } catch (error: any) {
      console.error('Error processing Xendit webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message,
      });
    }
  }

  /**
   * Webhook handler untuk Mitra
   */
  async mitraWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-mitra-signature'] as string;
      const payload = req.body;

      if (!signature) {
        res.status(400).json({
          success: false,
          message: 'Missing signature header',
        });
        return;
      }

      await this.paymentService.processWebhook('mitra', payload, signature);

      res.json({
        success: true,
        message: 'Webhook processed successfully',
      });

    } catch (error: any) {
      console.error('Error processing Mitra webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message,
      });
    }
  }

  /**
   * Webhook handler untuk Tripay
   */
  async tripayWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['x-tripay-signature'] as string;
      const payload = req.body;

      if (!signature) {
        res.status(400).json({
          success: false,
          message: 'Missing signature header',
        });
        return;
      }

      await this.paymentService.processWebhook('tripay', payload, signature);

      res.json({
        success: true,
        message: 'Webhook processed successfully',
      });

    } catch (error: any) {
      console.error('Error processing Tripay webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: error.message,
      });
    }
  }

  /**
   * Mendapatkan konfigurasi payment gateway
   */
  async getGatewayConfig(req: Request, res: Response): Promise<void> {
    try {
      // Ambil konfigurasi dari database
      const { databasePool } = await import('../../db/pool');
      const connection = await databasePool.getConnection();

      try {
        const [rows] = await connection.execute(
          'SELECT * FROM payment_gateways WHERE is_active = TRUE'
        );

        res.json({
          success: true,
          data: rows,
        });

      } finally {
        connection.release();
      }

    } catch (error: any) {
      console.error('Error getting gateway config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get gateway configuration',
        error: error.message,
      });
    }
  }

  /**
   * Update konfigurasi payment gateway
   */
  async updateGatewayConfig(req: Request, res: Response): Promise<void> {
    try {
      const { gatewayId } = req.params;
      const { apiKey, secretKey, webhookSecret, isActive } = req.body;

      const { databasePool } = await import('../../db/pool');
      const connection = await databasePool.getConnection();

      try {
        await connection.execute(
          `UPDATE payment_gateways 
           SET api_key = ?, secret_key = ?, webhook_secret = ?, is_active = ?, updated_at = NOW()
           WHERE id = ?`,
          [apiKey, secretKey, webhookSecret, isActive, gatewayId]
        );

        res.json({
          success: true,
          message: 'Gateway configuration updated successfully',
        });

      } finally {
        connection.release();
      }

    } catch (error: any) {
      console.error('Error updating gateway config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update gateway configuration',
        error: error.message,
      });
    }
  }

  /**
   * Refresh status transaksi
   */
  async refreshTransactionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;

      if (!transactionId) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID is required',
        });
        return;
      }

      // Ambil status terbaru dari gateway
      const updatedStatus = await this.paymentService.getPaymentStatus(transactionId);

      res.json({
        success: true,
        message: 'Transaction status refreshed successfully',
        data: updatedStatus,
      });

    } catch (error: any) {
      console.error('Error refreshing transaction status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh transaction status',
        error: error.message,
      });
    }
  }

  /**
   * Batalkan transaksi
   */
  async cancelTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;

      if (!transactionId) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID is required',
        });
        return;
      }

      // Ambil detail transaksi
      const transaction = await this.paymentService.getPaymentStatus(transactionId);
      
      if (!transaction) {
        res.status(404).json({
          success: false,
          message: 'Transaction not found',
        });
        return;
      }

      // Cek apakah transaksi bisa dibatalkan
      if (transaction.status !== 'pending' && transaction.status !== 'processing') {
        res.status(400).json({
          success: false,
          message: 'Transaction cannot be cancelled. Only pending or processing transactions can be cancelled.',
        });
        return;
      }

      // Update status ke cancelled
      const { databasePool } = await import('../../db/pool');
      const connection = await databasePool.getConnection();

      try {
        await connection.execute(
          'UPDATE payment_transactions SET status = ?, updated_at = NOW() WHERE external_id = ?',
          ['cancelled', transactionId]
        );

        res.json({
          success: true,
          message: 'Transaction cancelled successfully',
        });

      } finally {
        connection.release();
      }

    } catch (error: any) {
      console.error('Error cancelling transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel transaction',
        error: error.message,
      });
    }
  }
}
