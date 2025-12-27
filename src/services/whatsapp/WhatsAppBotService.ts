/**
 * WhatsApp Bot Service
 * Handles bot commands for package purchase and payment verification
 */

// import { Message, MessageMedia } from 'whatsapp-web.js'; // Removed to support multiple providers
import { WhatsAppService } from './WhatsAppService';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

import { PaymentVerificationService } from './PaymentVerificationService';
import { AIAnomalyDetectionService } from '../billing/AIAnomalyDetectionService';
import { WiFiManagementService } from '../genieacs/WiFiManagementService';

// Generic interface to support both Baileys and WhatsAppAuth based messages
export interface WhatsAppMessageInterface {
    from: string;
    body: string;
    hasMedia: boolean;
    downloadMedia(): Promise<{ mimetype: string; data: string; filename?: string }>;
}



export class WhatsAppBotService {
    private static readonly COMMAND_PREFIX = '/';


    /**
     * Validate if sender is a registered customer
     * Returns customer object if valid, null otherwise (and sends rejection message)
     */
    private static async validateCustomer(phone: string): Promise<any | null> {
        const customer = await this.getCustomerByPhone(phone);

        if (!customer) {
            await this.sendMessage(
                phone,
                '⛔ *AKSES DITOLAK*\n\n' +
                'Maaf, nomor WhatsApp Anda belum terdaftar di sistem kami.\n\n' +
                'Menu ini khusus untuk pelanggan terdaftar.\n' +
                'Silakan hubungi admin/customer service untuk pendaftaran.'
            );
            return null;
        }

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
        try {
            const from = message.from || '';
            if (!from) return;
            const body = message.body?.trim() || '';
            const hasMedia = message.hasMedia;

            // Extract phone number (remove @c.us)
            phone = from.split('@')[0] || '';

            console.log(`[WhatsAppBot] Message from ${phone}: ${body.substring(0, 50)}...`);

            // Handle image/media (bukti transfer)
            if (hasMedia) {
                await this.handleMediaMessage(message, phone);
                return;
            }

            // Handle text commands
            if (body.startsWith(this.COMMAND_PREFIX)) {
                await this.handleCommand(message, phone, body);
                return;
            }

            // Handle menu navigation
            if (this.isMenuCommand(body)) {
                await this.handleMenuCommand(message, phone, body);
                return;
            }

            // Default: Show main menu
            await this.showMainMenu(phone);

        } catch (error: any) {
            console.error('[WhatsAppBot] Error handling message:', error);
            await this.sendMessage(phone, '❌ Terjadi kesalahan. Silakan coba lagi atau hubungi customer service.');
        }
    }

    /**
     * Handle media message (bukti transfer)
     * AI akan analisa dan auto-approve jika valid
     */
    private static async handleMediaMessage(message: WhatsAppMessageInterface, phone: string): Promise<void> {
        try {
            // Validate customer first
            const customer = await this.validateCustomer(phone);
            if (!customer) return;

            const media = await message.downloadMedia();

            // Process payment verification - AI will analyze and match automatically
            await this.sendMessage(phone, '⏳ Sedang menganalisa bukti transfer Anda dengan AI...\nMohon tunggu sebentar.');

            const verificationResult = await PaymentVerificationService.verifyPaymentProofAuto(
                media,
                customer.id
            );

            if (verificationResult.success) {
                await this.sendMessage(
                    phone,
                    '✅ *Pembayaran Berhasil Diverifikasi!*\n\n' +
                    `Invoice: ${verificationResult.invoiceNumber || '-'}\n` +
                    `Jumlah: Rp ${verificationResult.amount?.toLocaleString('id-ID') || '0'}\n` +
                    `Status: ${verificationResult.invoiceStatus || 'Lunas'}\n\n` +
                    'Terima kasih atas pembayaran Anda!'
                );
            } else {
                await this.sendMessage(
                    phone,
                    '❌ *Verifikasi Gagal*\n\n' +
                    `Alasan: ${verificationResult.error}\n\n` +
                    'Silakan periksa kembali bukti transfer Anda atau hubungi customer service.\n\n' +
                    '*Tips:*\n' +
                    '• Pastikan foto bukti transfer jelas\n' +
                    '• Pastikan jumlah transfer sesuai dengan tagihan\n' +
                    '• Pastikan bukti transfer belum pernah digunakan'
                );
            }

        } catch (error: any) {
            console.error('[WhatsAppBot] Error handling media:', error);
            await this.sendMessage(
                phone,
                '❌ Terjadi kesalahan saat memproses bukti transfer. Silakan coba lagi atau hubungi customer service.'
            );
        }
    }

    /**
     * Handle command
     */
    private static async handleCommand(message: WhatsAppMessageInterface, phone: string, command: string): Promise<void> {
        const cmd = command.toLowerCase().trim();

        if (cmd === '/start' || cmd === '/menu' || cmd === '/help') {
            await this.showMainMenu(phone);
        } else if (cmd === '/tagihan' || cmd.startsWith('/tagihan')) {
            await this.showInvoices(phone);
        } else if (cmd === '/wifi' || cmd === '/ubahwifi') {
            await this.showWiFiMenu(phone);
        } else if (cmd.startsWith('/wifi_ssid ')) {
            const newSSID = command.substring(11).trim();
            await this.changeWiFiSSID(phone, newSSID);
        } else if (cmd.startsWith('/wifi_password ')) {
            const newPassword = command.substring(15).trim();
            await this.changeWiFiPassword(phone, newPassword);
        } else if (cmd === '/reboot') {
            await this.rebootOnt(phone);
        } else if (cmd.startsWith('/wifi_both ')) {
            // Format: /wifi_both SSID|Password
            const parts = command.substring(11).trim().split('|');
            if (parts.length === 2 && parts[0] && parts[1]) {
                await this.changeWiFiBoth(phone, parts[0].trim(), parts[1].trim());
            } else {
                await this.sendMessage(
                    phone,
                    '❌ *Format salah!*\n\n' +
                    'Gunakan format: /wifi_both SSID|Password\n' +
                    'Contoh: /wifi_both MyWiFi|password123'
                );
            }
        } else if (cmd.startsWith('/lapor')) {
            const description = command.substring(6).trim();
            await this.handleReportCommand(phone, description);
        } else if (cmd.startsWith('/selesai')) {
            await this.handleResolveCommand(phone);
        } else {
            await this.sendMessage(
                phone,
                '❌ *Command tidak dikenal*\n\n' +
                'Gunakan salah satu command berikut:\n' +
                '*/menu* - Tampilkan menu utama\n' +
                '*/tagihan* - Lihat tagihan\n' +
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
    private static async handleMenuCommand(message: WhatsAppMessageInterface, phone: string, command: string): Promise<void> {
        const cmd = command.toLowerCase().trim();

        if (cmd === '1' || cmd === 'tagihan' || cmd === 'invoice') {
            await this.showInvoices(phone);
        } else if (cmd === '2' || cmd === 'bantuan' || cmd === 'help') {
            await this.showHelp(phone);
        } else if (cmd === '3' || cmd === 'wifi' || cmd === 'ubahwifi') {
            await this.showWiFiMenu(phone);
        } else if (cmd === '4' || cmd === 'reboot' || cmd === 'restart') {
            await this.rebootOnt(phone);
        } else {
            await this.showMainMenu(phone);
        }
    }

    /**
     * Check if command is menu navigation
     */
    private static isMenuCommand(command: string): boolean {
        const menuCommands = ['1', '2', '3', '4', 'tagihan', 'invoice', 'bantuan', 'help', 'menu', 'wifi', 'ubahwifi', 'reboot', 'restart'];
        return menuCommands.includes(command.toLowerCase());
    }

    /**
     * Show main menu
     */
    private static async showMainMenu(phone: string): Promise<void> {
        // Validate customer access first
        const customer = await this.validateCustomer(phone);
        if (!customer) return;

        const menu = `🏠 *MENU UTAMA*
Hai *${customer.name || 'Pelanggan'}*,

1️⃣ *Tagihan* - Lihat tagihan yang belum dibayar
2️⃣ *Bantuan* - Informasi bantuan
3️⃣ *WiFi* - Ubah nama WiFi & password
4️⃣ *Reboot* - Restart Perangkat (ONT)

*Cara Menggunakan:*
• Ketik angka menu (1, 2, 3, 4) atau
• Ketik command: /tagihan, /help, /wifi, /reboot

*Atau gunakan command:*
/tagihan - Lihat tagihan
/wifi - Ubah WiFi
/reboot - Reboot ONT
/help - Bantuan

*💡 TIP:*
Kirim foto bukti transfer langsung untuk verifikasi otomatis!`;

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
            message += '2. Kirim foto bukti transfer ke chat ini\n';
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
3. Kirim foto bukti transfer ke chat ini
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
                await this.sendMessage(
                    phone,
                    `✅ *SSID WiFi Berhasil Diubah!*\n\n` +
                    `SSID Baru: *${newSSID}*\n\n` +
                    `Perubahan akan diterapkan dalam beberapa saat.\n` +
                    `Silakan sambungkan ulang perangkat Anda dengan SSID baru.`
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
                await this.sendMessage(
                    phone,
                    `✅ *Password WiFi Berhasil Diubah!*\n\n` +
                    `Password Baru: *${newPassword}*\n\n` +
                    `⚠️ PENTING: Simpan password ini dengan aman!\n\n` +
                    `Perubahan akan diterapkan dalam beberapa saat.\n` +
                    `Silakan sambungkan ulang perangkat Anda dengan password baru.`
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
                await this.sendMessage(
                    phone,
                    `✅ *WiFi Berhasil Diubah!*\n\n` +
                    `SSID Baru: *${newSSID}*\n` +
                    `Password Baru: *${newPassword}*\n\n` +
                    `⚠️ PENTING: Simpan kredensial ini dengan aman!\n\n` +
                    `Perubahan akan diterapkan dalam beberapa saat.\n` +
                    `Silakan sambungkan ulang perangkat Anda dengan kredensial baru.`
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
     * Get customer by phone number (helper)
     */
    private static async getCustomerByPhone(phone: string): Promise<any | null> {
        try {
            let normalizedPhone = phone.replace('@c.us', '').trim();

            // Try exact match first
            const [customersExact] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM customers WHERE phone = ? LIMIT 1',
                [normalizedPhone]
            );

            if (customersExact.length > 0) {
                return customersExact[0];
            }

            // Try with leading 0 removed (if starts with 62)
            if (normalizedPhone.startsWith('62')) {
                const phoneWithZero = '0' + normalizedPhone.substring(2);
                const [customersZero] = await databasePool.query<RowDataPacket[]>(
                    'SELECT * FROM customers WHERE phone = ? OR phone = ? LIMIT 1',
                    [phoneWithZero, normalizedPhone]
                );
                if (customersZero.length > 0) {
                    return customersZero[0];
                }
            } else if (normalizedPhone.startsWith('0')) {
                // Try with 62 prefix
                const phoneWith62 = '62' + normalizedPhone.substring(1);
                const [customers62] = await databasePool.query<RowDataPacket[]>(
                    'SELECT * FROM customers WHERE phone = ? OR phone = ? LIMIT 1',
                    [phoneWith62, normalizedPhone]
                );
                if (customers62.length > 0) {
                    return customers62[0];
                }
            }

            return null;
        } catch (error: any) {
            console.error('[WhatsAppBot] Error getting customer by phone:', error);
            return null;
        }
    }


    /**
     * Send message helper
     */
    private static async sendMessage(phone: string, message: string): Promise<void> {
        try {
            await WhatsAppService.sendMessage(phone, message);
        } catch (error: any) {
            console.error('[WhatsAppBot] Error sending message:', error);
        }
    }
}

