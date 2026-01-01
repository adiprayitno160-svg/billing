import { Request, Response } from 'express';
import { BillingPaymentIntegration } from '../../services/payment/BillingPaymentIntegration';
import { PaymentGatewayService } from '../../services/payment/PaymentGatewayService';

export class BillingPaymentController {
  private billingPaymentService: BillingPaymentIntegration;

  constructor() {
    // Initialize payment service with configuration
    const paymentConfig = {
      xendit: {
        apiKey: process.env.XENDIT_API_KEY || '',
        secretKey: process.env.XENDIT_SECRET_KEY || '',
        baseUrl: process.env.XENDIT_BASE_URL || 'https://api.xendit.co',
        webhookSecret: process.env.XENDIT_WEBHOOK_SECRET || '',
      },
      mitra: {
        apiKey: process.env.MITRA_API_KEY || '',
        secretKey: process.env.MITRA_SECRET_KEY || '',
        baseUrl: process.env.MITRA_BASE_URL || 'https://api.mitra.com',
        webhookSecret: process.env.MITRA_WEBHOOK_SECRET || '',
      },
      tripay: {
        apiKey: process.env.TRIPAY_API_KEY || '',
        secretKey: process.env.TRIPAY_SECRET_KEY || '',
        baseUrl: process.env.TRIPAY_BASE_URL || 'https://tripay.co.id/api',
        webhookSecret: process.env.TRIPAY_WEBHOOK_SECRET || '',
        merchantCode: process.env.TRIPAY_MERCHANT_CODE || '',
      },
    };

    const paymentService = new PaymentGatewayService(paymentConfig);
    this.billingPaymentService = new BillingPaymentIntegration(paymentService);
  }

  /**
   * Membuat payment untuk invoice
   */
  async createInvoicePayment(req: Request, res: Response): Promise<void> {
    try {
      const {
        invoiceId,
        customerId,
        gatewayCode,
        paymentMethod,
        callbackUrl,
        redirectUrl,
      } = req.body;

      // Validasi input
      if (!invoiceId || !customerId || !gatewayCode || !paymentMethod) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
          errors: {
            invoiceId: !invoiceId ? 'Invoice ID is required' : undefined,
            customerId: !customerId ? 'Customer ID is required' : undefined,
            gatewayCode: !gatewayCode ? 'Gateway code is required' : undefined,
            paymentMethod: !paymentMethod ? 'Payment method is required' : undefined,
          },
        });
        return;
      }

      const result = await this.billingPaymentService.createInvoicePayment({
        invoiceId: parseInt(invoiceId),
        customerId: parseInt(customerId),
        gatewayCode,
        paymentMethod,
        callbackUrl,
        redirectUrl,
      });

      res.json(result);

    } catch (error: any) {
      console.error('Error creating invoice payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create invoice payment',
        error: error.message,
      });
    }
  }

  /**
   * Mendapatkan invoice dengan payment options
   */
  async getInvoiceWithPaymentOptions(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId, customerId } = req.params;

      if (!invoiceId || !customerId) {
        res.status(400).json({
          success: false,
          message: 'Invoice ID and Customer ID are required',
        });
        return;
      }

      const result = await this.billingPaymentService.getInvoiceWithPaymentOptions(
        parseInt(invoiceId),
        parseInt(customerId)
      );

      res.json({
        success: true,
        data: result,
      });

    } catch (error: any) {
      console.error('Error getting invoice with payment options:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get invoice with payment options',
        error: error.message,
      });
    }
  }

  /**
   * Mendapatkan payment history untuk customer
   */
  async getCustomerPaymentHistory(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!customerId) {
        res.status(400).json({
          success: false,
          message: 'Customer ID is required',
        });
        return;
      }

      const history = await this.billingPaymentService.getCustomerPaymentHistory(
        parseInt(customerId),
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
      console.error('Error getting customer payment history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get customer payment history',
        error: error.message,
      });
    }
  }

  /**
   * Mendapatkan payment statistics
   */
  async getPaymentStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await this.billingPaymentService.getPaymentStatistics();

      res.json({
        success: true,
        data: statistics,
      });

    } catch (error: any) {
      console.error('Error getting payment statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment statistics',
        error: error.message,
      });
    }
  }

  /**
   * Mendapatkan available payment methods
   */
  async getAvailablePaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const { customerId } = req.params;

      if (!customerId) {
        res.status(400).json({
          success: false,
          message: 'Customer ID is required',
        });
        return;
      }

      const methods = await this.billingPaymentService.getAvailablePaymentMethods(
        parseInt(customerId)
      );

      res.json({
        success: true,
        data: methods,
      });

    } catch (error: any) {
      console.error('Error getting available payment methods:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available payment methods',
        error: error.message,
      });
    }
  }

  /**
   * Membuat payment link untuk invoice
   */
  async createPaymentLink(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId, customerId } = req.params;

      if (!invoiceId || !customerId) {
        res.status(400).json({
          success: false,
          message: 'Invoice ID and Customer ID are required',
        });
        return;
      }

      const paymentLink = await this.billingPaymentService.createPaymentLink(
        parseInt(invoiceId),
        parseInt(customerId)
      );

      res.json({
        success: true,
        data: {
          paymentLink,
        },
      });

    } catch (error: any) {
      console.error('Error creating payment link:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment link',
        error: error.message,
      });
    }
  }

  /**
   * Memproses payment success
   */
  async processPaymentSuccess(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;

      if (!transactionId) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID is required',
        });
        return;
      }

      await this.billingPaymentService.processPaymentSuccess(transactionId);

      res.json({
        success: true,
        message: 'Payment success processed',
      });

    } catch (error: any) {
      console.error('Error processing payment success:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process payment success',
        error: error.message,
      });
    }
  }

  /**
   * Memproses payment failure
   */
  async processPaymentFailure(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;

      if (!transactionId) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID is required',
        });
        return;
      }

      await this.billingPaymentService.processPaymentFailure(
        transactionId,
        reason || 'Payment failed'
      );

      res.json({
        success: true,
        message: 'Payment failure processed',
      });

    } catch (error: any) {
      console.error('Error processing payment failure:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process payment failure',
        error: error.message,
      });
    }
  }
  /**
   * Apply discount code
   */
  async applyDiscount(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId, code } = req.body;
      // Get user ID from auth context if available, otherwise 0 or system
      const userId = (req as any).user?.id || 0;

      if (!invoiceId || !code) {
        res.status(400).json({ success: false, message: 'Invoice ID and code are required' });
        return;
      }

      const { DiscountService } = await import('../../services/billing/discountService');
      const result = await DiscountService.applyMarketingDiscount(parseInt(invoiceId), code, userId);

      res.json(result);
    } catch (error: any) {
      console.error('Error applying discount:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to apply discount',
        error: error.message
      });
    }
  }
}
