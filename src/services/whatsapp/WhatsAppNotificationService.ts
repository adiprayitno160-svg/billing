import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

/**
 * WhatsApp Notification Service
 * Handles sending notifications via WhatsApp for various events
 */
export class WhatsAppNotificationService {
    
    /**
     * Send invoice notification
     */
    static async sendInvoiceNotification(invoiceId: number): Promise<boolean> {
        try {
            // Get invoice with customer info
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `, [invoiceId]);

            const invoice = result[0];
            if (!invoice || !invoice.customer_phone) {
                console.log('Invoice or customer phone not found');
                return false;
            }

            const template = await this.getTemplate('invoice_new');
            const message = this.fillTemplate(template, {
                customer_name: invoice.customer_name,
                invoice_number: invoice.invoice_number,
                period: invoice.period,
                due_date: invoice.due_date,
                total_amount: this.formatCurrency(invoice.total_amount)
            });

            // TODO: Send via WhatsApp Web Service
            console.log(`Sending invoice notification to ${invoice.customer_phone}`);
            console.log(message);

            // Log notification
            await this.logNotification('invoice', invoiceId, invoice.customer_phone, message, 'sent');

            return true;

        } catch (error) {
            console.error('Error sending invoice notification:', error);
            return false;
        }
    }

    /**
     * Send payment reminder
     */
    static async sendPaymentReminder(invoiceId: number): Promise<boolean> {
        try {
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    DATEDIFF(i.due_date, CURDATE()) as days_until_due
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `, [invoiceId]);

            const invoice = result[0];
            if (!invoice || !invoice.customer_phone) {
                return false;
            }

            const template = await this.getTemplate('payment_reminder');
            const message = this.fillTemplate(template, {
                customer_name: invoice.customer_name,
                invoice_number: invoice.invoice_number,
                period: invoice.period,
                due_date: invoice.due_date,
                total_amount: this.formatCurrency(invoice.total_amount),
                days_until_due: invoice.days_until_due
            });

            console.log(`Sending payment reminder to ${invoice.customer_phone}`);
            console.log(message);

            await this.logNotification('payment_reminder', invoiceId, invoice.customer_phone, message, 'sent');

            return true;

        } catch (error) {
            console.error('Error sending payment reminder:', error);
            return false;
        }
    }

    /**
     * Send overdue notice
     */
    static async sendOverdueNotice(invoiceId: number): Promise<boolean> {
        try {
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    i.*,
                    c.name as customer_name,
                    c.phone as customer_phone,
                    DATEDIFF(CURDATE(), i.due_date) as days_overdue
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                WHERE i.id = ?
            `, [invoiceId]);

            const invoice = result[0];
            if (!invoice || !invoice.customer_phone) {
                return false;
            }

            const template = await this.getTemplate('payment_overdue');
            const message = this.fillTemplate(template, {
                customer_name: invoice.customer_name,
                invoice_number: invoice.invoice_number,
                period: invoice.period,
                due_date: invoice.due_date,
                total_amount: this.formatCurrency(invoice.total_amount),
                days_overdue: invoice.days_overdue
            });

            console.log(`Sending overdue notice to ${invoice.customer_phone}`);
            console.log(message);

            await this.logNotification('payment_overdue', invoiceId, invoice.customer_phone, message, 'sent');

            return true;

        } catch (error) {
            console.error('Error sending overdue notice:', error);
            return false;
        }
    }

    /**
     * Send payment confirmation
     */
    static async sendPaymentConfirmation(paymentId: number): Promise<boolean> {
        try {
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT 
                    p.*,
                    i.invoice_number,
                    i.period,
                    c.name as customer_name,
                    c.phone as customer_phone
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN customers c ON p.customer_id = c.id
                WHERE p.id = ?
            `, [paymentId]);

            const payment = result[0];
            if (!payment || !payment.customer_phone) {
                return false;
            }

            const template = await this.getTemplate('payment_confirmed');
            const message = this.fillTemplate(template, {
                customer_name: payment.customer_name,
                invoice_number: payment.invoice_number,
                payment_amount: this.formatCurrency(payment.amount),
                payment_date: payment.payment_date,
                payment_method: this.getPaymentMethodText(payment.payment_method)
            });

            console.log(`Sending payment confirmation to ${payment.customer_phone}`);
            console.log(message);

            await this.logNotification('payment_confirmed', paymentId, payment.customer_phone, message, 'sent');

            return true;

        } catch (error) {
            console.error('Error sending payment confirmation:', error);
            return false;
        }
    }

    /**
     * Send isolation notice
     */
    static async sendIsolationNotice(customerId: number): Promise<boolean> {
        try {
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT name, phone FROM customers WHERE id = ?
            `, [customerId]);

            const customer = result[0];
            if (!customer || !customer.phone) {
                return false;
            }

            const template = await this.getTemplate('customer_isolated');
            const message = this.fillTemplate(template, {
                customer_name: customer.name
            });

            console.log(`Sending isolation notice to ${customer.phone}`);
            console.log(message);

            await this.logNotification('isolation_notice', customerId, customer.phone, message, 'sent');

            return true;

        } catch (error) {
            console.error('Error sending isolation notice:', error);
            return false;
        }
    }

    /**
     * Send restoration notice
     */
    static async sendRestorationNotice(customerId: number): Promise<boolean> {
        try {
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT name, phone FROM customers WHERE id = ?
            `, [customerId]);

            const customer = result[0];
            if (!customer || !customer.phone) {
                return false;
            }

            const template = await this.getTemplate('customer_restored');
            const message = this.fillTemplate(template, {
                customer_name: customer.name
            });

            console.log(`Sending restoration notice to ${customer.phone}`);
            console.log(message);

            await this.logNotification('restoration_notice', customerId, customer.phone, message, 'sent');

            return true;

        } catch (error) {
            console.error('Error sending restoration notice:', error);
            return false;
        }
    }

    /**
     * Get notification template
     */
    private static async getTemplate(templateName: string): Promise<string> {
        try {
            const [result] = await databasePool.query<RowDataPacket[]>(`
                SELECT content FROM whatsapp_message_templates 
                WHERE name = ? AND is_active = 1
                LIMIT 1
            `, [templateName]);

            if (result.length > 0 && result[0]) {
                return result[0].content;
            }

            // Return default templates
            return this.getDefaultTemplate(templateName);

        } catch (error) {
            console.error('Error getting template:', error);
            return this.getDefaultTemplate(templateName);
        }
    }

    /**
     * Get default template
     */
    private static getDefaultTemplate(templateName: string): string {
        const templates: { [key: string]: string } = {
            'invoice_new': `Halo *{customer_name}*,

📋 *INVOICE BARU*
No. Invoice: {invoice_number}
Periode: {period}
Jatuh Tempo: {due_date}
Total: Rp {total_amount}

Silakan lakukan pembayaran sebelum jatuh tempo.

Terima kasih!`,

            'payment_reminder': `Halo *{customer_name}*,

⏰ *PENGINGAT PEMBAYARAN*
No. Invoice: {invoice_number}
Periode: {period}
Jatuh Tempo: {due_date}
Total: Rp {total_amount}

Pembayaran akan jatuh tempo dalam {days_until_due} hari. 
Silakan lakukan pembayaran segera.

Terima kasih!`,

            'payment_overdue': `Halo *{customer_name}*,

⚠️ *PEMBAYARAN TERTUNDA*
No. Invoice: {invoice_number}
Periode: {period}
Jatuh Tempo: {due_date}
Total: Rp {total_amount}

Pembayaran sudah melewati jatuh tempo {days_overdue} hari.
Silakan lakukan pembayaran segera untuk menghindari isolasi layanan.

Terima kasih!`,

            'payment_confirmed': `Halo *{customer_name}*,

✅ *PEMBAYARAN DITERIMA*
No. Invoice: {invoice_number}
Jumlah: Rp {payment_amount}
Tanggal: {payment_date}
Metode: {payment_method}

Terima kasih atas pembayaran Anda!`,

            'customer_isolated': `Halo *{customer_name}*,

🔒 *LAYANAN DIISOLIR*
Layanan internet Anda telah diisolir karena pembayaran tertunda.

Silakan lakukan pembayaran untuk mengaktifkan kembali layanan.

Terima kasih!`,

            'customer_restored': `Halo *{customer_name}*,

✅ *LAYANAN DIAKTIFKAN*
Layanan internet Anda telah diaktifkan kembali setelah pembayaran diterima.

Terima kasih!`
        };

        return templates[templateName] || 'Template not found';
    }

    /**
     * Fill template with data
     */
    private static fillTemplate(template: string, data: { [key: string]: any }): string {
        let filled = template;
        
        for (const key in data) {
            const placeholder = `{${key}}`;
            filled = filled.replace(new RegExp(placeholder, 'g'), data[key]);
        }

        return filled;
    }

    /**
     * Format currency
     */
    private static formatCurrency(amount: number): string {
        return amount.toLocaleString('id-ID');
    }

    /**
     * Get payment method text
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

    /**
     * Log notification
     */
    private static async logNotification(
        type: string,
        refId: number,
        phoneNumber: string,
        message: string,
        status: string
    ): Promise<void> {
        try {
            await databasePool.execute(`
                INSERT INTO notification_logs (
                    notification_type, reference_id, recipient, message, status, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [type, refId, phoneNumber, message, status]);

        } catch (error) {
            console.error('Error logging notification:', error);
        }
    }
}
