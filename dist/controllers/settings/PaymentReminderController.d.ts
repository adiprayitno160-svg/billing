import { Request, Response } from 'express';
export declare class PaymentReminderController {
    /**
     * Get all payment reminders with pagination
     */
    getAllReminders(req: Request, res: Response): Promise<void>;
    /**
     * Get reminders by customer ID
     */
    getRemindersByCustomerId(req: Request, res: Response): Promise<void>;
    /**
     * Get reminders by invoice ID
     */
    getRemindersByInvoiceId(req: Request, res: Response): Promise<void>;
    /**
     * Get pending reminders
     */
    getPendingReminders(req: Request, res: Response): Promise<void>;
    /**
     * Update reminder status
     */
    updateReminderStatus(req: Request, res: Response): Promise<void>;
    /**
     * Get overdue invoices for reminders
     */
    getOverdueInvoicesForReminders(req: Request, res: Response): Promise<void>;
    /**
     * Send payment reminders for overdue invoices
     */
    sendPaymentReminders(req: Request, res: Response): Promise<void>;
    /**
     * Get reminder counts by level
     */
    getReminderCountsByLevel(req: Request, res: Response): Promise<void>;
    /**
     * Get recent reminders
     */
    getRecentReminders(req: Request, res: Response): Promise<void>;
    /**
     * Get reminder statistics
     */
    getReminderStats(req: Request, res: Response): Promise<void>;
    /**
     * Create a new payment reminder (for manual creation)
     */
    createReminder(req: Request, res: Response): Promise<void>;
}
declare const _default: PaymentReminderController;
export default _default;
//# sourceMappingURL=PaymentReminderController.d.ts.map