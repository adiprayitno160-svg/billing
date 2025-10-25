import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

/**
 * WhatsApp Bot Service with Auto-Response
 * Handles incoming messages and provides automated responses
 */
export class WhatsAppBotService {
    
    /**
     * Handle incoming WhatsApp message with auto-response
     */
    static async handleIncomingMessage(from: string, message: string, messageId: string): Promise<string | null> {
        try {
            console.log(`📨 Incoming message from ${from}: ${message}`);

            const lowerMessage = message.toLowerCase().trim();

            // Extract phone number (remove @c.us suffix if present)
            const phoneNumber = from.replace('@c.us', '');

            // Find customer by phone
            const customer = await this.findCustomerByPhone(phoneNumber);

            // Auto-response based on keywords
            let response: string | null = null;

            // 1. GREETING
            if (this.isGreeting(lowerMessage)) {
                response = await this.handleGreeting(customer);
            }
            
            // 2. CHECK INVOICE / TAGIHAN
            else if (this.isCheckInvoice(lowerMessage)) {
                response = await this.handleCheckInvoice(customer);
            }
            
            // 3. CHECK PAYMENT / CEK PEMBAYARAN
            else if (this.isCheckPayment(lowerMessage)) {
                response = await this.handleCheckPayment(customer);
            }
            
            // 4. HELP MENU
            else if (this.isHelpRequest(lowerMessage)) {
                response = this.getHelpMenu();
            }
            
            // 5. PAYMENT CONFIRMATION
            else if (this.isPaymentConfirmation(lowerMessage)) {
                response = await this.handlePaymentConfirmation(customer);
            }

            // 6. CHECK STATUS / STATUS LAYANAN
            else if (this.isCheckStatus(lowerMessage)) {
                response = await this.handleCheckStatus(customer);
            }

            // 7. COMPLAINT / KOMPLAIN
            else if (this.isComplaint(lowerMessage)) {
                response = this.handleComplaint(customer);
            }

            // 8. DEFAULT RESPONSE
            else {
                response = this.getDefaultResponse();
            }

            // Log conversation
            await this.logConversation(phoneNumber, message, response, messageId);

            return response;

        } catch (error) {
            console.error('Error handling incoming message:', error);
            return 'Maaf, terjadi kesalahan. Silakan coba lagi atau hubungi customer service.';
        }
    }

    /**
     * Check if message is greeting
     */
    private static isGreeting(message: string): boolean {
        const greetings = ['halo', 'hai', 'hello', 'hi', 'selamat', 'pagi', 'siang', 'sore', 'malam'];
        return greetings.some(g => message.includes(g));
    }

    /**
     * Check if message is invoice check request
     */
    private static isCheckInvoice(message: string): boolean {
        const keywords = ['tagihan', 'invoice', 'bill', 'cek tagihan', 'lihat tagihan', 'bayar'];
        return keywords.some(k => message.includes(k));
    }

    /**
     * Check if message is payment check request
     */
    private static isCheckPayment(message: string): boolean {
        const keywords = ['pembayaran', 'payment', 'bayar', 'lunas', 'cek pembayaran', 'status pembayaran'];
        return keywords.some(k => message.includes(k));
    }

    /**
     * Check if message is help request
     */
    private static isHelpRequest(message: string): boolean {
        const keywords = ['help', 'bantuan', 'menu', 'fitur', 'gimana', 'cara'];
        return keywords.some(k => message.includes(k));
    }

    /**
     * Check if message is payment confirmation
     */
    private static isPaymentConfirmation(message: string): boolean {
        const keywords = ['sudah bayar', 'konfirmasi', 'transfer', 'bukti', 'bayar'];
        return keywords.some(k => message.includes(k));
    }

    /**
     * Check if message is status check
     */
    private static isCheckStatus(message: string): boolean {
        const keywords = ['status', 'layanan', 'internet', 'koneksi', 'down', 'mati'];
        return keywords.some(k => message.includes(k));
    }

    /**
     * Check if message is complaint
     */
    private static isComplaint(message: string): boolean {
        const keywords = ['komplain', 'keluhan', 'masalah', 'gangguan', 'lambat', 'lemot', 'putus'];
        return keywords.some(k => message.includes(k));
    }

    /**
     * Handle greeting
     */
    private static async handleGreeting(customer: any): Promise<string> {
        if (customer) {
            return `Halo *${customer.name}*! 👋

Selamat datang di *Billing Bot* kami.

Saya siap membantu Anda dengan:
📋 Cek tagihan
💰 Informasi pembayaran
📊 Status layanan
🆘 Bantuan lainnya

Ketik *menu* untuk melihat semua opsi yang tersedia.`;
        } else {
            return `Halo! 👋

Selamat datang di *Billing Bot* kami.

Nomor Anda belum terdaftar dalam sistem kami.
Silakan hubungi customer service untuk registrasi.

Terima kasih!`;
        }
    }

    /**
     * Handle check invoice
     */
    private static async handleCheckInvoice(customer: any): Promise<string> {
        if (!customer) {
            return 'Nomor Anda belum terdaftar. Silakan hubungi customer service.';
        }

        try {
            // Get unpaid/partial invoices
            const [invoices] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    invoice_number,
                    period,
                    total_amount,
                    paid_amount,
                    remaining_amount,
                    due_date,
                    status
                FROM invoices
                WHERE customer_id = ?
                AND status IN ('sent', 'partial', 'overdue')
                ORDER BY due_date ASC
                LIMIT 5
            `, [customer.id]);

            if (invoices.length === 0) {
                return `Halo *${customer.name}*! ✅

Anda tidak memiliki tagihan yang belum dibayar.
Terima kasih sudah menjadi pelanggan setia kami!`;
            }

            let response = `📋 *DAFTAR TAGIHAN*

Pelanggan: *${customer.name}*

`;

            for (const inv of invoices) {
                const statusIcon = inv.status === 'overdue' ? '⚠️' : inv.status === 'partial' ? '⏳' : '📄';
                response += `${statusIcon} *${inv.invoice_number}*\n`;
                response += `Periode: ${inv.period}\n`;
                response += `Total: Rp ${this.formatCurrency(inv.total_amount)}\n`;
                
                if (inv.status === 'partial') {
                    response += `Terbayar: Rp ${this.formatCurrency(inv.paid_amount)}\n`;
                    response += `Sisa: Rp ${this.formatCurrency(inv.remaining_amount)}\n`;
                } else {
                    response += `Jumlah: Rp ${this.formatCurrency(inv.remaining_amount)}\n`;
                }
                
                response += `Jatuh Tempo: ${inv.due_date}\n`;
                response += `Status: ${this.getStatusText(inv.status)}\n\n`;
            }

            response += `💡 Ketik "bayar" untuk informasi cara pembayaran.`;

            return response;

        } catch (error) {
            console.error('Error checking invoice:', error);
            return 'Maaf, terjadi kesalahan saat mengecek tagihan. Silakan coba lagi.';
        }
    }

    /**
     * Handle check payment
     */
    private static async handleCheckPayment(customer: any): Promise<string> {
        if (!customer) {
            return 'Nomor Anda belum terdaftar. Silakan hubungi customer service.';
        }

        try {
            // Get recent payments
            const [payments] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    p.amount,
                    p.payment_date,
                    p.payment_method,
                    p.reference_number,
                    i.invoice_number
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                WHERE p.customer_id = ?
                ORDER BY p.payment_date DESC
                LIMIT 5
            `, [customer.id]);

            if (payments.length === 0) {
                return `Halo *${customer.name}*!

Belum ada riwayat pembayaran yang tercatat.`;
            }

            let response = `💰 *RIWAYAT PEMBAYARAN*

Pelanggan: *${customer.name}*

`;

            for (const pay of payments) {
                response += `✅ *${pay.invoice_number}*\n`;
                response += `Tanggal: ${pay.payment_date}\n`;
                response += `Jumlah: Rp ${this.formatCurrency(pay.amount)}\n`;
                response += `Metode: ${this.getPaymentMethodText(pay.payment_method)}\n`;
                if (pay.reference_number) {
                    response += `Ref: ${pay.reference_number}\n`;
                }
                response += `\n`;
            }

            return response;

        } catch (error) {
            console.error('Error checking payment:', error);
            return 'Maaf, terjadi kesalahan saat mengecek pembayaran. Silakan coba lagi.';
        }
    }

    /**
     * Get help menu
     */
    private static getHelpMenu(): string {
        return `📱 *MENU BANTUAN*

Berikut yang bisa saya bantu:

1️⃣ *Cek Tagihan*
   Ketik: tagihan, invoice, cek tagihan

2️⃣ *Cek Pembayaran*
   Ketik: pembayaran, bayar, lunas

3️⃣ *Status Layanan*
   Ketik: status, layanan

4️⃣ *Konfirmasi Pembayaran*
   Ketik: sudah bayar, konfirmasi

5️⃣ *Keluhan/Gangguan*
   Ketik: komplain, gangguan

Silakan ketik sesuai kebutuhan Anda! 😊`;
    }

    /**
     * Handle payment confirmation
     */
    private static async handlePaymentConfirmation(customer: any): Promise<string> {
        if (!customer) {
            return 'Nomor Anda belum terdaftar. Silakan hubungi customer service.';
        }

        return `💳 *KONFIRMASI PEMBAYARAN*

Halo *${customer.name}*!

Untuk konfirmasi pembayaran, silakan kirim:
1. Screenshot/foto bukti transfer
2. Nomor invoice yang dibayar
3. Tanggal transfer
4. Jumlah yang ditransfer

Tim kami akan segera memverifikasi pembayaran Anda.

Atau kunjungi: 
http://localhost:3000/portal/payment

Terima kasih! 🙏`;
    }

    /**
     * Handle check status
     */
    private static async handleCheckStatus(customer: any): Promise<string> {
        if (!customer) {
            return 'Nomor Anda belum terdaftar. Silakan hubungi customer service.';
        }

        try {
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT status, connection_type, is_isolated
                FROM customers
                WHERE id = ?
            `, [customer.id]);

            if (result.length === 0) {
                return 'Data pelanggan tidak ditemukan.';
            }

            const customerData = result[0];
            if (!customerData) {
                return 'Data pelanggan tidak ditemukan.';
            }

            const statusIcon = customerData.is_isolated ? '🔴' : '🟢';
            const statusText = customerData.is_isolated ? 'TERISOLIR' : 'AKTIF';

            return `📡 *STATUS LAYANAN*

Pelanggan: *${customer.name}*
Status: ${statusIcon} *${statusText}*
Tipe: ${customerData.connection_type.toUpperCase()}

${customerData.is_isolated ? 
    '⚠️ Layanan Anda saat ini terisolir.\nKemungkinan karena tagihan belum dibayar.\nSilakan cek tagihan dan lakukan pembayaran.' :
    '✅ Layanan Anda aktif dan berjalan normal.'}`;

        } catch (error) {
            console.error('Error checking status:', error);
            return 'Maaf, terjadi kesalahan saat mengecek status. Silakan coba lagi.';
        }
    }

    /**
     * Handle complaint
     */
    private static handleComplaint(customer: any): string {
        if (!customer) {
            return 'Untuk komplain, silakan hubungi customer service kami.';
        }

        return `🆘 *LAYANAN KOMPLAIN*

Halo *${customer.name}*!

Kami mohon maaf atas ketidaknyamanan yang Anda alami.

Untuk komplain atau gangguan teknis:
📞 Call Center: 0812-3456-7890
📧 Email: support@yourcompany.com
⏰ Jam Operasional: 08:00 - 20:00

Atau kirim detail keluhan Anda melalui chat ini, 
tim kami akan segera menindaklanjuti.

Terima kasih atas kesabaran Anda! 🙏`;
    }

    /**
     * Get default response
     */
    private static getDefaultResponse(): string {
        return `Maaf, saya belum memahami pesan Anda. 🤔

Ketik *menu* untuk melihat daftar bantuan yang tersedia.

Atau hubungi customer service kami untuk bantuan lebih lanjut.`;
    }

    /**
     * Find customer by phone number
     */
    private static async findCustomerByPhone(phoneNumber: string): Promise<any | null> {
        try {
            // Clean phone number (remove country code if present)
            let cleanPhone = phoneNumber.replace(/\D/g, '');
            
            // Try different formats
            const phoneFormats = [
                cleanPhone,
                '0' + cleanPhone.substring(2), // Remove 62 and add 0
                '62' + cleanPhone.substring(1), // Remove 0 and add 62
                cleanPhone.substring(2) // Just number without prefix
            ];

            for (const format of phoneFormats) {
                const [result] = await databasePool.query<RowDataPacket[]>(`
                    SELECT id, name, customer_code, phone, email
                    FROM customers
                    WHERE phone LIKE ?
                    LIMIT 1
                `, [`%${format}%`]);

                if (result.length > 0) {
                    return result[0];
                }
            }

            return null;

        } catch (error) {
            console.error('Error finding customer:', error);
            return null;
        }
    }

    /**
     * Log conversation to database
     */
    private static async logConversation(
        phoneNumber: string,
        incomingMessage: string,
        outgoingMessage: string | null,
        messageId: string
    ): Promise<void> {
        try {
            await databasePool.execute(`
                INSERT INTO whatsapp_bot_conversations (
                    phone_number,
                    incoming_message,
                    outgoing_message,
                    message_id,
                    created_at
                ) VALUES (?, ?, ?, ?, NOW())
            `, [phoneNumber, incomingMessage, outgoingMessage, messageId]);

        } catch (error) {
            console.error('Error logging conversation:', error);
        }
    }

    /**
     * Format currency
     */
    private static formatCurrency(amount: number): string {
        return amount.toLocaleString('id-ID');
    }

    /**
     * Get status text in Indonesian
     */
    private static getStatusText(status: string): string {
        const statusMap: { [key: string]: string } = {
            'draft': 'Draft',
            'sent': 'Terkirim',
            'paid': 'Lunas',
            'partial': 'Sebagian',
            'overdue': 'Jatuh Tempo',
            'cancelled': 'Dibatalkan'
        };
        return statusMap[status] || status;
    }

    /**
     * Get payment method text in Indonesian
     */
    private static getPaymentMethodText(method: string): string {
        const methodMap: { [key: string]: string } = {
            'cash': 'Tunai',
            'transfer': 'Transfer Bank',
            'gateway': 'Payment Gateway',
            'virtual_account': 'Virtual Account',
            'ewallet': 'E-wallet'
        };
        return methodMap[method] || method;
    }
}
