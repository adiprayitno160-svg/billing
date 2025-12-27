"use strict";
/**
 * WhatsApp Settings Controller
 * Handle WhatsApp service configuration and QR Code binding
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppSettingsController = void 0;
const BaileysWhatsAppService_1 = require("../../services/whatsapp/BaileysWhatsAppService");
const pool_1 = require("../../db/pool");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WhatsAppSettingsController {
    /**
     * Show WhatsApp settings page
     */
    static async showSettings(req, res) {
        try {
            // Get WhatsApp service status
            let status = BaileysWhatsAppService_1.BaileysWhatsAppService.getStatus();
            // Force initialize if not initialized yet
            if (!status.initialized && !status.initializing) {
                console.log('🔄 Force initializing WhatsApp service...');
                try {
                    // Don't await - initialize in background
                    BaileysWhatsAppService_1.BaileysWhatsAppService.initialize()
                        .then(() => console.log('✅ WhatsApp service initialized successfully'))
                        .catch(err => console.error('❌ Failed to initialize WhatsApp:', err));
                    // Wait a bit for initialization to start
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    status = BaileysWhatsAppService_1.BaileysWhatsAppService.getStatus();
                }
                catch (initError) {
                    console.error('⚠️ Error during WhatsApp initialization:', initError);
                }
            }
            const stats = await BaileysWhatsAppService_1.BaileysWhatsAppService.getNotificationStats();
            let qrCode = BaileysWhatsAppService_1.BaileysWhatsAppService.getQRCode();
            // Get recent failed notifications
            let failedNotifications = [];
            try {
                const [cols] = await pool_1.databasePool.query('SHOW COLUMNS FROM notification_logs');
                const colNames = cols.map((col) => col.Field);
                let q;
                if (colNames.includes('channel')) {
                    q = `SELECT nl.*, c.name as customer_name FROM notification_logs nl 
                         LEFT JOIN customers c ON nl.customer_id = c.id
                         WHERE nl.channel = 'whatsapp' AND nl.status = 'failed'
                         ORDER BY nl.created_at DESC LIMIT 5`;
                }
                else {
                    q = `SELECT nl.*, c.name as customer_name FROM notification_logs nl 
                         LEFT JOIN customers c ON nl.customer_id = c.id
                         WHERE nl.status = 'failed'
                         ORDER BY nl.created_at DESC LIMIT 5`;
                }
                const [rows] = await pool_1.databasePool.query(q);
                failedNotifications = rows;
            }
            catch (err) {
                console.error('Error fetching failed notifications for settings:', err);
            }
            // Get pending notifications
            let pendingNotifications = [];
            try {
                const [cols] = await pool_1.databasePool.query('SHOW COLUMNS FROM unified_notifications_queue');
                const colNames = cols.map((col) => col.Field);
                let q;
                if (colNames.includes('channel')) {
                    q = `SELECT unq.*, c.name as customer_name FROM unified_notifications_queue unq
                         LEFT JOIN customers c ON unq.customer_id = c.id
                         WHERE unq.channel = 'whatsapp' AND unq.status = 'pending'
                         ORDER BY unq.created_at DESC LIMIT 5`;
                }
                else {
                    q = `SELECT unq.*, c.name as customer_name FROM unified_notifications_queue unq
                         LEFT JOIN customers c ON unq.customer_id = c.id
                         WHERE unq.status = 'pending'
                         ORDER BY unq.created_at DESC LIMIT 5`;
                }
                const [rows] = await pool_1.databasePool.query(q);
                pendingNotifications = rows;
            }
            catch (err) {
                console.error('Error fetching pending notifications for settings:', err);
            }
            // Get QR code URL if available (using local endpoint)
            const qrCodeUrl = qrCode
                ? `/whatsapp/qr-image`
                : null;
            res.render('settings/whatsapp', {
                title: 'Pengaturan WhatsApp',
                currentPath: '/settings/whatsapp',
                status,
                stats,
                qrCode,
                qrCodeUrl,
                failedNotifications,
                pendingNotifications,
                user: req.session.user
            });
        }
        catch (error) {
            console.error('Error loading WhatsApp settings:', error);
            res.status(500).render('error', {
                error: 'Failed to load WhatsApp settings',
                user: req.session.user
            });
        }
    }
    /**
     * Get WhatsApp status (AJAX endpoint)
     */
    static async getStatus(req, res) {
        try {
            const status = BaileysWhatsAppService_1.BaileysWhatsAppService.getStatus();
            const stats = await BaileysWhatsAppService_1.BaileysWhatsAppService.getNotificationStats();
            const qrCode = BaileysWhatsAppService_1.BaileysWhatsAppService.getQRCode();
            const qrCodeUrl = qrCode
                ? `/whatsapp/qr-image`
                : null;
            res.json({
                success: true,
                data: {
                    status,
                    stats,
                    qrCode: qrCode || null,
                    qrCodeUrl
                }
            });
        }
        catch (error) {
            res.json({
                success: false,
                error: error.message || 'Failed to get WhatsApp status'
            });
        }
    }
    /**
     * Test send WhatsApp message
     */
    static async testSendMessage(req, res) {
        try {
            const { phone, message } = req.body;
            if (!phone) {
                res.json({
                    success: false,
                    error: 'Nomor telepon wajib diisi'
                });
                return;
            }
            if (!message || !message.trim()) {
                res.json({
                    success: false,
                    error: 'Pesan wajib diisi'
                });
                return;
            }
            // Check if WhatsApp is ready
            const status = BaileysWhatsAppService_1.BaileysWhatsAppService.getStatus();
            console.log('📱 [Test WA] Current status before test send:', status);
            if (!status.ready) {
                console.warn('⚠️ [Test WA] Test send rejected: WhatsApp is not ready');
                res.json({
                    success: false,
                    error: `WhatsApp belum terhubung (Status: ${JSON.stringify(status)}). Silakan scan QR code terlebih dahulu.`
                });
                return;
            }
            // Send test message
            console.log(`📱 [Test WA] Attempting to send test message to ${phone}...`);
            const result = await BaileysWhatsAppService_1.BaileysWhatsAppService.sendMessage(phone.trim(), message.trim(), {
                template: 'test_message'
            });
            if (result.success) {
                console.log('✅ [Test WA] Test message sent successfully');
                res.json({
                    success: true,
                    message: 'Pesan test berhasil dikirim!',
                    data: {
                        messageId: result.messageId
                    }
                });
            }
            else {
                console.error('❌ [Test WA] Failed to send test message:', result.error);
                res.json({
                    success: false,
                    error: result.error || 'Gagal mengirim pesan test'
                });
            }
        }
        catch (error) {
            console.error('Error sending test message:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to send test message'
            });
        }
    }
    /**
     * Regenerate QR code
     */
    static async regenerateQR(req, res) {
        try {
            console.log('🔄 Starting QR code regeneration...');
            // First clear session if exists
            const sessionPath = path.join(process.cwd(), 'baileys-session');
            // Destroy client first
            try {
                const status = BaileysWhatsAppService_1.BaileysWhatsAppService.getStatus();
                if (status.initialized) {
                    console.log('🗑️ Destroying existing client...');
                    await BaileysWhatsAppService_1.BaileysWhatsAppService.destroy();
                    console.log('✅ Client destroyed');
                }
            }
            catch (err) {
                console.warn('⚠️ Error destroying client:', err);
            }
            // Delete session folder if exists
            if (fs.existsSync(sessionPath)) {
                try {
                    console.log('🗑️ Deleting session folder...');
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    console.log('✅ Session folder deleted');
                }
                catch (err) {
                    console.warn('⚠️ Error deleting session folder:', err);
                }
            }
            else {
                console.log('ℹ️ No session folder found');
            }
            // Wait a bit before reinitializing to ensure cleanup is complete
            console.log('⏳ Waiting before reinitializing...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Regenerate QR code
            console.log('🔄 Regenerating QR code...');
            await BaileysWhatsAppService_1.BaileysWhatsAppService.regenerateQRCode();
            // Wait for QR code to be generated (up to 15 seconds)
            console.log('⏳ Waiting for QR code generation...');
            let attempts = 0;
            let qrCode = BaileysWhatsAppService_1.BaileysWhatsAppService.getQRCode();
            const maxAttempts = 30; // 15 seconds
            while (!qrCode && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                qrCode = BaileysWhatsAppService_1.BaileysWhatsAppService.getQRCode();
                attempts++;
                if (attempts % 5 === 0) {
                    console.log(`⏳ Still waiting for QR code... (${attempts}/${maxAttempts})`);
                }
            }
            const status = BaileysWhatsAppService_1.BaileysWhatsAppService.getStatus();
            const qrCodeUrl = qrCode
                ? `/whatsapp/qr-image`
                : null;
            if (qrCode) {
                console.log('✅ QR code generated successfully');
            }
            else {
                console.warn('⚠️ QR code not generated yet, but client might still be initializing');
            }
            res.json({
                success: true,
                message: qrCode
                    ? 'QR code berhasil di-generate. Silakan scan dengan WhatsApp Anda.'
                    : 'QR code sedang di-generate. Silakan refresh halaman dalam beberapa detik atau tunggu hingga QR code muncul.',
                data: {
                    qrCode: qrCode || null,
                    qrCodeUrl,
                    status
                }
            });
        }
        catch (error) {
            console.error('❌ Error regenerating QR code:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to regenerate QR code'
            });
        }
    }
}
exports.WhatsAppSettingsController = WhatsAppSettingsController;
exports.default = WhatsAppSettingsController;
//# sourceMappingURL=WhatsAppSettingsController.js.map