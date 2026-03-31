/**
 * Notification Template Controller
 * Manages notification templates via web interface
 */

import { Request, Response } from 'express';
import { NotificationTemplateService } from '../../services/notification/NotificationTemplateService';
import { UnifiedNotificationService } from '../../services/notification/UnifiedNotificationService';
import { databasePool } from '../../db/pool';
import { RowDataPacket } from 'mysql2';

export class NotificationTemplateController {
  /**
   * GET /notification/history
   * Show notification history/queue page
   */
  async showHistoryPage(req: Request, res: Response): Promise<any> {
    try {
      res.render('notification/history', {
        title: 'Riwayat Notifikasi',
        currentPath: '/notification/history',
        user: (req.session as any).user
      });
    } catch (error) {
      console.error('Error loading history page:', error);
      res.status(500).render('error', {
        error: 'Failed to load history page',
        user: (req.session as any).user
      });
    }
  }

  /**
   * GET /notification/templates/page
   * Show template management page
   */
  async showTemplatesPage(req: Request, res: Response): Promise<any> {
    try {
      console.log('[NotificationTemplateController] Loading templates page...');

      // Get templates with error handling
      let templates: any[] = [];
      try {
        templates = await NotificationTemplateService.getAllTemplates();
        console.log(`[NotificationTemplateController] Loaded ${templates.length} templates`);
      } catch (error) {
        console.error('[NotificationTemplateController] Error loading templates:', error);
        // Continue with empty templates array
      }

      // Get statistics with error handling
      let stats: any = {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        skipped: 0
      };
      try {
        stats = await UnifiedNotificationService.getStatistics(30);
        console.log('[NotificationTemplateController] Loaded statistics');
      } catch (error) {
        console.error('[NotificationTemplateController] Error loading statistics:', error);
        // Continue with default stats
      }

      // Group templates by notification type
      const templatesByType: { [key: string]: any[] } = {};
      templates.forEach(template => {
        if (!templatesByType[template.notification_type]) {
          templatesByType[template.notification_type] = [];
        }
        templatesByType[template.notification_type].push(template);
      });

      console.log('[NotificationTemplateController] Rendering templates page...');
      res.render('notification/templates', {
        title: 'Template Notifikasi',
        currentPath: '/notification/templates',
        templates,
        templatesByType,
        stats,
        user: (req.session as any).user
      });
    } catch (error) {
      console.error('[NotificationTemplateController] Error loading templates page:', error);
      res.status(500).render('error', {
        title: 'Error',
        status: 500,
        message: 'Failed to load templates page',
        error: error instanceof Error ? error.message : 'Unknown error',
        user: (req.session as any).user
      });
    }
  }

  /**
   * GET /notification/templates/edit/:code
   * Show edit template page
   */
  async showEditTemplatePage(req: Request, res: Response): Promise<any> {
    try {
      const { code } = req.params;
      const template = await NotificationTemplateService.getTemplateByCode(code);

      if (!template) {
        res.status(404).render('error', {
          error: 'Template tidak ditemukan',
          user: (req.session as any).user
        });
        return;
      }

      res.render('notification/template-edit', {
        title: 'Edit Template Notifikasi',
        currentPath: '/notification/templates',
        template,
        user: (req.session as any).user
      });
    } catch (error) {
      console.error('Error loading edit template page:', error);
      res.status(500).render('error', {
        error: 'Failed to load edit template page',
        user: (req.session as any).user
      });
    }
  }

  /**
   * GET /notification/templates/create
   * Show create template page
   */
  async showCreateTemplatePage(req: Request, res: Response): Promise<any> {
    try {
      res.render('notification/template-create', {
        title: 'Buat Template Notifikasi',
        currentPath: '/notification/templates',
        user: (req.session as any).user
      });
    } catch (error) {
      console.error('Error loading create template page:', error);
      res.status(500).render('error', {
        error: 'Failed to load create template page',
        user: (req.session as any).user
      });
    }
  }

  /**
   * GET /api/notification/templates
   * List all notification templates (API)
   */
  async listTemplates(req: Request, res: Response): Promise<any> {
    try {
      const { notification_type, channel, is_active } = req.query;

      const templates = await NotificationTemplateService.getAllTemplates({
        notification_type: notification_type as string,
        channel: channel as string,
        is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined
      });

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error listing templates:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil daftar template',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/notification/templates/:code
   * Get template by code (API)
   */
  async getTemplate(req: Request, res: Response): Promise<any> {
    try {
      const { code } = req.params;

      const template = await NotificationTemplateService.getTemplateByCode(code);

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template tidak ditemukan'
        });
        return;
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error getting template:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil template',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/notification/templates
   * Create new template (API)
   */
  async createTemplate(req: Request, res: Response): Promise<any> {
    try {
      const {
        template_code,
        template_name,
        notification_type,
        channel,
        title_template,
        message_template,
        variables,
        is_active,
        priority,
        schedule_days_before
      } = req.body;

      // Validation
      if (!template_code || !template_name || !notification_type || !channel || !title_template || !message_template) {
        res.status(400).json({
          success: false,
          message: 'Data tidak lengkap'
        });
        return;
      }

      // Check if template code already exists
      const existing = await NotificationTemplateService.getTemplateByCode(template_code);
      if (existing) {
        res.status(400).json({
          success: false,
          message: 'Template code sudah digunakan'
        });
        return;
      }

      const templateId = await NotificationTemplateService.createTemplate({
        template_code,
        template_name,
        notification_type,
        channel,
        title_template,
        message_template,
        variables: Array.isArray(variables) ? variables : [],
        is_active: is_active !== false,
        priority: priority || 'normal',
        schedule_days_before: schedule_days_before || undefined
      });

      res.json({
        success: true,
        message: 'Template berhasil dibuat',
        data: { id: templateId }
      });
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal membuat template',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /api/notification/templates/:code
   * Update template (API)
   */
  async updateTemplate(req: Request, res: Response): Promise<any> {
    try {
      const { code } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be updated
      delete updates.id;
      delete updates.template_code;
      delete updates.created_at;
      delete updates.updated_at;

      const success = await NotificationTemplateService.updateTemplate(code, updates);

      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Template tidak ditemukan'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template berhasil diperbarui'
      });
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memperbarui template',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /api/notification/templates/:code
   * Delete template (API)
   */
  async deleteTemplate(req: Request, res: Response): Promise<any> {
    try {
      const { code } = req.params;

      const success = await NotificationTemplateService.deleteTemplate(code);

      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Template tidak ditemukan'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template berhasil dihapus'
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal menghapus template',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/notification/statistics
   * Get notification statistics (API)
   */
  async getStatistics(req: Request, res: Response): Promise<any> {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const stats = await UnifiedNotificationService.getStatistics(days);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil statistik',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/notification/test
   * Test notification template (API)
   */
  async testTemplate(req: Request, res: Response): Promise<any> {
    try {
      const { template_code, customer_id, variables } = req.body;

      if (!template_code || !customer_id) {
        res.status(400).json({
          success: false,
          message: 'template_code dan customer_id diperlukan'
        });
        return;
      }

      const template = await NotificationTemplateService.getTemplateByCode(template_code);
      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Template tidak ditemukan'
        });
        return;
      }

      // Queue test notification
      await UnifiedNotificationService.queueNotification({
        customer_id: parseInt(customer_id),
        notification_type: template.notification_type as any,
        variables: variables || {},
        channels: [template.channel as any]
      });

      res.json({
        success: true,
        message: 'Notifikasi test telah dikirim ke queue'
      });
    } catch (error) {
      console.error('Error testing template:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengirim notifikasi test',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/notification/process-queue
   * Manually process pending notifications (API)
   */
  async processQueue(req: Request, res: Response): Promise<any> {
    try {
      const { NotificationScheduler } = await import('../../services/notification/NotificationScheduler');
      const result = await NotificationScheduler.processNow();

      res.json({
        success: true,
        message: 'Queue processed successfully',
        data: result
      });
    } catch (error) {
      console.error('Error processing queue:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memproses queue',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/notification/whatsapp-status
   * Get WhatsApp service status (API)
   */
  async getWhatsAppStatus(req: Request, res: Response): Promise<any> {
    try {
      const { whatsappService } = await import('../../services/whatsapp/WhatsAppService');
      const waClient = whatsappService;
      const status = waClient.getStatus();
      const qrCode = status.qr;

      res.json({
        success: true,
        data: {
          ...status,
          qrCode: qrCode,
          message: !status.ready
            ? (qrCode
              ? 'WhatsApp client is waiting for QR code scan. Please scan the QR code to activate WhatsApp service.'
              : 'WhatsApp client is not initialized or disconnected. Please check server logs.')
            : 'WhatsApp client is ready and can send messages.'
        }
      });
    } catch (error) {
      console.error('Error getting WhatsApp status:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil status WhatsApp',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/notification/queue-status
   * Get queue status (API)
   */
  async getQueueStatus(req: Request, res: Response): Promise<any> {
    try {
      const connection = await databasePool.getConnection();

      try {
        // Get queue statistics
        const [statsRows] = await connection.query<RowDataPacket[]>(
          `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
           FROM unified_notifications_queue
           WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
        );

        // Get recent pending notifications
        const [pendingRows] = await connection.query<RowDataPacket[]>(
          `SELECT 
            id, customer_id, notification_type, channel, status, 
            error_message, created_at, scheduled_for
           FROM unified_notifications_queue
           WHERE status = 'pending'
           ORDER BY created_at DESC
           LIMIT 20`
        );

        // Get recent failed notifications
        const [failedRows] = await connection.query<RowDataPacket[]>(
          `SELECT 
            id, customer_id, notification_type, channel, status, 
            error_message, created_at, retry_count
           FROM unified_notifications_queue
           WHERE status = 'failed'
           ORDER BY created_at DESC
           LIMIT 10`
        );

        res.json({
          success: true,
          data: {
            statistics: statsRows[0] || {},
            pending: pendingRows,
            failed: failedRows
          }
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error getting queue status:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil status queue',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/notification/debug-customer/:customerId
   * Debug notification for specific customer (API)
   */
  async debugCustomerNotification(req: Request, res: Response): Promise<any> {
    try {
      const { customerId } = req.params;
      const connection = await databasePool.getConnection();

      try {
        const debugInfo: any = {
          customerId: parseInt(customerId),
          steps: []
        };

        // Step 1: Check customer exists
        const [customerRows] = await connection.query<RowDataPacket[]>(
          'SELECT id, name, phone, email, customer_code FROM customers WHERE id = ?',
          [customerId]
        );

        if (customerRows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Customer not found',
            debug: debugInfo
          });
        }

        const customer = customerRows[0];
        debugInfo.customer = {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          customer_code: customer.customer_code
        };
        debugInfo.steps.push({
          step: 1,
          status: 'ok',
          message: 'Customer found'
        });

        // Step 2: Check template exists
        const template = await NotificationTemplateService.getTemplate('customer_created', 'whatsapp');

        if (!template) {
          debugInfo.steps.push({
            step: 2,
            status: 'error',
            message: 'Template customer_created not found or inactive'
          });

          return res.json({
            success: false,
            message: 'Template not found',
            debug: debugInfo
          });
        }

        debugInfo.template = {
          code: template.template_code,
          name: template.template_name,
          is_active: template.is_active
        };
        debugInfo.steps.push({
          step: 2,
          status: 'ok',
          message: 'Template found and active'
        });

        // Step 3: Check WhatsApp status
        const { whatsappService } = await import('../../services/whatsapp/WhatsAppService');
        const waClient = whatsappService;
        const whatsappStatus = waClient.getStatus();
        debugInfo.whatsapp = whatsappStatus;
        debugInfo.steps.push({
          step: 3,
          status: whatsappStatus.ready ? 'ok' : 'error',
          message: whatsappStatus.ready
            ? 'WhatsApp client is ready'
            : 'WhatsApp client is not ready'
        });

        // Step 4: Check queue for this customer
        const [queueRows] = await connection.query<RowDataPacket[]>(
          `SELECT 
            id, notification_type, channel, status, 
            error_message, created_at, retry_count
           FROM unified_notifications_queue
           WHERE customer_id = ?
           ORDER BY created_at DESC
           LIMIT 10`,
          [customerId]
        );

        debugInfo.queue = queueRows;
        debugInfo.steps.push({
          step: 4,
          status: 'ok',
          message: `Found ${queueRows.length} notifications in queue`
        });

        // Step 5: Try to queue a test notification
        if (req.query.test === 'true') {
          try {
            const notificationIds = await UnifiedNotificationService.queueNotification({
              customer_id: parseInt(customerId),
              notification_type: 'customer_created',
              channels: ['whatsapp'],
              variables: {
                customer_name: customer.name,
                customer_code: customer.customer_code || '',
                connection_type: 'PPPoE',
                package_info: '',
                pppoe_info: '',
                ip_info: ''
              },
              priority: 'normal'
            });

            debugInfo.testNotification = {
              success: true,
              notificationIds: notificationIds
            };
            debugInfo.steps.push({
              step: 5,
              status: 'ok',
              message: `Test notification queued (IDs: ${notificationIds.join(', ')})`
            });

            // Try to process immediately
            try {
              const result = await UnifiedNotificationService.sendPendingNotifications(10);
              debugInfo.testProcess = {
                success: true,
                result: result
              };
              debugInfo.steps.push({
                step: 6,
                status: 'ok',
                message: `Processed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`
              });
            } catch (processError: any) {
              debugInfo.testProcess = {
                success: false,
                error: processError.message
              };
              debugInfo.steps.push({
                step: 6,
                status: 'error',
                message: `Process error: ${processError.message}`
              });
            }
          } catch (testError: any) {
            debugInfo.testNotification = {
              success: false,
              error: testError.message
            };
            debugInfo.steps.push({
              step: 5,
              status: 'error',
              message: `Test notification failed: ${testError.message}`
            });
          }
        }

        res.json({
          success: true,
          message: 'Debug information collected',
          debug: debugInfo
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error debugging customer notification:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal melakukan debugging',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/notification/recent-logs
   * Get recent notification logs for analysis (API)
   */
  async getRecentLogs(req: Request, res: Response): Promise<any> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const connection = await databasePool.getConnection();

      try {
        // Get recent queue notifications
        const [queueRows] = await connection.query<RowDataPacket[]>(
          `SELECT 
            unq.id,
            unq.customer_id,
            c.name as customer_name,
            c.phone as customer_phone,
            unq.notification_type,
            unq.channel,
            unq.status,
            unq.error_message,
            unq.retry_count,
            unq.created_at,
            unq.sent_at,
            unq.title,
            LEFT(unq.message, 100) as message_preview
           FROM unified_notifications_queue unq
           LEFT JOIN customers c ON unq.customer_id = c.id
           ORDER BY unq.created_at DESC
           LIMIT ?`,
          [limit]
        );

        // Get recent notification logs (from notification_logs table if exists)
        let notificationLogs: any[] = [];
        try {
          const [logRows] = await connection.query<RowDataPacket[]>(
            `SELECT 
              id,
              customer_id,
              channel,
              recipient,
              template,
              status,
              error_message,
              sent_at,
              created_at,
              LEFT(message, 100) as message_preview
             FROM notification_logs
             WHERE channel = 'whatsapp'
             ORDER BY created_at DESC
             LIMIT ?`,
            [limit]
          );
          notificationLogs = logRows;
        } catch (logError: any) {
          // Table might not exist, that's okay
          console.log('notification_logs table not found or error:', logError.message);
        }

        // Get customer notification logs (from customer_notifications_log if exists)
        let customerLogs: any[] = [];
        try {
          const [customerLogRows] = await connection.query<RowDataPacket[]>(
            `SELECT 
              id,
              customer_id,
              channel,
              notification_type,
              status,
              error_message,
              recipient,
              created_at,
              LEFT(message, 100) as message_preview
             FROM customer_notifications_log
             ORDER BY created_at DESC
             LIMIT ?`,
            [limit]
          );
          customerLogs = customerLogRows;
        } catch (customerLogError: any) {
          // Table might not exist, that's okay
          console.log('customer_notifications_log table not found or error:', customerLogError.message);
        }

        // Get statistics
        const [statsRows] = await connection.query<RowDataPacket[]>(
          `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
           FROM unified_notifications_queue
           WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`
        );

        // Get recent customer_created notifications specifically
        const [customerCreatedRows] = await connection.query<RowDataPacket[]>(
          `SELECT 
            unq.id,
            unq.customer_id,
            c.name as customer_name,
            c.phone as customer_phone,
            unq.status,
            unq.error_message,
            unq.created_at,
            unq.sent_at,
            unq.retry_count
           FROM unified_notifications_queue unq
           LEFT JOIN customers c ON unq.customer_id = c.id
           WHERE unq.notification_type = 'customer_created'
           ORDER BY unq.created_at DESC
           LIMIT 20`
        );

        res.json({
          success: true,
          data: {
            statistics: statsRows[0] || {},
            recentQueue: queueRows,
            recentCustomerCreated: customerCreatedRows,
            notificationLogs: notificationLogs,
            customerLogs: customerLogs,
            summary: {
              totalQueue: queueRows.length,
              totalNotificationLogs: notificationLogs.length,
              totalCustomerLogs: customerLogs.length,
              recentCustomerCreated: customerCreatedRows.length
            }
          }
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error getting recent logs:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil log',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/notification/analyze
   * Analyze notification flow for debugging (API)
   */
  async analyzeNotificationFlow(req: Request, res: Response): Promise<any> {
    try {
      const connection = await databasePool.getConnection();

      try {
        const analysis: any = {
          timestamp: new Date().toISOString(),
          checks: []
        };

        // Check 1: Template exists and active
        const template = await NotificationTemplateService.getTemplate('customer_created', 'whatsapp');
        analysis.checks.push({
          check: 'Template customer_created',
          status: template ? (template.is_active ? 'ok' : 'inactive') : 'not_found',
          details: template ? {
            code: template.template_code,
            name: template.template_name,
            is_active: template.is_active
          } : null
        });

        // Check 2: WhatsApp status
        // Check 2: WhatsApp status
        const { whatsappService } = await import('../../services/whatsapp/WhatsAppService');
        const waClient = whatsappService;
        const whatsappStatus = waClient.getStatus();
        analysis.checks.push({
          check: 'WhatsApp Client',
          status: whatsappStatus.ready ? 'ready' : 'not_ready',
          details: whatsappStatus
        });

        // Check 3: Recent queue status
        const [recentQueue] = await connection.query<RowDataPacket[]>(
          `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
           FROM unified_notifications_queue
           WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`
        );
        analysis.checks.push({
          check: 'Recent Queue (1 hour)',
          status: 'ok',
          details: recentQueue[0] || {}
        });

        // Check 4: Recent customer_created notifications
        const [customerCreated] = await connection.query<RowDataPacket[]>(
          `SELECT 
            id, customer_id, status, error_message, created_at, sent_at, retry_count
           FROM unified_notifications_queue
           WHERE notification_type = 'customer_created'
           ORDER BY created_at DESC
           LIMIT 5`
        );
        analysis.checks.push({
          check: 'Recent customer_created notifications',
          status: customerCreated.length > 0 ? 'found' : 'none',
          details: customerCreated
        });

        // Check 5: Failed notifications with errors
        const [failed] = await connection.query<RowDataPacket[]>(
          `SELECT 
            id, customer_id, notification_type, error_message, created_at, retry_count
           FROM unified_notifications_queue
           WHERE status = 'failed'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
           ORDER BY created_at DESC
           LIMIT 10`
        );
        analysis.checks.push({
          check: 'Failed notifications (1 hour)',
          status: failed.length > 0 ? 'has_errors' : 'no_errors',
          details: failed
        });

        // Summary
        const allOk = analysis.checks.every((c: any) =>
          c.status === 'ok' || c.status === 'ready' || c.status === 'found' || c.status === 'none' || c.status === 'no_errors'
        );

        analysis.summary = {
          allChecksPassed: allOk,
          issues: analysis.checks.filter((c: any) =>
            c.status !== 'ok' && c.status !== 'ready' && c.status !== 'found' && c.status !== 'none' && c.status !== 'no_errors'
          ).map((c: any) => ({
            check: c.check,
            status: c.status,
            details: c.details
          }))
        };

        res.json({
          success: true,
          analysis: analysis
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error analyzing notification flow:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal menganalisis flow notifikasi',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  /**
   * POST /api/notification/retry/:id
   * Retry a failed notification
   */
  async retryNotification(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const connection = await databasePool.getConnection();
      try {
        const [result] = await connection.query(
          "UPDATE unified_notifications_queue SET status = 'pending', retry_count = 0, error_message = NULL WHERE id = ?",
          [id]
        );
        res.json({ success: true, message: 'Notification reset to pending' });
      } finally {
        connection.release();
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/notification/clear-old-queue
   * Clear old pending notifications
   */
  async clearOldQueue(req: Request, res: Response): Promise<any> {
    try {
      const connection = await databasePool.getConnection();
      try {
        // Clear pending notifications older than 7 days
        const [result] = await connection.query(
          "DELETE FROM unified_notifications_queue WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
        );
        res.json({
          success: true,
          message: `Cleared ${(result as any).affectedRows} old pending notifications`
        });
      } finally {
        connection.release();
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/notification/retry-all-failed
   * Retry all failed and skipped notifications
   */
  async retryAllFailed(req: Request, res: Response): Promise<any> {
    try {
      const connection = await databasePool.getConnection();
      try {
        // Reset both failed and skipped notifications to pending
        const [result] = await connection.query(
          "UPDATE unified_notifications_queue SET status = 'pending', retry_count = 0, error_message = NULL WHERE status IN ('failed', 'skipped')"
        );
        res.json({
          success: true,
          message: `Berhasil mereset ${(result as any).affectedRows} notifikasi ke antrian pending`
        });
      } finally {
        connection.release();
      }
    } catch (error: any) {
      console.error('Error retrying all failed notifications:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Gagal mereset semua notifikasi gagal'
      });
    }
  }
}
