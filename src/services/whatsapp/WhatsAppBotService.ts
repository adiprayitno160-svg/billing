/**
 * WhatsApp Bot Service
 * Handles bot commands for package purchase and payment verification
 */

import { Message, MessageMedia } from 'whatsapp-web.js';
import { WhatsAppService } from './WhatsAppService';
import { databasePool } from '../../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { PrepaidPackageService } from '../prepaid/PrepaidPackageService';
import { PaymentVerificationService } from './PaymentVerificationService';
import { AIAnomalyDetectionService } from '../billing/AIAnomalyDetectionService';

export interface PurchaseCode {
    id: number;
    code: string;
    customer_id: number;
    package_id: number;
    amount: number;
    status: 'pending' | 'paid' | 'expired' | 'cancelled';
    expires_at: Date;
    created_at: Date;
}

export class WhatsAppBotService {
    private static readonly COMMAND_PREFIX = '/';
    private static readonly CODE_EXPIRY_HOURS = 24;

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
    static async handleMessage(message: Message): Promise<void> {
        try {
            const from = message.from;
            const body = message.body?.trim() || '';
            const hasMedia = message.hasMedia;

            // Extract phone number (remove @c.us)
            const phone = from.split('@')[0];

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
    private static async handleMediaMessage(message: Message, phone: string): Promise<void> {
        try {
            const media = await message.downloadMedia();
            
            // Get customer by phone
            const [customers] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM customers WHERE phone = ? LIMIT 1',
                [phone]
            );

            if (customers.length === 0) {
                await this.sendMessage(
                    phone,
                    '❌ *Pelanggan Tidak Ditemukan*\n\n' +
                    'Nomor WhatsApp Anda belum terdaftar sebagai pelanggan.\n' +
                    'Silakan hubungi customer service untuk registrasi.'
                );
                return;
            }

            const customer = customers[0];

            // Process payment verification - AI will analyze and match automatically
            await this.sendMessage(phone, '⏳ Sedang menganalisa bukti transfer Anda dengan AI...\nMohon tunggu sebentar.');

            const verificationResult = await PaymentVerificationService.verifyPaymentProofAuto(
                media,
                customer.id,
                customer.billing_mode || 'postpaid'
            );

            if (verificationResult.success) {
                if (verificationResult.type === 'prepaid') {
                    await this.sendMessage(
                        phone,
                        '✅ *Pembayaran Berhasil Diverifikasi!*\n\n' +
                        `Paket: ${verificationResult.packageName || 'Paket Internet'}\n` +
                        `Jumlah: Rp ${verificationResult.amount?.toLocaleString('id-ID') || '0'}\n\n` +
                        'Paket internet Anda akan segera diaktifkan. Terima kasih!'
                    );
                } else {
                    await this.sendMessage(
                        phone,
                        '✅ *Pembayaran Berhasil Diverifikasi!*\n\n' +
                        `Invoice: ${verificationResult.invoiceNumber || '-'}\n` +
                        `Jumlah: Rp ${verificationResult.amount?.toLocaleString('id-ID') || '0'}\n` +
                        `Status: ${verificationResult.invoiceStatus || 'Lunas'}\n\n` +
                        'Terima kasih atas pembayaran Anda!'
                    );
                }
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
    private static async handleCommand(message: Message, phone: string, command: string): Promise<void> {
        const cmd = command.toLowerCase().trim();

        if (cmd === '/start' || cmd === '/menu' || cmd === '/help') {
            await this.showMainMenu(phone);
        } else if (cmd === '/paket' || cmd.startsWith('/paket ')) {
            await this.showPackages(phone);
        } else if (cmd.startsWith('/beli ')) {
            const packageId = parseInt(cmd.split(' ')[1]);
            if (packageId) {
                await this.handlePurchase(phone, packageId);
            } else {
                await this.sendMessage(phone, '❌ Format salah. Gunakan: /beli [ID_PAKET]');
            }
        } else if (cmd === '/status' || cmd.startsWith('/status ')) {
            await this.showPurchaseStatus(phone);
        } else {
            await this.sendMessage(
                phone,
                '❌ *Command tidak dikenal*\n\n' +
                'Gunakan salah satu command berikut:\n' +
                '*/menu* - Tampilkan menu utama\n' +
                '*/paket* - Lihat daftar paket\n' +
                '*/beli [ID]* - Beli paket\n' +
                '*/status* - Cek status pembelian'
            );
        }
    }

    /**
     * Handle menu command
     */
    private static async handleMenuCommand(message: Message, phone: string, command: string): Promise<void> {
        const cmd = command.toLowerCase().trim();

        // Get customer billing mode
        const [customers] = await databasePool.query<RowDataPacket[]>(
            'SELECT billing_mode FROM customers WHERE phone = ? LIMIT 1',
            [phone]
        );
        const billingMode = customers.length > 0 ? customers[0].billing_mode : 'postpaid';

        if (cmd === '1') {
            if (billingMode === 'prepaid') {
                await this.showPackages(phone);
            } else {
                await this.showInvoices(phone);
            }
        } else if (cmd === '2' || cmd === 'status' || cmd === 'cek status') {
            await this.showPurchaseStatus(phone);
        } else if (cmd === '3' || cmd === 'bantuan' || cmd === 'help') {
            await this.showHelp(phone);
        } else if (cmd === 'paket' || cmd === 'paket internet') {
            await this.showPackages(phone);
        } else if (cmd === 'tagihan' || cmd === 'invoice') {
            await this.showInvoices(phone);
        } else {
            await this.showMainMenu(phone);
        }
    }

    /**
     * Check if command is menu navigation
     */
    private static isMenuCommand(command: string): boolean {
        const menuCommands = ['1', '2', '3', 'paket', 'tagihan', 'invoice', 'status', 'bantuan', 'help', 'menu'];
        return menuCommands.includes(command.toLowerCase());
    }

    /**
     * Show main menu
     */
    private static async showMainMenu(phone: string): Promise<void> {
        // Get customer info to show relevant menu
        const [customers] = await databasePool.query<RowDataPacket[]>(
            'SELECT billing_mode FROM customers WHERE phone = ? LIMIT 1',
            [phone]
        );

        const billingMode = customers.length > 0 ? customers[0].billing_mode : 'postpaid';

        let menu = `🤖 *BOT PEMBAYARAN INTERNET*

Selamat datang! Pilih menu:

`;

        if (billingMode === 'prepaid') {
            menu += `1️⃣ *Paket Internet* - Lihat daftar paket
2️⃣ *Status Pembelian* - Cek status pembelian
3️⃣ *Bantuan* - Informasi bantuan

*Cara Menggunakan:*
• Ketik angka menu (1, 2, 3) atau
• Ketik command: /paket, /status, /help

*Atau gunakan command:*
/paket - Lihat paket
/beli [ID] - Beli paket
/status - Cek status`;
        } else {
            menu += `1️⃣ *Tagihan* - Lihat tagihan yang belum dibayar
2️⃣ *Status Pembayaran* - Cek status pembayaran
3️⃣ *Bantuan* - Informasi bantuan

*Cara Menggunakan:*
• Ketik angka menu (1, 2, 3) atau
• Ketik command: /tagihan, /status, /help

*Atau gunakan command:*
/tagihan - Lihat tagihan
/status - Cek status

*💡 TIP:*
Kirim foto bukti transfer langsung untuk verifikasi otomatis!`;
        }

        await this.sendMessage(phone, menu);
    }

    /**
     * Show available packages
     */
    private static async showPackages(phone: string): Promise<void> {
        try {
            const packages = await PrepaidPackageService.getActivePackages();

            if (packages.length === 0) {
                await this.sendMessage(phone, '⚠️ Tidak ada paket yang tersedia saat ini.');
                return;
            }

            let message = '📦 *DAFTAR PAKET INTERNET*\n\n';

            packages.forEach((pkg, index) => {
                message += `${index + 1}. *${pkg.name}*\n`;
                message += `   💨 ${pkg.download_mbps} Mbps / ${pkg.upload_mbps} Mbps\n`;
                message += `   ⏱️ ${pkg.duration_days} hari\n`;
                message += `   💰 Rp ${parseFloat(pkg.price.toString()).toLocaleString('id-ID')}\n`;
                if (pkg.description) {
                    message += `   📝 ${pkg.description.substring(0, 50)}...\n`;
                }
                message += `   🆔 ID: ${pkg.id}\n\n`;
            });

            message += '*Cara Membeli:*\n';
            message += 'Ketik: /beli [ID_PAKET]\n';
            message += 'Contoh: /beli 1';

            await this.sendMessage(phone, message);

        } catch (error: any) {
            console.error('[WhatsAppBot] Error showing packages:', error);
            await this.sendMessage(phone, '❌ Gagal memuat daftar paket. Silakan coba lagi.');
        }
    }

    /**
     * Handle purchase
     */
    private static async handlePurchase(phone: string, packageId: number): Promise<void> {
        try {
            // Get customer by phone
            const [customers] = await databasePool.query<RowDataPacket[]>(
                'SELECT * FROM customers WHERE phone = ? LIMIT 1',
                [phone]
            );

            if (customers.length === 0) {
                await this.sendMessage(
                    phone,
                    '❌ *Pelanggan Tidak Ditemukan*\n\n' +
                    'Nomor WhatsApp Anda belum terdaftar sebagai pelanggan.\n' +
                    'Silakan hubungi customer service untuk registrasi.'
                );
                return;
            }

            const customer = customers[0];

            // Get package
            const packageData = await PrepaidPackageService.getPackageById(packageId);
            if (!packageData) {
                await this.sendMessage(phone, '❌ Paket tidak ditemukan.');
                return;
            }

            // Generate purchase code
            const purchaseCode = await this.generatePurchaseCode(
                customer.id,
                packageId,
                parseFloat(packageData.price.toString())
            );

            // Get payment info
            const [paymentSettings] = await databasePool.query<RowDataPacket[]>(
                `SELECT setting_value FROM system_settings WHERE setting_key = 'payment_bank_account' LIMIT 1`
            );
            const bankAccount = paymentSettings.length > 0 ? paymentSettings[0].setting_value : 'Silakan hubungi admin';

            const message = `✅ *KODE PEMBELIAN BERHASIL DIBUAT*

📦 *Paket:* ${packageData.name}
💰 *Harga:* Rp ${parseFloat(packageData.price.toString()).toLocaleString('id-ID')}
⏱️ *Durasi:* ${packageData.duration_days} hari
💨 *Speed:* ${packageData.download_mbps} Mbps / ${packageData.upload_mbps} Mbps

🔑 *KODE PEMBELIAN:*
*${purchaseCode.code}*

📋 *CARA PEMBAYARAN:*
1. Transfer ke rekening:
   ${bankAccount}

2. *PENTING:* Cantumkan kode pembelian di keterangan transfer:
   *${purchaseCode.code}*

3. Setelah transfer, kirim bukti transfer (foto) ke chat ini

⏰ *Kode berlaku:* 24 jam
📅 *Expired:* ${new Date(purchaseCode.expires_at).toLocaleString('id-ID')}

*Catatan:* Jika tidak melakukan pembayaran dalam 24 jam, kode akan expired.`;

            await this.sendMessage(phone, message);

        } catch (error: any) {
            console.error('[WhatsAppBot] Error handling purchase:', error);
            await this.sendMessage(phone, '❌ Gagal membuat kode pembelian. Silakan coba lagi.');
        }
    }

    /**
     * Generate purchase code
     */
    private static async generatePurchaseCode(
        customerId: number,
        packageId: number,
        amount: number
    ): Promise<PurchaseCode> {
        // Generate unique code: PREFIX + TIMESTAMP + RANDOM
        const prefix = 'PKT';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const code = `${prefix}${timestamp}${random}`;

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + this.CODE_EXPIRY_HOURS);

        const [result] = await databasePool.query<ResultSetHeader>(
            `INSERT INTO purchase_codes 
             (code, customer_id, package_id, amount, status, expires_at, created_at)
             VALUES (?, ?, ?, ?, 'pending', ?, NOW())`,
            [code, customerId, packageId, amount, expiresAt]
        );

        return {
            id: result.insertId,
            code,
            customer_id: customerId,
            package_id: packageId,
            amount,
            status: 'pending',
            expires_at: expiresAt,
            created_at: new Date()
        };
    }

    /**
     * Show purchase status
     */
    private static async showPurchaseStatus(phone: string): Promise<void> {
        try {
            const [customers] = await databasePool.query<RowDataPacket[]>(
                'SELECT id FROM customers WHERE phone = ? LIMIT 1',
                [phone]
            );

            if (customers.length === 0) {
                await this.sendMessage(phone, '❌ Pelanggan tidak ditemukan.');
                return;
            }

            const [codes] = await databasePool.query<RowDataPacket[]>(
                `SELECT pc.*, pp.name as package_name 
                 FROM purchase_codes pc
                 JOIN prepaid_packages pp ON pc.package_id = pp.id
                 WHERE pc.customer_id = ?
                 ORDER BY pc.created_at DESC
                 LIMIT 5`,
                [customers[0].id]
            );

            if (codes.length === 0) {
                await this.sendMessage(phone, '📭 Anda belum memiliki riwayat pembelian.');
                return;
            }

            let message = '📋 *RIWAYAT PEMBELIAN*\n\n';

            codes.forEach((code, index) => {
                const statusEmoji = code.status === 'paid' ? '✅' : code.status === 'expired' ? '⏰' : '⏳';
                message += `${index + 1}. ${statusEmoji} *${code.code}*\n`;
                message += `   Paket: ${code.package_name}\n`;
                message += `   Jumlah: Rp ${parseFloat(code.amount.toString()).toLocaleString('id-ID')}\n`;
                message += `   Status: ${this.getStatusText(code.status)}\n`;
                message += `   Tanggal: ${new Date(code.created_at).toLocaleString('id-ID')}\n\n`;
            });

            await this.sendMessage(phone, message);

        } catch (error: any) {
            console.error('[WhatsAppBot] Error showing status:', error);
            await this.sendMessage(phone, '❌ Gagal memuat status. Silakan coba lagi.');
        }
    }

    /**
     * Show invoices (for postpaid customers)
     */
    private static async showInvoices(phone: string): Promise<void> {
        try {
            const [customers] = await databasePool.query<RowDataPacket[]>(
                'SELECT id, billing_mode FROM customers WHERE phone = ? LIMIT 1',
                [phone]
            );

            if (customers.length === 0) {
                await this.sendMessage(phone, '❌ Pelanggan tidak ditemukan.');
                return;
            }

            const customer = customers[0];

            if (customer.billing_mode !== 'postpaid') {
                await this.sendMessage(
                    phone,
                    'ℹ️ Fitur ini untuk pelanggan postpaid.\n\n' +
                    'Untuk pelanggan prepaid, gunakan:\n' +
                    '*/paket* - Lihat paket\n' +
                    '*/beli [ID]* - Beli paket'
                );
                return;
            }

            const [invoices] = await databasePool.query<RowDataPacket[]>(
                `SELECT * FROM invoices
                 WHERE customer_id = ?
                 AND status IN ('sent', 'partial', 'overdue')
                 AND remaining_amount > 0
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
                const remaining = parseFloat(invoice.remaining_amount.toString());
                const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('id-ID') : '-';
                message += `${index + 1}. *${invoice.invoice_number}*\n`;
                message += `   💰 Sisa: Rp ${remaining.toLocaleString('id-ID')}\n`;
                message += `   📅 Jatuh Tempo: ${dueDate}\n`;
                message += `   📊 Status: ${invoice.status}\n\n`;
            });

            message += '*Cara Membayar:*\n';
            message += '1. Transfer sesuai jumlah tagihan\n';
            message += '2. Kirim foto bukti transfer ke chat ini\n';
            message += '3. Sistem akan verifikasi otomatis\n';
            message += '4. Tagihan akan otomatis terupdate';

            await this.sendMessage(phone, message);

        } catch (error: any) {
            console.error('[WhatsAppBot] Error showing invoices:', error);
            await this.sendMessage(phone, '❌ Gagal memuat tagihan. Silakan coba lagi.');
        }
    }

    /**
     * Show help
     */
    private static async showHelp(phone: string): Promise<void> {
        const help = `📖 *BANTUAN*

*Cara Membayar (Postpaid):*
1. Ketik: /tagihan (untuk lihat tagihan)
2. Transfer sesuai jumlah tagihan
3. Kirim foto bukti transfer ke chat ini
4. Sistem akan verifikasi otomatis dengan AI

*Cara Membeli Paket (Prepaid):*
1. Ketik: /paket (untuk lihat daftar)
2. Ketik: /beli [ID_PAKET]
3. Transfer sesuai instruksi
4. Kirim foto bukti transfer ke chat ini

*Command yang Tersedia:*
/menu - Menu utama
/paket - Daftar paket (prepaid)
/beli [ID] - Beli paket (prepaid)
/tagihan - Lihat tagihan (postpaid)
/status - Cek status

*Pertanyaan?*
Hubungi customer service untuk bantuan lebih lanjut.`;

        await this.sendMessage(phone, help);
    }

    /**
     * Get status text
     */
    private static getStatusText(status: string): string {
        const statusMap: { [key: string]: string } = {
            'pending': 'Menunggu Pembayaran',
            'paid': 'Sudah Dibayar',
            'expired': 'Kedaluwarsa',
            'cancelled': 'Dibatalkan'
        };
        return statusMap[status] || status;
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

