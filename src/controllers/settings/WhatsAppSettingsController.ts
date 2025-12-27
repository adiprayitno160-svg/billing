/**
 * WhatsApp Settings Controller
 * Handle WhatsApp service configuration and QR Code binding
 */

import { Request, Response } from 'express';
import { WhatsAppService } from '../../services/whatsapp/WhatsAppService';
import * as fs from 'fs';
import * as path from 'path';

export class WhatsAppSettingsController {

    /**
     * Show WhatsApp settings page
     */
    static async showSettings(req: Request, res: Response): Promise<void> {
        try {
            // Get WhatsApp service status
            let status = WhatsAppService.getStatus();

            // Force initialize if not initialized yet
            if (!status.initialized && !status.initializing) {
                console.log('🔄 Force initializing WhatsApp service...');
                try {
                    // Don't await - initialize in background
                    WhatsAppService.initialize()
                        .then(() => console.log('✅ WhatsApp service initialized successfully'))
                        .catch(err => console.error('❌ Failed to initialize WhatsApp:', err));

                    // Wait a bit for initialization to start
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    status = WhatsAppService.getStatus();
                } catch (initError) {
                    console.error('⚠️ Error during WhatsApp initialization:', initError);
                }
            }

            const stats = await WhatsAppService.getNotificationStats();
            let qrCode = WhatsAppService.getQRCode();

            // If not ready and no QR code, try to initialize or regenerate
            // Note: QR code generation is async and happens via event, so we check status
            if (!status.ready && !qrCode) {
                if (!status.initialized) {
                    // Service not initialized yet, will be initialized on server start
                    console.log('⚠️ WhatsApp service not initialized yet');
                } else {
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
                user: (req.session as any).user
            });

        } catch (error) {
            console.error('Error loading WhatsApp settings:', error);
            res.status(500).render('error', {
                error: 'Failed to load WhatsApp settings',
                user: (req.session as any).user
            });
        }
    }

    /**
     * Get WhatsApp status (AJAX endpoint)
     */
    static async getStatus(req: Request, res: Response): Promise<void> {
        try {
            const status = WhatsAppService.getStatus();
            const stats = await WhatsAppService.getNotificationStats();
            const qrCode = WhatsAppService.getQRCode();

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
        } catch (error: any) {
            res.json({
                success: false,
                error: error.message || 'Failed to get WhatsApp status'
            });
        }
    }

    /**
     * Test send WhatsApp message
     */
    static async testSendMessage(req: Request, res: Response): Promise<void> {
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
            const status = WhatsAppService.getStatus();
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
            const result = await WhatsAppService.sendMessage(phone.trim(), message.trim(), {
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
            } else {
                console.error('❌ [Test WA] Failed to send test message:', result.error);
                res.json({
                    success: false,
                    error: result.error || 'Gagal mengirim pesan test'
                });
            }
        } catch (error: any) {
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
    static async regenerateQR(req: Request, res: Response): Promise<void> {
        try {
            console.log('🔄 Starting QR code regeneration...');

            // First clear session if exists
            const sessionPath = path.join(process.cwd(), 'whatsapp-session');

            // Destroy client first
            try {
                const status = WhatsAppService.getStatus();
                if (status.initialized) {
                    console.log('🗑️ Destroying existing client...');
                    await WhatsAppService.destroy();
                    console.log('✅ Client destroyed');
                }
            } catch (err) {
                console.warn('⚠️ Error destroying client:', err);
            }

            // Delete session folder if exists
            if (fs.existsSync(sessionPath)) {
                try {
                    console.log('🗑️ Deleting session folder...');
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    console.log('✅ Session folder deleted');
                } catch (err) {
                    console.warn('⚠️ Error deleting session folder:', err);
                }
            } else {
                console.log('ℹ️ No session folder found');
            }

            // Wait a bit before reinitializing to ensure cleanup is complete
            console.log('⏳ Waiting before reinitializing...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Regenerate QR code
            console.log('🔄 Regenerating QR code...');
            await WhatsAppService.regenerateQRCode();

            // Wait for QR code to be generated (up to 15 seconds)
            console.log('⏳ Waiting for QR code generation...');
            let attempts = 0;
            let qrCode = WhatsAppService.getQRCode();
            const maxAttempts = 30; // 15 seconds
            while (!qrCode && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
                qrCode = WhatsAppService.getQRCode();
                attempts++;

                if (attempts % 5 === 0) {
                    console.log(`⏳ Still waiting for QR code... (${attempts}/${maxAttempts})`);
                }
            }

            const status = WhatsAppService.getStatus();

            const qrCodeUrl = qrCode
                ? `/whatsapp/qr-image`
                : null;

            if (qrCode) {
                console.log('✅ QR code generated successfully');
            } else {
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
        } catch (error: any) {
            console.error('❌ Error regenerating QR code:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to regenerate QR code'
            });
        }
    }
}

export default WhatsAppSettingsController;

