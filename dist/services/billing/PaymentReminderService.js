"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentReminderService = void 0;
const pool_1 = __importDefault(require("../../db/pool"));
class PaymentReminderService {
    /**
     * Get all payment reminders with pagination and filters
     */
    static async getAllReminders(options) {
        const { page, limit, status, level } = options;
        const offset = (page - 1) * limit;
        let whereClause = '1=1';
        const params = [];
        if (status) {
            whereClause += ' AND pr.status = ?';
            params.push(status);
        }
        if (level) {
            whereClause += ' AND pr.reminder_level = ?';
            params.push(level);
        }
        // Get total count
        const [countResult] = await pool_1.default.query(`SELECT COUNT(*) as total FROM payment_reminders pr WHERE ${whereClause}`, params);
        const total = countResult[0].total;
        // Get paginated data
        const [rows] = await pool_1.default.query(`SELECT pr.*, c.name as customer_name, i.invoice_number
       FROM payment_reminders pr
       LEFT JOIN customers c ON pr.customer_id = c.id
       LEFT JOIN invoices i ON pr.invoice_id = i.id
       WHERE ${whereClause}
       ORDER BY pr.sent_date DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]);
        return {
            reminders: rows,
            total,
            page,
            limit
        };
    }
    /**
     * Create a new payment reminder
     */
    static async createReminder(reminder) {
        const [result] = await pool_1.default.query(`INSERT INTO payment_reminders 
       (customer_id, invoice_id, reminder_level, method, status, notes) 
       VALUES (?, ?, ?, ?, ?, ?)`, [
            reminder.customer_id,
            reminder.invoice_id,
            reminder.reminder_level,
            reminder.method,
            reminder.status,
            reminder.notes
        ]);
        return result.insertId;
    }
    /**
     * Get reminders by customer ID
     */
    static async getRemindersByCustomerId(customerId) {
        const [rows] = await pool_1.default.query(`SELECT * FROM payment_reminders 
       WHERE customer_id = ? 
       ORDER BY sent_date DESC`, [customerId]);
        return rows;
    }
    /**
     * Get reminders by invoice ID
     */
    static async getRemindersByInvoiceId(invoiceId) {
        const [rows] = await pool_1.default.query(`SELECT * FROM payment_reminders 
       WHERE invoice_id = ? 
       ORDER BY sent_date DESC`, [invoiceId]);
        return rows;
    }
    /**
     * Get pending reminders
     */
    static async getPendingReminders() {
        const [rows] = await pool_1.default.query(`SELECT * FROM payment_reminders 
       WHERE status = 'pending'
       ORDER BY sent_date ASC`);
        return rows;
    }
    /**
     * Update reminder status
     */
    static async updateReminderStatus(id, status, notes) {
        const [result] = await pool_1.default.query(`UPDATE payment_reminders 
       SET status = ?, notes = COALESCE(CONCAT(notes, ?), ?), sent_date = NOW() 
       WHERE id = ?`, [status, notes ? `\n${notes}` : '', notes, id]);
        return result.affectedRows > 0;
    }
    /**
     * Get overdue invoices that need reminders
     */
    static async getOverdueInvoicesForReminders() {
        const [rows] = await pool_1.default.query(`SELECT 
         i.id,
         i.customer_id,
         c.name as customer_name,
         c.phone as customer_phone,
         c.email as customer_email,
         i.invoice_number,
         i.amount,
         i.due_date,
         DATEDIFF(CURDATE(), i.due_date) as days_overdue
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.status = 'unpaid' 
         AND i.due_date < CURDATE()
         AND i.deleted_at IS NULL
       ORDER BY days_overdue DESC, i.due_date ASC`);
        return rows;
    }
    /**
     * Determine reminder level based on days overdue
     */
    static determineReminderLevel(daysOverdue) {
        if (daysOverdue <= 7)
            return 1; // First notice
        if (daysOverdue <= 14)
            return 2; // Second notice
        if (daysOverdue <= 21)
            return 3; // Final notice
        return 4; // Collection
    }
    /**
     * Send payment reminders for overdue invoices
     */
    static async sendPaymentReminders() {
        const overdueInvoices = await this.getOverdueInvoicesForReminders();
        let sentCount = 0;
        let failedCount = 0;
        for (const invoice of overdueInvoices) {
            try {
                // Determine the appropriate reminder level
                const reminderLevel = this.determineReminderLevel(invoice.days_overdue);
                // Check if a reminder of this level has already been sent
                const [existingReminder] = await pool_1.default.query(`SELECT id FROM payment_reminders 
           WHERE customer_id = ? AND reminder_level = ? AND invoice_id = ?
           ORDER BY sent_date DESC LIMIT 1`, [invoice.customer_id, reminderLevel, invoice.id]);
                if (existingReminder.length === 0) {
                    // Create a new reminder record
                    await this.createReminder({
                        customer_id: invoice.customer_id,
                        invoice_id: invoice.id,
                        reminder_level: reminderLevel,
                        method: 'whatsapp', // Default to WhatsApp for tech companies
                        status: 'pending',
                        notes: `Auto-generated reminder for invoice ${invoice.invoice_number}`
                    });
                    // In a real implementation, you would send the actual notification here
                    // For now, we'll just mark it as sent
                    await this.updateReminderStatus(sentCount + 1, 'sent', `Sent reminder level ${reminderLevel} for invoice ${invoice.invoice_number}`);
                    sentCount++;
                }
            }
            catch (error) {
                console.error(`Failed to process reminder for invoice ${invoice.id}:`, error);
                failedCount++;
            }
        }
        return { sent: sentCount, failed: failedCount };
    }
    /**
     * Get reminder counts by level
     */
    static async getReminderCountsByLevel() {
        const [rows] = await pool_1.default.query(`SELECT 
         reminder_level,
         COUNT(*) as count,
         CASE 
           WHEN reminder_level = 1 THEN 'First Notice'
           WHEN reminder_level = 2 THEN 'Second Notice'
           WHEN reminder_level = 3 THEN 'Final Notice'
           WHEN reminder_level = 4 THEN 'Collection'
           ELSE 'Unknown'
         END as description
       FROM payment_reminders
       GROUP BY reminder_level
       ORDER BY reminder_level`);
        return rows;
    }
    /**
     * Get recent reminders
     */
    static async getRecentReminders(limit = 10) {
        const [rows] = await pool_1.default.query(`SELECT * FROM payment_reminders 
       ORDER BY sent_date DESC
       LIMIT ?`, [limit]);
        return rows;
    }
    /**
     * Get reminder statistics
     */
    static async getReminderStats() {
        const [rows] = await pool_1.default.query(`SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
         SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM payment_reminders`);
        const result = rows[0];
        return {
            total: Number(result.total) || 0,
            pending: Number(result.pending) || 0,
            sent: Number(result.sent) || 0,
            delivered: Number(result.delivered) || 0,
            failed: Number(result.failed) || 0
        };
    }
}
exports.PaymentReminderService = PaymentReminderService;
exports.default = PaymentReminderService;
//# sourceMappingURL=PaymentReminderService.js.map