/**
 * Notification Template Controller
 * Manages notification templates via web interface
 */
import { Request, Response } from 'express';
export declare class NotificationTemplateController {
    /**
     * GET /notification/history
     * Show notification history/queue page
     */
    showHistoryPage(req: Request, res: Response): Promise<any>;
    /**
     * GET /notification/templates/page
     * Show template management page
     */
    showTemplatesPage(req: Request, res: Response): Promise<any>;
    /**
     * GET /notification/templates/edit/:code
     * Show edit template page
     */
    showEditTemplatePage(req: Request, res: Response): Promise<any>;
    /**
     * GET /notification/templates/create
     * Show create template page
     */
    showCreateTemplatePage(req: Request, res: Response): Promise<any>;
    /**
     * GET /api/notification/templates
     * List all notification templates (API)
     */
    listTemplates(req: Request, res: Response): Promise<any>;
    /**
     * GET /api/notification/templates/:code
     * Get template by code (API)
     */
    getTemplate(req: Request, res: Response): Promise<any>;
    /**
     * POST /api/notification/templates
     * Create new template (API)
     */
    createTemplate(req: Request, res: Response): Promise<any>;
    /**
     * PUT /api/notification/templates/:code
     * Update template (API)
     */
    updateTemplate(req: Request, res: Response): Promise<any>;
    /**
     * DELETE /api/notification/templates/:code
     * Delete template (API)
     */
    deleteTemplate(req: Request, res: Response): Promise<any>;
    /**
     * GET /api/notification/statistics
     * Get notification statistics (API)
     */
    getStatistics(req: Request, res: Response): Promise<any>;
    /**
     * POST /api/notification/test
     * Test notification template (API)
     */
    testTemplate(req: Request, res: Response): Promise<any>;
    /**
     * POST /api/notification/process-queue
     * Manually process pending notifications (API)
     */
    processQueue(req: Request, res: Response): Promise<any>;
    /**
     * GET /api/notification/whatsapp-status
     * Get WhatsApp service status (API)
     */
    getWhatsAppStatus(req: Request, res: Response): Promise<any>;
    /**
     * GET /api/notification/queue-status
     * Get queue status (API)
     */
    getQueueStatus(req: Request, res: Response): Promise<any>;
    /**
     * POST /api/notification/debug-customer/:customerId
     * Debug notification for specific customer (API)
     */
    debugCustomerNotification(req: Request, res: Response): Promise<any>;
    /**
     * GET /api/notification/recent-logs
     * Get recent notification logs for analysis (API)
     */
    getRecentLogs(req: Request, res: Response): Promise<any>;
    /**
     * GET /api/notification/analyze
     * Analyze notification flow for debugging (API)
     */
    analyzeNotificationFlow(req: Request, res: Response): Promise<any>;
    /**
     * POST /api/notification/retry/:id
     * Retry a failed notification
     */
    retryNotification(req: Request, res: Response): Promise<any>;
    /**
     * POST /api/notification/clear-old-queue
     * Clear old pending notifications
     */
    clearOldQueue(req: Request, res: Response): Promise<any>;
    /**
     * POST /api/notification/retry-all-failed
     * Retry all failed and skipped notifications
     */
    retryAllFailed(req: Request, res: Response): Promise<any>;
}
//# sourceMappingURL=NotificationTemplateController.d.ts.map