/**
 * Prepaid Admin Payment Controller
 * Admin panel untuk verifikasi pembayaran manual transfer
 */

import { Request, Response } from 'express';
import { PrepaidPaymentService } from '../../services/prepaid/PrepaidPaymentService';
import PrepaidActivationService from '../../services/prepaid/PrepaidActivationService';

class PrepaidAdminPaymentController {
  constructor() {
    this.index = this.index.bind(this);
    this.verifyPayment = this.verifyPayment.bind(this);
    this.rejectPayment = this.rejectPayment.bind(this);
    this.viewPaymentProof = this.viewPaymentProof.bind(this);
    this.getPaymentStatistics = this.getPaymentStatistics.bind(this);
  }

  /**
   * Payment verification dashboard
   */
  async index(req: Request, res: Response): Promise<void> {
    try {
      const pendingPayments = await PrepaidPaymentService.getPendingTransactions();

      // Get statistics for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const statistics = await PrepaidPaymentService.getPaymentStatistics(today, tomorrow);

      res.render('prepaid/admin/payment-verification', {
        title: 'Verifikasi Pembayaran Prepaid',
        pendingPayments,
        statistics,
        success: req.query.success,
        error: req.query.error,
      });
    } catch (error) {
      console.error('[PrepaidAdminPaymentController] Error in index:', error);
      res.status(500).render('error', {
        message: 'Failed to load payment verification',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Approve/verify payment
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = parseInt(req.params.transaction_id);
      const adminId = req.session.userId;
      const notes = req.body.notes || '';

      if (!adminId) {
        return res.json({ success: false, error: 'Not authenticated' });
      }

      // Verify payment in database
      await PrepaidPaymentService.verifyPayment(transactionId, adminId, notes);

      // Activate package
      const activationResult = await PrepaidActivationService.activateFromTransaction(transactionId);

      if (!activationResult.success) {
        console.error('[PrepaidAdminPaymentController] Activation failed:', activationResult.error);
        
        // Payment verified but activation failed
        return res.json({
          success: false,
          error: 'Payment verified but activation failed: ' + activationResult.error,
        });
      }

      // TODO: Send WhatsApp notification to customer
      // TODO: Send Telegram notification to admin

      res.json({
        success: true,
        message: 'Pembayaran berhasil diverifikasi dan paket diaktifkan',
        subscription_id: activationResult.subscription_id,
      });
    } catch (error) {
      console.error('[PrepaidAdminPaymentController] Error verifying payment:', error);
      res.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify payment',
      });
    }
  }

  /**
   * Reject payment
   */
  async rejectPayment(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = parseInt(req.params.transaction_id);
      const adminId = req.session.userId;
      const reason = req.body.reason || 'No reason provided';

      if (!adminId) {
        return res.json({ success: false, error: 'Not authenticated' });
      }

      await PrepaidPaymentService.rejectPayment(transactionId, adminId, reason);

      // TODO: Send WhatsApp notification to customer

      res.json({
        success: true,
        message: 'Pembayaran berhasil ditolak',
      });
    } catch (error) {
      console.error('[PrepaidAdminPaymentController] Error rejecting payment:', error);
      res.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject payment',
      });
    }
  }

  /**
   * View payment proof (image/PDF)
   */
  async viewPaymentProof(req: Request, res: Response): Promise<void> {
    try {
      const transactionId = parseInt(req.params.transaction_id);
      const transaction = await PrepaidPaymentService.getTransactionById(transactionId);

      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      if (!transaction.payment_proof_url) {
        return res.status(404).json({ success: false, error: 'No payment proof uploaded' });
      }

      res.json({
        success: true,
        proof_url: transaction.payment_proof_url,
      });
    } catch (error) {
      console.error('[PrepaidAdminPaymentController] Error viewing payment proof:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load payment proof',
      });
    }
  }

  /**
   * Get payment statistics (for dashboard widgets)
   */
  async getPaymentStatistics(req: Request, res: Response): Promise<void> {
    try {
      const dateFrom = req.query.from ? new Date(req.query.from as string) : undefined;
      const dateTo = req.query.to ? new Date(req.query.to as string) : undefined;

      const statistics = await PrepaidPaymentService.getPaymentStatistics(dateFrom, dateTo);

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error('[PrepaidAdminPaymentController] Error getting statistics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get statistics',
      });
    }
  }
}

export default new PrepaidAdminPaymentController();

