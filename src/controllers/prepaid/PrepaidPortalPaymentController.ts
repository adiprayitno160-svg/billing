/**
 * Prepaid Portal Payment Controller
 * Customer portal untuk pilih paket dan bayar
 */

import { Request, Response } from 'express';
import { PrepaidPackageService } from '../../services/prepaid/PrepaidPackageService';
import { PrepaidPaymentService } from '../../services/prepaid/PrepaidPaymentService';
import multer from 'multer';
import path from 'path';

// Configure multer for payment proof upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPG, PNG) and PDF are allowed!'));
    }
  },
}).single('payment_proof');

class PrepaidPortalPaymentController {
  constructor() {
    this.selectPackage = this.selectPackage.bind(this);
    this.reviewPackage = this.reviewPackage.bind(this);
    this.selectPaymentMethod = this.selectPaymentMethod.bind(this);
    this.processManualTransfer = this.processManualTransfer.bind(this);
    this.processPaymentGateway = this.processPaymentGateway.bind(this);
    this.showWaitingPage = this.showWaitingPage.bind(this);
    this.showSuccessPage = this.showSuccessPage.bind(this);
    this.checkPaymentStatus = this.checkPaymentStatus.bind(this);
  }

  /**
   * Step 1: Display available packages (filtered by customer connection type)
   */
  async selectPackage(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.session.portalCustomerId;

      if (!customerId) {
        return res.redirect('/prepaid/portal/login');
      }

      // Detect customer connection type
      const connectionType = await PrepaidPackageService.getCustomerConnectionType(customerId);

      if (!connectionType) {
        return res.render('prepaid/portal/select-package', {
          title: 'Pilih Paket',
          packages: [],
          error: 'Connection type tidak terdeteksi. Hubungi admin.',
        });
      }

      // Get packages for this connection type
      const packages = await PrepaidPackageService.getActivePackagesByType(connectionType);

      res.render('prepaid/portal/select-package', {
        title: 'Pilih Paket Internet',
        packages,
        connectionType,
        error: req.query.error,
      });
    } catch (error) {
      console.error('[PrepaidPortalPaymentController] Error in selectPackage:', error);
      res.status(500).render('error', {
        message: 'Failed to load packages',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Step 2: Review selected package before payment
   */
  async reviewPackage(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.session.portalCustomerId;
      const packageId = parseInt(req.params.package_id);

      if (!customerId) {
        return res.redirect('/prepaid/portal/login');
      }

      const packageData = await PrepaidPackageService.getPackageById(packageId);

      if (!packageData || !packageData.is_active) {
        return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Paket tidak tersedia'));
      }

      res.render('prepaid/portal/review-package', {
        title: 'Review Paket',
        package: packageData,
      });
    } catch (error) {
      console.error('[PrepaidPortalPaymentController] Error in reviewPackage:', error);
      res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load package'));
    }
  }

  /**
   * Step 3: Select payment method
   */
  async selectPaymentMethod(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.session.portalCustomerId;
      const packageId = parseInt(req.body.package_id);

      if (!customerId) {
        return res.redirect('/prepaid/portal/login');
      }

      const packageData = await PrepaidPackageService.getPackageById(packageId);
      if (!packageData) {
        return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Paket tidak ditemukan'));
      }

      // Get payment settings
      const paymentSettings = await PrepaidPaymentService.getPaymentSettings();

      res.render('prepaid/portal/payment-method', {
        title: 'Pilih Metode Pembayaran',
        package: packageData,
        paymentSettings,
      });
    } catch (error) {
      console.error('[PrepaidPortalPaymentController] Error in selectPaymentMethod:', error);
      res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load payment methods'));
    }
  }

  /**
   * Step 4A: Process manual transfer (with proof upload)
   */
  async processManualTransfer(req: Request, res: Response): Promise<void> {
    upload(req, res, async (err) => {
      try {
        if (err) {
          console.error('[PrepaidPortalPaymentController] Upload error:', err);
          return res.redirect('/prepaid/packages?error=' + encodeURIComponent(err.message));
        }

        const customerId = req.session.portalCustomerId;
        const packageId = parseInt(req.body.package_id);

        if (!customerId) {
          return res.redirect('/prepaid/portal/login');
        }

        const packageData = await PrepaidPackageService.getPackageById(packageId);
        if (!packageData) {
          return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Paket tidak ditemukan'));
        }

        // Create transaction
        const transactionId = await PrepaidPaymentService.createTransaction({
          customer_id: customerId,
          package_id: packageId,
          amount: packageData.price,
          payment_method: 'manual_transfer',
          payment_status: 'pending',
          payment_notes: req.body.notes || null,
        });

        // Save payment proof if uploaded
        if (req.file) {
          await PrepaidPaymentService.savePaymentProof(req.file, transactionId);
        }

        // Redirect to waiting page
        res.redirect(`/prepaid/portal/payment/waiting/${transactionId}`);
      } catch (error) {
        console.error('[PrepaidPortalPaymentController] Error processing manual transfer:', error);
        res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to process payment'));
      }
    });
  }

  /**
   * Step 4B: Process payment gateway
   * TODO: Implement Midtrans/Xendit integration
   */
  async processPaymentGateway(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.session.portalCustomerId;
      const packageId = parseInt(req.body.package_id);
      const gateway = req.body.gateway; // 'midtrans' or 'xendit'

      if (!customerId) {
        return res.redirect('/prepaid/portal/login');
      }

      const packageData = await PrepaidPackageService.getPackageById(packageId);
      if (!packageData) {
        return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Paket tidak ditemukan'));
      }

      // Create transaction
      const transactionId = await PrepaidPaymentService.createTransaction({
        customer_id: customerId,
        package_id: packageId,
        amount: packageData.price,
        payment_method: 'payment_gateway',
        payment_status: 'pending',
        payment_gateway_type: gateway,
      });

      // TODO: Integrate dengan payment gateway
      // For now, redirect to waiting page with info
      res.render('prepaid/portal/payment-gateway', {
        title: 'Payment Gateway',
        package: packageData,
        transactionId,
        gateway,
        message: 'Payment gateway integration will be implemented next. For now, use manual transfer.',
      });
    } catch (error) {
      console.error('[PrepaidPortalPaymentController] Error processing payment gateway:', error);
      res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to process payment'));
    }
  }

  /**
   * Step 5: Waiting page (after payment submission)
   */
  async showWaitingPage(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.session.portalCustomerId;
      const transactionId = parseInt(req.params.transaction_id);

      if (!customerId) {
        return res.redirect('/prepaid/portal/login');
      }

      const transaction = await PrepaidPaymentService.getTransactionById(transactionId);

      if (!transaction || transaction.customer_id !== customerId) {
        return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Transaction not found'));
      }

      // If already verified/paid, redirect to success page
      if (transaction.payment_status === 'verified' || transaction.payment_status === 'paid') {
        return res.redirect(`/prepaid/portal/payment/success/${transactionId}`);
      }

      // If rejected, show error
      if (transaction.payment_status === 'rejected') {
        return res.render('prepaid/portal/payment-waiting', {
          title: 'Pembayaran Ditolak',
          transaction,
          status: 'rejected',
          message: transaction.rejected_reason || 'Pembayaran ditolak oleh admin',
        });
      }

      // Otherwise, show waiting
      res.render('prepaid/portal/payment-waiting', {
        title: 'Menunggu Verifikasi',
        transaction,
        status: 'pending',
      });
    } catch (error) {
      console.error('[PrepaidPortalPaymentController] Error in showWaitingPage:', error);
      res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load payment status'));
    }
  }

  /**
   * Step 6: Success page (after activation)
   */
  async showSuccessPage(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.session.portalCustomerId;
      const transactionId = parseInt(req.params.transaction_id);

      if (!customerId) {
        return res.redirect('/prepaid/portal/login');
      }

      const transaction = await PrepaidPaymentService.getTransactionById(transactionId);

      if (!transaction || transaction.customer_id !== customerId) {
        return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Transaction not found'));
      }

      if (transaction.payment_status !== 'verified' && transaction.payment_status !== 'paid') {
        return res.redirect(`/prepaid/portal/payment/waiting/${transactionId}`);
      }

      res.render('prepaid/portal/payment-success', {
        title: 'Pembayaran Berhasil',
        transaction,
      });
    } catch (error) {
      console.error('[PrepaidPortalPaymentController] Error in showSuccessPage:', error);
      res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load success page'));
    }
  }

  /**
   * API: Check payment status (AJAX polling)
   */
  async checkPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const customerId = req.session.portalCustomerId;
      const transactionId = parseInt(req.params.transaction_id);

      if (!customerId) {
        return res.json({ success: false, error: 'Not authenticated' });
      }

      const transaction = await PrepaidPaymentService.getTransactionById(transactionId);

      if (!transaction || transaction.customer_id !== customerId) {
        return res.json({ success: false, error: 'Transaction not found' });
      }

      res.json({
        success: true,
        status: transaction.payment_status,
        redirect: transaction.payment_status === 'verified' || transaction.payment_status === 'paid'
          ? `/prepaid/portal/payment/success/${transactionId}`
          : null,
      });
    } catch (error) {
      console.error('[PrepaidPortalPaymentController] Error checking payment status:', error);
      res.json({ success: false, error: 'Failed to check status' });
    }
  }
}

export default new PrepaidPortalPaymentController();

