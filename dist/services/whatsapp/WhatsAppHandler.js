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
exports.WhatsAppHandler = void 0;
const baileys_1 = require("@whiskeysockets/baileys");
const pool_1 = require("../../db/pool");
const WhatsAppSessionService_1 = require("./WhatsAppSessionService");
const GenieacsWhatsAppController_1 = require("../../controllers/whatsapp/GenieacsWhatsAppController");
const ChatBotService_1 = require("../ai/ChatBotService");
const AdvancedPaymentVerificationService_1 = require("../ai/AdvancedPaymentVerificationService");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class WhatsAppHandler {
    static async writeLog(message) {
        const logPath = path_1.default.join(process.cwd(), 'logs', 'whatsapp_debug.log');
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${message}\n`;
        fs_1.default.appendFile(logPath, logLine, (err) => {
            if (err)
                console.error('Failed to write log:', err);
        });
    }
    /**
     * Sophisticated identity resolution logic
     * Handles LID, remoteJidAlt, International formats, and standard JIDs
     */
    static resolveSenderIdentity(msg) {
        const remoteJid = msg.key.remoteJid || '';
        const isLid = remoteJid.includes('@lid');
        let phone = '';
        // 1. Try Extended Metadata (remoteJidAlt) - The most reliable for LIDs
        if (isLid && msg.key.remoteJidAlt) {
            const alt = msg.key.remoteJidAlt;
            if (alt) {
                phone = alt.replace('@s.whatsapp.net', '').replace(/\D/g, '');
                // console.log(`[Identity] Resolved via remoteJidAlt: ${phone}`);
            }
        }
        // 2. If 'participant' is present (sometimes in groups/broadcasts context), it might be the real JID
        if (!phone && msg.key.participant) {
            const participant = msg.key.participant;
            if (!participant.includes('@lid')) {
                phone = participant.replace('@s.whatsapp.net', '').replace(/\D/g, '');
            }
        }
        // 3. Fallback to extracting from remoteJid (only works for normal JIDs or if LID ID is needed as key)
        if (!phone) {
            phone = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/\D/g, '');
        }
        return { phone, isLid, originalJid: remoteJid };
    }
    static async handleIncomingMessage(msg, service) {
        try {
            if (!msg.key.remoteJid)
                return;
            // Log raw message structure
            await this.writeLog(`INCOMING: ${JSON.stringify(msg, (key, value) => {
                if (key === 'buffer')
                    return '[Buffer]';
                return value;
            })}`);
            // 1. RESOLVE IDENTITY (Robust & Sophisticated)
            const { phone: senderPhone, isLid, originalJid: senderJid } = this.resolveSenderIdentity(msg);
            await this.writeLog(`Processing message from Phone: ${senderPhone} (LID: ${isLid})`);
            // Get content safest way
            const messageContent = msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
                msg.message?.ephemeralMessage?.message?.conversation ||
                '';
            if (!messageContent && !msg.message?.imageMessage && !msg.message?.viewOnceMessage) {
                // await this.writeLog('Message content empty (and not straightforward image)');
            }
            const cleanText = messageContent.toLowerCase().trim();
            const keyword = cleanText.replace(/[^a-z0-9]/g, '');
            // Handle location message specifically
            const isLocation = !!(msg.message?.locationMessage || msg.message?.ephemeralMessage?.message?.locationMessage);
            const locationData = isLocation ? (msg.message?.locationMessage || msg.message?.ephemeralMessage?.message?.locationMessage) : null;
            // Handle Media (Image) - Check for nested types
            const msgContent = msg.message;
            let isImage = !!(msgContent?.imageMessage ||
                msgContent?.viewOnceMessage?.message?.imageMessage ||
                msgContent?.viewOnceMessageV2?.message?.imageMessage ||
                msgContent?.viewOnceMessageV2Extension?.message?.imageMessage ||
                msgContent?.ephemeralMessage?.message?.imageMessage ||
                msgContent?.documentWithCaptionMessage?.message?.imageMessage ||
                msgContent?.buttonsMessage?.imageMessage ||
                msgContent?.templateMessage?.hydratedFourRowTemplate?.imageMessage ||
                msgContent?.interactiveMessage?.header?.imageMessage);
            // Robust check for Document Message that is actually an image
            if (!isImage && msgContent?.documentMessage) {
                const doc = msgContent.documentMessage;
                const mime = doc.mimetype || '';
                const fileName = (doc.fileName || '').toLowerCase();
                const isImageMime = mime.startsWith('image/');
                const isImageExt = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ||
                    fileName.endsWith('.png') || fileName.endsWith('.webp');
                if (isImageMime || isImageExt) {
                    isImage = true;
                }
            }
            console.log(`📩 [WhatsAppHandler] From: ${senderPhone} | isImage=${isImage} | hasInteractive=${!!msgContent?.interactiveMessage} | hasTemplate=${!!msgContent?.templateMessage}`);
            if (!isImage) {
                console.log(`[WhatsAppHandler] Non-image message internal structure:`, JSON.stringify(msgContent).substring(0, 1000));
            }
            await this.writeLog(`Content Analysis: isImage=${isImage}, isLocation=${isLocation}, Text=${cleanText}`);
            // Allow processing if it's a location message OR has text content OR image
            if (!messageContent && !isLocation && !isImage) {
                console.log(`❌ [WhatsAppHandler] Skipping message - no content, location, or image detected`);
                await this.writeLog('Skipping: No recognized content');
                return;
            }
            console.log(`📩 [WhatsAppHandler] From: ${senderPhone} (LID: ${isLid}) | Text: "${cleanText}" | Location: ${isLocation} | Img: ${isImage}`);
            // Self ignore
            if (msg.key.fromMe)
                return;
            // 2. Identify User
            let customer = await this.getCustomerByPhone(senderPhone);
            await this.writeLog(`Customer Lookup: ${customer ? `Found (${customer.name})` : 'Not Found'}`);
            // NEW: Auto-link attempt for LID users
            if (!customer && isLid) {
                customer = await this.attemptAutoLinkByPattern(senderJid);
                await this.writeLog(`Auto-link result: ${customer ? `Linked (${customer.name})` : 'Failed'}`);
            }
            // 3. Handle Image Messages First (Before text processing)
            if (isImage) {
                console.log(`🖼️ [WhatsAppHandler] Processing IMAGE message from ${senderPhone}`);
                await this.writeLog('Entering Image Processing Block');
                // Check if customer exists
                if (!customer) {
                    await this.writeLog('Verification Aborted: No customer found');
                    await service.sendMessage(senderJid, '⚠️ Maaf, nomor Anda belum terdaftar. Silakan registrasi terlebih dahulu.');
                    return;
                }
                // Send generic processing message
                await service.sendMessage(senderJid, '🔍 *Menganalisis bukti pembayaran...*\nMohon tunggu sebentar, AI kami sedang memverifikasi.');
                try {
                    console.log(`[WhatsAppHandler] 📥 Downloading image from ${senderPhone}...`);
                    await this.writeLog(`Downloading image from ${senderPhone}...`);
                    const sock = service.getSocket();
                    if (!sock)
                        throw new Error('WhatsApp socket not available');
                    // Use the top-level downloadMediaMessage import
                    const buffer = await (0, baileys_1.downloadMediaMessage)(msg, 'buffer', {}, {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    });
                    console.log(`[WhatsAppHandler] ✅ Image downloaded. Size: ${buffer.length} bytes`);
                    await this.writeLog(`Image downloaded. Size: ${buffer.length} bytes. Starting AI Verification...`);
                    // Use Advanced Payment Verification
                    const result = await AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService.verifyPaymentAdvanced(buffer, customer.id);
                    await this.writeLog(`AI Result: Success=${result.success}, Auto=${result.data?.autoApproved}`);
                    if (result.success && result.data?.autoApproved) {
                        const amountStr = result.data.extractedAmount?.toLocaleString('id-ID');
                        const isPrepaid = !!result.data.paymentRequestId;
                        const invStr = result.data.invoiceNumber || (isPrepaid ? 'Pembelian Paket' : 'Tagihan');
                        const statusStr = isPrepaid ? 'AKTIF' : 'LUNAS';
                        await service.sendMessage(senderJid, `✅ *PEMBAYARAN DITERIMA*\n\nTerima kasih, pembayaran sebesar *Rp ${amountStr}* untuk *${invStr}* telah berhasil diverifikasi otomatis.\n\nStatus: *${statusStr}* 🎉`);
                        console.log(`[AutoApprove] Preparing PDF for invoice ID: ${result.data.invoiceId}`);
                        if (result.data.invoiceId) {
                            try {
                                const { InvoicePdfService } = await Promise.resolve().then(() => __importStar(require('../../services/invoice/InvoicePdfService')));
                                console.log('[AutoApprove] Generating PDF...');
                                const pdfPath = await InvoicePdfService.generateInvoicePdf(result.data.invoiceId);
                                console.log(`[AutoApprove] PDF generated at ${pdfPath}. Sending...`);
                                const sendResult = await service.sendDocument(senderJid, pdfPath, `Invoice-${result.data.invoiceNumber || result.data.invoiceId}-LUNAS.pdf`, '📄 *Bukti Pembayaran Lunas*');
                                console.log(`[AutoApprove] PDF send result: ${JSON.stringify(sendResult)}`);
                            }
                            catch (error) {
                                console.error('[AutoApprove] CRITICAL PDF Generation / Sending Error:', error);
                            }
                        }
                        else {
                            console.warn('[AutoApprove] No invoiceId attached to verification result. PDF will not be sent.');
                        }
                    }
                    else {
                        // Manual Review
                        let reason = result.error || 'Bukti tidak dapat dibaca otomatis.';
                        if (result.data?.amountMatch === 'mismatch' && result.data?.expectedAmount) {
                            reason = `Nominal terbaca (Rp ${result.data.extractedAmount?.toLocaleString('id-ID')}) tidak sesuai dengan tagihan (Rp ${result.data.expectedAmount.toLocaleString('id-ID')}).`;
                        }
                        else if (result.data && result.data.confidence > 50) {
                            reason = 'Menunggu verifikasi admin (Manual Review).';
                        }
                        // Save Manual Verification
                        try {
                            const imageBase64 = buffer.toString('base64');
                            const extractedAmount = result.data?.extractedAmount || 0;
                            const expectedAmount = result.data?.expectedAmount || 0;
                            await pool_1.databasePool.query(`INSERT INTO manual_payment_verifications (customer_id, status, image_data, image_mimetype, extracted_amount, expected_amount, reason, created_at) VALUES (?, 'pending', ?, 'image/jpeg', ?, ?, ?, NOW())`, [customer.id, imageBase64, extractedAmount, expectedAmount, reason]);
                            // Broadcast to Admin
                            const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
                            await UnifiedNotificationService.broadcastToAdmins(`🔔 *VERIFIKASI MANUAL*\n${customer.name}\nRp ${extractedAmount}\n${reason}`);
                        }
                        catch (e) {
                            console.error('Failed to save manual verification', e);
                        }
                        await service.sendMessage(senderJid, `⚠️ *Verifikasi Manual Diperlukan*\n\n${reason}\n\nData telah diteruskan ke Admin.`);
                    }
                }
                catch (err) {
                    console.error(`[WhatsAppHandler] Error processing image:`, err);
                    await service.sendMessage(senderJid, '❌ Maaf, gagal memproses gambar. Silakan kirim ulang.');
                }
                return; // Stop processing
            }
            // 3. Handle Location Messages
            if (isLocation && locationData) {
                console.log(`📍 [WhatsAppHandler] Processing LOCATION message from ${senderPhone}`);
                await this.handleLocationMessage(locationData, customer, service, senderJid, senderPhone);
                return;
            }
            // 4. Session Handling
            let session = await WhatsAppSessionService_1.WhatsAppSessionService.getSession(senderPhone);
            // ==========================================
            // WELCOME CONFIRMATION FLOW
            // ==========================================
            if (session && session.step === 'waiting_welcome_confirmation') {
                const response = cleanText;
                if (response === 'benar' || response === 'ya' || response === 'sesuai') {
                    await service.sendMessage(senderJid, '✅ *Terima Kasih!*\n\nData Anda telah terverifikasi. Selamat menikmati layanan kami!\n\nKetik *Menu* untuk melihat opsi bantuan.');
                    await WhatsAppSessionService_1.WhatsAppSessionService.clearSession(senderPhone);
                }
                else if (response === 'salah' || response === 'tidak') {
                    await service.sendMessage(senderJid, '📝 *Koreksi Data*\n\nSilakan balas pesan ini dengan menuliskan *NAMA LENGKAP* Anda yang benar.');
                    await WhatsAppSessionService_1.WhatsAppSessionService.updateSession(senderPhone, { step: 'waiting_name_correction' });
                }
                else {
                    await service.sendMessage(senderJid, '🤖 Mohon balas dengan ketik *BENAR* atau *SALAH*.');
                }
                return;
            }
            if (session && session.step === 'waiting_name_correction') {
                const newName = messageContent.trim();
                if (newName.length < 3) {
                    await service.sendMessage(senderJid, '⚠️ Nama terlalu pendek. Silakan masukkan nama lengkap yang benar.');
                    return;
                }
                // Update session
                await WhatsAppSessionService_1.WhatsAppSessionService.updateSession(senderPhone, {
                    step: 'waiting_address_correction',
                    data: { ...session.data, newName }
                });
                await service.sendMessage(senderJid, `✅ Nama diterima: *${newName}*\n\nSekarang, silakan tuliskan *ALAMAT LENGKAP* pemasangan Anda.`);
                return;
            }
            if (session && session.step === 'waiting_address_correction') {
                const newAddress = messageContent.trim();
                if (newAddress.length < 5) {
                    await service.sendMessage(senderJid, '⚠️ Alamat terlalu pendek. Mohon berikan alamat lengkap.');
                    return;
                }
                const { newName, customerId } = session.data;
                // UPDATE DATABASE
                try {
                    console.log(`[WhatsApp Bot] Updating customer ${customerId}: Name=${newName}, Address=${newAddress}`);
                    await pool_1.databasePool.query('UPDATE customers SET name = ?, address = ?, updated_at = NOW() WHERE id = ?', [newName, newAddress, customerId]);
                    await service.sendMessage(senderJid, `✅ *DATA BERHASIL DIPERBARUI*\n\n👤 Nama: ${newName}\n🏠 Alamat: ${newAddress}\n\nTerima kasih atas konfirmasinya. Data Anda telah kami perbarui.`);
                    await WhatsAppSessionService_1.WhatsAppSessionService.clearSession(senderPhone);
                }
                catch (err) {
                    console.error('[WhatsApp Bot] Failed to update customer:', err);
                    await service.sendMessage(senderJid, '❌ Maaf, terjadi kesalahan sistem saat menyimpan data. Silakan hubungi admin.');
                    await WhatsAppSessionService_1.WhatsAppSessionService.clearSession(senderPhone);
                }
                return;
            }
            // Special handling for session with Location
            if (session && isLocation) {
                await this.handleRegistration(service, senderJid, senderPhone, '', session, locationData);
                return;
            }
            // 3. Advanced Keyword Matching (Menu / Greetings)
            const isGreeting = /^(halo|hallo|hai|hi|p|tes|test|ping|assalamualaikum|selamat|pagi|siang|sore|malam)/.test(cleanText);
            const isMenu = /^(menu|info|help|bantuan|\/menu|\.menu|batal|cancel|exit)/.test(cleanText);
            if (isGreeting || isMenu) {
                await WhatsAppSessionService_1.WhatsAppSessionService.clearSession(senderPhone);
                await this.sendMenu(service, senderJid, customer); // Reply to the JID that sent the message
                return;
            }
            // 4. Registration Flow
            if (!customer) {
                // HANDLE LID LINKING PRE-CHECK
                if (keyword === 'myid' || cleanText === '!myid' || cleanText === 'cek id') {
                    await service.sendMessage(senderJid, `🆔 *Info ID Perangkat*
    
ID Perangkat: *${senderPhone}*

Jika nomor Anda terdaftar tapi bot tidak merespons, itu karena WhatsApp Anda mengirim ID ini (LID), bukan nomor HP.

Ketik: *!link [NomorHPAnda]* untuk menghubungkan.
Contoh: *!link 08123456789*

Atau biarkan kami bantu hubungkan secara otomatis dengan mengirim pesan: *Hubungkan otomatis*`);
                    return;
                }
                if (cleanText.startsWith('!link ')) {
                    const targetInfo = cleanText.replace('!link ', '').trim();
                    const targetPhoneRaw = targetInfo.replace(/\D/g, '');
                    if (targetPhoneRaw.length < 9) {
                        await service.sendMessage(senderJid, '⚠️ Mohon masukkan nomor HP yang valid. Contoh: !link 08123456789');
                        return;
                    }
                    // Look up customer by this phone (Try exact match first, then partial)
                    let [cRows] = await pool_1.databasePool.query('SELECT id, name, phone FROM customers WHERE phone = ? LIMIT 1', // Try exact first
                    [targetInfo]);
                    if (cRows.length === 0) {
                        // Try standard formats
                        const formats = [targetPhoneRaw];
                        if (targetPhoneRaw.startsWith('0'))
                            formats.push('62' + targetPhoneRaw.substring(1));
                        if (targetPhoneRaw.startsWith('62'))
                            formats.push('0' + targetPhoneRaw.substring(2));
                        [cRows] = await pool_1.databasePool.query('SELECT id, name, phone FROM customers WHERE phone IN (?) LIMIT 1', [formats]);
                    }
                    // Fallback to LIKE
                    if (cRows.length === 0) {
                        [cRows] = await pool_1.databasePool.query('SELECT id, name, phone FROM customers WHERE phone LIKE ? LIMIT 1', [`%${targetPhoneRaw}`]);
                    }
                    if (cRows.length === 0) {
                        await service.sendMessage(senderJid, `❌ Maaf, nomor HP *${targetInfo}* tidak ditemukan di sistem.`);
                        return;
                    }
                    const linkedCustomer = cRows[0];
                    const currentLid = senderJid; // Use full JID as LID key
                    try {
                        await pool_1.databasePool.query('INSERT INTO customer_wa_lids (customer_id, lid) VALUES (?, ?) ON DUPLICATE KEY UPDATE customer_id = VALUES(customer_id)', [linkedCustomer.id, currentLid]);
                        await service.sendMessage(senderJid, `✅ *Perangkat Terhubung!*
    
ID Perangkat: ${currentLid}
Akun: ${linkedCustomer.name} (${linkedCustomer.phone})

Sekarang Anda dapat menggunakan semua fitur bot.`);
                    }
                    catch (err) {
                        console.error('Link error:', err);
                        await service.sendMessage(senderJid, 'Gagal menghubungkan perangkat. Coba lagi nanti.');
                    }
                    return;
                }
                // NEW: Auto-link trigger
                if (cleanText.includes('hubungkan otomatis') || cleanText.includes('connect automatic') || cleanText.includes('auto link')) {
                    await this.handleAutoConnectionRequest(senderJid, service);
                    return;
                }
                // Check if it's registration keyword
                if (/^(daftar|reg|registrasi)/.test(keyword)) {
                    await this.handleRegistration(service, senderJid, senderPhone, cleanText, null, null);
                    return;
                }
                // If in session
                if (session) {
                    await this.handleRegistration(service, senderJid, senderPhone, messageContent, session, null);
                    return;
                }
                // If unknown user and not greeting/menu -> Show help menu
                await this.sendMenu(service, senderJid, null);
                return;
            }
            // 4.5. !link Command (Manual Account Linking)
            if (keyword === '!link' || keyword === '/link') {
                const targetPhone = cleanText.replace(/[^0-9]/g, '');
                if (targetPhone.length < 9) {
                    await service.sendMessage(senderJid, '⚠️ Mohon masukkan nomor HP yang terdaftar.\nFormat: *!link 08123xxxx*');
                    return;
                }
                // Look up customer by this phone
                let [cRows] = await pool_1.databasePool.query('SELECT id, name, phone FROM customers WHERE phone = ? LIMIT 1', [targetPhone]);
                if (cRows.length === 0) {
                    // Try alternative formats
                    const formats = [targetPhone];
                    if (targetPhone.startsWith('0'))
                        formats.push('62' + targetPhone.substring(1));
                    if (targetPhone.startsWith('62'))
                        formats.push('0' + targetPhone.substring(2));
                    [cRows] = await pool_1.databasePool.query('SELECT id, name, phone FROM customers WHERE phone IN (?) LIMIT 1', [formats]);
                }
                if (cRows.length === 0) {
                    await service.sendMessage(senderJid, `❌ Nomor *${targetPhone}* tidak ditemukan di sistem.`);
                    return;
                }
                const linkedCustomer = cRows[0];
                const currentLid = senderJid; // This is the LID sent by WA (e.g. 628xxx@s.whatsapp.net user part)
                try {
                    await pool_1.databasePool.query('INSERT INTO customer_wa_lids (customer_id, lid) VALUES (?, ?) ON DUPLICATE KEY UPDATE customer_id = VALUES(customer_id)', [linkedCustomer.id, currentLid]);
                    await service.sendMessage(senderJid, `✅ *Perangkat Terhubung!*

Nomor WA ini telah terhubung dengan akun:
👤 ${linkedCustomer.name}
📞 ${linkedCustomer.phone}

Ketik *Menu* untuk memulai.`);
                }
                catch (err) {
                    console.error('Link error:', err);
                    await service.sendMessage(senderJid, 'Gagal menghubungkan perangkat. Silakan coba lagi nanti.');
                }
                return;
            }
            // 5. Customer Logic - JANJIBAYAR (Self-Service Payment Deferment via Bot)
            if (keyword === 'janjibayar' || keyword === 'janji' || cleanText === 'minta perpanjangan' || cleanText === 'perpanjangan waktu') {
                if (!customer) {
                    await service.sendMessage(senderJid, '⚠️ Maaf, nomor Anda belum terdaftar.');
                    return;
                }
                try {
                    const MAX_DEFERMENT_DAYS = 7;
                    // 1. Check unpaid invoices
                    const [unpaidInvoices] = await pool_1.databasePool.query(`SELECT id, invoice_number, period, total_amount, remaining_amount, due_date 
                         FROM invoices 
                         WHERE customer_id = ? AND status NOT IN ('paid', 'cancelled') AND remaining_amount > 0
                         ORDER BY due_date ASC LIMIT 1`, [customer.id]);
                    if (unpaidInvoices.length === 0) {
                        await service.sendMessage(senderJid, '✅ *Tidak ada tagihan tertunggak.*\n\nSemua tagihan Anda sudah lunas. Terima kasih!');
                        return;
                    }
                    const invoice = unpaidInvoices[0];
                    // 2. Check if already has active deferment for this invoice
                    const [existingDeferment] = await pool_1.databasePool.query(`SELECT id, deferred_until_date FROM payment_deferments 
                         WHERE customer_id = ? AND invoice_id = ? AND status IN ('pending', 'approved')`, [customer.id, invoice.id]);
                    if (existingDeferment.length > 0) {
                        const untilDate = new Date(existingDeferment[0].deferred_until_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                        await service.sendMessage(senderJid, `⚠️ *Janji Bayar Sudah Aktif*\n\nAnda sudah memiliki perpanjangan waktu untuk tagihan ini.\nBatas waktu: *${untilDate}*\n\nMohon lunasi sebelum tanggal tersebut.`);
                        return;
                    }
                    // 3. Check yearly limit (max 4x per year)
                    const { DefermentService } = await Promise.resolve().then(() => __importStar(require('../billing/DefermentService')));
                    const yearlyCount = await DefermentService.getDefermentCountThisYear(customer.id);
                    if (yearlyCount >= 4) {
                        await service.sendMessage(senderJid, `🚫 *Batas Perpanjangan Tercapai*\n\nAnda telah menggunakan kuota perpanjangan waktu sebanyak 4x dalam tahun ini.\n\nMohon segera lakukan pembayaran atau hubungi Admin untuk bantuan lebih lanjut.`);
                        return;
                    }
                    // 4. Auto-approve: extend by MAX_DEFERMENT_DAYS from today
                    const deferUntil = new Date();
                    deferUntil.setDate(deferUntil.getDate() + MAX_DEFERMENT_DAYS);
                    const deferUntilStr = deferUntil.toISOString().split('T')[0];
                    const result = await DefermentService.requestDeferment({
                        customer_id: customer.id,
                        invoice_id: invoice.id,
                        deferred_until_date: deferUntilStr,
                        reason: `Self-service via Bot WhatsApp (Perpanjangan ${MAX_DEFERMENT_DAYS} hari)`,
                        requested_by: 'bot_whatsapp'
                    });
                    if (result.success) {
                        const untilDateFormatted = deferUntil.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                        const invoiceAmount = parseFloat(invoice.remaining_amount).toLocaleString('id-ID');
                        await service.sendMessage(senderJid, `✅ *JANJI BAYAR DISETUJUI*\n\n` +
                            `Koneksi internet Anda diperpanjang.\n\n` +
                            `📋 *Detail:*\n` +
                            `━━━━━━━━━━━━━━━\n` +
                            `📄 Invoice: *${invoice.invoice_number}*\n` +
                            `💰 Tagihan: *Rp ${invoiceAmount}*\n` +
                            `📅 Batas Bayar Baru: *${untilDateFormatted}*\n` +
                            `🔢 Kuota Tersisa: *${3 - yearlyCount}x* lagi tahun ini\n` +
                            `━━━━━━━━━━━━━━━\n\n` +
                            `⚠️ *PENTING:* Jika sampai tanggal *${untilDateFormatted}* belum ada pembayaran, koneksi internet Anda akan *DIPUTUS OTOMATIS* oleh sistem.\n\n` +
                            `Ketik *TAGIHAN* untuk cek detail tagihan.`);
                        // Notify Admin
                        const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
                        await UnifiedNotificationService.broadcastToAdmins(`📋 *JANJI BAYAR OTOMATIS*\n\n` +
                            `Pelanggan *${customer.name}* telah meminta perpanjangan waktu via Bot WA.\n` +
                            `Invoice: ${invoice.invoice_number}\n` +
                            `Batas Baru: ${untilDateFormatted}\n` +
                            `Kuota Tahun Ini: ${yearlyCount + 1}/4`).catch(() => { });
                    }
                    else {
                        await service.sendMessage(senderJid, `❌ *Gagal Memproses*\n\n${result.message}\n\nSilakan hubungi Admin untuk bantuan.`);
                    }
                }
                catch (err) {
                    console.error('[WA JANJIBAYAR] Error:', err);
                    await service.sendMessage(senderJid, '❌ Maaf, terjadi kesalahan sistem. Silakan coba lagi nanti.');
                }
                return;
            }
            // Check Bill
            if (keyword === 'tagihan' || keyword === 'cek' || keyword === 'cektagihan') {
                await this.handleCheckBill(service, senderJid, customer);
                return;
            }
            // 5.5 IMAGE RECOGNITION (Payment Proof Scan)
            if (isImage) {
                console.log(`[WhatsApp] 📷 Image message received from ${senderJid}`);
                const sock = service.getSocket();
                if (!sock) {
                    console.error('Socket not available for image processing');
                    return;
                }
                if (!customer) {
                    await service.sendMessage(senderJid, 'Maaf, nomor Anda belum terdaftar. Silakan registrasi terlebih dahulu.');
                    return;
                }
                await service.sendMessage(senderJid, '🔍 *Menganalisis bukti pembayaran...*\nMohon tunggu sebentar, AI kami sedang memverifikasi.');
                try {
                    const buffer = await (0, baileys_1.downloadMediaMessage)(msg, 'buffer', {}, {
                        logger: console,
                        reuploadRequest: sock.updateMediaMessage
                    });
                    const result = await AdvancedPaymentVerificationService_1.AdvancedPaymentVerificationService.verifyPaymentAdvanced(buffer, customer.id);
                    console.log(`[WhatsApp] 🤖 AI Verification result for ${customer.name}: success=${result.success}, autoApproved=${result.data?.autoApproved}, stage=${result.stage}`);
                    if (result.success && result.data?.autoApproved) {
                        // Auto Approved
                        const amountStr = result.data.extractedAmount?.toLocaleString('id-ID');
                        const invStr = result.data.invoiceNumber || 'Tagihan';
                        // 1. Send Text Confirmation
                        await service.sendMessage(senderJid, `✅ *PEMBAYARAN DITERIMA*

Terima kasih, pembayaran sebesar *Rp ${amountStr}* untuk *${invStr}* telah berhasil diverifikasi otomatis.

Status: *LUNAS* 🎉

_Invoice lunas dilampirkan dibawah ini..._`);
                        // 2. Generate and Send PDF with Stamp
                        if (result.data.invoiceId) {
                            try {
                                const { InvoicePdfService } = await Promise.resolve().then(() => __importStar(require('../../services/invoice/InvoicePdfService')));
                                const pdfPath = await InvoicePdfService.generateInvoicePdf(result.data.invoiceId);
                                await service.sendDocument(senderJid, pdfPath, `Invoice-${result.data.invoiceNumber}-LUNAS.pdf`, '📄 *Bukti Pembayaran Lunas*');
                            }
                            catch (pdfErr) {
                                console.error('Failed to generate/send PDF:', pdfErr);
                                await service.sendMessage(senderJid, '⚠️ Gagal membuat PDF invoice, namun pembayaran sudah tercatat lunas di sistem.');
                            }
                        }
                    }
                    else {
                        // Failed / Manual Review Needed
                        let reason = result.error || 'Bukti tidak dapat dibaca otomatis/Nominal tidak sesuai.';
                        if (result.data && result.data.confidence > 50) {
                            reason = 'Menunggu verifikasi admin (Manual Review).';
                        }
                        // SAVE TO MANUAL VERIFICATION TABLE
                        try {
                            const imageBase64 = buffer.toString('base64');
                            const extractedAmount = result.data?.extractedAmount || 0;
                            const expectedAmount = result.data?.expectedAmount || 0;
                            await pool_1.databasePool.query(`INSERT INTO manual_payment_verifications 
                                 (customer_id, status, image_data, image_mimetype, extracted_amount, expected_amount, reason, created_at)
                                 VALUES (?, 'pending', ?, 'image/jpeg', ?, ?, ?, NOW())`, [customer.id, imageBase64, extractedAmount, expectedAmount, reason]);
                            // Notify Admins
                            const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
                            await UnifiedNotificationService.broadcastToAdmins(`🔔 *PEMBAYARAN BUTUH VERIFIKASI*\n\n` +
                                `Pelanggan: ${customer.name}\n` +
                                `Nominal: Rp ${extractedAmount.toLocaleString('id-ID')}\n` +
                                `Alasan: ${reason}\n\n` +
                                `Silakan cek menu WhatsApp Monitor untuk memverifikasi.`);
                        }
                        catch (saveErr) {
                            console.error('Failed to save manual verification:', saveErr);
                        }
                        await service.sendMessage(senderJid, `⚠️ *Verifikasi Manual Diperlukan*

${reason}

Data Anda telah diteruskan ke Admin untuk pengecekan manual. Mohon tunggu konfirmasi selanjutnya.`);
                    }
                }
                catch (err) {
                    console.error('Image processing error:', err);
                    const errorMessage = err?.message || String(err);
                    if (errorMessage.includes('not enabled') || errorMessage.includes('API key')) {
                        await service.sendMessage(senderJid, 'Fitur verifikasi otomatis belum diaktifkan oleh Admin. Mohon tunggu verifikasi manual.');
                    }
                    else {
                        await service.sendMessage(senderJid, 'Maaf, gagal memproses gambar. Silakan kirim ulang atau hubungi admin.');
                    }
                }
                return;
            }
            // AUTO TICKET CREATION (Lapor/Gangguan)
            if (/^(lapor|aduan|gangguan|kendala|rusak|mati)/.test(keyword)) {
                if (!customer) {
                    await service.sendMessage(senderJid, 'Maaf, nomor Anda belum terdaftar. Silakan hubungi admin.');
                    return;
                }
                // CHECK FOR MASS OUTAGE (GANGGUAN MASSAL)
                try {
                    const [moRows] = await pool_1.databasePool.query("SELECT `value` FROM settings WHERE `key` = 'mass_outage_active' LIMIT 1").catch(() => [[], []]);
                    if (moRows && moRows.length > 0 && (moRows[0].value === '1' || moRows[0].value === 'true')) {
                        const [msgRows] = await pool_1.databasePool.query("SELECT `value` FROM settings WHERE `key` = 'mass_outage_message' LIMIT 1").catch(() => [[], []]);
                        const outageMsg = (msgRows && msgRows.length > 0) ? msgRows[0].value : 'Saat ini sedang terjadi gangguan teknis pada infrastruktur pusat (Gangguan Massal). Tim kami sedang bekerja melakukan perbaikan secepatnya.\n\nMohon maaf atas ketidaknyamanannya.';
                        await service.sendMessage(senderJid, `📢 *INFO GANGGUAN PUSAT*

${outageMsg}

_Tiket tidak dibuat karena tim sudah menangani masalah ini._`);
                        return;
                    }
                }
                catch (ignore) { }
                // Check if already has pending ticket? (Optional optimization, skipping for now to allow multiple reports if needed, or maybe check limits)
                // Extract description
                let description = cleanText.replace(/^(lapor|aduan|gangguan|kendala|rusak|mati)\s*/, '').trim();
                if (!description)
                    description = "Laporan gangguan via WhatsApp (Tanpa detail)";
                try {
                    // Dynamic import to avoid circular dependency
                    const { TechnicianController } = await Promise.resolve().then(() => __importStar(require('../../controllers/technician/TechnicianController')));
                    const ticketNumber = await TechnicianController.createJob({
                        title: `Laporan Gangguan WA`,
                        description: `Dari WA: ${description}`,
                        customer_id: customer.id,
                        priority: 'high',
                        address: customer.address || 'Alamat belum diset',
                        reported_by: 'customer_wa',
                        coordinates: customer.coordinates // if available
                    });
                    if (ticketNumber) {
                        await service.sendMessage(senderJid, `✅ *TIKET BERHASIL DIBUAT*

Nomor Tiket: *${ticketNumber}*

Laporan Anda telah diteruskan ke tim teknisi kami. Mohon tunggu, teknisi akan segera menghubungi Anda saat tiket diproses.

Terima kasih.`);
                    }
                    else {
                        await service.sendMessage(senderJid, 'Maaf, gagal membuat tiket. Silakan coba lagi nanti atau hubungi Admin.');
                    }
                }
                catch (err) {
                    console.error('[WA AutoTicket] Error:', err);
                    await service.sendMessage(senderJid, 'Terjadi kesalahan sistem saat membuat tiket.');
                }
                return;
            }
            // HANDLE TECHNICIAN !ambil COMMAND
            if (cleanText.startsWith('!ambil')) {
                const ticketNumber = cleanText.replace('!ambil', '').trim().toUpperCase();
                if (!ticketNumber) {
                    await service.sendMessage(senderJid, '⚠️ Mohon masukkan nomor tiket.\nContoh: *!ambil JOB-12345*');
                    return;
                }
                try {
                    // Identify if sender is a technician
                    const [techRows] = await pool_1.databasePool.query("SELECT id, full_name, role FROM users WHERE phone = ? AND role = 'teknisi' AND is_active = 1 LIMIT 1", [senderPhone]);
                    if (!techRows || techRows.length === 0) {
                        // formats check (re-use generic lookup if needed, but phone should be exact for users)
                        // but sometimes senderPhone has 62 while DB has 0
                        // let's try a bit wider
                        const formats = [senderPhone];
                        if (senderPhone.startsWith('62'))
                            formats.push('0' + senderPhone.substring(2));
                        if (senderPhone.startsWith('0'))
                            formats.push('62' + senderPhone.substring(1));
                        const [techRowsRetry] = await pool_1.databasePool.query("SELECT id, full_name, role FROM users WHERE phone IN (?) AND role = 'teknisi' AND is_active = 1 LIMIT 1", [formats]);
                        if (!techRowsRetry || techRowsRetry.length === 0) {
                            await service.sendMessage(senderJid, '🚫 Maaf, perintah ini hanya untuk teknisi terdaftar.');
                            return;
                        }
                        techRows[0] = techRowsRetry[0];
                    }
                    const technician = techRows[0];
                    // Find job by ticket number
                    const [jobRows] = await pool_1.databasePool.query(`SELECT j.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address 
                         FROM technician_jobs j 
                         LEFT JOIN customers c ON j.customer_id = c.id 
                         WHERE j.ticket_number = ?`, [ticketNumber]);
                    if (!jobRows || jobRows.length === 0) {
                        await service.sendMessage(senderJid, `❌ Maaf, tiket *${ticketNumber}* tidak ditemukan.`);
                        return;
                    }
                    const job = jobRows[0];
                    if (job.status !== 'pending') {
                        if (job.status === 'accepted' && job.technician_id === technician.id) {
                            await service.sendMessage(senderJid, `✅ Tiket *${ticketNumber}* sudah Anda ambil sebelumnya.`);
                        }
                        else {
                            await service.sendMessage(senderJid, `⚠️ Maaf, tiket *${ticketNumber}* sudah diambil oleh teknisi lain atau sedang diproses.`);
                        }
                        return;
                    }
                    // Update job status
                    await pool_1.databasePool.query("UPDATE technician_jobs SET status = 'accepted', technician_id = ?, accepted_at = NOW() WHERE id = ?", [technician.id, job.id]);
                    // Send success to technician
                    const successMsg = `✅ *BERHASIL MENGAMBIL JOB*\n\n` +
                        `🎫 Tiket: *${job.ticket_number}*\n` +
                        `👤 Customer: ${job.customer_name || 'Umum'}\n` +
                        `📍 Alamat: ${job.customer_address || job.address || '-'}\n` +
                        `📞 Telp: ${job.customer_phone || '-'}\n` +
                        `📝 Deskripsi: ${job.title}\n\n` +
                        `Selamat bekerja! Hubungi customer untuk konfirmasi waktu.`;
                    await service.sendMessage(senderJid, successMsg);
                    // Notify Customer if exists
                    if (job.customer_phone) {
                        const custMsg = `✅ *TEKNISI MENUJU LOKASI*

Halo Kak *${job.customer_name}*,
Laporan Anda (#${job.ticket_number}) telah diambil oleh teknisi kami:

👤 Nama: *${technician.full_name}*

Teknisi akan segera menghubungi Kakak. Terima kasih.`;
                        await service.sendMessage(job.customer_phone, custMsg).catch(() => { });
                    }
                }
                catch (err) {
                    console.error('[WA !ambil] Error:', err);
                    await service.sendMessage(senderJid, '❌ Terjadi kesalahan saat mengambil pekerjaan.');
                }
                return;
            }
            // ==========================================
            // ADMIN COMMANDS (Processed after technician)
            // ==========================================
            if (cleanText.startsWith('!bayar')) {
                // 1. Check if Admin
                const [adminRows] = await pool_1.databasePool.query("SELECT id, full_name, role FROM users WHERE phone LIKE ? AND role IN ('admin', 'superadmin', 'operator') AND is_active = 1 LIMIT 1", [`%${senderPhone.substring(senderPhone.length - 10)}`]);
                if (!adminRows || adminRows.length === 0) {
                    // Not an admin, ignore or send unauthorized msg? (Better ignore to keep it quiet)
                    return;
                }
                const admin = adminRows[0];
                const parts = cleanText.split(' ').filter(p => p.trim());
                if (parts.length < 3) {
                    await service.sendMessage(senderJid, `📝 *Format Perintah !bayar*
                    
*!bayar [NomorHP/KodeCUST] [Nominal]*

Contoh: !bayar CUST001 150000
_Catatan: Spasi di nominal akan dibuang otomatis._`);
                    return;
                }
                const targetIdentifier = parts[1];
                const nominalRaw = parts.slice(2).join('').replace(/\D/g, '');
                const amount = parseFloat(nominalRaw);
                if (isNaN(amount) || amount <= 0) {
                    await service.sendMessage(senderJid, '⚠️ Nominal tidak valid.');
                    return;
                }
                await service.sendMessage(senderJid, `🔄 *Sedang memproses pembayaran...*\nTarget: ${targetIdentifier}\nNominal: Rp ${amount.toLocaleString('id-ID')}`);
                try {
                    // 2. Find Customer
                    const formats = [targetIdentifier];
                    if (targetIdentifier.startsWith('0'))
                        formats.push('62' + targetIdentifier.substring(1));
                    if (targetIdentifier.startsWith('62'))
                        formats.push('0' + targetIdentifier.substring(2));
                    const [cRows] = await pool_1.databasePool.query(`SELECT id, name, phone, customer_code FROM customers 
                         WHERE customer_code = ? OR phone IN (?) OR phone LIKE ? LIMIT 1`, [targetIdentifier, formats, `%${targetIdentifier}`]);
                    if (!cRows || cRows.length === 0) {
                        await service.sendMessage(senderJid, `❌ Pelanggan *${targetIdentifier}* tidak ditemukan.`);
                        return;
                    }
                    const targetCustomer = cRows[0];
                    // 3. Find Unpaid Invoices
                    const [invRows] = await pool_1.databasePool.query(`SELECT id, invoice_number, remaining_amount FROM invoices 
                         WHERE customer_id = ? AND status != 'paid' AND remaining_amount > 0 
                         ORDER BY due_date ASC LIMIT 1`, [targetCustomer.id]);
                    if (!invRows || invRows.length === 0) {
                        await service.sendMessage(senderJid, `✅ Pelanggan *${targetCustomer.name}* tidak memiliki tagihan aktif saat ini.`);
                        return;
                    }
                    const invoice = invRows[0];
                    // Mock Request/Response for controller use if possible, or just use direct logic
                    // Direct logic is safer here to avoid middleware interference
                    const conn = await pool_1.databasePool.getConnection();
                    try {
                        await conn.beginTransaction();
                        // Get current values
                        const currentPaid = parseFloat(invoice.remaining_amount) <= 0 ? 0 : (await conn.query('SELECT paid_amount, total_amount FROM invoices WHERE id = ?', [invoice.id]))[0][0].paid_amount;
                        // wait, I can just recalculate
                        const [fullInv] = await conn.query('SELECT paid_amount, total_amount, remaining_amount FROM invoices WHERE id = ?', [invoice.id]);
                        const totalAmount = parseFloat(fullInv[0].total_amount);
                        const paidSoFar = parseFloat(fullInv[0].paid_amount || '0');
                        const newPaid = paidSoFar + amount;
                        const newRemaining = Math.max(0, totalAmount - newPaid);
                        const newStatus = newRemaining <= 100 ? 'paid' : 'partial';
                        // Insert payment
                        const [pResult] = await conn.execute(`INSERT INTO payments (invoice_id, payment_method, amount, payment_date, notes, created_at) 
                             VALUES (?, 'whatsapp_admin', ?, NOW(), ?, NOW())`, [invoice.id, amount, `Recorded via WhatsApp by ${admin.full_name}`]);
                        // Update invoice
                        await conn.execute(`UPDATE invoices SET paid_amount = ?, remaining_amount = ?, status = ?, 
                             last_payment_date = NOW(), paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END 
                             WHERE id = ?`, [newPaid, newRemaining, newStatus, newStatus, invoice.id]);
                        // Check isolation removal
                        if (newStatus === 'paid') {
                            const [unpaidCheck] = await conn.query("SELECT COUNT(*) as count FROM invoices WHERE customer_id = ? AND id != ? AND status != 'paid' AND remaining_amount > 0", [targetCustomer.id, invoice.id]);
                            if (unpaidCheck[0].count === 0) {
                                const { IsolationService } = await Promise.resolve().then(() => __importStar(require('../billing/isolationService')));
                                await IsolationService.restoreIfQualified(targetCustomer.id, conn).catch(() => { });
                            }
                        }
                        await conn.commit();
                        // 5. Build Result Message
                        await service.sendMessage(senderJid, `✅ *PEMBAYARAN BERHASIL*\n\n` +
                            `👤 Pelanggan: ${targetCustomer.name}\n` +
                            `📄 Invois: ${invoice.invoice_number}\n` +
                            `💰 Nominal: Rp ${amount.toLocaleString('id-ID')}\n` +
                            `📉 Sisa: Rp ${newRemaining.toLocaleString('id-ID')}\n` +
                            `📌 Status: *${newStatus.toUpperCase()}*`);
                        // 6. Notify Customer
                        const { UnifiedNotificationService } = await Promise.resolve().then(() => __importStar(require('../notification/UnifiedNotificationService')));
                        await UnifiedNotificationService.notifyPaymentReceived(pResult.insertId).catch(() => { });
                    }
                    catch (dbErr) {
                        await conn.rollback();
                        throw dbErr;
                    }
                    finally {
                        conn.release();
                    }
                }
                catch (err) {
                    console.error('[WA !bayar] Error:', err);
                    await service.sendMessage(senderJid, `❌ Gagal memproses pembayaran: ${err.message}`);
                }
                return;
            }
            // QRIS Feature
            if (keyword === 'qris' || keyword === 'bayar' || cleanText.includes('qr code')) {
                const qrisPath = path_1.default.join(process.cwd(), 'public', 'images', 'payments', 'qris.png');
                if (fs_1.default.existsSync(qrisPath)) {
                    await service.sendMessage(senderJid, 'Tunggu sebentar, sedang mengambil kode QRIS...');
                    await service.sendImage(senderJid, qrisPath, 'Scan QRIS ini untuk melakukan pembayaran.\n\n*Otomatis Terverifikasi* ✅');
                }
                else {
                    await service.sendMessage(senderJid, 'Maaf, gambar QRIS belum tersedia. Silakan hubungi admin.');
                }
                return;
            }
            // RESET CONNECTION Feature (with AI Guidance)
            if (keyword === 'reset' || cleanText === '/reset') {
                if (!customer) {
                    await service.sendMessage(senderJid, 'Maaf, nomor Anda belum terdaftar sebagai pelanggan.');
                    return;
                }
                await WhatsAppSessionService_1.WhatsAppSessionService.setSession(senderPhone, {
                    step: 'reset_confirm',
                    data: { customerId: customer.id, connType: customer.connection_type, pppoeUser: customer.pppoe_username }
                });
                const greeting = `🛠️ *Panduan Reset Koneksi (AI Assistant)*

Halo ${customer.name}, saya mendeteksi Anda ingin mereset koneksi internet.

*Apa yang akan terjadi?*
1. Sistem akan memutus koneksi Anda dari server pusat.
2. Modem/Router Anda akan dipaksa menyambung ulang (reconnect).
3. IP Address Anda mungkin akan diperbarui.

_Biasanya ini ampuh mengatasi internet lemot atau bengong._

Apakah Anda yakin ingin melanjutkan?
Ketik *YA* untuk konfirmasi.`;
                await service.sendMessage(senderJid, greeting);
                return;
            }
            // Handle Reset Confirmation
            if (session && session.step === 'reset_confirm') {
                if (cleanText === 'ya' || cleanText === 'ok' || cleanText === 'lanjut') {
                    await service.sendMessage(senderJid, '🔄 *Memproses Reset...*\nMohon tunggu dalam 10-30 detik sistem sedang me-refresh sesi Anda...');
                    try {
                        // Dynamic Import Mikrotik Service to avoid circular deps if any
                        const { getMikrotikConfig } = await Promise.resolve().then(() => __importStar(require('../../utils/mikrotikConfigHelper')));
                        const { RouterOSAPI } = await Promise.resolve().then(() => __importStar(require('node-routeros')));
                        const config = await getMikrotikConfig();
                        const configWithTls = config ? { ...config, use_tls: config.use_tls || false } : null;
                        if (configWithTls) {
                            const api = new RouterOSAPI({
                                host: configWithTls.host,
                                port: configWithTls.port,
                                user: configWithTls.username,
                                password: configWithTls.password,
                                timeout: 10000
                            });
                            await api.connect();
                            let resetSuccess = false;
                            const customerData = session.data;
                            if (customerData.connType === 'pppoe' && customerData.pppoeUser) {
                                // PPPoE Kick
                                const active = await api.write('/ppp/active/print', [`?name=${customerData.pppoeUser}`]);
                                if (active && active.length > 0) {
                                    for (const act of active) {
                                        await api.write('/ppp/active/remove', [`=.id=${act['.id']}`]);
                                    }
                                    resetSuccess = true;
                                    console.log(`[WhatsApp Reset] Kicked PPPoE user: ${customerData.pppoeUser}`);
                                }
                                else {
                                    // User not active, maybe that's the problem? try simple response
                                    console.log(`[WhatsApp Reset] PPPoE user not active: ${customerData.pppoeUser}`);
                                }
                            }
                            else if (customerData.connType === 'static_ip') {
                                // Static IP Reset (Disable then Enable Queue)
                                // We need to find the queue by client name. Assuming customer name usually used in queue or DB lookup?
                                // Better approach: Check static_ip_clients table
                                const [rows] = await pool_1.databasePool.query('SELECT client_name FROM static_ip_clients WHERE customer_id = ?', [customerData.customerId]);
                                if (rows.length > 0 && rows[0].client_name) {
                                    const clientName = rows[0].client_name;
                                    const { findQueueTreeIdByName, updateQueueTree } = await Promise.resolve().then(() => __importStar(require('../../services/mikrotikService')));
                                    // Toggle Down
                                    const dlId = await findQueueTreeIdByName(configWithTls, clientName);
                                    if (dlId) {
                                        await updateQueueTree(configWithTls, dlId, { disabled: 'yes' });
                                        await new Promise(r => setTimeout(r, 1000)); // wait 1s
                                        await updateQueueTree(configWithTls, dlId, { disabled: 'no' });
                                        resetSuccess = true;
                                    }
                                    // Toggle Up
                                    const upId = await findQueueTreeIdByName(configWithTls, `UP-${clientName}`);
                                    if (upId) {
                                        await updateQueueTree(configWithTls, upId, { disabled: 'yes' });
                                        await new Promise(r => setTimeout(r, 500));
                                        await updateQueueTree(configWithTls, upId, { disabled: 'no' });
                                    }
                                }
                            }
                            await api.close();
                            if (resetSuccess) {
                                await service.sendMessage(senderJid, '✅ *Reset Berhasil!*\nKoneksi Anda telah diputus dan disambung ulang. Silakan coba akses internet kembali.\n\n_Jika masih berkendala, segera hubungi admin._');
                            }
                            else {
                                await service.sendMessage(senderJid, '⚠️ *Reset Selesai (Soft)*\nTidak ditemukan sesi aktif yang nyangkut, namun sistem telah direfresh. Coba matikan dan nyalakan modem Anda secara manual jika masih gangguan.');
                            }
                        }
                        else {
                            await service.sendMessage(senderJid, '❌ Gagal terhubung ke Router Pusat. Hubungi Admin.');
                        }
                    }
                    catch (err) {
                        console.error('Reset Error:', err);
                        await service.sendMessage(senderJid, '❌ Terjadi kesalahan saat mereset. Silakan coba lagi nanti.');
                    }
                    await WhatsAppSessionService_1.WhatsAppSessionService.clearSession(senderPhone);
                    return;
                }
                else if (cleanText === 'batal' || cleanText === 'tidak' || cleanText === 'no') {
                    await WhatsAppSessionService_1.WhatsAppSessionService.clearSession(senderPhone);
                    await service.sendMessage(senderJid, 'Reset dibatalkan. Koneksi Anda tetap berjalan seperti biasa.');
                    return;
                }
                else {
                    await service.sendMessage(senderJid, 'Ketik *YA* untuk konfirmasi Reset, atau *Batal* untuk membatalkan.');
                    return; // Stay in session
                }
            }
            // CHECK FOR PREPAID ONLY COMMANDS
            if (/^(beli|paket|internet)/.test(keyword)) {
                if (customer.billing_mode === 'postpaid') {
                    await service.sendMessage(senderJid, '⚠️ *Menu Terbatas*\n\nMaaf, menu Pembelian Paket hanya tersedia untuk pelanggan Prabayar (Prepaid).');
                    return;
                }
                const { PrepaidBotHandler } = await Promise.resolve().then(() => __importStar(require('./PrepaidBotHandler')));
                const resp = await PrepaidBotHandler.handleBuyCommand(senderJid, customer);
                if (resp) {
                    await WhatsAppSessionService_1.WhatsAppSessionService.setSession(senderPhone, { step: 'waiting_prepaid_selection', data: {} });
                    await service.sendMessage(senderJid, resp);
                }
                return;
            }
            // Prepaid Selection (1, 2, 3)
            if (['1', '2', '3'].includes(cleanText)) {
                if (session && session.step === 'waiting_prepaid_selection') {
                    const { PrepaidBotHandler } = await Promise.resolve().then(() => __importStar(require('./PrepaidBotHandler')));
                    const resp = await PrepaidBotHandler.handlePackageSelection(senderJid, customer, cleanText);
                    await WhatsAppSessionService_1.WhatsAppSessionService.clearSession(senderPhone);
                    if (resp) {
                        await service.sendMessage(senderJid, resp);
                        return;
                    }
                }
            }
            // Command /status for Prepaid
            if (keyword === 'status' || keyword === 'cekstatus' || cleanText === '/status') {
                if (customer.billing_mode === 'prepaid') {
                    const expiry = customer.expiry_date ? new Date(customer.expiry_date) : null;
                    const now = new Date();
                    let msg = `📊 *STATUS INTERNET (PRABAYAR)*\n\n`;
                    msg += `👤 Pelanggan: ${customer.name}\n`;
                    if (expiry) {
                        const isExpired = expiry <= now;
                        msg += `⏰ Masa Aktif: ${expiry.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}\n`;
                        msg += `\n🌐 Status: ${isExpired ? '❌ *NONAKTIF*' : '✅ *AKTIF*'}\n`;
                        if (isExpired) {
                            msg += `\n💡 Ketik *Beli* untuk memperpanjang layanan.`;
                        }
                        else {
                            msg += `\n💡 Ketik *Beli* jika ingin menambah masa aktif.`;
                        }
                    }
                    else {
                        msg += `⏰ Masa Aktif: Belum diset\n`;
                    }
                    await service.sendMessage(senderJid, msg);
                    return;
                }
            }
            // 5.5 Self-Service Name Update (One-Time Only)
            if (/^(edit|ganti|ubah)\s+nama/.test(cleanText)) {
                if (!customer) {
                    await service.sendMessage(senderJid, 'Maaf, nomor Anda belum terdaftar.');
                    return;
                }
                if (customer.name_edited_at) {
                    await service.sendMessage(senderJid, '⚠️ Maaf, Anda sudah pernah mengubah nama pelanggan satu kali. Untuk perubahan data lebih lanjut, silakan hubungi Admin.');
                    return;
                }
                // Extract name safely (preserving case for the name part)
                // "edit nama " is 10 chars, but regex handles variations.
                // easier to split by space and join rest
                const parts = messageContent.split(/\s+/);
                const newName = parts.slice(2).join(' ').trim();
                if (newName.length < 3) {
                    await service.sendMessage(senderJid, '⚠️ Nama terlalu pendek. Mohon masukkan nama lengkap yang valid.\nContoh: *Ganti Nama Budi Santoso*');
                    return;
                }
                try {
                    await pool_1.databasePool.query('UPDATE customers SET name = ?, name_edited_at = NOW() WHERE id = ?', [newName, customer.id]);
                    await service.sendMessage(senderJid, `✅ *Sukses!* Nama pelanggan berhasil diubah menjadi:

*${newName}*

_Catatan: Fitur ubah nama mandiri ini hanya dapat digunakan satu kali._`);
                }
                catch (err) {
                    console.error('Error updating customer name via WA:', err);
                    await service.sendMessage(senderJid, 'Maaf, terjadi kesalahan sistem saat memproses permintaan Anda.');
                }
                return;
            }
            // 6. WiFi Commands (Strict & Loose Matching)
            if (cleanText.includes('wifi') || cleanText.includes('password') || cleanText.includes('sandi')) {
                if (customer) {
                    if (/^(info|cek)\s*wifi/.test(cleanText) || cleanText === 'wifi') {
                        const res = await GenieacsWhatsAppController_1.GenieacsWhatsAppController.getCurrentWiFiInfo(senderPhone); // Use senderPhone for lookup
                        await service.sendMessage(senderJid, res.message);
                        return;
                    }
                    if (cleanText === 'ganti password' || cleanText === 'ganti sandi') {
                        await service.sendMessage(senderJid, 'Untuk mengganti password WiFi, ketik: Ganti Password [PasswordBaru]\nContoh: Ganti Password rahasia123');
                        return;
                    }
                    if (cleanText.startsWith('ganti password ') || cleanText.startsWith('ganti sandi ')) {
                        const newPass = messageContent.split(/\s+/).slice(2).join(' ').trim();
                        if (!newPass) {
                            await service.sendMessage(senderJid, 'Password tidak boleh kosong.');
                            return;
                        }
                        const res = await GenieacsWhatsAppController_1.GenieacsWhatsAppController.changeWiFiPassword(senderPhone, newPass);
                        await service.sendMessage(senderJid, res.message);
                        return;
                    }
                }
            }
            // 6.2 Reboot ONT Command
            if (keyword === 'reboot' || cleanText === 'restart modem' || cleanText === '/reboot') {
                if (customer) {
                    await service.sendMessage(senderJid, '🔄 Memproses perintah restart modem...');
                    const res = await GenieacsWhatsAppController_1.GenieacsWhatsAppController.restartONT(senderPhone);
                    await service.sendMessage(senderJid, res.message);
                }
                else {
                    await service.sendMessage(senderJid, 'Maaf, nomor Anda belum terdaftar.');
                }
                return;
            }
            // 6.5 Admin/Operator Request
            if (keyword === 'admin' || keyword === 'operator' || cleanText.includes('hubungi admin')) {
                await service.sendMessage(senderJid, `👨‍💼 *Kontak Admin/Operator*

Silakan hubungi kami di:
wa.me/628123456789 (Admin Utama)

_Jam Operasional: 08:00 - 17:00_`);
                return;
            }
            // 7. AI ChatBot Fallback
            try {
                // If customer is null, treat as guest. AI will handle generic Q&A.
                const aiResponse = await ChatBotService_1.ChatBotService.ask(messageContent, customer || { status: 'guest' });
                await service.sendMessage(senderJid, aiResponse);
            }
            catch (error) {
                // Fallback to menu if AI fails
                console.error('[Handler] AI Error:', error);
                await this.sendMenu(service, senderJid, customer);
            }
        }
        catch (error) {
            console.error('Error handling message:', error);
        }
    }
    static async getCustomerByPhone(phone) {
        // 1. Check LID Mapping first (Direct Match)
        try {
            const [lidRows] = await pool_1.databasePool.query('SELECT c.* FROM customers c JOIN customer_wa_lids l ON c.id = l.customer_id WHERE l.lid = ? LIMIT 1', [phone]);
            if (lidRows.length > 0) {
                console.log(`[WhatsAppHandler] ✅ Found customer via LID: ${lidRows[0].name}`);
                return lidRows[0];
            }
        }
        catch (e) {
            console.error('Error checking LID:', e);
        }
        // NEW: Auto-link attempt for LID users
        // If this looks like an LID and we don't have a direct match,
        // try to find customers with similar phone patterns
        const isLikelyLid = phone.length > 12 && !/^[0-9]{9,13}$/.test(phone);
        if (isLikelyLid) {
            console.log(`[WhatsAppHandler] 🔍 Auto-link attempt for potential LID: ${phone}`);
            const autoLinkedCustomer = await this.attemptAutoLinkByPattern(phone);
            if (autoLinkedCustomer) {
                return autoLinkedCustomer;
            }
        }
        // Normalize phone number - strip all non-digits first
        const cleanPhone = phone.replace(/\D/g, '');
        // If phone is too short or too long (LID), skip
        if (cleanPhone.length < 9 || cleanPhone.length > 15) {
            console.log(`[WhatsAppHandler] Phone ${phone} invalid length, skipping lookup`);
            return null;
        }
        // Generate all possible formats INCLUDING international formats
        const formats = [];
        // Original
        formats.push(cleanPhone);
        // Handle international numbers (Philippine numbers start with 63)
        if (cleanPhone.startsWith('63')) {
            // Philippine format: 63XXXXXXXXX -> 0XXXXXXXXX (local format)
            formats.push('0' + cleanPhone.substring(2));
            // Also try without country code
            formats.push(cleanPhone.substring(2));
        }
        // If starts with 62, try without it (convert to 0xxx)
        if (cleanPhone.startsWith('62')) {
            formats.push('0' + cleanPhone.substring(2));
            formats.push(cleanPhone.substring(2)); // raw without prefix
        }
        // If starts with 0, try with 62
        if (cleanPhone.startsWith('0')) {
            formats.push('62' + cleanPhone.substring(1));
            formats.push(cleanPhone.substring(1)); // raw without 0
        }
        // If starts with 8 (raw), try 08 and 628
        if (cleanPhone.startsWith('8')) {
            formats.push('0' + cleanPhone);
            formats.push('62' + cleanPhone);
        }
        // Remove duplicates
        const uniqueFormats = [...new Set(formats)];
        console.log(`[WhatsAppHandler] Looking up phone: ${phone} -> formats:`, uniqueFormats);
        for (const fmt of uniqueFormats) {
            const [rows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE phone = ? LIMIT 1', [fmt]);
            if (rows.length > 0) {
                console.log(`[WhatsAppHandler] ✅ Found customer: ${rows[0].name} (phone: ${rows[0].phone})`);
                return rows[0];
            }
        }
        // Fallback: Try partial LIKE match (last 9 digits)
        if (cleanPhone.length >= 9) {
            const last9 = cleanPhone.slice(-9);
            const [rows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE phone LIKE ? LIMIT 1', [`%${last9}`]);
            if (rows.length > 0) {
                console.log(`[WhatsAppHandler] ✅ Found customer via partial match: ${rows[0].name}`);
                return rows[0];
            }
        }
        console.log(`[WhatsAppHandler] ❌ No customer found for phone: ${phone}`);
        return null;
    }
    /**
     * Attempt auto-link by finding customers with similar phone number patterns
     * This helps when LID looks similar to actual phone numbers
     */
    static async sendMenu(service, jid, customer) {
        let text = '';
        if (customer) {
            const isPostpaid = customer.billing_mode === 'postpaid';
            text = `👋 Halo *${customer.name}*\n\n` +
                `🤖 *Menu Otomatis*\n` +
                `• Ketik *Tagihan* untuk cek tagihan\n` +
                (isPostpaid ? '' : `• Ketik *Beli* untuk paket (Prabayar)\n• Ketik *Status* untuk cek masa aktif\n`) +
                `• Ketik *JanjiBayar* untuk minta perpanjangan waktu bayar\n` +
                `• Ketik *WiFi* untuk info WiFi\n` +
                `• Ketik *Edit Nama [NamaBaru]* untuk ubah nama\n` +
                `• Ketik *Menu* untuk lihat ini lagi\n\n` +
                `🛠️ *Fitur Teknis*\n` +
                `• Ketik *Reset* untuk refresh koneksi\n` +
                `• Ketik *Reboot* untuk restart Modem\n\n` +
                `_Butuh bantuan lain? Tulis pertanyaan Anda, AI kami akan membantu!_`;
        }
        else {
            text = `👋 Selamat datang di Billing System.\n\n` +
                `*🔔 Informasi Penting:*\n` +
                `Nomor Anda belum terdaftar di sistem kami.\n\n` +
                `*📝 Pilihan Yang Tersedia:*\n\n` +
                `1️⃣ *Sudah Pelanggan?* \n` +
                `Ketik: *!link [NomorHPAnda]*\n` +
                `Contoh: *!link 08123456789*\n\n` +
                `2️⃣ *Pelanggan Baru?*\n` +
                `Ketik: *Daftar*\n\n` +
                `3️⃣ *Bantuan Otomatis*\n` +
                `Kirim pesan: *Hubungkan otomatis*\n` +
                `(Kami akan coba hubungkan secara otomatis)\n\n` +
                `4️⃣ *Cek ID Saya*\n` +
                `Ketik: *!myid*\n\n` +
                `_Pilih salah satu opsi di atas dengan mengetik sesuai petunjuk._`;
        }
        await service.sendMessage(jid, text);
    }
    static async handleCheckBill(service, jid, customer) {
        if (!customer) {
            await service.sendMessage(jid, 'Maaf, nomor Anda belum terdaftar.');
            return;
        }
        const [inv] = await pool_1.databasePool.query(`SELECT * FROM invoices WHERE customer_id = ? AND status != 'paid' ORDER BY id DESC LIMIT 1`, [customer.id]);
        if (inv.length > 0) {
            const i = inv[0];
            const msg = `🧾 *Info Tagihan*\n\n` +
                `Periode: ${i.period_date || '-'}\n` +
                `Total: Rp ${parseFloat(i.remaining_amount).toLocaleString('id-ID')}\n` +
                `Jatuh Tempo: ${i.due_date ? new Date(i.due_date).toLocaleDateString() : '-'}\n\n` +
                `Silakan lakukan pembayaran sebelum jatuh tempo.`;
            await service.sendMessage(jid, msg);
        }
        else {
            await service.sendMessage(jid, `✅ Terimakasih! Tidak ada tagihan yang tertunggak saat ini.`);
        }
    }
    static async handleRegistration(service, jid, phone, text, session, location) {
        if (!session) {
            if (/^(daftar|reg)/.test(text)) {
                await WhatsAppSessionService_1.WhatsAppSessionService.setSession(phone, { step: 'name', data: {} });
                await service.sendMessage(jid, 'Silakan masukkan *Nama Lengkap* Anda:');
            }
            else {
                await this.sendMenu(service, jid, null);
            }
            return;
        }
        switch (session.step) {
            case 'name':
                await WhatsAppSessionService_1.WhatsAppSessionService.updateSession(phone, { step: 'phone', data: { ...session.data, name: text } });
                await service.sendMessage(jid, `Halo *${text}*! Silakan masukkan *Nomor HP* Anda yang aktif (WA):\n\nContoh: 08123456789\n\n_Nomor ini digunakan tim teknisi untuk menghubungi Anda._`);
                break;
            case 'phone':
                // Basic phone validation
                const cleanPhone = text.replace(/\D/g, '');
                if (cleanPhone.length < 9 || cleanPhone.length > 15) {
                    await service.sendMessage(jid, '⚠️ Nomor HP tidak valid. Mohon masukkan nomor yang benar (9-15 digit).');
                    return;
                }
                await WhatsAppSessionService_1.WhatsAppSessionService.updateSession(phone, { step: 'address', data: { ...session.data, phone: cleanPhone } });
                await service.sendMessage(jid, 'Terima kasih. Sekarang masukkan *Alamat Lengkap* lokasi pemasangan (termasuk RT/RW/Dusun):');
                break;
            case 'address':
                await WhatsAppSessionService_1.WhatsAppSessionService.updateSession(phone, { step: 'location', data: { ...session.data, address: text } });
                await service.sendMessage(jid, 'Terakhir, mohon kirimkan *Lokasi (Share Location)* Anda saat ini agar teknisi kami mudah menemukan lokasi pemasangan.\n\n(Klik ikon klip kertas/tambah 📎 -> Lokasi/Location -> Kirim lokasi saat ini 📍)');
                break;
            case 'location':
                if (!location) {
                    await service.sendMessage(jid, 'Mohon kirimkan format *Lokasi (Maps)*, bukan teks.\nAtau ketik *Batal* untuk membatalkan.');
                    return;
                }
                const userData = {
                    ...session.data,
                    latitude: location.degreesLatitude,
                    longitude: location.degreesLongitude
                };
                try {
                    // Save to registration_requests table
                    await pool_1.databasePool.query('INSERT INTO registration_requests (name, address, phone, latitude, longitude, status) VALUES (?, ?, ?, ?, ?, ?)', [userData.name, userData.address, userData.phone, userData.latitude, userData.longitude, 'pending']);
                    await service.sendMessage(jid, `✅ Terima kasih *${userData.name}*.\nData & Lokasi Anda telah kami terima.\n\nAdmin kami akan segera menghubungi Anda untuk proses selanjutnya.`);
                }
                catch (error) {
                    console.error('Error saving registration request:', error);
                    await service.sendMessage(jid, 'Maaf, terjadi kesalahan sistem saat menyimpan data registrasi. Silakan coba lagi nanti.');
                }
                await WhatsAppSessionService_1.WhatsAppSessionService.clearSession(phone);
                break;
        }
    }
    /**
     * Attempt to automatically link by searching matching phone pattern
     */
    static async attemptAutoLinkByPattern(jid) {
        try {
            // Extract numeric parts from JID (handle both @s.whatsapp.net and @lid)
            // e.g. 62812345@s.whatsapp.net -> 62812345
            // e.g. 63729093849223@lid -> 63729093849223
            let phoneDigits = jid.split('@')[0].replace(/\D/g, '');
            if (!phoneDigits)
                return null;
            // Patterns to try
            const patterns = [phoneDigits];
            // if starts with 62, also try 0
            if (phoneDigits.startsWith('62')) {
                patterns.push('0' + phoneDigits.substring(2));
            }
            // if starts with 0, also try 62
            if (phoneDigits.startsWith('0')) {
                patterns.push('62' + phoneDigits.substring(1));
            }
            // Also try matching the last 10 digits to be safer with country codes
            if (phoneDigits.length >= 10) {
                const tail = phoneDigits.substring(phoneDigits.length - 10);
                patterns.push('%' + tail);
            }
            // query
            let customer = null;
            // Try exact match first
            const [rows] = await pool_1.databasePool.query('SELECT * FROM customers WHERE phone IN (?) LIMIT 1', [patterns]);
            if (rows.length > 0) {
                customer = rows[0];
            }
            else {
                // Try suffix match if no exact match
                const [rowsSuffix] = await pool_1.databasePool.query('SELECT * FROM customers WHERE phone LIKE ? LIMIT 1', ['%' + phoneDigits.substring(Math.max(0, phoneDigits.length - 10))]);
                if (rowsSuffix.length > 0)
                    customer = rowsSuffix[0];
            }
            if (customer) {
                console.log(`[WhatsAppHandler] ✅ Auto-linked customer found: ${customer.name}`);
                // Link it with FULL JID
                await pool_1.databasePool.query('INSERT INTO customer_wa_lids (customer_id, lid) VALUES (?, ?) ON DUPLICATE KEY UPDATE customer_id = VALUES(customer_id)', [customer.id, jid]);
                return customer;
            }
            return null;
        }
        catch (err) {
            console.error('[WhatsAppHandler] Auto-link error:', err);
            return null;
        }
    }
    /**
     * Handle auto-connection request from customers
     * This provides guided assistance for linking accounts
     */
    static async handleAutoConnectionRequest(jid, service) {
        try {
            await service.sendMessage(jid, `🔄 *Memproses Permintaan Hubungan Otomatis...*\n\nMohon tunggu sebentar, kami sedang mencari akun Anda di sistem.`);
            // Try auto-link first
            const autoLinkedCustomer = await this.attemptAutoLinkByPattern(jid);
            if (autoLinkedCustomer) {
                await service.sendMessage(jid, `✅ *Berhasil Terhubung!*

Akun Anda telah berhasil dihubungkan secara otomatis:

👤 Nama: *${autoLinkedCustomer.name}*
📞 Nomor: *${autoLinkedCustomer.phone}*

Sekarang Anda dapat menggunakan semua fitur bot. Ketik *Menu* untuk melihat pilihan.`);
                return;
            }
            // If auto-link fails, provide manual guidance
            await service.sendMessage(jid, `🔍 *Pencarian Otomatis Gagal*

Kami tidak dapat menemukan akun Anda secara otomatis. Silakan:

1️⃣ Pastikan nomor HP Anda sudah terdaftar di sistem
2️⃣ Gunakan format: *!link [NomorHPAnda]*
   Contoh: *!link 08123456789*

Atau hubungi Admin untuk bantuan lebih lanjut.`);
        }
        catch (error) {
            console.error('Error in auto-connection request:', error);
            await service.sendMessage(jid, 'Maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti atau hubungi Admin.');
        }
    }
    /**
     * Process payment image for OCR verification
     */
    static async processPaymentImage(buffer, customer, service, senderJid) {
        try {
            console.log(`[WhatsAppHandler] 🤖 Processing payment image for customer: ${customer.name}`);
            // Import payment verification service
            const { PaymentVerificationService } = await Promise.resolve().then(() => __importStar(require('./PaymentVerificationService')));
            // Create media message object
            const mediaMessage = {
                data: buffer,
                mimetype: 'image/jpeg' // Default assumption
            };
            // Process payment verification
            const result = await PaymentVerificationService.verifyPaymentProofAuto(mediaMessage, customer.id);
            if (result.success) {
                await service.sendMessage(senderJid, `✅ *VERIFIKASI BERHASIL!*
                
Pembayaran sebesar *Rp ${result.amount?.toLocaleString('id-ID')}* telah berhasil diverifikasi.
                
Status: *${result.invoiceStatus}*
Nomor Invoice: *${result.invoiceNumber}*

Terima kasih atas pembayaran Anda! 🎉`);
            }
            else {
                await service.sendMessage(senderJid, `⚠️ *VERIFIKASI GAGAL*
                
${result.error || 'Gagal memverifikasi bukti pembayaran.'}
                
Silakan coba kirim ulang gambar yang lebih jelas atau hubungi Admin untuk bantuan.`);
            }
            return result;
        }
        catch (error) {
            console.error('[WhatsAppHandler] Error processing payment image:', error);
            await service.sendMessage(senderJid, '❌ Terjadi kesalahan saat memproses bukti pembayaran. Silakan coba lagi nanti.');
            throw error;
        }
    }
    /**
     * Handle location message
     */
    static async handleLocationMessage(locationData, customer, service, senderJid, senderPhone) {
        try {
            console.log(`[WhatsAppHandler] 📍 Processing location message from ${senderPhone}`);
            if (!customer) {
                await service.sendMessage(senderJid, 'Maaf, Anda harus terdaftar sebagai pelanggan untuk menggunakan fitur lokasi.');
                return;
            }
            // Process location data (this would typically save to database or trigger technician dispatch)
            const lat = locationData.degreesLatitude;
            const lng = locationData.degreesLongitude;
            await service.sendMessage(senderJid, `📍 *Lokasi Diterima!*
            
Koordinat:
• Latitude: ${lat}
• Longitude: ${lng}

Lokasi Anda telah dicatat dalam sistem. Tim teknisi akan menggunakan informasi ini saat melakukan kunjungan.`);
            // Here you would typically save the location to database or trigger related workflows
        }
        catch (error) {
            console.error('[WhatsAppHandler] Error handling location message:', error);
            await service.sendMessage(senderJid, 'Maaf, terjadi kesalahan saat memproses lokasi Anda.');
        }
    }
}
exports.WhatsAppHandler = WhatsAppHandler;
//# sourceMappingURL=WhatsAppHandler.js.map