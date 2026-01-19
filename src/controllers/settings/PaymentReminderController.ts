import { Request, Response } from 'express';
import PaymentReminderService from '../../services/billing/PaymentReminderService';

export class PaymentReminderController {
  /**
   * Get all payment reminders with pagination
   */
  async getAllReminders(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string || '';
      const level = req.query.level ? parseInt(req.query.level as string) : undefined;

      const reminders = await PaymentReminderService.getAllReminders({ page, limit, status, level });

      res.json({
        success: true,
        data: reminders
      });
    } catch (error) {
      console.error('Error getting all payment reminders:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving payment reminders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get reminders by customer ID
   */
  async getRemindersByCustomerId(req: Request, res: Response): Promise<void> {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid customer ID'
        });
        return;
      }

      const reminders = await PaymentReminderService.getRemindersByCustomerId(customerId);

      res.json({
        success: true,
        data: reminders
      });
    } catch (error) {
      console.error('Error getting reminders by customer ID:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving reminders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get reminders by invoice ID
   */
  async getRemindersByInvoiceId(req: Request, res: Response): Promise<void> {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      if (isNaN(invoiceId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid invoice ID'
        });
        return;
      }

      const reminders = await PaymentReminderService.getRemindersByInvoiceId(invoiceId);

      res.json({
        success: true,
        data: reminders
      });
    } catch (error) {
      console.error('Error getting reminders by invoice ID:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving reminders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get pending reminders
   */
  async getPendingReminders(req: Request, res: Response): Promise<void> {
    try {
      const reminders = await PaymentReminderService.getPendingReminders();

      res.json({
        success: true,
        data: reminders
      });
    } catch (error) {
      console.error('Error getting pending reminders:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving pending reminders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update reminder status
   */
  async updateReminderStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          message: 'Invalid reminder ID'
        });
        return;
      }

      const { status, notes } = req.body;

      // Validate status
      const validStatuses = ['pending', 'sent', 'delivered', 'failed'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: pending, sent, delivered, failed'
        });
        return;
      }

      const updated = await PaymentReminderService.updateReminderStatus(id, status, notes);
      if (!updated) {
        res.status(404).json({
          success: false,
          message: 'Reminder not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Reminder status updated successfully'
      });
    } catch (error) {
      console.error('Error updating reminder status:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating reminder status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get overdue invoices for reminders
   */
  async getOverdueInvoicesForReminders(req: Request, res: Response): Promise<void> {
    try {
      const invoices = await PaymentReminderService.getOverdueInvoicesForReminders();

      res.json({
        success: true,
        data: invoices
      });
    } catch (error) {
      console.error('Error getting overdue invoices for reminders:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving overdue invoices',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send payment reminders for overdue invoices
   */
  async sendPaymentReminders(req: Request, res: Response): Promise<void> {
    try {
      const result = await PaymentReminderService.sendPaymentReminders();

      res.json({
        success: true,
        message: 'Payment reminders processing completed',
        data: result
      });
    } catch (error) {
      console.error('Error sending payment reminders:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending payment reminders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get reminder counts by level
   */
  async getReminderCountsByLevel(req: Request, res: Response): Promise<void> {
    try {
      const counts = await PaymentReminderService.getReminderCountsByLevel();

      res.json({
        success: true,
        data: counts
      });
    } catch (error) {
      console.error('Error getting reminder counts by level:', error);
      res.status(500).json({
        success: true,
        message: 'Error retrieving reminder counts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get recent reminders
   */
  async getRecentReminders(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      const reminders = await PaymentReminderService.getRecentReminders(limit);

      res.json({
        success: true,
        data: reminders
      });
    } catch (error) {
      console.error('Error getting recent reminders:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving recent reminders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get reminder statistics
   */
  async getReminderStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await PaymentReminderService.getReminderStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting reminder statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving reminder statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create a new payment reminder (for manual creation)
   */
  async createReminder(req: Request, res: Response): Promise<void> {
    try {
      const { customer_id, invoice_id, reminder_level, method, status, notes } = req.body;

      // Validate required fields
      if (!customer_id || reminder_level === undefined || !method || !status) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: customer_id, reminder_level, method, status'
        });
        return;
      }

      // Validate reminder level
      if (typeof reminder_level !== 'number' || reminder_level < 1 || reminder_level > 4) {
        res.status(400).json({
          success: false,
          message: 'Reminder level must be a number between 1 and 4'
        });
        return;
      }

      // Validate method
      const validMethods = ['email', 'sms', 'whatsapp', 'phone'];
      if (!validMethods.includes(method)) {
        res.status(400).json({
          success: false,
          message: 'Invalid method. Must be one of: email, sms, whatsapp, phone'
        });
        return;
      }

      // Validate status
      const validStatuses = ['pending', 'sent', 'delivered', 'failed'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: pending, sent, delivered, failed'
        });
        return;
      }

      const newReminderId = await PaymentReminderService.createReminder({
        customer_id,
        invoice_id: invoice_id || null,
        reminder_level,
        method,
        status,
        notes: notes || null
      });

      res.status(201).json({
        success: true,
        message: 'Payment reminder created successfully',
        data: { id: newReminderId }
      });
    } catch (error) {
      console.error('Error creating payment reminder:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating payment reminder',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new PaymentReminderController();