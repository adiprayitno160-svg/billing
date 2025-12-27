"use strict";
/**
 * Prepaid Portal Payment Controller
 * Customer portal untuk pilih paket dan bayar
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const PrepaidPackageService_1 = require("../../services/prepaid/PrepaidPackageService");
const PrepaidPaymentService_1 = require("../../services/prepaid/PrepaidPaymentService");
const PaymentGatewayService_1 = require("../../services/payment/PaymentGatewayService");
const pool_1 = __importDefault(require("../../db/pool"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
// Configure multer for payment proof upload
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        else {
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
    async selectPackage(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            if (!customerId) {
                return res.redirect('/prepaid/portal/login');
            }
            // Detect customer connection type
            const connectionType = await PrepaidPackageService_1.PrepaidPackageService.getCustomerConnectionType(customerId);
            if (!connectionType) {
                return res.render('prepaid/portal/select-package', {
                    title: 'Pilih Paket',
                    packages: [],
                    error: 'Connection type tidak terdeteksi. Hubungi admin.',
                });
            }
            // Get packages for this connection type
            const packages = await PrepaidPackageService_1.PrepaidPackageService.getActivePackagesByType(connectionType);
            res.render('prepaid/portal/select-package', {
                title: 'Pilih Paket Internet',
                packages,
                connectionType,
                error: req.query.error,
            });
        }
        catch (error) {
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
    async reviewPackage(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            const packageId = parseInt(req.params.package_id);
            if (!customerId) {
                return res.redirect('/prepaid/portal/login');
            }
            const packageData = await PrepaidPackageService_1.PrepaidPackageService.getPackageById(packageId);
            if (!packageData || !packageData.is_active) {
                return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Paket tidak tersedia'));
            }
            res.render('prepaid/portal/review-package', {
                title: 'Review Paket',
                package: packageData,
            });
        }
        catch (error) {
            console.error('[PrepaidPortalPaymentController] Error in reviewPackage:', error);
            res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load package'));
        }
    }
    /**
     * Step 3: Select payment method
     */
    async selectPaymentMethod(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            const packageId = parseInt(req.body.package_id);
            // Get custom speed from form (for static IP packages)
            const customDownloadMbps = req.body.custom_download_mbps ? parseFloat(req.body.custom_download_mbps) : undefined;
            const customUploadMbps = req.body.custom_upload_mbps ? parseFloat(req.body.custom_upload_mbps) : undefined;
            if (!customerId) {
                return res.redirect('/prepaid/portal/login');
            }
            const packageData = await PrepaidPackageService_1.PrepaidPackageService.getPackageById(packageId);
            if (!packageData) {
                return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Paket tidak ditemukan'));
            }
            // Store custom speed in session for later use
            if (req.session) {
                req.session.selectedPackageCustomSpeed = {
                    download_mbps: customDownloadMbps,
                    upload_mbps: customUploadMbps
                };
            }
            // Get payment settings
            const paymentSettings = await PrepaidPaymentService_1.PrepaidPaymentService.getPaymentSettings();
            res.render('prepaid/portal/payment-method', {
                title: 'Pilih Metode Pembayaran',
                package: packageData,
                paymentSettings,
                customSpeed: { download_mbps: customDownloadMbps, upload_mbps: customUploadMbps },
            });
        }
        catch (error) {
            console.error('[PrepaidPortalPaymentController] Error in selectPaymentMethod:', error);
            res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load payment methods'));
        }
    }
    /**
     * Step 4A: Process manual transfer (with proof upload)
     */
    async processManualTransfer(req, res) {
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
                const packageData = await PrepaidPackageService_1.PrepaidPackageService.getPackageById(packageId);
                if (!packageData) {
                    return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Paket tidak ditemukan'));
                }
                // Get custom speed from session or form
                const sessionCustomSpeed = req.session?.selectedPackageCustomSpeed;
                const customDownloadMbps = req.body.custom_download_mbps ? parseFloat(req.body.custom_download_mbps) : (sessionCustomSpeed?.download_mbps);
                const customUploadMbps = req.body.custom_upload_mbps ? parseFloat(req.body.custom_upload_mbps) : (sessionCustomSpeed?.upload_mbps);
                // Store custom speed in payment notes (will be used during activation)
                let paymentNotes = req.body.notes || '';
                if ((customDownloadMbps || customUploadMbps) && packageData.connection_type === 'static') {
                    const speedInfo = `Custom Speed: ${customDownloadMbps || packageData.download_mbps}Mbps/${customUploadMbps || packageData.upload_mbps}Mbps`;
                    paymentNotes = paymentNotes ? `${paymentNotes} | ${speedInfo}` : speedInfo;
                }
                // Create transaction
                const transactionId = await PrepaidPaymentService_1.PrepaidPaymentService.createTransaction({
                    customer_id: customerId,
                    package_id: packageId,
                    amount: packageData.price,
                    payment_method: 'manual_transfer',
                    payment_status: 'pending',
                    payment_notes: paymentNotes || null,
                });
                // Save payment proof if uploaded
                if (req.file) {
                    await PrepaidPaymentService_1.PrepaidPaymentService.savePaymentProof(req.file, transactionId);
                }
                // Redirect to waiting page
                res.redirect(`/prepaid/portal/payment/waiting/${transactionId}`);
            }
            catch (error) {
                console.error('[PrepaidPortalPaymentController] Error processing manual transfer:', error);
                res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to process payment'));
            }
        });
    }
    /**
     * Step 4B: Process payment gateway
     * Integrated with PaymentGatewayService (Xendit, Mitra, Tripay)
     */
    async processPaymentGateway(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            const packageId = parseInt(req.body.package_id);
            const gatewayCode = req.body.gateway; // 'xendit', 'mitra', or 'tripay'
            const paymentMethod = req.body.payment_method || 'invoice'; // Default to invoice
            if (!customerId) {
                return res.redirect('/prepaid/portal/login');
            }
            const packageData = await PrepaidPackageService_1.PrepaidPackageService.getPackageById(packageId);
            if (!packageData) {
                return res.redirect('/prepaid/packages?error=' + encodeURIComponent('Paket tidak ditemukan'));
            }
            // Get customer info
            const [customerRows] = await pool_1.default.query('SELECT * FROM customers WHERE id = ?', [customerId]);
            if (customerRows.length === 0) {
                return res.redirect('/prepaid/portal/login');
            }
            const customer = customerRows[0];
            // Get gateway configuration from database
            const [gatewayRows] = await pool_1.default.query(`SELECT * FROM payment_gateways WHERE code = ? AND is_active = 1`, [gatewayCode]);
            if (gatewayRows.length === 0) {
                console.error(`[PrepaidPortalPaymentController] Gateway ${gatewayCode} not found or inactive`);
                return res.redirect('/prepaid/portal/packages?error=' + encodeURIComponent('Payment gateway tidak tersedia'));
            }
            const gatewayConfig = gatewayRows[0];
            // Create prepaid transaction first
            const transactionId = await PrepaidPaymentService_1.PrepaidPaymentService.createTransaction({
                customer_id: customerId,
                package_id: packageId,
                amount: packageData.price,
                payment_method: 'payment_gateway',
                payment_status: 'pending',
                payment_gateway_type: gatewayCode,
            });
            // Initialize PaymentGatewayService with config from database
            const paymentService = new PaymentGatewayService_1.PaymentGatewayService({
                xendit: {
                    apiKey: gatewayConfig?.api_key || '',
                    secretKey: gatewayConfig?.secret_key || '',
                    webhookSecret: gatewayConfig?.webhook_secret || '',
                    baseUrl: gatewayConfig?.base_url || undefined
                },
                mitra: {
                    apiKey: gatewayConfig?.api_key || '',
                    secretKey: gatewayConfig?.secret_key || '',
                    webhookSecret: gatewayConfig?.webhook_secret || '',
                    baseUrl: gatewayConfig?.base_url || undefined
                },
                tripay: {
                    apiKey: gatewayConfig.api_key || '',
                    secretKey: gatewayConfig.secret_key || '',
                    merchantCode: gatewayConfig.merchant_code || '',
                    webhookSecret: gatewayConfig.webhook_secret || '',
                    baseUrl: gatewayConfig.base_url || undefined
                }
            });
            // Create payment request
            const paymentRequest = {
                invoiceId: transactionId, // Use transaction ID as invoice ID reference
                customerId: customerId,
                amount: packageData.price,
                currency: 'IDR',
                description: `Pembayaran Paket Prepaid: ${packageData.name}`,
                paymentMethod: paymentMethod,
                gatewayCode: gatewayCode,
                customerName: customer.name || 'Customer',
                customerEmail: customer.email || undefined,
                customerPhone: customer.phone || undefined,
                callbackUrl: `${req.protocol}://${req.get('host')}/prepaid/portal/payment/success/${transactionId}`,
                redirectUrl: `${req.protocol}://${req.get('host')}/prepaid/portal/payment/waiting/${transactionId}`,
                expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours expiry
            };
            // Create payment via gateway
            const paymentResponse = await paymentService.createPayment(paymentRequest);
            // Update transaction with gateway reference
            await pool_1.default.query(`UPDATE prepaid_transactions 
         SET payment_gateway_reference = ?, 
             payment_status = 'pending',
             updated_at = NOW()
         WHERE id = ?`, [paymentResponse.transactionId, transactionId]);
            // Redirect based on payment response
            if (paymentResponse.paymentUrl) {
                // Redirect to payment URL (for invoice-based payments)
                return res.redirect(paymentResponse.paymentUrl);
            }
            else if (paymentResponse.accountNumber) {
                // Show virtual account details
                return res.render('prepaid/portal/payment-gateway', {
                    title: 'Virtual Account',
                    layout: false,
                    package: packageData,
                    transactionId,
                    gateway: gatewayCode,
                    accountNumber: paymentResponse.accountNumber,
                    accountName: paymentResponse.accountName,
                    bankCode: paymentResponse.bankCode,
                    expiryDate: paymentResponse.expiryDate,
                    amount: packageData.price
                });
            }
            else {
                // Fallback to waiting page
                return res.redirect(`/prepaid/portal/payment/waiting/${transactionId}`);
            }
        }
        catch (error) {
            console.error('[PrepaidPortalPaymentController] Error processing payment gateway:', error);
            res.redirect('/prepaid/portal/packages?error=' + encodeURIComponent(`Gagal memproses pembayaran: ${error.message || 'Unknown error'}`));
        }
    }
    /**
     * Step 5: Waiting page (after payment submission)
     */
    async showWaitingPage(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            const { transaction_id } = req.params;
            if (!transaction_id) {
                return res.status(400).json({ success: false, error: 'transaction_id is required' });
            }
            const transactionId = parseInt(transaction_id);
            if (!customerId) {
                return res.redirect('/prepaid/portal/login');
            }
            const transaction = await PrepaidPaymentService_1.PrepaidPaymentService.getTransactionById(transactionId);
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
        }
        catch (error) {
            console.error('[PrepaidPortalPaymentController] Error in showWaitingPage:', error);
            res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load payment status'));
        }
    }
    /**
     * Step 6: Success page (after activation)
     */
    async showSuccessPage(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            const { transaction_id } = req.params;
            if (!transaction_id) {
                return res.status(400).json({ success: false, error: 'transaction_id is required' });
            }
            const transactionId = parseInt(transaction_id);
            if (!customerId) {
                return res.redirect('/prepaid/portal/login');
            }
            const transaction = await PrepaidPaymentService_1.PrepaidPaymentService.getTransactionById(transactionId);
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
        }
        catch (error) {
            console.error('[PrepaidPortalPaymentController] Error in showSuccessPage:', error);
            res.redirect('/prepaid/packages?error=' + encodeURIComponent('Failed to load success page'));
        }
    }
    /**
     * API: Check payment status (AJAX polling)
     */
    async checkPaymentStatus(req, res) {
        try {
            const customerId = req.session.portalCustomerId;
            const { transaction_id } = req.params;
            if (!transaction_id) {
                return res.status(400).json({ success: false, error: 'transaction_id is required' });
            }
            const transactionId = parseInt(transaction_id);
            if (!customerId) {
                return res.json({ success: false, error: 'Not authenticated' });
            }
            const transaction = await PrepaidPaymentService_1.PrepaidPaymentService.getTransactionById(transactionId);
            if (!transaction || transaction.customer_id !== customerId) {
                res.json({ success: false, error: 'Transaction not found' });
                return;
            }
            res.json({
                success: true,
                status: transaction.payment_status,
                redirect: transaction.payment_status === 'verified' || transaction.payment_status === 'paid'
                    ? `/prepaid/portal/payment/success/${transactionId}`
                    : null,
            });
        }
        catch (error) {
            console.error('[PrepaidPortalPaymentController] Error checking payment status:', error);
            res.json({ success: false, error: 'Failed to check status' });
        }
    }
}
exports.default = new PrepaidPortalPaymentController();
//# sourceMappingURL=PrepaidPortalPaymentController.js.map