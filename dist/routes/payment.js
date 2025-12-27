"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PaymentController_1 = require("../controllers/payment/PaymentController");
const PaymentGatewayService_1 = require("../services/payment/PaymentGatewayService");
const BillingPaymentController_1 = require("../controllers/payment/BillingPaymentController");
const router = (0, express_1.Router)();
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
const paymentService = new PaymentGatewayService_1.PaymentGatewayService(paymentConfig);
const paymentController = new PaymentController_1.PaymentController(paymentService);
const billingPaymentController = new BillingPaymentController_1.BillingPaymentController();
// Payment routes
router.post('/create', (req, res) => paymentController.createPayment(req, res));
router.get('/status/:transactionId', (req, res) => paymentController.getPaymentStatus(req, res));
router.get('/methods', (req, res) => paymentController.getPaymentMethods(req, res));
router.get('/history', (req, res) => paymentController.getTransactionHistory(req, res));
router.post('/refresh/:transactionId', (req, res) => paymentController.refreshTransactionStatus(req, res));
router.post('/cancel/:transactionId', (req, res) => paymentController.cancelTransaction(req, res));
// Gateway configuration routes
router.get('/gateways', (req, res) => paymentController.getGatewayConfig(req, res));
router.put('/gateways/:gatewayId', (req, res) => paymentController.updateGatewayConfig(req, res));
// Billing Payment Integration routes
router.post('/billing/create', (req, res) => billingPaymentController.createInvoicePayment(req, res));
router.get('/billing/invoice/:invoiceId/:customerId', (req, res) => billingPaymentController.getInvoiceWithPaymentOptions(req, res));
router.get('/billing/customer/:customerId/history', (req, res) => billingPaymentController.getCustomerPaymentHistory(req, res));
router.get('/billing/statistics', (req, res) => billingPaymentController.getPaymentStatistics(req, res));
router.get('/billing/customer/:customerId/methods', (req, res) => billingPaymentController.getAvailablePaymentMethods(req, res));
router.get('/billing/invoice/:invoiceId/:customerId/link', (req, res) => billingPaymentController.createPaymentLink(req, res));
router.post('/billing/success/:transactionId', (req, res) => billingPaymentController.processPaymentSuccess(req, res));
router.post('/billing/failure/:transactionId', (req, res) => billingPaymentController.processPaymentFailure(req, res));
// Webhook routes
router.post('/webhook/xendit', (req, res) => paymentController.xenditWebhook(req, res));
router.post('/webhook/mitra', (req, res) => paymentController.mitraWebhook(req, res));
router.post('/webhook/tripay', (req, res) => paymentController.tripayWebhook(req, res));
exports.default = router;
//# sourceMappingURL=payment.js.map