import { databasePool } from '../../db/pool';

export interface NotificationTemplate {
    invoice_new: string;
    payment_reminder: string;
    payment_overdue: string;
    customer_isolated: string;
    customer_restored: string;
}

export class WhatsappService {
    private templates: NotificationTemplate = {
        invoice_new: `Halo *{customer_name}*,

📋 *INVOICE BARU*
No. Invoice: {invoice_number}
Periode: {period}
Jatuh Tempo: {due_date}
Total: Rp {total_amount}

Silakan lakukan pembayaran sebelum jatuh tempo.

Terima kasih.`,
        
        payment_reminder: `Halo *{customer_name}*,

⏰ *PENGINGAT PEMBAYARAN*
No. Invoice: {invoice_number}
Periode: {period}
Jatuh Tempo: {due_date}
Total: Rp {total_amount}

Pembayaran akan jatuh tempo dalam 3 hari. Silakan lakukan pembayaran segera.

Terima kasih.`,
        
        payment_overdue: `Halo *{customer_name}*,

⚠️ *PEMBAYARAN TERTUNDA*
No. Invoice: {invoice_number}
Periode: {period}
Jatuh Tempo: {due_date}
Total: Rp {total_amount}

Pembayaran sudah melewati jatuh tempo. Silakan lakukan pembayaran segera untuk menghindari isolasi layanan.

Terima kasih.`,
        
        customer_isolated: `Halo *{customer_name}*,

🔒 *LAYANAN DIISOLIR*
Layanan internet Anda telah diisolir karena pembayaran tertunda.

No. Invoice: {invoice_number}
Total: Rp {total_amount}

Silakan lakukan pembayaran untuk mengaktifkan kembali layanan.

Terima kasih.`,
        
        customer_restored: `Halo *{customer_name}*,

✅ *LAYANAN DIAKTIFKAN*
Layanan internet Anda telah diaktifkan kembali setelah pembayaran diterima.

Terima kasih.`
    };

    /**
     * Send invoice notification
     */
    async sendInvoiceNotification(invoice: any): Promise<boolean> {
        try {
            const message = this.templates.invoice_new
                .replace('{customer_name}', invoice.customer_name || '')
                .replace('{invoice_number}', invoice.invoice_number || '')
                .replace('{period}', invoice.period || '')
                .replace('{due_date}', invoice.due_date || new Date().toISOString().split('T')[0] || '')
                .replace('{total_amount}', invoice.total_amount || 0?.toLocaleString('id-ID') || '0');

            return await this.sendMessage(invoice.phone, message, 'invoice_new', invoice.id);
        } catch (error) {
            console.error('Error sending invoice notification:', error);
            return false;
        }
    }

    /**
     * Send payment reminder
     */
    async sendPaymentReminder(invoice: any): Promise<boolean> {
        try {
            const message = this.templates.payment_reminder
                .replace('{customer_name}', invoice.customer_name || '')
                .replace('{invoice_number}', invoice.invoice_number || '')
                .replace('{period}', invoice.period || '')
                .replace('{due_date}', invoice.due_date || new Date().toISOString().split('T')[0] || '')
                .replace('{total_amount}', invoice.total_amount || 0?.toLocaleString('id-ID') || '0');

            return await this.sendMessage(invoice.phone, message, 'payment_reminder', invoice.id);
        } catch (error) {
            console.error('Error sending payment reminder:', error);
            return false;
        }
    }

    /**
     * Send overdue notification
     */
    async sendOverdueNotification(invoice: any): Promise<boolean> {
        try {
            const message = this.templates.payment_overdue
                .replace('{customer_name}', invoice.customer_name || '')
                .replace('{invoice_number}', invoice.invoice_number || '')
                .replace('{period}', invoice.period || '')
                .replace('{due_date}', invoice.due_date || new Date().toISOString().split('T')[0] || '')
                .replace('{total_amount}', invoice.total_amount || 0?.toLocaleString('id-ID') || '0');

            return await this.sendMessage(invoice.phone, message, 'payment_overdue', invoice.id);
        } catch (error) {
            console.error('Error sending overdue notification:', error);
            return false;
        }
    }

    /**
     * Send isolation notification
     */
    async sendIsolationNotification(customer: any, invoice: any): Promise<boolean> {
        try {
            const message = this.templates.customer_isolated
                .replace('{customer_name}', customer.name || '')
                .replace('{invoice_number}', invoice.invoice_number || '')
                .replace('{total_amount}', invoice.total_amount || 0?.toLocaleString('id-ID') || '0');

            return await this.sendMessage(customer.phone, message, 'customer_isolated', customer.id || 0);
        } catch (error) {
            console.error('Error sending isolation notification:', error);
            return false;
        }
    }

    /**
     * Send restoration notification
     */
    async sendRestorationNotification(customer: any): Promise<boolean> {
        try {
            const message = this.templates.customer_restored
                .replace('{customer_name}', customer.name || '');

            return await this.sendMessage(customer.phone, message, 'customer_restored', customer.id || 0);
        } catch (error) {
            console.error('Error sending restoration notification:', error);
            return false;
        }
    }

    /**
     * Send custom message
     */
    async sendCustomMessage(phone: string, message: string, template: string = 'custom'): Promise<boolean> {
        return await this.sendMessage(phone, message, template);
    }

    /**
     * Core method to send WhatsApp message
     */
    private async sendMessage(phone: string, message: string, template: string, customerId?: number): Promise<boolean> {
        try {
            // Log notification attempt
            const logQuery = `
                INSERT INTO notification_logs (customer_id, channel, recipient, template, message, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            const [logResult] = await databasePool.execute(logQuery, [
                customerId, 'whatsapp', phone, template, message, 'pending'
            ]);
            
            const logId = (logResult as any).insertId;

            // Here you would integrate with your WhatsApp Business API
            // For now, we'll simulate the API call
            const success = await this.callWhatsAppAPI(phone, message);
            
            // Update log status
            const updateQuery = `
                UPDATE notification_logs 
                SET status = ?, sent_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            await databasePool.execute(updateQuery, [success ? 'sent' : 'failed', logId]);
            
            return success;
            
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            
            // Log error
            if (customerId) {
                const errorLogQuery = `
                    INSERT INTO notification_logs (customer_id, channel, recipient, template, message, status, error_message)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                
                await databasePool.execute(errorLogQuery, [
                    customerId, 'whatsapp', phone, template, message, 'failed', error instanceof Error ? error.message : String(error)
                ]);
            }
            
            return false;
        }
    }

    /**
     * Call WhatsApp Web API
     * This will be implemented with WhatsApp Web integration
     */
    private async callWhatsAppAPI(phone: string, message: string): Promise<boolean> {
        try {
            // TODO: Implement WhatsApp Web message sending
            console.log(`WhatsApp Web message to ${phone}: ${message}`);
            
            // For now, simulate success
            return true;
        } catch (error) {
            console.error('WhatsApp Web API call failed:', error);
            return false;
        }
    }

    /**
     * Get notification history
     */
    async getNotificationHistory(customerId?: number, limit: number = 50) {
        let query = `
            SELECT nl.*, c.name as customer_name
            FROM notification_logs nl
            LEFT JOIN customers c ON nl.customer_id = c.id
            WHERE nl.channel = 'whatsapp'
        `;
        
        const params: any[] = [];
        let paramCount = 1;
        
        if (customerId) {
            query += ` AND nl.customer_id = ?`;
            params.push(customerId);
        }
        
        query += ` ORDER BY nl.created_at DESC LIMIT ?`;
        params.push(limit);
        
        const [result] = await databasePool.execute(query, params);
        return result;
    }

    /**
     * Get notification statistics
     */
    async getNotificationStats(period?: string) {
        let query = `
            SELECT 
                template,
                status,
                COUNT(*) as count,
                COUNT(CASE WHEN created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY) THEN 1 END) as last_30_days
            FROM notification_logs 
            WHERE channel = 'whatsapp'
        `;
        
        const params: any[] = [];
        
        if (period) {
            query += ` AND DATE_FORMAT(created_at, '%Y-%m') = ?`;
            params.push(period);
        }
        
        query += ` GROUP BY template, status ORDER BY count DESC`;
        
        const [result] = await databasePool.execute(query, params);
        return result;
    }

    /**
     * Test WhatsApp connection
     */
    async testConnection(): Promise<{success: boolean, message: string}> {
        try {
            // Test with a dummy message
            const success = await this.callWhatsAppAPI('6281234567890', 'Test connection');
            
            return {
                success,
                message: success ? 'WhatsApp connection successful' : 'WhatsApp connection failed'
            };
        } catch (error) {
            return {
                success: false,
                message: `WhatsApp connection error: ${error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) : String(error)}`
            };
        }
    }
}
