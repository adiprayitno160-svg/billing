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
const WhatsAppService_1 = require("../../services/whatsapp/WhatsAppService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WhatsAppSettingsController {
    /**
     * Show WhatsApp settings page
     */
    static async showSettings(req, res) {
        try {
            // Get WhatsApp service status
            let status = WhatsAppService_1.WhatsAppService.getStatus();
            // Force initialize if not initialized yet
            if (!status.initialized && !status.initializing) {
                console.log('🔄 Force initializing WhatsApp service...');
                try {
                    // Don't await - initialize in background
                    WhatsAppService_1.WhatsAppService.initialize()
                        .then(() => console.log('✅ WhatsApp service initialized successfully'))
                        .catch(err => console.error('❌ Failed to initialize WhatsApp:', err));
                    // Wait a bit for initialization to start
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    status = WhatsAppService_1.WhatsAppService.getStatus();
                }
                catch (initError) {
                    console.error('⚠️ Error during WhatsApp initialization:', initError);
                }
            }
            const stats = await WhatsAppService_1.WhatsAppService.getNotificationStats();
            let qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
            // If not ready and no QR code, try to initialize or regenerate
            // Note: QR code generation is async and happens via event, so we check status
            if (!status.ready && !qrCode) {
                if (!status.initialized) {
                    // Service not initialized yet, will be initialized on server start
                    console.log('⚠️ WhatsApp service not initialized yet');
                }
                else {
                    // Service initialized but no QR code - might be waiting for QR event
                    console.log('⚠️ WhatsApp initialized but QR code not available yet. It will appear automatically when ready.');
                }
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
            const status = WhatsAppService_1.WhatsAppService.getStatus();
            const stats = await WhatsAppService_1.WhatsAppService.getNotificationStats();
            const qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
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
            const status = WhatsAppService_1.WhatsAppService.getStatus();
            if (!status.ready) {
                res.json({
                    success: false,
                    error: 'WhatsApp belum terhubung. Silakan scan QR code terlebih dahulu.'
                });
                return;
            }
            // Send test message
            const result = await WhatsAppService_1.WhatsAppService.sendMessage(phone.trim(), message.trim(), {
                template: 'test_message'
            });
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Pesan test berhasil dikirim!',
                    data: {
                        messageId: result.messageId
                    }
                });
            }
            else {
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
            const sessionPath = path.join(process.cwd(), 'whatsapp-session');
            // Destroy client first
            try {
                const status = WhatsAppService_1.WhatsAppService.getStatus();
                if (status.initialized) {
                    console.log('🗑️ Destroying existing client...');
                    await WhatsAppService_1.WhatsAppService.destroy();
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
            await WhatsAppService_1.WhatsAppService.regenerateQRCode();
            // Wait for QR code to be generated (up to 15 seconds)
            console.log('⏳ Waiting for QR code generation...');
            let attempts = 0;
            let qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
            const maxAttempts = 30; // 15 seconds
            while (!qrCode && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                qrCode = WhatsAppService_1.WhatsAppService.getQRCode();
                attempts++;
                if (attempts % 5 === 0) {
                    console.log(`⏳ Still waiting for QR code... (${attempts}/${maxAttempts})`);
                }
            }
            const status = WhatsAppService_1.WhatsAppService.getStatus();
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