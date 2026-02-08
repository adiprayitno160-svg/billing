/**
 * Notification Routes
 */

import { Router } from 'express';
import { NotificationTemplateController } from '../controllers/notification/NotificationTemplateController';
import { isAuthenticated } from '../middlewares/authMiddleware';

const templateController = new NotificationTemplateController();

// Page routes router (HTML) - mounted at /notification
const pageRouter = Router();

// Test route WITHOUT auth to verify router is working
pageRouter.get('/test', (req, res) => {
    console.log('[Notification Route] GET /test hit - router is working!');
    res.send('Notification router is working!');
});

// Apply auth middleware AFTER test route
pageRouter.use(isAuthenticated);

// Test route to verify router is working
pageRouter.get('/', (req, res) => {
    console.log('[Notification Route] GET / hit - redirecting to templates');
    res.redirect('/notification/templates');
});

pageRouter.get('/templates', (req, res) => {
    console.log('[Notification Route] GET /templates hit');
    console.log('[Notification Route] Request path:', req.path);
    console.log('[Notification Route] Request originalUrl:', req.originalUrl);
    templateController.showTemplatesPage(req, res);
});
pageRouter.get('/templates/create', (req, res) => {
    console.log('[Notification Route] GET /templates/create hit');
    templateController.showCreateTemplatePage(req, res);
});
pageRouter.get('/templates/edit/:code', (req, res) => {
    console.log('[Notification Route] GET /templates/edit/:code hit', req.params.code);
    templateController.showEditTemplatePage(req, res);
});
pageRouter.get('/history', (req, res) => {
    console.log('[Notification Route] GET /history hit');
    templateController.showHistoryPage(req, res);
});

// API routes router (JSON) - mounted at /api/notification
const apiRouter = Router();
apiRouter.use(isAuthenticated);

apiRouter.get('/templates', (req, res) => templateController.listTemplates(req, res));
apiRouter.get('/templates/:code', (req, res) => templateController.getTemplate(req, res));
apiRouter.post('/templates', (req, res) => templateController.createTemplate(req, res));
apiRouter.put('/templates/:code', (req, res) => templateController.updateTemplate(req, res));
apiRouter.delete('/templates/:code', (req, res) => templateController.deleteTemplate(req, res));

// Statistics
apiRouter.get('/statistics', (req, res) => templateController.getStatistics(req, res));

// Test notification
apiRouter.post('/test', (req, res) => templateController.testTemplate(req, res));

// Process queue manually
apiRouter.post('/process-queue', (req, res) => templateController.processQueue(req, res));

// Get queue status
apiRouter.get('/queue-status', (req, res) => templateController.getQueueStatus(req, res));

// Get WhatsApp status
apiRouter.get('/whatsapp-status', (req, res) => templateController.getWhatsAppStatus(req, res));

// Debug customer notification
apiRouter.post('/debug-customer/:customerId', (req, res) => templateController.debugCustomerNotification(req, res));

// Get recent logs for analysis
apiRouter.get('/recent-logs', (req, res) => {
    console.log('[Notification API] GET /recent-logs hit');
    templateController.getRecentLogs(req, res);
});

// Analyze notification flow
apiRouter.get('/analyze', (req, res) => {
    console.log('[Notification API] GET /analyze hit');
    templateController.analyzeNotificationFlow(req, res);
});

apiRouter.post('/retry/:id', (req, res) => templateController.retryNotification(req, res));
apiRouter.post('/retry-all-failed', (req, res) => templateController.retryAllFailed(req, res));
apiRouter.post('/clear-old-queue', (req, res) => templateController.clearOldQueue(req, res));

// Ensure templates exist (utility endpoint)
apiRouter.post('/templates/ensure', async (req, res) => {
    try {
        const { NotificationTemplateService } = await import('../services/notification/NotificationTemplateService');
        const { ensureNotificationTemplates } = await import('../utils/ensureNotificationTemplates');

        // First try using the utility function
        await ensureNotificationTemplates();

        // Also try direct insert using service
        const templates = [
            {
                template_code: 'customer_created',
                template_name: 'Pelanggan Baru',
                notification_type: 'customer_created',
                channel: 'whatsapp' as const,
                title_template: 'Selamat Datang - {customer_code}',
                message_template: '🎉 *Selamat Datang!*\n\nHalo {customer_name},\n\nTerima kasih telah bergabung dengan layanan internet kami!\n\n📋 *Informasi Akun Anda:*\n🆔 Kode Pelanggan: {customer_code}\n🔌 Tipe Koneksi: {connection_type}{package_info}{pppoe_info}{ip_info}\n\n💡 *Tips:*\n• Simpan informasi ini dengan aman\n• Hubungi kami jika ada pertanyaan\n• Nikmati layanan internet Anda!\n\nTerima kasih,\nTim Support',
                variables: ['customer_name', 'customer_code', 'connection_type', 'package_info', 'pppoe_info', 'ip_info'],
                priority: 'normal' as const,
                is_active: true
            },
            {
                template_code: 'service_blocked',
                template_name: 'Layanan Diblokir',
                notification_type: 'service_blocked',
                channel: 'whatsapp' as const,
                title_template: 'Layanan Internet Diblokir',
                message_template: '⚠️ *Layanan Internet Diblokir*\n\nHalo {customer_name},\n\nLayanan internet Anda telah diblokir karena:\n\n📋 *Alasan:*\n{reason}\n\n📄 *Detail:*\n{details}\n\n💡 *Cara Mengaktifkan Kembali:*\n• Lakukan pembayaran tagihan yang tertunggak\n• Hubungi customer service untuk informasi lebih lanjut\n• Setelah pembayaran, layanan akan otomatis diaktifkan kembali\n\nTerima kasih,\nTim Support',
                variables: ['customer_name', 'reason', 'details'],
                priority: 'high' as const,
                is_active: true
            },
            {
                template_code: 'service_unblocked',
                template_name: 'Layanan Diaktifkan Kembali',
                notification_type: 'service_unblocked',
                channel: 'whatsapp' as const,
                title_template: 'Layanan Internet Diaktifkan Kembali',
                message_template: '✅ *Layanan Internet Diaktifkan Kembali*\n\nHalo {customer_name},\n\nLayanan internet Anda telah diaktifkan kembali!\n\n📋 *Informasi:*\n{details}\n\n💡 *Terima Kasih:*\nTerima kasih telah melakukan pembayaran. Nikmati layanan internet Anda kembali!\n\nJika ada pertanyaan, jangan ragu untuk menghubungi kami.\n\nTerima kasih,\nTim Support',
                variables: ['customer_name', 'details'],
                priority: 'normal' as const,
                is_active: true
            }
        ];

        const results = [];
        for (const template of templates) {
            try {
                // Check if exists
                const existing = await NotificationTemplateService.getTemplateByCode(template.template_code);
                if (!existing) {
                    await NotificationTemplateService.createTemplate(template);
                    results.push({ template_code: template.template_code, status: 'inserted' });
                } else {
                    results.push({ template_code: template.template_code, status: 'already_exists' });
                }
            } catch (error: any) {
                results.push({ template_code: template.template_code, status: 'error', error: error.message });
            }
        }

        res.json({
            success: true,
            message: 'Template check completed',
            results
        });
    } catch (error) {
        console.error('Error ensuring templates:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to ensure templates',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Combined router for backward compatibility (exports page routes)
const router = pageRouter;

// ========== TROUBLE NOTIFICATION ENDPOINTS ==========
// Report trouble/gangguan and notify admin/operators
apiRouter.post('/trouble', async (req, res) => {
    console.log('[Notification API] POST /trouble hit');
    try {
        const { TroubleNotificationService } = await import('../services/notification/TroubleNotificationService');

        const {
            customer_id,
            customer_name,
            customer_phone,
            trouble_type,
            description,
            priority,
            reported_by,
            additional_info
        } = req.body;

        if (!customer_id || !customer_name || !trouble_type || !description) {
            return res.status(400).json({
                success: false,
                error: 'customer_id, customer_name, trouble_type, dan description wajib diisi'
            });
        }

        const result = await TroubleNotificationService.notifyTrouble({
            customer_id: parseInt(customer_id),
            customer_name,
            customer_phone,
            trouble_type,
            description,
            priority: priority || 'medium',
            reported_by: reported_by || 'system',
            additional_info
        });

        res.json(result);
    } catch (error: any) {
        console.error('[Notification API] Error reporting trouble:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Gagal mengirim notifikasi gangguan'
        });
    }
});

// Get list of admin/operators who will receive trouble notifications
apiRouter.get('/admin-operators', async (req, res) => {
    console.log('[Notification API] GET /admin-operators hit');
    try {
        const { TroubleNotificationService } = await import('../services/notification/TroubleNotificationService');

        const operators = await TroubleNotificationService.getAdminOperators();

        res.json({
            success: true,
            total: operators.length,
            data: operators.map(u => ({
                id: u.id,
                username: u.username,
                full_name: u.full_name,
                role: u.role,
                phone: u.phone ? u.phone.substring(0, 4) + '****' + u.phone.slice(-4) : null
            }))
        });
    } catch (error: any) {
        console.error('[Notification API] Error getting admin operators:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Gagal mengambil data operator'
        });
    }
});

// Export both routers
console.log('[Notification Routes] Exporting routers - pageRouter and apiRouter');
console.log('[Notification Routes] API routes registered:', {
    templates: 'GET /templates, GET /templates/:code, POST /templates, PUT /templates/:code, DELETE /templates/:code',
    statistics: 'GET /statistics',
    test: 'POST /test',
    processQueue: 'POST /process-queue',
    queueStatus: 'GET /queue-status',
    whatsappStatus: 'GET /whatsapp-status',
    debugCustomer: 'POST /debug-customer/:customerId',
    recentLogs: 'GET /recent-logs',
    analyze: 'GET /analyze',
    templatesEnsure: 'POST /templates/ensure'
});

export default router;
export { pageRouter, apiRouter };

