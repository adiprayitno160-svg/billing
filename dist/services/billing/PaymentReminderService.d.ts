interface PaymentReminder {
    id: number;
    customer_id: number;
    invoice_id: number | null;
    reminder_level: number;
    sent_date: Date;
    method: 'email' | 'sms' | 'whatsapp' | 'phone';
    status: 'pending' | 'sent' | 'delivered' | 'failed';
    notes: string | null;
}
export declare class PaymentReminderService {
    /**
     * Get all payment reminders with pagination and filters
     */
    static getAllReminders(options: {
        page: number;
        limit: number;
        status?: string;
        level?: number;
    }): Promise<{
        reminders: PaymentReminder[];
        total: number;
        page: number;
        limit: number;
    }>;
    /**
     * Create a new payment reminder
     */
    static createReminder(reminder: Omit<PaymentReminder, 'id' | 'sent_date'>): Promise<number>;
    /**
     * Get reminders by customer ID
     */
    static getRemindersByCustomerId(customerId: number): Promise<PaymentReminder[]>;
    /**
     * Get reminders by invoice ID
     */
    static getRemindersByInvoiceId(invoiceId: number): Promise<PaymentReminder[]>;
    /**
     * Get pending reminders
     */
    static getPendingReminders(): Promise<PaymentReminder[]>;
    /**
     * Update reminder status
     */
    static updateReminderStatus(id: number, status: 'pending' | 'sent' | 'delivered' | 'failed', notes?: string): Promise<boolean>;
    /**
     * Get overdue invoices that need reminders
     */
    static getOverdueInvoicesForReminders(): Promise<Array<{
        id: number;
        customer_id: number;
        customer_name: string;
        customer_phone: string;
        customer_email: string;
        invoice_number: string;
        amount: number;
        due_date: Date;
        days_overdue: number;
    }>>;
    /**
     * Determine reminder level based on days overdue
     */
    static determineReminderLevel(daysOverdue: number): number;
    /**
     * Send payment reminders for overdue invoices
     */
    static sendPaymentReminders(): Promise<{
        sent: number;
        failed: number;
    }>;
    /**
     * Get reminder counts by level
     */
    static getReminderCountsByLevel(): Promise<Array<{
        level: number;
        count: number;
        description: string;
    }>>;
    /**
     * Get recent reminders
     */
    static getRecentReminders(limit?: number): Promise<PaymentReminder[]>;
    /**
     * Get reminder statistics
     */
    static getReminderStats(): Promise<{
        total: number;
        pending: number;
        sent: number;
        delivered: number;
        failed: number;
    }>;
}
export default PaymentReminderService;
//# sourceMappingURL=PaymentReminderService.d.ts.map