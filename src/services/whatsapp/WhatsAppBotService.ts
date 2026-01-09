/**
 * WhatsApp Bot Service
 * Handles bot commands for package purchase and payment verification
 */

// import { Message, MessageMedia } from 'whatsapp-web.js'; // Removed to support multiple providers
import { WhatsAppServiceBaileys as WhatsAppService } from './WhatsAppServiceBaileys';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';
import fs from 'fs';
import path from 'path';

import { PaymentVerificationService } from './PaymentVerificationService';
import { AIAnomalyDetectionService } from '../billing/AIAnomalyDetectionService';
import { WiFiManagementService } from '../genieacs/WiFiManagementService';
import { GenieacsService } from '../genieacs/GenieacsService';
import { MikrotikService } from '../mikrotik/MikrotikService';
import { ChatBotService } from '../ai/ChatBotService';
import { WhatsAppRegistrationService } from './WhatsAppRegistrationService';

// Generic interface to support both Baileys and WhatsAppAuth based messages
export interface WhatsAppMessageInterface {
    from: string;
    body: string;
    hasMedia: boolean;
    fromMe?: boolean;
    downloadMedia(): Promise<{ mimetype: string; data: string; filename?: string }>;
}



export class WhatsAppBotService {
    private static readonly COMMAND_PREFIX = '/';
    // TODO: Add Admin Numbers here (e.g., '628123456789')
    private static readonly ADMIN_NUMBERS: string[] = [];

    /**
     * Check if phone number belongs to an admin
     */
    private static async isAdmin(phone: string): Promise<boolean> {
        const resolvedPhone = this.resolveLid(phone).split('@')[0];

        // 1. Check Hardcoded list (Fallback)
        if (this.ADMIN_NUMBERS.includes(resolvedPhone)) return true;

        // 2. Check Database (Users Table)
        try {
            const cleanPhone = resolvedPhone;

            // Check for both 62... and 0... formats
            const phoneWithZero = '0' + cleanPhone.substring(2);

            const [rows] = await databasePool.query<RowDataPacket[]>(
                "SELECT id FROM users WHERE (phone = ? OR phone = ?) AND role IN ('superadmin', 'admin', 'teknisi')",
                [cleanPhone, phoneWithZero]
            );

            return rows.length > 0;
        } catch (error) {
            console.error('Error verifying admin status:', error);
            return false;
        }
    }


    /**
     * Validate if sender is a registered customer
     * Returns customer object if valid, null otherwise
     * NOTE: No longer sends rejection - caller handles unregistered flow
     */
    private static async validateCustomer(phone: string): Promise<any | null> {
        console.log(`[WhatsAppBot] 🔍 Validating customer for phone: ${phone}`);

        const customer = await this.getCustomerByPhone(phone);

        if (!customer) {
            console.log(`[WhatsAppBot] ❌ Customer NOT FOUND for phone: ${phone}`);
            return null;
        }

        console.log(`[WhatsAppBot] ✅ Customer FOUND: ${customer.name} (ID: ${customer.id})`);
        return customer;
    }


    /**
     * Initialize bot message handler
     */
    static async initialize(): Promise<void> {
        // Bot handler is registered in WhatsAppService
        console.log('✅ WhatsApp Bot Service initialized');
    }

    /**
     * Handle incoming WhatsApp message
     */
    static async handleMessage(message: WhatsAppMessageInterface): Promise<void> {
        let phone = '';
        let senderJid = '';
        try {
            console.log('[WhatsAppBot] ========== MESSAGE HANDLER START ==========');

            senderJid = message.from || '';

            // Ignore messages from self
            if (message.fromMe) {
                console.log('[WhatsAppBot] ⏩ Ignoring message from self');
                return;
            }

            if (!senderJid) {
                console.log('[WhatsAppBot] ❌ No sender found, ignoring message');
                return;
            }

            const body = message.body?.trim() || '';
            const bodyLower = body.toLowerCase(); // For case-insensitive comparison
            const hasMedia = message.hasMedia;

            // Extract phone number for DB lookup (remove @suffix)
            phone = senderJid.split('@')[0] || '';
            console.log(`[WhatsAppBot] 📨 Incoming message:`);
            console.log(`[WhatsAppBot]   From (JID): ${senderJid}`);
            console.log(`[WhatsAppBot]   Phone ID: ${phone}`);
            console.log(`[WhatsAppBot]   Body: "${body.substring(0, 100)}${body.length > 100 ? '...' : ''}"`);
            console.log(`[WhatsAppBot]   Body (lowercase): "${bodyLower.substring(0, 100)}"`);
            console.log(`[WhatsAppBot]   Has Media: ${hasMedia}`);

            // GLOBAL GUARD: Only registered customers can access the bot
            console.log('[WhatsAppBot] 🔐 Validating customer access...');

            // ADMIN BYPASS CHECK
            if (await this.isAdmin(phone)) {
                if (body.startsWith('/adm_')) {
                    console.log('[WhatsAppBot] 🛡️ Processing ADMIN command...');
                    await this.handleAdminCommand(message, phone, body);
                    return;
                }
            }

            const customer = await this.validateCustomer(phone);
            if (!customer) {
                // UNREGISTERED USER HANDLING
                try {
                    // Allow explicit registration command (case-insensitive)
                    if (bodyLower === '/daftar' || bodyLower === '/reg' || bodyLower === '/register') {
                        console.log('[WhatsAppBot] 📝 Starting registration for new user...');
                        console.log(`[WhatsAppBot] Registration command detected: "${body}"`);
                        try {
                            // Ensure service is available
                            if (!WhatsAppRegistrationService) {
                                throw new Error('WhatsAppRegistrationService not initialized');
                            }
                            const registrationResponse = await WhatsAppRegistrationService.processStep(phone, body);
                            console.log(`[WhatsAppBot] Registration response: ${registrationResponse.substring(0, 100)}...`);
                            await this.sendMessage(senderJid, registrationResponse);
                            console.log('[WhatsAppBot] ✅ Registration message sent successfully');
                        } catch (regError: any) {
                            console.error('[WhatsAppBot] ❌ Error in registration:', regError);
                            await this.sendMessage(senderJid, '❌ Terjadi kesalahan saat registrasi. Silakan coba lagi nanti.');
                        }
                        return;
                    }

                    // Check if already in registration session
                    // Wrap in try-catch to prevent crash if service is missing
                    let hasSession = false;
                    try {
                        if (WhatsAppRegistrationService && WhatsAppRegistrationService.hasActiveSession(phone)) {
                            hasSession = true;
                        }
                    } catch (sessError) {
                        console.error('[WhatsAppBot] Error checking session:', sessError);
                    }

                    if (hasSession) {
                        console.log('[WhatsAppBot] 📝 Continuing registration session...');
                        try {
                            const registrationResponse = await WhatsAppRegistrationService.processStep(phone, body);
                            await this.sendMessage(senderJid, registrationResponse);
                        } catch (regError: any) {
                            console.error('[WhatsAppBot] ❌ Error in registration session:', regError);
                            await this.sendMessage(senderJid, '❌ Terjadi kesalahan. Silakan ketik /daftar untuk ulang.');
                        }
                        return;
                    }

                    // Default: Guide unregistered users to register
                    // Only send this if it's NOT a command intended for registered users (to avoid spamming)
                    console.log('[WhatsAppBot] ℹ️ Sending registration guide to unregistered user');
                    await this.sendMessage(
                        senderJid,
                        '❌ *Nomor Belum Terdaftar*\n\n' +
                        'Maaf, nomor ini belum terdaftar di database kami.\n\n' +
                        'Ketik */daftar* untuk registrasi pelanggan baru.\n' +
                        'Atau hubungi admin jika Anda sudah berlangganan.'
                    );
                } catch (unregError) {
                    console.error('[WhatsAppBot] Error in unregistered flow:', unregError);
                    // Do NOT throw to avoid global catch sending "System Error"
                }
                return;
            }

            console.log('[WhatsAppBot] ✅ Customer validated successfully');

            // Handle image/media (bukti transfer)
            if (hasMedia) {
                console.log('[WhatsAppBot] 🖼️  Processing media message...');
                try {
                    await this.handleMediaMessage(message, phone, senderJid);
                    console.log('[WhatsAppBot] ✅ Media message handled successfully');
                } catch (mediaError: any) {
                    console.error('[WhatsAppBot] ❌ Error in handleMediaMessage:', mediaError);
                    await this.sendMessage(
                        senderJid,
                        '❌ *Terjadi Kesalahan*\n\n' +
                        'Maaf, terjadi kesalahan saat memproses media Anda.\n' +
                        'Silakan coba lagi atau hubungi customer service.'
                    );
                }
                return;
            }

            // Handle text commands
            if (body.startsWith(this.COMMAND_PREFIX)) {
                console.log('[WhatsAppBot] 🔧 Processing command...');
                try {
                    await this.handleCommand(message, phone, body, customer, senderJid);
                    console.log('[WhatsAppBot] ✅ Command handled successfully');
                } catch (cmdError: any) {
                    console.error('[WhatsAppBot] ❌ Error in handleCommand:', cmdError);
                    await this.sendMessage(
                        senderJid,
                        '❌ *Terjadi Kesalahan*\n\n' +
                        'Maaf, terjadi kesalahan saat memproses command Anda.\n' +
                        'Silakan coba lagi atau hubungi customer service.'
                    );
                }
                return;
            }

            // Handle prepaid package selection (1 = weekly, 2 = monthly)
            if (customer.billing_mode === 'prepaid' && (body === '1' || body === '2')) {
                console.log(`[WhatsAppBot] 📦 Processing prepaid package selection: ${body}`);
                try {
                    const { PrepaidBotHandler } = await import('./PrepaidBotHandler');
                    const response = await PrepaidBotHandler.handlePackageSelection(phone, customer, body);
                    if (response) {
                        await this.sendMessage(senderJid, response);
                        return;
                    }
                } catch (prepaidError) {
                    console.error('[WhatsAppBot] Error handling package selection:', prepaidError);
                }
            }

            // Handle menu navigation

            const isMenu = WhatsAppBotService.isMenuCommand(body);
            console.log(`[WhatsAppBot] Checking menu command: "${body}" -> ${isMenu}`);

            if (isMenu) {
                console.log(`[WhatsAppBot] 📋 Processing menu command for: "${body}"`);
                try {
                    await WhatsAppBotService.handleMenuCommand(message, phone, body, customer, senderJid);
                    console.log('[WhatsAppBot] ✅ Menu command handled successfully');
                } catch (menuError: any) {
                    console.error('[WhatsAppBot] ❌ Error in handleMenuCommand:', menuError);
                    await this.sendMessage(
                        senderJid,
                        '❌ *Terjadi Kesalahan*\n\n' +
                        'Maaf, terjadi kesalahan saat menampilkan menu.\n' +
                        'Silakan coba lagi atau hubungi customer service.'
                    );
                }
                return;
            } else {
                console.log(`[WhatsAppBot] ⏩ NOT a menu command: "${body}"`);
            }

            // Handle AI ChatBot (Fallback for other text)
            console.log('[WhatsAppBot] 🤖 Hubbing AI ChatBot...');
            try {
                // PRE-CHECK: Removed numeric check to rely on isMenuCommand

                const aiResponse = await ChatBotService.ask(body, customer);

                // If AI returns the specific error message (service down/unconfigured)
                const aiResponseLower = aiResponse.toLowerCase();
                if (aiResponseLower.includes("maaf") && (aiResponseLower.includes("gangguan") || aiResponseLower.includes("sistem ai"))) {
                    console.log('[WhatsAppBot] ⚠️ AI Service returned error');
                    // Reformatted to avoid auto-spamming the full menu
                    await this.sendMessage(senderJid, `⚠️ Maaf, sistem AI sedang offline.\nSilakan ketik */menu* untuk melihat opsi layanan.\n(Debug: "${body}")`);
                    return;
                }

                await this.sendMessage(senderJid, aiResponse);
                console.log('[WhatsAppBot] ✅ AI ChatBot response sent');
            } catch (aiError: any) {
                console.error('[WhatsAppBot] ❌ Error in AI ChatBot:', aiError);
                await this.showMainMenu(senderJid, customer);
            }

        } catch (error: any) {
            console.error('[WhatsAppBot] ========== FATAL ERROR ==========');
            console.error('[WhatsAppBot] Error details:', error);
            console.error('[WhatsAppBot] Stack trace:', error.stack);
            console.error('[WhatsAppBot] ==========================================');

            // Send generic error message to customer
            if (senderJid) {
                await this.sendMessage(senderJid, '❌ Terjadi kesalahan sistem. Silakan coba beberapa saat lagi.');
            }
        } finally {
            console.log('[WhatsAppBot] ========== MESSAGE HANDLER END ==========');
        }
    }

    /**
     * Handle media message (bukti transfer)
     * AI akan analisa dan auto-approve jika valid
     * Jika tidak valid atau confidence rendah, akan diflag untuk manual verification
     */
    private static async handleMediaMessage(message: WhatsAppMessageInterface, phone: string, senderJid: string): Promise<void> {
        try {
            // Validate customer first
            const customer = await this.validateCustomer(phone);
            if (!customer) return;

            const media = await message.downloadMedia();

            // Validate media type
            if (!media.mimetype.startsWith('image/')) {
                await this.sendMessage(
                    phone,
                    '❌ *Format File Tidak Didukung*\n\n' +
                    'Silakan kirim gambar (JPG, PNG, atau WebP) saja.\n' +
                    'File yang dikirim harus berupa foto bukti transfer.'
                );
                return;
            }

            // Process payment verification - AI will analyze and match automatically
            await this.sendMessage(
                phone,
                '⏳ *Memproses Bukti Transfer...*\n\n' +
                '🤖 AI sedang menganalisa bukti transfer Anda\n' +
                'Mohon tunggu sebentar...'
            );

            const verificationResult = await PaymentVerificationService.verifyPaymentProofAuto(
                media,
                customer.id
            );

            if (verificationResult.success) {
                // Successful verification - payment auto-approved
                await this.sendMessage(
                    phone,
                    '✅ *PEMBAYARAN BERHASIL DIVERIFIKASI!*\n\n' +
                    `📄 Invoice: ${verificationResult.invoiceNumber || '-'}\n` +
                    `💰 Jumlah: Rp ${verificationResult.amount?.toLocaleString('id-ID') || '0'}\n` +
                    `📊 Status: ${verificationResult.invoiceStatus || 'Lunas'}\n` +
                    `🎯 Confidence: ${Math.round((verificationResult.confidence || 0) * 100)}%\n\n` +
                    '🎉 *Terima kasih atas pembayaran Anda!*\n\n' +
                    'Layanan Anda sudah aktif kembali.'
                );
            } else {
                // Verification failed - check if it's low confidence or genuine error
                const errorLower = (verificationResult.error || '').toLowerCase();
                const isLowConfidence = errorLower.includes('confidence') ||
                    errorLower.includes('tidak jelas') ||
                    errorLower.includes('blur');
                const isNoInvoice = errorLower.includes('tidak ada tagihan') ||
                    errorLower.includes('sudah lunas');
                const isAmountMismatch = errorLower.includes('tidak sesuai') ||
                    errorLower.includes('jumlah');

                if (isNoInvoice) {
                    // No pending invoices
                    await this.sendMessage(
                        phone,
                        '✅ *Tagihan Sudah Lunas*\n\n' +
                        'Semua tagihan Anda sudah dibayar.\n' +
                        'Tidak ada tagihan yang perlu dibayar saat ini.\n\n' +
                        'Terima kasih! 🙏'
                    );
                } else if (isLowConfidence || isAmountMismatch) {
                    // Flag for manual verification
                    await this.flagForManualVerification(customer.id, media, verificationResult.error || 'Unknown error');

                    await this.sendMessage(
                        phone,
                        '⚠️ *BUKTI TRANSFER MEMERLUKAN VERIFIKASI MANUAL*\n\n' +
                        `Alasan: ${verificationResult.error}\n\n` +
                        '📋 *Bukti transfer Anda telah disimpan dan akan diverifikasi oleh admin.*\n\n' +
                        '⏱️ Verifikasi manual biasanya selesai dalam 1-2 jam kerja.\n' +
                        'Anda akan mendapat notifikasi WhatsApp setelah verifikasi selesai.\n\n' +
                        '💡 *Tips untuk verifikasi lebih cepat:*\n' +
                        '• Pastikan foto jelas dan tidak blur\n' +
                        '• Pastikan semua informasi terlihat lengkap\n' +
                        '• Pastikan jumlah transfer sesuai tagihan\n\n' +
                        'Atau hubungi customer service: [CS Number]'
                    );
                } else {
                    // Genuine error
                    await this.sendMessage(
                        phone,
                        '❌ *VERIFIKASI GAGAL*\n\n' +
                        `Alasan: ${verificationResult.error}\n\n` +
                        '💡 *Saran:*\n' +
                        '• Pastikan foto bukti transfer jelas\n' +
                        '• Pastikan jumlah transfer sesuai dengan tagihan\n' +
                        '• Pastikan bukti transfer belum pernah digunakan\n\n' +
                        '📞 Jika masalah berlanjut, silakan hubungi customer service.'
                    );
                }
            }

        } catch (error: any) {
            console.error('[WhatsAppBot] Error handling media:', error);
            await this.sendMessage(
                phone,
                '❌ *Terjadi Kesalahan*\n\n' +
                'Maaf, terjadi kesalahan saat memproses bukti transfer.\n\n' +
                'Silakan coba lagi atau hubungi customer service.\n' +
                `Error: ${error.message || 'Unknown error'}`
            );
        }
    }

    /**
     * Flag payment for manual verification by admin
     */
    private static async flagForManualVerification(
        customerId: number,
        media: any,
        reason: string
    ): Promise<void> {
        try {
            // Save to manual_payment_verifications table
            await databasePool.query(
                `INSERT INTO manual_payment_verifications 
                 (customer_id, image_data, image_mimetype, reason, status, created_at)
                 VALUES (?, ?, ?, ?, 'pending', NOW())`,
                [customerId, media.data, media.mimetype, reason]
            );

            console.log(`[WhatsAppBot] Payment flagged for manual verification - Customer ${customerId}`);
        } catch (error: any) {
            console.error('[WhatsAppBot] Error flagging for manual verification:', error);
            // Don't throw - customer already notified
        }
    }

    /**
     * Handle command
     */
    private static async handleCommand(message: WhatsAppMessageInterface, phone: string, command: string, customer: any, senderJid: string): Promise<void> {
        const cmd = command.toLowerCase().trim();

        if (cmd === '/start' || cmd === '/menu' || cmd === '/help') {
            await this.showMainMenu(senderJid, customer);
        } else if (cmd === '/tagihan' || cmd.startsWith('/tagihan')) {
            await this.showInvoices(senderJid);
        } else if (cmd === '/wifi' || cmd === '/ubahwifi') {
            await this.showWiFiMenu(senderJid);
        } else if (cmd === '/mywifi' || cmd === '/passwordwifi' || cmd === '/lihatwifi') {
            // NEW: Show saved WiFi credentials from database
            await this.showSavedWiFiCredentials(senderJid);
        } else if (cmd.startsWith('/wifi_ssid ')) {
            const newSSID = command.substring(11).trim();
            await this.changeWiFiSSID(senderJid, newSSID);
        } else if (cmd.startsWith('/wifi_password ')) {
            const newPassword = command.substring(15).trim();
            await this.changeWiFiPassword(senderJid, newPassword);
        } else if (cmd === '/reboot') {
            await this.rebootOnt(senderJid);
        } else if (cmd.startsWith('/wifi_both ')) {
            // Format: /wifi_both SSID|Password
            const parts = command.substring(11).trim().split('|');
            if (parts.length === 2 && parts[0] && parts[1]) {
                await this.changeWiFiBoth(senderJid, parts[0].trim(), parts[1].trim());
            } else {
                await this.sendMessage(
                    senderJid,
                    '❌ *Format salah!*\n\n' +
                    'Gunakan format: /wifi_both SSID|Password\n' +
                    'Contoh: /wifi_both MyWiFi|password123'
                );
            }
        } else if (cmd.startsWith('/lapor')) {
            const description = command.substring(6).trim();
            await this.handleReportCommand(senderJid, description);
        } else if (cmd.startsWith('/selesai')) {
            await this.handleResolveCommand(senderJid);
        } else if (cmd.startsWith('/nama ') || cmd.startsWith('/gantinama ')) {
            const newName = command.replace(/^\/(nama|gantinama)\s+/i, '').trim();
            await this.changeCustomerName(senderJid, newName);
        } else if (cmd === '/beli' || cmd === '/paket') {
            // Prepaid package purchase command
            try {
                const { PrepaidBotHandler } = await import('./PrepaidBotHandler');
                const response = await PrepaidBotHandler.handleBuyCommand(phone, customer);
                await this.sendMessage(senderJid, response);
            } catch (prepaidError) {
                console.error('[WhatsAppBot] Error handling /beli:', prepaidError);
                await this.sendMessage(senderJid, '❌ Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.');
            }
        } else {
            await this.sendMessage(
                senderJid,
                '❌ *Command tidak dikenal*\n\n' +
                'Gunakan salah satu command berikut:\n' +
                '*/menu* - Tampilkan menu utama\n' +
                '*/tagihan* - Lihat tagihan\n' +
                '*/mywifi* - Lihat password WiFi\n' +
                '*/lapor* - Lapor gangguan (Start SLA)\n' +
                '*/selesai* - Laporan selesai (Stop SLA)\n' +
                '*/wifi* - Ubah WiFi\n' +
                '*/reboot* - Restart Perangkat'
            );
        }
    }

    /**
     * Handle menu command
     */
    private static async handleMenuCommand(message: WhatsAppMessageInterface, phone: string, command: string, customer: any, senderJid: string): Promise<void> {
        const cmd = command.toLowerCase().trim();

        if (cmd === '1' || cmd === 'tagihan' || cmd === 'invoice') {
            await this.showInvoices(senderJid);
        } else if (cmd === '2' || cmd === 'bantuan' || cmd === 'help') {
            await this.showHelp(senderJid);
        } else if (cmd === '3' || cmd === 'wifi' || cmd === 'ubahwifi') {
            await this.showWiFiMenu(senderJid);
        } else if (cmd === '4' || cmd === 'reboot' || cmd === 'restart') {
            await this.rebootOnt(senderJid);
        } else if (cmd === '5' || cmd === 'bantuan') {
            await this.showHelp(senderJid);
        } else if (cmd === '6' || cmd === 'gantinama' || cmd === 'nama' || cmd === '10') {
            await this.sendMessage(senderJid, '📝 *GANTI NAMA PELANGGAN*\n\nSilakan balas pesan ini dengan format:\n*/nama [Nama Baru]*\n\nContoh:\n*/nama Budi Santoso*');
        } else if (cmd === '7' || cmd === 'mywifi' || cmd === 'lihatwifi' || cmd === 'passwordwifi') {
            // NEW: Show saved WiFi credentials
            await this.showSavedWiFiCredentials(senderJid);
        } else {
            console.log(`[WhatsAppBot] Menu command fallthrough for "${cmd}". Sending hint.`);
            await this.sendMessage(senderJid, '❓ Perintah tidak dikenali.\nSilakan ketik */menu* untuk kembali ke menu utama.');
        }
    }

    /**
     * Change Customer Name
     */
    private static async changeCustomerName(phone: string, newName: string): Promise<void> {
        try {
            console.log(`[WhatsAppBot] Changing name for ${phone} to "${newName}"`);

            if (!newName || newName.length < 3) {
                await this.sendMessage(phone, '❌ Nama terlalu pendek (min 3 karakter).');
                return;
            }

            // Prepare phone variants (08xx and 628xx) to capture all duplicate accounts
            const normalizedPhone = this.resolveLid(phone).split('@')[0].trim();
            const phoneVariants = [normalizedPhone];

            if (normalizedPhone.startsWith('62')) {
                phoneVariants.push('0' + normalizedPhone.substring(2));
            } else if (normalizedPhone.startsWith('0')) {
                phoneVariants.push('62' + normalizedPhone.substring(1));
            }

            console.log(`[WhatsAppBot] Updating records for phones: ${phoneVariants.join(', ')}`);

            const [result] = await databasePool.query<any>(
                'UPDATE customers SET name = ? WHERE phone IN (?)',
                [newName, phoneVariants]
            );

            console.log('[WhatsAppBot] Update Result:', result);

            if (result.affectedRows > 0) {
                await this.sendMessage(phone, `✅ Nama berhasil diubah menjadi: *${newName}*\n(Ter-update pada ${result.affectedRows} data pelanggan)`);
            } else {
                await this.sendMessage(phone, '❌ Gagal mengubah nama. Nomor Anda tidak ditemukan di sistem.');
            }
        } catch (error) {
            console.error('Error changing customer name:', error);
            await this.sendMessage(phone, '❌ Gagal mengubah nama (System Error).');
        }
    }

    /**
     * Check if command is menu navigation
     */
    private static isMenuCommand(command: string): boolean {
        const menuCommands = ['1', '2', '3', '4', '5', '6', '7', '10', 'tagihan', 'invoice', 'bantuan', 'help', 'menu', 'wifi', 'ubahwifi', 'reboot', 'restart', 'gantinama', 'nama', 'mywifi', 'lihatwifi', 'passwordwifi'];
        return menuCommands.includes(command.toLowerCase());
    }
    /**
     * Show main menu
     */
    private static async showMainMenu(phone: string, customer: any): Promise<void> {
        // Customer is already validated and passed from caller
        if (!customer) {
            customer = await this.validateCustomer(phone);
            if (!customer) return;
        }

        // Determine customer status
        let statusIcon = '✅';
        let statusText = 'ACTIVE';
        let statusNote = '';

        if (customer.is_isolated === 1 || customer.is_isolated === true) {
            statusIcon = '🔴';
            statusText = 'TERBLOKIR';
            statusNote = '\n⚠️ *Layanan Internet Anda sedang diisolir.*\nMohon segera lakukan pembayaran agar internet aktif kembali.';
        } else if (customer.status === 'inactive') {
            statusIcon = '⚫';
            statusText = 'NONAKTIF';
        }

        const menu = `🏠 *MENU UTAMA*
Hai *${customer.name || 'Pelanggan'}*,

${statusIcon} Status: *${statusText}*${statusNote}

1️⃣ *Tagihan* - Cek Tagihan & Pembayaran
2️⃣ *Lapor Gangguan* - Lapor internet mati
3️⃣ *WiFi* - Ganti Password WiFi
4️⃣ *Reboot* - Restart Modem
5️⃣ *Bantuan* - Tanya CS
6️⃣ *Ganti Nama* - Ubah Nama Pelanggan
7️⃣ *Password WiFi* - Lihat Password WiFi

_Ketik angka (1-7) atau command:_
_/mywifi - Lihat password WiFi_
_/wifi - Ubah WiFi_
_Anda juga bisa chat langsung dengan AI Assistant kami._`;

        await this.sendMessage(phone, menu);
    }

    /**
     * Show invoices (for postpaid customers)
     */
    private static async showInvoices(phone: string): Promise<void> {
        try {
            // Validate customer access first
            const customer = await this.validateCustomer(phone);
            if (!customer) return;



            // Get unpaid invoices
            // Use COALESCE to handle NULL values safely
            const [invoices] = await databasePool.query<RowDataPacket[]>(
                `SELECT 
                    id, invoice_number, customer_id, period, due_date, 
                    COALESCE(total_amount, 0) as total_amount,
                    COALESCE(paid_amount, 0) as paid_amount,
                    COALESCE(remaining_amount, 0) as remaining_amount,
                    status, created_at
                 FROM invoices
                 WHERE customer_id = ?
                 AND status IN ('sent', 'partial', 'overdue')
                 AND COALESCE(remaining_amount, 0) > 0
                 ORDER BY due_date ASC
                 LIMIT 10`,
                [customer.id]
            );

            if (invoices.length === 0) {
                await this.sendMessage(phone, '✅ Semua tagihan Anda sudah lunas!');
                return;
            }

            let message = '📋 *TAGIHAN YANG BELUM DIBAYAR*\n\n';

            invoices.forEach((invoice, index) => {
                try {
                    // Safely parse amounts with fallback to 0
                    const remaining = parseFloat(String(invoice.remaining_amount || 0));
                    const total = parseFloat(String(invoice.total_amount || 0));
                    const paid = parseFloat(String(invoice.paid_amount || 0));

                    // Format due date safely
                    let dueDate = '-';
                    if (invoice.due_date) {
                        try {
                            const date = new Date(invoice.due_date);
                            if (!isNaN(date.getTime())) {
                                dueDate = date.toLocaleDateString('id-ID', {
                                    day: '2-digit',
                                    month: 'long',
                                    year: 'numeric'
                                });
                            }
                        } catch (dateError) {
                            console.warn(`[WhatsAppBot] Error formatting date for invoice ${invoice.id}:`, dateError);
                        }
                    }

                    let statusText = 'Belum Dibayar';
                    if (invoice.status === 'partial') {
                        statusText = 'Sebagian Dibayar';
                    } else if (invoice.status === 'overdue') {
                        statusText = 'Terlambat';
                    }

                    const invoiceNumber = invoice.invoice_number || `INV-${invoice.id || 'N/A'}`;

                    message += `${index + 1}. *${invoiceNumber}*\n`;
                    message += `   💰 Total: Rp ${total.toLocaleString('id-ID')}\n`;
                    message += `   💵 Dibayar: Rp ${paid.toLocaleString('id-ID')}\n`;
                    message += `   📊 Sisa: Rp ${remaining.toLocaleString('id-ID')}\n`;
                    message += `   📅 Jatuh Tempo: ${dueDate}\n`;
                    message += `   ⚠️ Status: ${statusText}\n\n`;
                } catch (invoiceError: any) {
                    console.error(`[WhatsAppBot] Error formatting invoice ${invoice.id || 'unknown'}:`, invoiceError);
                    // Add basic invoice info even if formatting fails
                    message += `${index + 1}. *${invoice.invoice_number || 'N/A'}*\n`;
                    message += `   Status: ${invoice.status || 'Unknown'}\n\n`;
                }
            });

            message += '*💡 Cara Membayar:*\n';
            message += '1. Transfer sesuai jumlah tagihan yang tersisa\n';
            message += '2. Kirim foto bukti transfer *KE NOMOR WA INI*\n';
            message += '3. Sistem akan verifikasi otomatis dengan AI\n';
            message += '4. Tagihan akan otomatis terupdate\n\n';
            message += '*Catatan:* Pastikan jumlah transfer sesuai dengan sisa tagihan.';

            await this.sendMessage(phone, message);

        } catch (error: any) {
            console.error('[WhatsAppBot] Error showing invoices:', error);
            console.error('[WhatsAppBot] Error details:', {
                message: error.message,
                stack: error.stack,
                phone: phone
            });
            await this.sendMessage(
                phone,
                '❌ Gagal memuat tagihan.\n\n' +
                'Silakan coba lagi atau hubungi customer service.\n' +
                'Error: ' + (error.message || 'Unknown error')
            );
        }
    }

    private static async showHelp(phone: string): Promise<void> {
        // Validate customer access first
        const customer = await this.validateCustomer(phone);
        if (!customer) return;

        const help = `📖 *BANTUAN*
Hai ${customer.name},

*Cara Membayar:*
1. Ketik: /tagihan (untuk lihat tagihan)
2. Transfer sesuai jumlah tagihan
3. Kirim foto bukti transfer *KE NOMOR WA INI*
4. Sistem akan verifikasi otomatis dengan AI

*Command yang Tersedia:*
/menu - Menu utama
/tagihan - Lihat tagihan
/wifi - Ubah WiFi
/reboot - Reboot ONT
/help - Bantuan

*Pertanyaan?*
Hubungi customer service untuk bantuan lebih lanjut.`;

        await this.sendMessage(phone, help);
    }

    /**
     * Show WiFi menu
     */
    private static async showWiFiMenu(phone: string): Promise<void> {
        // Validate customer access first
        const customer = await this.validateCustomer(phone);
        if (!customer) return;

        const menu = `📶 *UBAH WIFI*
        
Hai ${customer.name},

Anda dapat mengubah nama WiFi (SSID) dan/atau password WiFi Anda.

*Command yang tersedia:*

1️⃣ *Ubah SSID saja*
   /wifi_ssid [nama_baru]
   Contoh: /wifi_ssid MyHomeWiFi

2️⃣ *Ubah Password saja*
   /wifi_password [password_baru]
   Contoh: /wifi_password mypassword123

3️⃣ *Ubah SSID dan Password*
   /wifi_both [SSID]|[Password]
   Contoh: /wifi_both MyHomeWiFi|mypassword123

*⚠️ Catatan Penting:*
• Password minimal 8 karakter, maksimal 63 karakter
• Perubahan akan diterapkan dalam beberapa saat
• Perangkat WiFi Anda mungkin restart otomatis
• Setelah perubahan, sambungkan ulang dengan kredensial baru

Ketik /menu untuk kembali ke menu utama.`;

        await this.sendMessage(phone, menu);
    }

    /**
     * Show saved WiFi credentials from database
     * Pelanggan bisa melihat password WiFi yang sudah diset operator
     */
    private static async showSavedWiFiCredentials(phone: string): Promise<void> {
        try {
            // Validate customer access first
            const customer = await this.validateCustomer(phone);
            if (!customer) return;

            // Get WiFi credentials from database
            const [rows] = await databasePool.query<RowDataPacket[]>(
                `SELECT wifi_ssid, wifi_password FROM customers WHERE id = ?`,
                [customer.id]
            );

            if (rows.length === 0) {
                await this.sendMessage(phone, '❌ Data tidak ditemukan.');
                return;
            }

            const wifiSSID = rows[0].wifi_ssid;
            const wifiPassword = rows[0].wifi_password;

            if (!wifiSSID && !wifiPassword) {
                await this.sendMessage(
                    phone,
                    `📶 *INFORMASI WIFI*\n\n` +
                    `Hai ${customer.name},\n\n` +
                    `⚠️ SSID dan Password WiFi Anda belum tersimpan di sistem.\n\n` +
                    `Silakan hubungi customer service untuk mendapatkan informasi WiFi Anda, ` +
                    `atau gunakan perintah /wifi untuk mengubah password WiFi.\n\n` +
                    `Ketik /menu untuk kembali ke menu utama.`
                );
                return;
            }

            // Build response message
            let message = `📶 *INFORMASI WIFI ANDA*\n\n`;
            message += `Hai *${customer.name}*,\n\n`;
            message += `Berikut adalah informasi WiFi Anda:\n\n`;

            if (wifiSSID) {
                message += `📡 *SSID:* ${wifiSSID}\n`;
            }
            if (wifiPassword) {
                message += `🔑 *Password:* ${wifiPassword}\n`;
            }

            message += `\n💡 *Tips:*\n`;
            message += `• Pastikan password diketik dengan benar (huruf besar/kecil berbeda)\n`;
            message += `• Jika tidak bisa konek, coba restart perangkat dengan perintah /reboot\n`;
            message += `• Untuk mengubah password, ketik /wifi\n\n`;
            message += `⚠️ *Jaga kerahasiaan password Anda!*\n\n`;
            message += `Ketik /menu untuk kembali ke menu utama.`;

            await this.sendMessage(phone, message);

        } catch (error: any) {
            console.error('[WhatsAppBot] Error showing saved WiFi credentials:', error);
            await this.sendMessage(
                phone,
                '❌ Gagal mengambil informasi WiFi.\n' +
                'Silakan coba lagi atau hubungi customer service.'
            );
        }
    }

    /**
     * Reboot ONT
     */
    private static async rebootOnt(phone: string): Promise<void> {
        // Validate customer access
        const customer = await this.validateCustomer(phone);
        if (!customer) return;

        await this.sendMessage(phone, '⏳ Sedang memproses permintaan reboot ONT...');

        const wifiService = new WiFiManagementService();
        const result = await wifiService.rebootCustomerDevice(customer.id);

        if (result.success) {
            await this.sendMessage(
                phone,
                '✅ *Reboot Berhasil!*\n\n' +
                'Perangkat ONT sedang direstart.\n' +
                'Internet akan terputus sementara (sekitar 2-3 menit).\n' +
                'Silakan tunggu hingga lampu indikator normal kembali.'
            );
        } else {
            await this.sendMessage(
                phone,
                `❌ *Gagal Reboot*\n\n` +
                `Error: ${result.message}\n\n` +
                `Silakan coba lagi atau hubungi customer service.`
            );
        }
    }

    /**
     * Handle Report Command (SLA Start)
     */
    private static async handleReportCommand(phone: string, description: string): Promise<void> {
        const customer = await this.validateCustomer(phone);
        if (!customer) return;

        try {
            // Check for existing open ticket
            const [existing] = await databasePool.query<RowDataPacket[]>(
                "SELECT id, ticket_number FROM tickets WHERE customer_id = ? AND status = 'open'",
                [customer.id]
            );

            if (existing.length > 0) {
                await this.sendMessage(
                    phone,
                    `⚠️ *Laporan Sudah Ada*\n\n` +
                    `Anda masih memiliki tiket terbuka *#${existing[0].ticket_number}*.\n` +
                    `Mohon tunggu penyelesaian atau ketik */selesai* jika layanan sudah normal kembali.`
                );
                return;
            }

            const ticketNumber = `T${Date.now().toString().slice(-6)}`;
            const subject = description ? `Laporan: ${description}` : 'Gangguan Internet (Via WA)';

            await databasePool.query(
                "INSERT INTO tickets (customer_id, ticket_number, subject, description, status, reported_at) VALUES (?, ?, ?, ?, 'open', NOW())",
                [customer.id, ticketNumber, subject, description || 'Tidak ada deskripsi']
            );

            await this.sendMessage(
                phone,
                `✅ *Laporan Diterima*\n\n` +
                `Tiket: *#${ticketNumber}*\n` +
                `Waktu: ${new Date().toLocaleTimeString('id-ID')}\n\n` +
                `⏳ Waktu downtime mulai dihitung untuk perhitungan diskon SLA.\n\n` +
                `Ketik */selesai* jika layanan sudah kembali normal.`
            );

        } catch (error) {
            console.error('Error creating ticket:', error);
            await this.sendMessage(phone, '❌ Gagal membuat laporan. Silakan coba lagi.');
        }
    }

    /**
     * Handle Resolve Command (SLA Stop)
     */
    private static async handleResolveCommand(phone: string): Promise<void> {
        const customer = await this.validateCustomer(phone);
        if (!customer) return;

        try {
            const [tickets] = await databasePool.query<RowDataPacket[]>(
                "SELECT id, ticket_number, reported_at FROM tickets WHERE customer_id = ? AND status = 'open'",
                [customer.id]
            );

            if (tickets.length === 0 || !tickets[0]) {
                await this.sendMessage(phone, `ℹ️ Anda tidak memiliki laporan gangguan yang sedang aktif.`);
                return;
            }

            const ticket = tickets[0];
            await databasePool.query(
                "UPDATE tickets SET status = 'closed', resolved_at = NOW() WHERE id = ?",
                [ticket.id]
            );

            // Calculate duration for info
            const reportedAt = new Date(ticket.reported_at);
            const resolvedAt = new Date();
            const durationMs = resolvedAt.getTime() - reportedAt.getTime();

            const hours = Math.floor(durationMs / 3600000);
            const minutes = Math.floor((durationMs % 3600000) / 60000);
            const durationStr = hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`;

            await this.sendMessage(
                phone,
                `✅ *Laporan Ditutup*\n\n` +
                `Tiket: *#${ticket.ticket_number}*\n` +
                `Durasi Gangguan: *${durationStr}*\n\n` +
                `Status SLA dan diskon akan dihitung otomatis pada tagihan bulan berikutnya.\n` +
                `Terima kasih.`
            );

        } catch (error) {
            console.error('Error closing ticket:', error);
            await this.sendMessage(phone, '❌ Gagal menutup laporan.');
        }
    }

    /**
     * Change WiFi SSID only
     */
    private static async changeWiFiSSID(phone: string, newSSID: string): Promise<void> {
        try {
            if (!newSSID || newSSID.length === 0) {
                await this.sendMessage(
                    phone,
                    '❌ *SSID tidak boleh kosong!*\n\n' +
                    'Gunakan format: /wifi_ssid [nama_baru]\n' +
                    'Contoh: /wifi_ssid MyHomeWiFi'
                );
                return;
            }

            // Validate customer access
            const customer = await this.validateCustomer(phone);
            if (!customer) return;

            // Get device ID
            const wifiService = new WiFiManagementService();
            const deviceId = await wifiService.getCustomerDeviceId(customer.id);

            if (!deviceId) {
                await this.sendMessage(
                    phone,
                    '❌ *Device tidak ditemukan*\n\n' +
                    'Akun Anda belum terhubung dengan perangkat WiFi.\n' +
                    'Silakan hubungi customer service.'
                );
                return;
            }

            await this.sendMessage(phone, '⏳ Sedang memproses perubahan SSID WiFi...');

            // Change WiFi SSID
            const result = await wifiService.changeWiFiCredentials(deviceId, newSSID, undefined);

            // Save request to database
            await wifiService.saveWiFiChangeRequest({
                customerId: customer.id,
                customerName: customer.name,
                phone: phone,
                deviceId: deviceId,
                newSSID: newSSID,
                requestedAt: new Date(),
                status: result.success ? 'completed' : 'failed',
                errorMessage: result.success ? undefined : result.message
            });

            if (result.success) {
                // Auto-reboot
                const rebootRes = await wifiService.rebootCustomerDevice(customer.id);
                const rebootMsg = rebootRes.success ? "\n🔄 Perangkat sedang direboot otomatis." : "\n⚠️ Gagal auto-reboot, silakan ketik /reboot manual.";

                await this.sendMessage(
                    phone,
                    `✅ *SSID WiFi Berhasil Diubah!*\n\n` +
                    `SSID Baru: *${newSSID}*\n\n` +
                    `Perubahan akan diterapkan dalam beberapa saat.\n` +
                    `Silakan sambungkan ulang perangkat Anda dengan SSID baru.` +
                    rebootMsg
                );
            } else {
                await this.sendMessage(
                    phone,
                    `❌ *Gagal Mengubah SSID*\n\n` +
                    `Error: ${result.message}\n\n` +
                    `Silakan coba lagi atau hubungi customer service.`
                );
            }

        } catch (error: any) {
            console.error('[WhatsAppBot] Error changing WiFi SSID:', error);
            await this.sendMessage(
                phone,
                '❌ Terjadi kesalahan saat mengubah SSID WiFi.\n' +
                'Silakan coba lagi atau hubungi customer service.'
            );
        }
    }

    /**
     * Change WiFi Password only
     */
    private static async changeWiFiPassword(phone: string, newPassword: string): Promise<void> {
        try {
            if (!newPassword || newPassword.length < 8) {
                await this.sendMessage(
                    phone,
                    '❌ *Password tidak valid!*\n\n' +
                    'Password minimal 8 karakter.\n\n' +
                    'Gunakan format: /wifi_password [password_baru]\n' +
                    'Contoh: /wifi_password mypassword123'
                );
                return;
            }

            // Validate customer access
            const customer = await this.validateCustomer(phone);
            if (!customer) return;

            // Get device ID
            const wifiService = new WiFiManagementService();
            const deviceId = await wifiService.getCustomerDeviceId(customer.id);

            if (!deviceId) {
                await this.sendMessage(
                    phone,
                    '❌ *Device tidak ditemukan*\n\n' +
                    'Akun Anda belum terhubung dengan perangkat WiFi.\n' +
                    'Silakan hubungi customer service.'
                );
                return;
            }

            await this.sendMessage(phone, '⏳ Sedang memproses perubahan password WiFi...');

            // Change WiFi Password
            const result = await wifiService.changeWiFiCredentials(deviceId, undefined, newPassword);

            // Save request to database
            await wifiService.saveWiFiChangeRequest({
                customerId: customer.id,
                customerName: customer.name,
                phone: phone,
                deviceId: deviceId,
                newPassword: newPassword,
                requestedAt: new Date(),
                status: result.success ? 'completed' : 'failed',
                errorMessage: result.success ? undefined : result.message
            });

            if (result.success) {
                // Auto-reboot
                const rebootRes = await wifiService.rebootCustomerDevice(customer.id);
                const rebootMsg = rebootRes.success ? "\n🔄 Perangkat sedang direboot otomatis." : "\n⚠️ Gagal auto-reboot, silakan ketik /reboot manual.";

                await this.sendMessage(
                    phone,
                    `✅ *Password WiFi Berhasil Diubah!*\n\n` +
                    `Password Baru: *${newPassword}*\n\n` +
                    `⚠️ PENTING: Simpan password ini dengan aman!\n\n` +
                    `Perubahan akan diterapkan dalam beberapa saat.\n` +
                    `Silakan sambungkan ulang perangkat Anda dengan password baru.` +
                    rebootMsg
                );
            } else {
                await this.sendMessage(
                    phone,
                    `❌ *Gagal Mengubah Password*\n\n` +
                    `Error: ${result.message}\n\n` +
                    `Silakan coba lagi atau hubungi customer service.`
                );
            }

        } catch (error: any) {
            console.error('[WhatsAppBot] Error changing WiFi password:', error);
            await this.sendMessage(
                phone,
                '❌ Terjadi kesalahan saat mengubah password WiFi.\n' +
                'Silakan coba lagi atau hubungi customer service.'
            );
        }
    }

    /**
     * Change both WiFi SSID and Password
     */
    private static async changeWiFiBoth(phone: string, newSSID: string, newPassword: string): Promise<void> {
        try {
            if (!newSSID || newSSID.length === 0) {
                await this.sendMessage(
                    phone,
                    '❌ *SSID tidak boleh kosong!*'
                );
                return;
            }

            if (!newPassword || newPassword.length < 8) {
                await this.sendMessage(
                    phone,
                    '❌ *Password tidak valid!*\n\n' +
                    'Password minimal 8 karakter.'
                );
                return;
            }

            // Validate customer access
            const customer = await this.validateCustomer(phone);
            if (!customer) return;

            // Get device ID
            const wifiService = new WiFiManagementService();
            const deviceId = await wifiService.getCustomerDeviceId(customer.id);

            if (!deviceId) {
                await this.sendMessage(
                    phone,
                    '❌ *Device tidak ditemukan*\n\n' +
                    'Akun Anda belum terhubung dengan perangkat WiFi.\n' +
                    'Silakan hubungi customer service.'
                );
                return;
            }

            await this.sendMessage(phone, '⏳ Sedang memproses perubahan SSID dan Password WiFi...');

            // Change both
            const result = await wifiService.changeWiFiCredentials(deviceId, newSSID, newPassword);

            // Save request to database
            await wifiService.saveWiFiChangeRequest({
                customerId: customer.id,
                customerName: customer.name,
                phone: phone,
                deviceId: deviceId,
                newSSID: newSSID,
                newPassword: newPassword,
                requestedAt: new Date(),
                status: result.success ? 'completed' : 'failed',
                errorMessage: result.success ? undefined : result.message
            });

            if (result.success) {
                // Auto-reboot
                const rebootRes = await wifiService.rebootCustomerDevice(customer.id);
                const rebootMsg = rebootRes.success ? "\n🔄 Perangkat sedang direboot otomatis." : "\n⚠️ Gagal auto-reboot, silakan ketik /reboot manual.";

                await this.sendMessage(
                    phone,
                    `✅ *WiFi Berhasil Diubah!*\n\n` +
                    `SSID Baru: *${newSSID}*\n` +
                    `Password Baru: *${newPassword}*\n\n` +
                    `⚠️ PENTING: Simpan kredensial ini dengan aman!\n\n` +
                    `Perubahan akan diterapkan dalam beberapa saat.\n` +
                    `Silakan sambungkan ulang perangkat Anda dengan kredensial baru.` +
                    rebootMsg
                );
            } else {
                await this.sendMessage(
                    phone,
                    `❌ *Gagal Mengubah WiFi*\n\n` +
                    `Error: ${result.message}\n\n` +
                    `Silakan coba lagi atau hubungi customer service.`
                );
            }

        } catch (error: any) {
            console.error('[WhatsAppBot] Error changing WiFi credentials:', error);
            await this.sendMessage(
                phone,
                '❌ Terjadi kesalahan saat mengubah WiFi.\n' +
                'Silakan coba lagi atau hubungi customer service.'
            );
        }
    }

    /**
     * Resolve LID (Linked Identity ID) to a phone number if mapping exists
     */
    private static resolveLid(id: string): string {
        try {
            const cleanId = id.split('@')[0];
            const authDir = path.join(process.cwd(), 'baileys_auth');
            if (fs.existsSync(authDir)) {
                const files = fs.readdirSync(authDir).filter(f => f.startsWith('lid-mapping-') && f.endsWith('.json'));
                for (const file of files) {
                    const content = fs.readFileSync(path.join(authDir, file), 'utf-8').replace(/"/g, '').trim();
                    if (content === cleanId) {
                        const phone = file.replace('lid-mapping-', '').replace('.json', '');
                        console.log(`[WhatsAppBot] 🚀 Resolved LID ${cleanId} to phone: ${phone}`);
                        return phone;
                    }
                }
            }
        } catch (err) {
            // Ignore errors during resolution
        }
        return id;
    }

    /**
     * Get customer by phone number (helper)
     */
    private static async getCustomerByPhone(phone: string): Promise<any | null> {
        try {
            let normalizedPhone = this.resolveLid(phone).split('@')[0].trim();

            // AGGRESSIVE NORMALIZATION: Remove ALL non-digit characters
            const digitsOnly = normalizedPhone.replace(/\D/g, '');
            console.log(`[WhatsAppBot] 🔍 Looking for customer with phone: ${normalizedPhone} (Digits: ${digitsOnly})`);

            // Prepare multiple formats to search
            const phoneVariants: string[] = [];

            // Add original cleaned version
            phoneVariants.push(digitsOnly);

            // Add with 62 prefix if starts with 0
            if (digitsOnly.startsWith('0')) {
                phoneVariants.push('62' + digitsOnly.substring(1));
            }
            // Add with 0 prefix if starts with 62
            if (digitsOnly.startsWith('62')) {
                phoneVariants.push('0' + digitsOnly.substring(2));
            }
            // Also add the original normalized (might have formatting)
            phoneVariants.push(normalizedPhone);

            // Remove duplicates
            const uniqueVariants = [...new Set(phoneVariants)];
            console.log(`[WhatsAppBot]   → Searching for variants: ${uniqueVariants.join(', ')}`);

            // Try exact match first with all variants
            const placeholders = uniqueVariants.map(() => '?').join(', ');
            const [customersExact] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') IN (${placeholders}) LIMIT 1`,
                uniqueVariants
            );

            if (customersExact.length > 0) {
                console.log(`[WhatsAppBot]   ✅ FOUND via exact match!`);
                return customersExact[0];
            }
            console.log(`[WhatsAppBot]   ❌ Not found via exact match, trying LIKE...`);

            // Fallback: LIKE search with digits only (last 9 digits to avoid prefix issues)
            const lastNineDigits = digitsOnly.slice(-9);
            if (lastNineDigits.length >= 9) {
                console.log(`[WhatsAppBot]   → Query 2: LIKE search for last 9 digits "%${lastNineDigits}"`);
                const [customersLike] = await databasePool.query<RowDataPacket[]>(
                    `SELECT * FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ? LIMIT 1`,
                    [`%${lastNineDigits}`]
                );
                if (customersLike.length > 0) {
                    console.log(`[WhatsAppBot]   ✅ FOUND via LIKE search!`);
                    return customersLike[0];
                }
                console.log(`[WhatsAppBot]   ❌ Not found via LIKE search`);
            }

            console.log(`[WhatsAppBot]   ❌ Customer NOT FOUND after all attempts (Raw: ${phone}, Norm: ${normalizedPhone})`);
            return null;
        } catch (error: any) {
            console.error('[WhatsAppBot] ❌ Error getting customer by phone:', error);
            // Return null instead of throwing to prevent global error handler from sending "System Error"
            return null;
        }
    }


    /**
     * Send message helper
     */
    private static async sendMessage(dest: string, message: string): Promise<void> {
        try {
            let targetJid = dest;

            // If destination is just a phone number (no @ suffix), try to resolve its LID mapping
            if (!targetJid.includes('@')) {
                const authDir = path.join(process.cwd(), 'baileys_auth');
                const mappingFile = path.join(authDir, `lid-mapping-${targetJid}.json`);
                if (fs.existsSync(mappingFile)) {
                    const lid = fs.readFileSync(mappingFile, 'utf-8').replace(/"/g, '').trim();
                    console.log(`[WhatsAppBot] 🚀 Resolved phone ${targetJid} back to LID: ${lid}@lid`);
                    targetJid = `${lid}@lid`;
                }
            }

            await WhatsAppService.sendMessage(targetJid, message);
        } catch (error: any) {
            console.error('[WhatsAppBot] Error sending message:', error);
        }
    }
    /**
     * Handle Admin Commands
     */
    private static async handleAdminCommand(message: WhatsAppMessageInterface, adminPhone: string, command: string): Promise<void> {
        const cmd = command.toLowerCase().trim();

        if (cmd === '/adm_offline') {
            await this.checkOfflineCustomers(adminPhone);
        } else if (cmd.startsWith('/adm_wifi ')) {
            // /adm_wifi [kode_pelanggan] [ssid] [password]
            const parts = command.split(' ');
            if (parts.length < 4) {
                await this.sendMessage(adminPhone, '❌ Format salah.\nGunakan: /adm_wifi [kode_plgn] [ssid] [pass]');
                return;
            }
            const code = parts[1];
            const ssid = parts[2];
            const password = parts.slice(3).join(' ');

            await this.adminChangeWifi(adminPhone, code, ssid, password);
        } else if (cmd.startsWith('/adm_cek ')) {
            const parts = command.split(' ');
            if (parts.length < 2) {
                await this.sendMessage(adminPhone, '❌ Format: /adm_cek [kode_pelanggan]');
                return;
            }
            await this.checkCustomerDevice(adminPhone, parts[1]);
        } else {
            await this.sendMessage(adminPhone, '🛠️ *ADMIN COMMANDS*\n\n/adm_offline - Cek pelanggan offline\n/adm_cek [kode] - Cek Sinyal & Status Device\n/adm_wifi [kode] [ssid] [pass] - Ganti WiFi Pelanggan');
        }
    }

    /**
     * Check Offline Customers (Admin Feature)
     */
    private static async checkOfflineCustomers(adminPhone: string): Promise<void> {
        await this.sendMessage(adminPhone, '⏳ Checking offline customers...');

        try {
            const mikrotik = await MikrotikService.getInstance();
            const activeSessions = await mikrotik.getActivePPPoESessions();
            const activeUsernames = new Set(activeSessions.map(s => s.name));

            const [customers] = await databasePool.query<RowDataPacket[]>(`
                 SELECT id, name, customer_code, pppoe_username, odc_id 
                 FROM customers 
                 WHERE status = 'active' AND connection_type = 'pppoe'
                 ORDER BY name ASC
            `);

            const offline = [];
            for (const c of customers) {
                if (c.pppoe_username && !activeUsernames.has(c.pppoe_username)) {
                    offline.push(c);
                }
            }

            let msg = `📉 *OFFLINE REPORT*\nTotal Offline: ${offline.length}\n\n`;
            if (offline.length === 0) {
                msg += '✅ Semua pelanggan ONLINE.';
            } else {
                offline.slice(0, 50).forEach(c => { // Limit list
                    msg += `• ${c.name} (${c.customer_code})\n`;
                });
                if (offline.length > 50) msg += `\n...dan ${offline.length - 50} lainnya.`;
            }

            await this.sendMessage(adminPhone, msg);
        } catch (err: any) {
            console.error('Check Offline Error:', err);
            await this.sendMessage(adminPhone, '❌ Gagal check offline: ' + err.message);
        }
    }
    /**
     * Check Customer Device Info (Signal/Status)
     */
    private static async checkCustomerDevice(adminPhone: string, code: string): Promise<void> {
        try {
            await this.sendMessage(adminPhone, `⏳ Checking device for customer ${code}...`);

            // Find customer
            const [rows] = await databasePool.query<RowDataPacket[]>(
                "SELECT id, name, device_id FROM customers WHERE customer_code = ?",
                [code]
            );

            if (rows.length === 0) {
                await this.sendMessage(adminPhone, '❌ Customer not found.');
                return;
            }
            const customer = rows[0];

            if (!customer.device_id) {
                await this.sendMessage(adminPhone, `❌ Customer ${customer.name} has no device linked.`);
                return;
            }

            const genieacs = await GenieacsService.getInstanceFromDb();
            const device = await genieacs.getDevice(customer.device_id);

            if (!device) {
                await this.sendMessage(adminPhone, `❌ Device not found in GenieACS.`);
                return;
            }

            const info = genieacs.extractDeviceInfo(device);

            // Format message
            const msg = `📊 *DEVICE INFO - ${customer.name}*\n` +
                `---------------------------\n` +
                `Status: ${info.isOnline ? '✅ ONLINE' : '🔴 OFFLINE'}\n` +
                `IP: ${info.ipAddress || 'N/A'}\n` +
                `Last Inform: ${info.lastInform ? info.lastInform.toLocaleString('id-ID') : 'Never'}\n\n` +
                `*OPTICAL SIGNAL* 📡\n` +
                `Rx Power: ${info.signal.rxPower}\n` +
                `Tx Power: ${info.signal.txPower}\n` +
                `Temp: ${info.signal.temperature}\n` +
                `---------------------------`;

            await this.sendMessage(adminPhone, msg);

        } catch (err: any) {
            console.error('Check Device Error:', err);
            await this.sendMessage(adminPhone, '❌ Error: ' + err.message);
        }
    }

    /**
     * Admin Change Wifi
     */
    private static async adminChangeWifi(adminPhone: string, code: string, ssid: string, pass: string): Promise<void> {
        try {
            // Find customer by code
            const [rows] = await databasePool.query<RowDataPacket[]>(
                "SELECT id, name FROM customers WHERE customer_code = ?",
                [code]
            );

            if (rows.length === 0) {
                await this.sendMessage(adminPhone, '❌ Customer not found with code: ' + code);
                return;
            }
            const customer = rows[0];

            const wifiService = new WiFiManagementService();
            const deviceId = await wifiService.getCustomerDeviceId(customer.id);

            if (!deviceId) {
                await this.sendMessage(adminPhone, `❌ Customer ${customer.name} has no device linked.`);
                return;
            }

            await this.sendMessage(adminPhone, `⏳ Changing WiFi for ${customer.name}...`);

            const result = await wifiService.changeWiFiCredentials(deviceId, ssid, pass);

            // Save request log
            await wifiService.saveWiFiChangeRequest({
                customerId: customer.id,
                customerName: customer.name,
                phone: adminPhone, // Admin phone doing request
                deviceId: deviceId,
                newSSID: ssid,
                newPassword: pass,
                requestedAt: new Date(),
                status: result.success ? 'completed' : 'failed',
                errorMessage: result.success ? undefined : `ADMIN-REQ: ${result.message}`
            });

            if (result.success) {
                await this.sendMessage(adminPhone, `✅ Success change WiFi for ${customer.name}\nSSID: ${ssid}\nPass: ${pass}`);
            } else {
                await this.sendMessage(adminPhone, `❌ Failed: ${result.message}`);
            }
        } catch (err: any) {
            console.error('Admin Wifi Change Error:', err);
            await this.sendMessage(adminPhone, '❌ Error: ' + err.message);
        }
    }
}

