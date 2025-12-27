"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const WhatsAppService_1 = require("../services/whatsapp/WhatsAppService");
const pool_1 = require("../db/pool");
const qrcode_1 = __importDefault(require("qrcode"));
const WhatsAppTroubleshootingController_1 = require("../controllers/whatsapp/WhatsAppTroubleshootingController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Apply auth middleware to page routes (not API routes)
router.use((req, res, next) => {
    // Skip auth for API endpoints only
    if (req.path.startsWith('/status') ||
        req.path.startsWith('/qr') ||
        req.path.startsWith('/send') ||
        req.path.startsWith('/history') ||
        req.path.startsWith('/stats') ||
        req.path.startsWith('/troubleshooting/diagnostics') ||
        req.path.startsWith('/troubleshooting/test-connection') ||
        req.path.startsWith('/troubleshooting/retry-failed') ||
        req.path.startsWith('/troubleshooting/clear-failed') ||
        req.path.startsWith('/troubleshooting/logs') ||
        req.path.startsWith('/troubleshooting/cleanup-logs')) {
        return next();
    }
    // Apply auth for page routes (including /troubleshooting)
    return (0, authMiddleware_1.isAuthenticated)(req, res, next);
});
/**
 * GET /whatsapp/status
 * Get WhatsApp service status
 */
router.get('/status', async (req, res) => {
    try {
        const status = WhatsAppService_1.WhatsAppService.getStatus();
        const stats = await WhatsAppService_1.WhatsAppService.getNotificationStats();
        const qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
        res.json({
            success: true,
            data: {
                ...status,
                stats,
                qrCode: qrCode || null,
                qrCodeUrl: qrCode ? `/whatsapp/qr-image` : null
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get WhatsApp status'
        });
    }
});
/**
 * GET /whatsapp/qr
 * Get QR code for WhatsApp authentication (JSON)
 */
router.get('/qr', async (req, res) => {
    try {
        const qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
        const status = WhatsAppService_1.WhatsAppService.getStatus();
        if (!qrCode) {
            return res.json({
                success: false,
                message: status.ready ? 'WhatsApp sudah terhubung, tidak perlu QR code' : 'QR code belum tersedia. Tunggu beberapa saat atau regenerate QR code.',
                status
            });
        }
        res.json({
            success: true,
            data: {
                qrCode,
                qrCodeUrl: `/whatsapp/qr-image`,
                status
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get QR code'
        });
    }
});
/**
 * GET /whatsapp/qr-image
 * Get QR code as image (PNG)
 */
router.get('/qr-image', async (req, res) => {
    try {
        const qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
        if (!qrCode) {
            return res.status(404).json({
                success: false,
                error: 'QR code tidak tersedia'
            });
        }
        // Generate QR code as PNG buffer
        const qrCodeBuffer = await qrcode_1.default.toBuffer(qrCode, {
            type: 'png',
            width: 400,
            margin: 3,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
        });
        // Set headers to prevent caching
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Add timestamp to prevent browser caching
        const timestamp = Date.now();
        res.setHeader('Last-Modified', new Date(timestamp).toUTCString());
        res.send(qrCodeBuffer);
    }
    catch (error) {
        console.error('Error generating QR code image:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate QR code image'
        });
    }
});
/**
 * POST /whatsapp/clear-session
 * Clear WhatsApp session to force new QR code generation
 */
router.post('/clear-session', async (req, res) => {
    try {
        console.log('🗑️ Clearing WhatsApp session...');
        // Destroy client if exists
        if (WhatsAppService_1.WhatsAppService.isClientReady() || WhatsAppService_1.WhatsAppService.getStatus().initialized) {
            await WhatsAppService_1.WhatsAppService.destroy();
        }
        // Delete session folder
        const fs = require('fs');
        const path = require('path');
        const sessionPath = path.join(process.cwd(), 'whatsapp-session');
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('✅ Session folder deleted');
        }
        // Reset state
        const status = WhatsAppService_1.WhatsAppService.getStatus();
        res.json({
            success: true,
            message: 'Session berhasil dihapus. Silakan regenerate QR code.',
            data: {
                status
            }
        });
    }
    catch (error) {
        console.error('Error clearing session:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to clear session'
        });
    }
});
/**
 * POST /whatsapp/regenerate-qr
 * Regenerate QR code (will clear session if needed)
 */
router.post('/regenerate-qr', async (req, res) => {
    try {
        console.log('🔄 Regenerating QR code...');
        await WhatsAppService_1.WhatsAppService.regenerateQRCode();
        // Wait longer for QR code to be generated (up to 10 seconds)
        let attempts = 0;
        let qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
        while (!qrCode && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 500));
            qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
            attempts++;
        }
        const status = WhatsAppService_1.WhatsAppService.getStatus();
        res.json({
            success: true,
            message: qrCode
                ? 'QR code berhasil di-generate. Silakan scan dengan WhatsApp Anda.'
                : 'QR code sedang di-generate. Silakan refresh halaman dalam beberapa detik.',
            data: {
                qrCode: qrCode || null,
                qrCodeUrl: qrCode ? `/whatsapp/qr-image` : null,
                status
            }
        });
    }
    catch (error) {
        console.error('Error regenerating QR code:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to regenerate QR code'
        });
    }
});
/**
 * POST /whatsapp/send
 * Send WhatsApp message
 */
router.post('/send', async (req, res) => {
    try {
        const { phone, message, customerId, template } = req.body;
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone and message are required'
            });
        }
        const result = await WhatsAppService_1.WhatsAppService.sendMessage(phone, message, {
            customerId,
            template
        });
        if (result.success) {
            res.json({
                success: true,
                data: result
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to send message'
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send WhatsApp message'
        });
    }
});
/**
 * POST /whatsapp/send-bulk
 * Send bulk WhatsApp messages
 */
router.post('/send-bulk', async (req, res) => {
    try {
        const { recipients, delayMs } = req.body;
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Recipients array is required'
            });
        }
        const result = await WhatsAppService_1.WhatsAppService.sendBulkMessages(recipients, delayMs || 2000);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send bulk messages'
        });
    }
});
/**
 * POST /whatsapp/send-to-customer
 * Send WhatsApp message to customer by ID
 */
router.post('/send-to-customer', async (req, res) => {
    try {
        const { customerId, message, template } = req.body;
        if (!customerId || !message) {
            return res.status(400).json({
                success: false,
                error: 'Customer ID and message are required'
            });
        }
        // Get customer phone
        const [customerRows] = await pool_1.databasePool.query('SELECT phone, name FROM customers WHERE id = ?', [customerId]);
        if (customerRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }
        const customer = customerRows[0];
        if (!customer || !customer.phone) {
            return res.status(400).json({
                success: false,
                error: 'Customer phone number not found'
            });
        }
        const result = await WhatsAppService_1.WhatsAppService.sendMessage(customer.phone, message, {
            customerId,
            template
        });
        if (result.success) {
            res.json({
                success: true,
                data: result
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to send message'
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send WhatsApp message'
        });
    }
});
/**
 * GET /whatsapp/history
 * Get notification history
 */
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const customerId = req.query.customerId ? parseInt(req.query.customerId) : undefined;
        const status = req.query.status;
        const history = await WhatsAppService_1.WhatsAppService.getNotificationHistory(limit, customerId, status);
        res.json({
            success: true,
            data: history
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get notification history'
        });
    }
});
/**
 * GET /whatsapp/stats
 * Get notification statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await WhatsAppService_1.WhatsAppService.getNotificationStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get notification statistics'
        });
    }
});
/**
 * POST /whatsapp/send-payment-notification
 * Send payment notification to customer
 */
router.post('/send-payment-notification', async (req, res) => {
    try {
        const { customerId, invoiceId, amount, paymentMethod, paymentId, paymentType } = req.body;
        if (!customerId || !invoiceId) {
            return res.status(400).json({
                success: false,
                error: 'Customer ID and Invoice ID are required'
            });
        }
        // Get customer and invoice data
        const [customerRows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (customerRows.length === 0 || !customerRows[0].phone) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found or phone number missing'
            });
        }
        const [invoiceRows] = await pool_1.databasePool.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        if (invoiceRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }
        const customer = customerRows[0];
        const invoice = invoiceRows[0];
        if (!customer || !invoice) {
            return res.status(404).json({
                success: false,
                error: 'Customer or invoice not found'
            });
        }
        // Format message
        const { getBillingMonth } = await Promise.resolve().then(() => __importStar(require('../utils/periodHelper')));
        const paymentDate = new Date();
        const billingMonth = invoice.period ?
            getBillingMonth(invoice.period, paymentDate, invoice.due_date || null) :
            (invoice.period || '-');
        let message = '';
        const paymentMethodNames = {
            'cash': 'Tunai',
            'transfer': 'Transfer',
            'debit': 'Debit',
            'credit': 'Kredit',
            'qris': 'QRIS',
            'other': 'Lainnya'
        };
        if (paymentType === 'debt') {
            message = `
*HUTANG TERCATAT* 📝

Pelanggan: ${customer.name}
ID Pelanggan: ${customer.customer_code}

Detail Hutang:
📋 No. Invoice: ${invoice.invoice_number}
📅 Bulan Tagihan: ${billingMonth}
💰 Total Hutang: Rp ${invoice.remaining_amount.toLocaleString('id-ID')}
🆔 ID Pencatatan: #${paymentId}

⚠️ Pembayaran ditunda. Mohon segera melakukan pembayaran.

Terima kasih! 🙏
            `.trim();
        }
        else {
            const statusText = paymentType === 'full' ? 'LUNAS' : 'SEBAGIAN TERBAYAR';
            message = `
*PEMBAYARAN DITERIMA* ✅

Pelanggan: ${customer.name}
ID Pelanggan: ${customer.customer_code}

Detail Pembayaran:
📋 No. Invoice: ${invoice.invoice_number}
📅 Bulan Tagihan: ${billingMonth}
💰 Jumlah Bayar: Rp ${amount.toLocaleString('id-ID')}
💳 Metode: ${paymentMethodNames[paymentMethod] || paymentMethod}
🆔 ID Pembayaran: #${paymentId}
${paymentType === 'partial' ? `📊 Sisa Tagihan: Rp ${(invoice.remaining_amount - amount).toLocaleString('id-ID')}` : ''}

Terima kasih atas pembayaran Anda! 🙏

Status layanan Anda telah ${statusText}.
            `.trim();
        }
        const result = await WhatsAppService_1.WhatsAppService.sendMessage(customer.phone, message, {
            customerId,
            template: 'payment_notification'
        });
        if (result.success) {
            res.json({
                success: true,
                data: result
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: result.error || 'Failed to send payment notification'
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send payment notification'
        });
    }
});
/**
 * GET /whatsapp
 * Show WhatsApp notification management page
 */
router.get('/', async (req, res) => {
    try {
        const status = WhatsAppService_1.WhatsAppService.getStatus();
        const stats = await WhatsAppService_1.WhatsAppService.getNotificationStats();
        const qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
        const qrCodeUrl = qrCode ? `/whatsapp/qr-image` : null;
        // Get recent notifications
        const history = await WhatsAppService_1.WhatsAppService.getNotificationHistory(50);
        res.render('whatsapp/index', {
            title: 'WhatsApp Notifikasi',
            currentPath: '/whatsapp',
            status,
            stats,
            qrCode,
            qrCodeUrl,
            history,
            user: req.session.user
        });
    }
    catch (error) {
        console.error('Error loading WhatsApp page:', error);
        res.status(500).render('error', {
            title: 'Error',
            status: 500,
            message: 'Failed to load WhatsApp page',
            error: error.message || 'Unknown error',
            user: req.session.user
        });
    }
});
/**
 * GET /whatsapp/troubleshooting
 * Show troubleshooting page
 */
router.get('/troubleshooting', (req, res) => WhatsAppTroubleshootingController_1.WhatsAppTroubleshootingController.showTroubleshooting(req, res));
/**
 * GET /whatsapp/troubleshooting/diagnostics
 * Get diagnostic information
 */
router.get('/troubleshooting/diagnostics', (req, res) => WhatsAppTroubleshootingController_1.WhatsAppTroubleshootingController.getDiagnostics(req, res));
/**
 * POST /whatsapp/troubleshooting/test-connection
 * Test WhatsApp connection
 */
router.post('/troubleshooting/test-connection', (req, res) => WhatsAppTroubleshootingController_1.WhatsAppTroubleshootingController.testConnection(req, res));
/**
 * POST /whatsapp/troubleshooting/retry-failed
 * Retry failed notifications
 */
router.post('/troubleshooting/retry-failed', (req, res) => WhatsAppTroubleshootingController_1.WhatsAppTroubleshootingController.retryFailedNotifications(req, res));
/**
 * POST /whatsapp/troubleshooting/clear-failed
 * Clear failed notifications
 */
router.post('/troubleshooting/clear-failed', (req, res) => WhatsAppTroubleshootingController_1.WhatsAppTroubleshootingController.clearFailedNotifications(req, res));
/**
 * GET /whatsapp/troubleshooting/logs
 * Get notification logs
 */
router.get('/troubleshooting/logs', (req, res) => WhatsAppTroubleshootingController_1.WhatsAppTroubleshootingController.getNotificationLogs(req, res));
/**
 * POST /whatsapp/troubleshooting/cleanup-logs
 * Cleanup old logs
 */
router.post('/troubleshooting/cleanup-logs', (req, res) => WhatsAppTroubleshootingController_1.WhatsAppTroubleshootingController.cleanupLogs(req, res));
exports.default = router;
//# sourceMappingURL=whatsapp.js.map